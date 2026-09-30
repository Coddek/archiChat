// lib/models.ts
// Único lugar donde se definen los modelos de IA que usa la app.
// Si un proveedor retira un modelo, se cambia acá y listo.
//
// Regla del proyecto: solo modelos gratis (free tier permanente) y estables
// (sin "preview" ni alias "-latest"). Probados con keys free el 2026-09-30.

export const MODELS = {
  // Groq — respuestas del chat (RAG y preguntas generales)
  groqChat:   'openai/gpt-oss-120b',
  // Groq — tareas cortas (clasificar intención, sugerir preguntas) y búsqueda web
  groqFast:   'openai/gpt-oss-20b',

  // Gemini — fallback cuando Groq falla (rápido, ~1s)
  geminiFallback: 'gemini-3.5-flash-lite',
  // Gemini — búsqueda web de respaldo y OCR de imágenes
  // (google_search no tiene cuota free en 3.5-flash-lite)
  geminiSearch:   'gemini-2.5-flash',
  geminiVision:   'gemini-2.5-flash',

  // Gemini — embeddings (3072 dims). Cambiarlo obliga a re-generar todos los chunks.
  embedding: 'gemini-embedding-001',
} as const
