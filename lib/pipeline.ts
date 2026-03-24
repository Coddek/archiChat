// lib/pipeline.ts
// Orquesta todo el proceso de indexación de un documento:
// extracción de texto → división en chunks → embeddings → guardado en Supabase

import { createClient } from '@supabase/supabase-js'
import { chunkText } from './chunker'
import { extractFromPDF, extractFromText, extractFromURL } from './extractor'
import { getEmbedding } from './ai'

// Usamos la service role key porque este código corre en el servidor
// y necesita saltear RLS para escribir los chunks
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

type SourceType = 'pdf' | 'text' | 'url'

interface ProcessInput {
  documentId: string
  sourceType: SourceType
  content: string | Buffer
}

export async function processDocument({ documentId, sourceType, content }: ProcessInput) {

  // PASO 1: Extraer texto según el tipo de fuente
  // Cada tipo necesita una estrategia distinta de extracción
  let rawText: string

  if (sourceType === 'pdf') {
    rawText = await extractFromPDF(content as Buffer)
  } else if (sourceType === 'url') {
    rawText = await extractFromURL(content as string)
  } else {
    rawText = await extractFromText(content as string)
  }

  if (!rawText || rawText.length < 50) {
    throw new Error('No se pudo extraer texto suficiente del documento')
  }

  // PASO 2: Dividir el texto en chunks con overlap
  // Después de esto tenemos un array de strings, cada uno de ~1500 chars
  const chunks = chunkText(rawText)
  console.log(`Documento dividido en ${chunks.length} chunks`)

  // PASO 3: Por cada chunk, generar su embedding y guardarlo en Supabase
  // Agregamos un delay de 1s cada 10 chunks para no superar el rate limit de Gemini
  for (let i = 0; i < chunks.length; i++) {

    if (i > 0 && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }

    // Convertimos el texto del chunk en un vector de 3072 números
    const embedding = await getEmbedding(chunks[i])

    // Guardamos el chunk + su vector en la tabla "chunks"
    const { error } = await supabase.from('chunks').insert({
      document_id: documentId,
      content: chunks[i],
      embedding,           // el vector que permite buscar por significado
      chunk_index: i,      // posición en el documento original
    })

    if (error) throw error

    console.log(`Chunk ${i + 1}/${chunks.length} procesado`)
  }

  // PASO 4: Guardamos los primeros 5000 chars del texto original en el documento
  // Útil para mostrar un preview y para debug
  await supabase
    .from('documents')
    .update({ raw_content: rawText.slice(0, 5000) })
    .eq('id', documentId)

  return { chunksProcessed: chunks.length }
}
