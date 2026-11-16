// lib/estudio.ts
// Modo estudio: tarjetas de repaso (flashcards) armadas con lo que quedó de la
// sesión. No se manda la transcripción entera: el resumen, los conceptos, las
// preguntas que hizo el usuario y lo que marcó ya son lo importante, y entran
// en un pedido chico.

import { formatTime } from './utils'
import type { ConceptoSesion, PreguntaSesion, NotaSesion, LineaTranscripcion } from './sesion'
import { notasConMinutos } from './sesion'

export interface Tarjeta {
  pregunta: string
  respuesta: string
}

export const MAX_TARJETAS = 12
const MAX_PREGUNTA = 200
const MAX_RESPUESTA = 500

export function buildFlashcardsPrompt(
  titulo: string,
  resumen: string,
  conceptos: ConceptoSesion[] = [],
  preguntas: PreguntaSesion[] = [],
  notas: NotaSesion[] = [],
  lineas: LineaTranscripcion[] = []
) {
  const bloques = [
    `RESUMEN:\n${resumen}`,
    conceptos.length > 0 &&
      `CONCEPTOS EXPLICADOS:\n${conceptos.map(c => `- ${c.concepto}: ${c.explicacion}`).join('\n')}`,
    preguntas.length > 0 &&
      `PREGUNTAS QUE HIZO EL USUARIO (lo que le costó entender):\n${preguntas
        .map(p => `[${formatTime(p.timestamp_segundos)}] ${p.pregunta}\nRespuesta: ${p.respuesta}`)
        .join('\n\n')}`,
    notas.length > 0 &&
      `LO QUE EL USUARIO MARCÓ COMO IMPORTANTE:\n${notasConMinutos(notas, lineas)}`,
  ].filter(Boolean).join('\n\n')

  return `Sos un asistente que arma tarjetas de repaso (flashcards) para estudiar una clase, reunión o video.

TÍTULO: ${titulo}

${bloques}

Armá entre 6 y ${MAX_TARJETAS} tarjetas, en español.
- Cada tarjeta evalúa UNA sola idea. La pregunta es concreta y la respuesta corta: 1 a 3 oraciones.
- Priorizá lo que el usuario marcó como importante y lo que le costó entender (sus preguntas).
- La respuesta tiene que poder verificarse con el material de arriba. No inventes datos que no están.
- No hagas preguntas sobre el minuto en que se dijo algo ni sobre quién habló.

Respondé SOLO este JSON:
{"tarjetas": [{"pregunta": "...", "respuesta": "..."}]}`
}

// Limpia lo que devuelve el modelo: descarta tarjetas incompletas o repetidas
// y recorta las demasiado largas. Nunca tira error: devuelve lo que sirva.
export function parseFlashcards(raw: unknown): Tarjeta[] {
  const lista = (raw as { tarjetas?: unknown })?.tarjetas
  if (!Array.isArray(lista)) return []

  const vistas = new Set<string>()
  const tarjetas: Tarjeta[] = []
  for (const item of lista) {
    const pregunta = typeof item?.pregunta === 'string' ? item.pregunta.trim() : ''
    const respuesta = typeof item?.respuesta === 'string' ? item.respuesta.trim() : ''
    if (!pregunta || !respuesta) continue
    const clave = pregunta.toLowerCase()
    if (vistas.has(clave)) continue
    vistas.add(clave)
    tarjetas.push({ pregunta: pregunta.slice(0, MAX_PREGUNTA), respuesta: respuesta.slice(0, MAX_RESPUESTA) })
    if (tarjetas.length === MAX_TARJETAS) break
  }
  return tarjetas
}

// Archivo de texto que Anki importa directo (Archivo → Importar): una tarjeta
// por línea, anverso y reverso separados por tabulación.
export function toAnkiTSV(tarjetas: Tarjeta[]): string {
  const limpiar = (t: string) => t.replace(/[\t\r\n]+/g, ' ').trim()
  return tarjetas.map(t => `${limpiar(t.pregunta)}\t${limpiar(t.respuesta)}`).join('\n')
}
