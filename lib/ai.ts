// lib/ai.ts
// Funciones principales:
// 1. getEmbedding → convierte texto en vector numérico (Gemini)
// 2. callAI       → genera una respuesta de texto completa (Groq con fallback a Gemini)
// 3. streamAnswer → genera la respuesta del chat token por token, con o sin búsqueda web
//
// Todas las funciones aceptan keys opcionales del usuario.
// Si no se pasan, usan las variables de entorno del servidor.
// Los nombres de los modelos están en lib/models.ts.

import Groq from 'groq-sdk'
import { MODELS } from './models'

export interface UserKeys {
  groq?:   string
  gemini?: string
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// 'doc' → respuesta normal (RAG o pregunta general)
// 'web' → el modelo puede buscar en internet
export type AnswerMode = 'doc' | 'web'

// ─── EMBEDDINGS ───────────────────────────────────────────────────────────────

// Convierte un texto en un array de 3072 números que representa su significado
export async function getEmbedding(text: string, geminiKey?: string): Promise<number[]> {
  const key = geminiKey || process.env.GEMINI_API_KEY!
  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(key)
  const model = genAI.getGenerativeModel({ model: MODELS.embedding })
  const result = await model.embedContent(text)
  return result.embedding.values
}

// ─── GEMINI (fallback) ────────────────────────────────────────────────────────

// Llama a Gemini con una conversación. Con search=true activa Google Search.
async function callGemini(
  messages: ChatMessage[],
  geminiKey: string,
  model: string,
  search = false
): Promise<string> {
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n')
  const contents = messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': geminiKey },
      body: JSON.stringify({
        contents,
        ...(system && { systemInstruction: { parts: [{ text: system }] } }),
        ...(search && { tools: [{ google_search: {} }] }),
      }),
    }
  )
  const data = await response.json()
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? '')
    .join('')
  if (!text) throw new Error(data.error?.message ?? `Gemini ${model} no devolvió texto`)
  return text
}

// ─── GENERACIÓN DE TEXTO ──────────────────────────────────────────────────────

// Genera una respuesta completa. Groq primero; si falla, Gemini.
export async function callAI(
  prompt: string,
  keys?: UserKeys,
  model: string = MODELS.groqChat
): Promise<string> {
  const groqKey   = keys?.groq   || process.env.GROQ_API_KEY!
  const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY!

  try {
    const groq = new Groq({ apiKey: groqKey })
    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1024,
      reasoning_effort: 'low',
    })
    return response.choices[0].message.content ?? ''
  } catch (error) {
    console.warn(`Groq ${model} falló, intentando con Gemini...`, error)
  }

  try {
    return await callGemini([{ role: 'user', content: prompt }], geminiKey, MODELS.geminiFallback)
  } catch (error) {
    console.error('Gemini también falló', error)
    throw new Error('Todos los proveedores de IA fallaron')
  }
}

// ─── RESPUESTA DEL CHAT (STREAMING) ───────────────────────────────────────────

// browser_search agrega marcas de cita tipo 【1†L3-L4】 que no sirven al usuario
function cleanCitations(text: string): string {
  return text.replace(/【[^】]*】/g, '')
}

// Genera la respuesta del chat como un stream de texto.
// - 'doc': Groq en streaming; si falla antes de empezar, Gemini.
// - 'web': Groq con browser_search; si falla, Gemini con Google Search;
//          si también falla, Gemini sin búsqueda.
export async function* streamAnswer(
  messages: ChatMessage[],
  mode: AnswerMode,
  keys?: UserKeys
): AsyncGenerator<string> {
  const groq      = new Groq({ apiKey: keys?.groq || process.env.GROQ_API_KEY! })
  const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY!

  if (mode === 'web') {
    // Sin streaming: hay que limpiar las citas del texto completo
    try {
      const response = await groq.chat.completions.create({
        model: MODELS.groqFast,
        messages,
        max_tokens: 2048,
        tools: [{ type: 'browser_search' }],
      })
      const text = response.choices[0].message.content
      if (text) { yield cleanCitations(text); return }
    } catch (error) {
      console.warn('Búsqueda web con Groq falló, probando Gemini con Google Search...', error)
    }
    try {
      yield await callGemini(messages, geminiKey, MODELS.geminiSearch, true)
      return
    } catch (error) {
      console.warn('Búsqueda web con Gemini falló, respondiendo sin búsqueda...', error)
    }
    yield await callGemini(messages, geminiKey, MODELS.geminiFallback)
    return
  }

  // Si Groq ya mandó texto y se corta a la mitad, no caemos a Gemini
  // (el usuario vería la respuesta duplicada)
  let started = false
  try {
    const stream = await groq.chat.completions.create({
      model: MODELS.groqChat,
      messages,
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
      reasoning_effort: 'low',
    })
    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content
      if (text) { started = true; yield text }
    }
    return
  } catch (error) {
    if (started) throw error
    console.warn(`Groq ${MODELS.groqChat} falló, intentando con Gemini...`, error)
  }
  yield await callGemini(messages, geminiKey, MODELS.geminiFallback)
}
