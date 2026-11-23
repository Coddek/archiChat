// Historial del chat de cada documento (tabla mensajes_chat).
// Funciones puras: qué filas se guardan después de una respuesta y cómo se
// vuelven a armar los mensajes al abrir el documento.

import type { Source } from './rag'

export const MAX_CONTENIDO = 20000 // igual que el CHECK de la tabla

export type FilaMensaje = {
  id?: string
  document_id?: string
  role: string
  content: string
  sources: Source[] | null
  confidence: number | null
  created_at: string
}

export type MensajeGuardado = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
  confidence?: number | null
}

// La pregunta y su respuesta. La respuesta va un milisegundo después para que
// el orden por created_at sea siempre pregunta → respuesta.
export function filasParaGuardar(
  documentId: string,
  pregunta: string,
  respuesta: string,
  sources: Source[],
  confidence: number | null,
  ahora: Date = new Date(),
): FilaMensaje[] {
  if (!respuesta.trim()) return []
  const t = ahora.getTime()
  return [
    {
      document_id: documentId,
      role: 'user',
      content: pregunta.slice(0, MAX_CONTENIDO),
      sources: null,
      confidence: null,
      created_at: new Date(t).toISOString(),
    },
    {
      document_id: documentId,
      role: 'assistant',
      content: respuesta.slice(0, MAX_CONTENIDO),
      sources: sources.length > 0 ? sources : null,
      confidence,
      created_at: new Date(t + 1).toISOString(),
    },
  ]
}

export function mensajesDesdeFilas(filas: FilaMensaje[]): MensajeGuardado[] {
  return filas
    .filter(f => f.role === 'user' || f.role === 'assistant')
    .map((f, i) => ({
      id: f.id ?? `guardado-${i}`,
      role: f.role as 'user' | 'assistant',
      content: f.content,
      ...(f.role === 'assistant' ? { sources: f.sources ?? undefined, confidence: f.confidence } : {}),
    }))
}
