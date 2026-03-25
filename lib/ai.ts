// lib/ai.ts
// Dos funciones principales:
// 1. getEmbedding → convierte texto en vector numérico (Gemini)
// 2. callAI → genera una respuesta de texto (Groq con fallback a Gemini)
//
// Todas las funciones aceptan keys opcionales del usuario.
// Si no se pasan, usan las variables de entorno del servidor.

import Groq from 'groq-sdk'

export interface UserKeys {
  groq?:   string
  gemini?: string
}

// ─── EMBEDDINGS ───────────────────────────────────────────────────────────────

// Convierte un texto en un array de 768 números que representa su significado
export async function getEmbedding(text: string, geminiKey?: string): Promise<number[]> {
  const key = geminiKey || process.env.GEMINI_API_KEY!
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  const result = await model.embedContent(text)
  return result.embedding.values
}

// ─── GENERACIÓN DE TEXTO ──────────────────────────────────────────────────────

// Llama a Groq para generar una respuesta.
// Si Groq falla (rate limit, error), intenta automáticamente con Gemini Flash.
export async function callAI(prompt: string, keys?: UserKeys): Promise<string> {
  const groqKey   = keys?.groq   || process.env.GROQ_API_KEY!
  const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY!

  // Intento 1: Groq — más rápido y con buen contexto
  try {
    const groq = new Groq({ apiKey: groqKey })
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    })
    return response.choices[0].message.content ?? ''
  } catch (error) {
    console.warn('Groq falló, intentando con Gemini...', error)
  }

  // Intento 2: Gemini Flash — fallback gratuito
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      }
    )
    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  } catch (error) {
    console.error('Gemini también falló', error)
    throw new Error('Todos los proveedores de IA fallaron')
  }
}

// ─── GENERACIÓN CON BÚSQUEDA WEB ──────────────────────────────────────────────

// Usa Groq Compound Mini — modelo con acceso a internet en tiempo real.
// Lo usamos cuando la pregunta no está relacionada al documento activo.
export async function callAIWithSearch(prompt: string, keys?: UserKeys): Promise<string> {
  const groqKey = keys?.groq || process.env.GROQ_API_KEY!

  try {
    const groq = new Groq({ apiKey: groqKey })
    const response = await groq.chat.completions.create({
      model: 'compound-beta-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
    })
    return response.choices[0].message.content ?? ''
  } catch (error) {
    // Si Compound falla, caemos al modelo normal sin búsqueda web
    console.warn('Compound Mini falló, usando Llama sin búsqueda web...', error)
    return callAI(prompt, keys)
  }
}
