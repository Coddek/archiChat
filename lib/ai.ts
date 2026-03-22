// lib/ai.ts
// Dos funciones principales:
// 1. getEmbedding → convierte texto en vector numérico (Together AI)
// 2. callAI → genera una respuesta de texto (Groq con fallback a Gemini)

import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// ─── EMBEDDINGS ───────────────────────────────────────────────────────────────

// Convierte un texto en un array de 768 números que representa su significado
// Usamos Gemini text-embedding-004 via el SDK oficial de Google
export async function getEmbedding(text: string): Promise<number[]> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  const result = await model.embedContent(text)
  return result.embedding.values // array de 768 números
}

// ─── GENERACIÓN DE TEXTO ──────────────────────────────────────────────────────

// Llama a Groq para generar una respuesta
// Si Groq falla (rate limit, error), intenta automáticamente con Gemini
// Esto garantiza que el chat siempre funcione aunque un proveedor falle
export async function callAI(prompt: string): Promise<string> {

  // Intento 1: Groq — más rápido y con buen contexto
  try {
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
  // Si llegamos acá es porque Groq tuvo algún problema
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
