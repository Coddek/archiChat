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
  search = false,
  timeoutMs = 25_000   // gemini-2.5-flash con búsqueda a veces tarda más de 1 minuto
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
      signal: AbortSignal.timeout(timeoutMs),
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
// reasoningEffort: cuánto "piensa" gpt-oss antes de responder ('medium' es más
// preciso y tarda 1-2 s más; conviene cuando una respuesta equivocada confunde)
export async function callAI(
  prompt: string,
  keys?: UserKeys,
  model: string = MODELS.groqChat,
  reasoningEffort: 'low' | 'medium' = 'low'
): Promise<string> {
  const groqKey   = keys?.groq   || process.env.GROQ_API_KEY!
  const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY!

  try {
    const groq = new Groq({ apiKey: groqKey })
    const response = await groq.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: reasoningEffort === 'medium' ? 2048 : 1024,
      reasoning_effort: reasoningEffort,
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
const NO_SEARCH_NOTICE = `La búsqueda en internet no está disponible en este momento.
Si la pregunta necesita datos actuales (precios, cotizaciones, clima, noticias), decile al usuario
que no pudiste consultar internet ahora y que pruebe de nuevo en un minuto. No inventes cifras.
Si la pregunta no necesita datos actuales, respondela normalmente.`

function cleanCitations(text: string): string {
  return text.replace(/【[^】]*】/g, '')
}

// Genera la respuesta del chat como un stream de texto.
// - 'doc': Groq gpt-oss-120b en streaming → gpt-oss-20b → Gemini Flash-Lite.
// - 'web': Groq gpt-oss-20b con browser_search → gpt-oss-120b con browser_search
//          → Gemini 2.5 Flash con Google Search → Gemini Flash-Lite avisando que no pudo buscar.
export async function* streamAnswer(
  messages: ChatMessage[],
  mode: AnswerMode,
  keys?: UserKeys
): AsyncGenerator<string> {
  const groq      = new Groq({ apiKey: keys?.groq || process.env.GROQ_API_KEY! })
  const geminiKey = keys?.gemini || process.env.GEMINI_API_KEY!

  if (mode === 'web') {
    // Cada modelo de Groq tiene su propio límite de 8.000 tokens/min y una búsqueda
    // gasta ~6.000: si uno está agotado, probamos el otro.
    // Sin streaming: hay que limpiar las citas del texto completo.
    for (const model of [MODELS.groqFast, MODELS.groqChat]) {
      try {
        const response = await groq.chat.completions.create({
          model,
          messages,
          max_tokens: 2048,
          tools: [{ type: 'browser_search' }],
        })
        const text = response.choices[0].message.content
        if (text) { yield cleanCitations(text); return }
      } catch (error) {
        console.warn(`Búsqueda web con Groq ${model} falló`, error)
      }
    }
    try {
      yield await callGemini(messages, geminiKey, MODELS.geminiSearch, true)
      return
    } catch (error) {
      console.warn('Búsqueda web con Gemini falló, respondiendo sin búsqueda...', error)
    }
    // Ningún proveedor pudo buscar: que lo diga en vez de inventar cifras
    yield await callGemini(
      [{ role: 'system', content: NO_SEARCH_NOTICE }, ...messages],
      geminiKey,
      MODELS.geminiFallback
    )
    return
  }

  // Si Groq ya mandó texto y se corta a la mitad, no caemos a otro modelo
  // (el usuario vería la respuesta duplicada)
  let started = false
  for (const model of [MODELS.groqChat, MODELS.groqFast]) {
    try {
      const stream = await groq.chat.completions.create({
        model,
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
      console.warn(`Groq ${model} falló, probando el siguiente...`, error)
    }
  }
  yield await callGemini(messages, geminiKey, MODELS.geminiFallback)
}
