// lib/rag.ts
// El corazón del sistema RAG:
// recibe una pregunta, busca los fragmentos relevantes del documento,
// y genera una respuesta basada ÚNICAMENTE en esos fragmentos

import { createClient } from '@supabase/supabase-js'
import { getEmbedding, callAI, callAIWithSearch } from './ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface RAGResult {
  answer: string
  sources: Array<{
    content: string
    chunk_index: number
    similarity: number
  }>
}

export async function ragQuery(
  question: string,
  documentId: string,
  documentTitle?: string
): Promise<RAGResult> {

  // PASO 1: Convertir la pregunta en un vector
  // La misma lógica que usamos para los chunks — así podemos comparar
  const questionEmbedding = await getEmbedding(question)

  // PASO 2: Buscar los 4 chunks más similares en Supabase
  // match_chunks compara el vector de la pregunta contra todos los chunks
  // del documento y devuelve los más cercanos semánticamente
  const { data: relevantChunks, error } = await supabase.rpc('match_chunks', {
    query_embedding: questionEmbedding,
    match_document_id: documentId,
    match_count: 4,
  })

  if (error) throw error

  // Si no encontró nada relevante, avisamos sin inventar
  if (!relevantChunks || relevantChunks.length === 0) {
    return {
      answer: 'No encontré información relevante en el documento para responder esa pregunta.',
      sources: [],
    }
  }

  // PASO 3: Armar el contexto con los chunks encontrados
  // Los numeramos para que la IA pueda referenciarlos
  const context = relevantChunks
    .map((chunk: any, i: number) => `[Fragmento ${i + 1}]:\n${chunk.content}`)
    .join('\n\n---\n\n')

  // Calculamos la similitud máxima encontrada
  // Si es muy baja, la pregunta probablemente no tiene que ver con el documento
  const maxSimilarity = Math.max(...relevantChunks.map((c: any) => c.similarity))
  const isRelevantToDoc = maxSimilarity > 0.3

  // Detectamos si la pregunta requiere información de internet usando la propia IA.
  // Le preguntamos a Llama (rápido y gratis) que clasifique la intención.
  // Así no dependemos de keywords hardcodeadas — entiende lenguaje natural.
  const intentResponse = await callAI(
    `Clasificá la siguiente pregunta en UNA de estas categorías. Respondé SOLO con la palabra, sin explicación:
- WEB: si el usuario pide buscar en internet, comparar precios, ver otros sitios, info actual, o dice "buscá", "googleá", "chequeá online", etc.
- DOC: si pregunta sobre el contenido del documento
- GENERAL: cualquier otra pregunta

Pregunta: "${question}"
Categoría:`
  )
  const intent = intentResponse.trim().toUpperCase()
  const asksForWebSearch = intent.includes('WEB')

  // PASO 4: Construir el prompt y elegir el modelo según el tipo de pregunta
  let answer: string

  if (asksForWebSearch) {
    // Incluimos contexto del documento para que sepa de qué está hablando el usuario
    const docContext = documentTitle
      ? `El usuario está viendo un documento llamado "${documentTitle}". Contexto relevante: ${relevantChunks[0]?.content?.slice(0, 300) ?? ''}`
      : ''

    const prompt = `Sos archiChat. El usuario pide información de internet.
${docContext}
Buscá en la web la información actualizada y respondé en español con datos reales.

PREGUNTA: ${question}

RESPUESTA:`
    answer = await callAIWithSearch(prompt)

  } else if (isRelevantToDoc) {
    // Pregunta sobre el documento — usamos RAG con contexto
    const prompt = `Sos archiChat, un asistente inteligente para analizar documentos.
Respondé la siguiente pregunta usando principalmente la información del contexto del documento.
Podés complementar con tu conocimiento general si es necesario, pero priorizá el contenido del documento.
Respondé en español, de forma clara y directa. Usá markdown para formatear si ayuda a la claridad.

CONTEXTO DEL DOCUMENTO:
${context}

PREGUNTA: ${question}

RESPUESTA:`
    answer = await callAI(prompt)

  } else {
    // Pregunta general — Compound Mini responde con conocimiento general y web si hace falta
    const prompt = `Sos archiChat, un asistente inteligente.
Respondé la siguiente pregunta en español, de forma clara, directa y útil.

PREGUNTA: ${question}

RESPUESTA:`
    answer = await callAIWithSearch(prompt)
  }

  // PASO 6: Devolver la respuesta + las fuentes usadas
  // Las fuentes le muestran al usuario qué fragmentos del documento usó la IA
  // Eso genera confianza — el usuario puede verificar la respuesta
  return {
    answer,
    sources: relevantChunks.map((chunk: any) => ({
      content: chunk.content.slice(0, 200) + '...',
      chunk_index: chunk.chunk_index,
      similarity: Math.round(chunk.similarity * 100),
    })),
  }
}
