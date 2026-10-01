// lib/sesion.ts
// Lo que pasa al finalizar una sesión: resumen + documento para el chat normal.

import { formatTime } from './utils'

export interface LineaTranscripcion {
  texto: string
  timestamp_segundos: number
}

export interface ConceptoSesion {
  concepto: string
  explicacion: string
  timestamp_segundos: number
}

export interface PreguntaSesion {
  pregunta: string
  respuesta: string
  timestamp_segundos: number
}

const transcripcionConMinutos = (lineas: LineaTranscripcion[]) =>
  lineas.map(l => `[${formatTime(l.timestamp_segundos)}] ${l.texto}`).join('\n')

const conceptosConMinutos = (conceptos: ConceptoSesion[]) =>
  conceptos.map(c => `[${formatTime(c.timestamp_segundos)}] **${c.concepto}**: ${c.explicacion}`).join('\n')

const preguntasConMinutos = (preguntas: PreguntaSesion[]) =>
  preguntas
    .map(p => `[${formatTime(p.timestamp_segundos)}] Pregunta: ${p.pregunta}\nRespuesta: ${p.respuesta}`)
    .join('\n\n')

// Prompt del resumen final. Las preguntas en vivo muestran qué le costó entender
// al usuario: se usan para armar la sección "Para repasar".
export function buildSummaryPrompt(
  titulo: string,
  lineas: LineaTranscripcion[],
  preguntas: PreguntaSesion[],
  conceptos: ConceptoSesion[] = []
) {
  return `Sos un asistente que crea resúmenes de clases, reuniones y videos.
La transcripción es automática: puede tener errores en nombres técnicos (por ejemplo "Cloud Code" en vez de "Claude Code"). Si el error es obvio por el contexto, usá el nombre correcto.

TÍTULO: ${titulo}

TRANSCRIPCIÓN COMPLETA (con minutos):
${transcripcionConMinutos(lineas)}
${preguntas.length > 0 ? `\nPREGUNTAS QUE HIZO EL USUARIO DURANTE LA SESIÓN (muestran qué le costó entender):\n${preguntasConMinutos(preguntas)}\n` : ''}${conceptos.length > 0 ? `\nCONCEPTOS DETECTADOS DURANTE LA SESIÓN (nombres bien escritos):\n${conceptosConMinutos(conceptos)}\n` : ''}
Creá un resumen en markdown, en español, con este formato exacto:

## Resumen general
2 o 3 oraciones con la idea principal.

## Puntos clave
- Cada punto con el minuto entre paréntesis, por ejemplo (03:40)

## Decisiones o conclusiones
- Solo si las hay. Si no hay, omití esta sección entera.

## Términos importantes
- **Término**: explicación breve.
${preguntas.length > 0 ? `
## Para repasar
- A partir de las preguntas del usuario: qué conviene repasar y por qué.
` : ''}
Respondé solo con el markdown, sin texto antes ni después.`
}

// Texto del documento que se indexa para el chat normal. Las marcas [mm:ss]
// quedan en los fragmentos, así el chat puede citar el minuto.
export function buildSessionDocument(
  titulo: string,
  fecha: string,
  resumen: string,
  lineas: LineaTranscripcion[],
  preguntas: PreguntaSesion[],
  conceptos: ConceptoSesion[] = []
) {
  const cuando = new Date(fecha).toLocaleString('es-AR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires',
  })
  return `# ${titulo}
Transcripción de una sesión en vivo (video, clase o reunión) del ${cuando}.

${resumen}

## Transcripción completa
${transcripcionConMinutos(lineas)}
${conceptos.length > 0 ? `\n## Conceptos explicados durante la sesión\n${conceptosConMinutos(conceptos)}\n` : ''}${preguntas.length > 0 ? `\n## Preguntas hechas durante la sesión\n${preguntasConMinutos(preguntas)}\n` : ''}`
}
