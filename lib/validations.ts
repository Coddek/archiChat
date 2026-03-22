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
