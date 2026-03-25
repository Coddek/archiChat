// lib/rag.ts
// Prepara el contexto RAG para una pregunta:
// embed → buscar chunks → detectar intención → armar prompt
// La llamada a la IA la hace el route con streaming

import { createClient } from '@supabase/supabase-js'
import { getEmbedding, callAI } from './ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Source = {
  content: string
  chunk_index: number
  similarity: number
}

// Lo que devuelve prepareRagPrompt — todo lo necesario para que el route
// pueda hacer el streaming sin lógica adicional
export interface RagContext {
  prompt: string
  model: string
  sources: Source[]
  confidence: number | null  // null si la pregunta no es sobre el doc
}

export async function prepareRagPrompt(
  question: string,
  documentId: string,
  documentTitle?: string
): Promise<RagContext> {

  // PASO 1: Convertir la pregunta en vector
  const questionEmbedding = await getEmbedding(question)

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
      model: 'llama-3.3-70b-versatile',
      sources: [],
      confidence: null,
    }
  }

  // PASO 3: Calcular similitud máxima para saber si la pregunta es relevante al doc
  const maxSimilarity = Math.max(...relevantChunks.map((c: any) => c.similarity))
  const isRelevantToDoc = maxSimilarity > 0.3

  // PASO 4: Detectar intención — ¿el usuario quiere buscar en internet?
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

  // Armamos los sources para mostrarle al usuario qué fragmentos se usaron
  const sources: Source[] = relevantChunks.map((chunk: any) => ({
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
${docContext}
Buscá en la web la información actualizada y respondé en español con datos reales.

PREGUNTA: ${question}

RESPUESTA:`,
      model: 'compound-beta-mini',
      sources,
      confidence: null,
    }
  }

  if (isRelevantToDoc) {
    const context = relevantChunks
      .map((chunk: any, i: number) => `[Fragmento ${i + 1}]:\n${chunk.content}`)
      .join('\n\n---\n\n')

    return {
      prompt: `Sos archiChat, un asistente inteligente para analizar documentos.
Respondé la siguiente pregunta usando principalmente la información del contexto del documento.
Podés complementar con tu conocimiento general si es necesario, pero priorizá el contenido del documento.
Respondé en español, de forma clara y directa. Usá markdown para formatear si ayuda a la claridad.

CONTEXTO DEL DOCUMENTO:
${context}

PREGUNTA: ${question}

RESPUESTA:`,
      model: 'llama-3.3-70b-versatile',
      sources,
      confidence: Math.round(maxSimilarity * 100),
    }
  }

  // Pregunta general — usa compound para web search automático si hace falta
  return {
    prompt: `Sos archiChat, un asistente inteligente.
Respondé la siguiente pregunta en español, de forma clara, directa y útil.

PREGUNTA: ${question}

RESPUESTA:`,
    model: 'compound-beta-mini',
    sources,
    confidence: null,
  }
}
