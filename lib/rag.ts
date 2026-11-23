// lib/rag.ts
// Prepara el contexto RAG para una pregunta:
// embed → buscar chunks → detectar intención → armar prompt
// La llamada a la IA la hace el route con streaming

import { createClient } from '@supabase/supabase-js'
import { getEmbedding, callAI } from './ai'
import type { UserKeys, AnswerMode } from './ai'
import { MODELS } from './models'
import { esPreguntaGeneral, repartirIndices } from './respuesta'

// El chat no interpreta HTML: se le pide al modelo que no lo use
const SIN_HTML = 'No uses etiquetas HTML (como <br>); en las tablas, si una celda necesita varias ideas, separalas con punto y coma.'

// Fragmentos tomados de principio a fin del documento, en orden
async function fragmentosRepartidos(documentId: string, cantidad: number) {
  const { data: indices } = await supabase
    .from('chunks')
    .select('chunk_index')
    .eq('document_id', documentId)
    .order('chunk_index')
  if (!indices?.length) return []
  const elegidos = repartirIndices(indices.length, cantidad).map(i => indices[i].chunk_index)
  const { data } = await supabase
    .from('chunks')
    .select('content, chunk_index')
    .eq('document_id', documentId)
    .in('chunk_index', elegidos)
    .order('chunk_index')
  return (data ?? []) as { content: string; chunk_index: number }[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Source = {
  content: string
  chunk_index: number
  similarity: number
}

type Chunk = {
  content: string
  chunk_index: number
  similarity: number
}

// Lo que devuelve prepareRagPrompt — todo lo necesario para que el route
// pueda hacer el streaming sin lógica adicional
export interface RagContext {
  prompt: string
  mode: AnswerMode
  sources: Source[]
  confidence: number | null  // null si la pregunta no es sobre el doc
}

export async function prepareRagPrompt(
  question: string,
  documentId: string,
  documentTitle?: string,
  keys?: UserKeys,
  userContext = '',      // fecha de hoy y país del usuario (lo arma el route)
  previousQuestion = ''  // para clasificar bien preguntas de seguimiento ("¿y el blue?")
): Promise<RagContext> {

  // Pregunta sobre el documento entero ("¿de qué trata?", "resumen"): la
  // búsqueda por similitud elegiría 4 fragmentos al azar. Se usan fragmentos
  // repartidos por todo el documento y no se mide respaldo (no aplica).
  if (esPreguntaGeneral(question)) {
    const panorama = await fragmentosRepartidos(documentId, 6)
    if (panorama.length > 0) {
      return {
        prompt: `Sos archiChat, un asistente para analizar documentos.
Te paso fragmentos tomados de distintas partes del documento${documentTitle ? ` "${documentTitle}"` : ''}, en orden.
Respondé la pregunta dando una visión de conjunto del documento entero, no de un fragmento suelto.
Ignorá textos de navegación de páginas web (botones, menús, "compartir", "descargar") si aparecen.
Respondé en español, de forma clara y directa. Usá markdown si ayuda a la claridad.
${SIN_HTML}

FRAGMENTOS DEL DOCUMENTO:
${panorama.map((c, i) => `[Parte ${i + 1}]:\n${c.content}`).join('\n\n---\n\n')}

PREGUNTA: ${question}

RESPUESTA:`,
        mode: 'doc',
        sources: panorama.map(c => ({ content: c.content.slice(0, 300), chunk_index: c.chunk_index, similarity: 0 })),
        confidence: null,
      }
    }
  }

  // PASO 1: Convertir la pregunta en vector
  const questionEmbedding = await getEmbedding(question, keys?.gemini)

  // PASO 2: Buscar los 4 chunks más similares
  const { data: relevantChunks, error } = await supabase.rpc('match_chunks', {
    query_embedding: questionEmbedding,
    match_document_id: documentId,
    match_count: 4,
  })

  if (error) throw error

  if (!relevantChunks || relevantChunks.length === 0) {
    return {
      prompt: `El usuario preguntó: "${question}". No hay fragmentos relevantes en el documento. Respondé en español diciendo que no encontraste información sobre eso en el documento.`,
      mode: 'doc',
      sources: [],
      confidence: null,
    }
  }

  // PASO 3: Calcular similitud máxima para saber si la pregunta es relevante al doc
  const maxSimilarity = Math.max(...relevantChunks.map((c: Chunk) => c.similarity))
  const isRelevantToDoc = maxSimilarity > 0.3

  // PASO 4: Detectar intención — ¿el usuario quiere buscar en internet?
  const intentResponse = await callAI(
    `Clasificá la siguiente pregunta en UNA de estas categorías. Respondé SOLO con la palabra, sin explicación:
- WEB: si el usuario pide buscar en internet, comparar precios, ver otros sitios, info actual, o dice "buscá", "googleá", "chequeá online", etc.
- DOC: si pregunta sobre el contenido del documento
- GENERAL: cualquier otra pregunta

Si la pregunta es un seguimiento de la anterior, clasificala según la anterior.
${previousQuestion ? `Pregunta anterior: "${previousQuestion}"
` : ''}Pregunta: "${question}"
Categoría:`,
    keys,
    MODELS.groqFast
  )
  const intent = intentResponse.trim().toUpperCase()
  const asksForWebSearch = intent.includes('WEB')

  // Armamos los sources para mostrarle al usuario qué fragmentos se usaron
  const sources: Source[] = relevantChunks.map((chunk: Chunk) => ({
    content: chunk.content.slice(0, 300),
    chunk_index: chunk.chunk_index,
    similarity: Math.round(chunk.similarity * 100),
  }))

  // PASO 5: Elegir prompt y modelo según la intención detectada

  if (asksForWebSearch) {
    const docContext = documentTitle
      ? `El usuario está viendo un documento llamado "${documentTitle}". Contexto relevante: ${relevantChunks[0]?.content?.slice(0, 300) ?? ''}`
      : ''

    return {
      prompt: `Sos archiChat. El usuario pide información de internet.
${userContext}
${docContext}
Buscá en la web la información actualizada y respondé en español con datos reales.
Si la pregunta depende del lugar (precios, moneda, clima, noticias), asumí el país del usuario salvo que diga otro.
Usá los datos más recientes que encuentres y aclará de qué fecha son.

PREGUNTA: ${question}

RESPUESTA:`,
      mode: 'web',
      // La respuesta sale de internet, no del documento: no mostramos fragmentos
      sources: [],
      confidence: null,
    }
  }

  if (isRelevantToDoc) {
    const context = relevantChunks
      .map((chunk: Chunk, i: number) => `[Fragmento ${i + 1}]:\n${chunk.content}`)
      .join('\n\n---\n\n')

    return {
      prompt: `Sos archiChat, un asistente inteligente para analizar documentos.
Respondé la siguiente pregunta usando principalmente la información del contexto del documento.
Podés complementar con tu conocimiento general si es necesario, pero priorizá el contenido del documento.
Respondé en español, de forma clara y directa. Usá markdown para formatear si ayuda a la claridad.
${SIN_HTML}
${userContext}

CONTEXTO DEL DOCUMENTO:
${context}

PREGUNTA: ${question}

RESPUESTA:`,
      mode: 'doc',
      sources,
      confidence: Math.round(maxSimilarity * 100),
    }
  }

  // Pregunta general — modo web: el modelo decide si hace falta buscar en internet
  return {
    prompt: `Sos archiChat, un asistente inteligente.
Respondé la siguiente pregunta en español, de forma clara, directa y útil.
${userContext}
Si la pregunta depende del lugar o de datos actuales, buscá en internet y asumí el país del usuario salvo que diga otro.

PREGUNTA: ${question}

RESPUESTA:`,
    mode: 'web',
    sources: [],
    confidence: null,
  }
}
