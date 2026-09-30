// lib/validations.ts
// Schemas de Zod que definen la "forma" válida de los datos que recibe la app.
// Se usan tanto en los formularios del frontend como en las API routes del backend.
// Así validamos en un solo lugar y reutilizamos en todos lados.

import { z } from 'zod'

// Schema para crear un documento nuevo
// Define exactamente qué campos son obligatorios y qué formato deben tener
export const DocumentSchema = z.object({
  title: z
    .string()
    .min(3, 'El título debe tener al menos 3 caracteres')
    .max(100, 'El título no puede superar los 100 caracteres'),

  sourceType: z.enum(['pdf', 'text', 'url']),

  // Para URLs: validamos que sea una URL real
  // Para texto/pdf: validamos que tenga contenido mínimo
  content: z.string().min(1, 'El contenido no puede estar vacío'),
}).refine(
  // .refine() permite validaciones que dependen de más de un campo a la vez
  // Si el tipo es URL, el contenido tiene que ser una URL válida
  (data) => {
    if (data.sourceType === 'url') {
      try {
        new URL(data.content)
        return true
      } catch {
        return false
      }
    }
    // Para texto plano, exigimos al menos 50 caracteres de contenido
    if (data.sourceType === 'text') {
      return data.content.length >= 50
    }
    return true // PDF se valida aparte (es un archivo, no texto)
  },
  {
    message: 'Si el tipo es URL, ingresá una URL válida. Si es texto, debe tener al menos 50 caracteres.',
    path: ['content'],
  }
)

// Schema para el mensaje que manda el usuario en el chat
export const MessageSchema = z.object({
  question: z
    .string()
    .min(2, 'La pregunta debe tener al menos 2 caracteres')
    .max(2000, 'La pregunta no puede superar los 2000 caracteres'),
})

// Tipos TypeScript inferidos desde los schemas
// Así no tenemos que definir los tipos dos veces
export type DocumentInput = z.infer<typeof DocumentSchema>
export type MessageInput = z.infer<typeof MessageSchema>

// Schema para cada tramo de audio que llega a /api/transcribir (ArchiChat Sessions)
// 4 MB: Vercel rechaza cuerpos de más de 4,5 MB; un tramo de 10 s pesa ~150 KB
export const MAX_AUDIO_BYTES = 4 * 1024 * 1024

export const TranscripcionSchema = z.object({
  sesionId: z.string().uuid('Sesión inválida'),
  timestampSegundos: z.coerce.number().int().min(0),
  textoPrevio: z.string().max(1000).default(''),
  audio: z
    .instanceof(File, { message: 'Falta el audio' })
    .refine(f => f.size > 0, 'El audio está vacío')
    .refine(f => f.size <= MAX_AUDIO_BYTES, 'El tramo de audio es demasiado grande'),
})

// Schema para las preguntas rápidas durante una sesión en vivo
export const PreguntaSesionSchema = z.object({
  sesionId: z.string().uuid('Sesión inválida'),
  pregunta: z
    .string()
    .min(2, 'La pregunta debe tener al menos 2 caracteres')
    .max(500, 'La pregunta no puede superar los 500 caracteres'),
  // Últimas preguntas y respuestas, para entender seguimientos ("¿y eso?")
  historial: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(4000) }))
    .max(6)
    .default([]),
  // Minuto de la sesión en que se hace la pregunta
  segundoActual: z.number().int().min(0).default(0),
})
