// app/api/chat/route.ts
// Recibe la pregunta y devuelve un stream SSE con la respuesta token por token.
// Al final del stream manda las fuentes y el nivel de confianza como metadata.

import { NextRequest } from 'next/server'
import { prepareRagPrompt } from '@/lib/rag'
import type { Source } from '@/lib/rag'
import { MessageSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { streamAnswer } from '@/lib/ai'
import type { ChatMessage } from '@/lib/ai'
import { checkDocumentAccess, accessDeniedResponse } from '@/lib/ownership'
import { filasParaGuardar } from '@/lib/historial'

async function getUserKeys() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return {}
  const { data } = await supabase
    .from('user_settings')
    .select('groq_api_key, gemini_api_key')
    .eq('user_id', user.id)
    .single()
  return {
    groq:   data?.groq_api_key   || undefined,
    gemini: data?.gemini_api_key || undefined,
  }
}

// Convierte el stream de texto en eventos SSE: 'chunk' por cada pedazo y 'done' al final.
// Espera el primer pedazo antes de responder: si todos los proveedores fallan,
// el error sale como JSON 500 (lo que el cliente espera) y no como un stream vacío.
async function sseResponse(
  answer: AsyncGenerator<string>,
  meta: { sources: Source[]; confidence: number | null },
  onDone?: (fullText: string) => Promise<void>
) {
  let fullText = ''
  const encoder = new TextEncoder()
  const send = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}

`)
  const first = await answer.next()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (!first.done) {
          fullText += first.value
          controller.enqueue(send({ type: 'chunk', content: first.value }))
        }
        for await (const text of answer) {
          fullText += text
          controller.enqueue(send({ type: 'chunk', content: text }))
        }
      } catch (error) {
        console.error('Error a mitad del stream:', error)
      } finally {
        // Guardar antes de cerrar: en Vercel la función puede congelarse apenas
        // termina la respuesta. Si falla, la respuesta llega igual.
        if (onDone) await onDone(fullText).catch(e => console.error('No se pudo guardar el historial:', e))
        controller.enqueue(send({ type: 'done', ...meta }))
        controller.close()
      }
    }
  })

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
  })
}

// Fecha de hoy y país del usuario, para que las respuestas con datos actuales
// (precios, dólar, clima) sean del lugar y el día correctos.
// Vercel manda el país y la zona horaria según la IP; en local usamos Argentina.
function buildUserContext(req: NextRequest): string {
  const country  = req.headers.get('x-vercel-ip-country') || 'AR'
  const timeZone = req.headers.get('x-vercel-ip-timezone') || 'America/Argentina/Buenos_Aires'
  let countryName = country
  try { countryName = new Intl.DisplayNames(['es'], { type: 'region' }).of(country) ?? country } catch {}
  let today: string
  try {
    today = new Date().toLocaleDateString('es-AR', { timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    today = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  return `Fecha de hoy: ${today}. El usuario está en ${countryName}.`
}

// Guarda la pregunta y la respuesta en el historial del documento. Usa la sesión
// del usuario (con RLS): solo puede escribir en sus propios documentos.
// El cliente se crea durante el request (lee las cookies de la sesión).
async function saveToHistory(documentId: string, question: string, sources: Source[], confidence: number | null) {
  const supabase = await createClient()
  return async (answer: string) => {
    const filas = filasParaGuardar(documentId, question, answer, sources, confidence)
    if (filas.length === 0) return
    const { error } = await supabase.from('mensajes_chat').insert(filas)
    if (error) throw error
  }
}

// Últimos mensajes de la conversación (sin la pregunta actual), para que el
// modelo entienda preguntas de seguimiento como "¿y en Argentina?"
const HISTORY_LENGTH = 6
function recentHistory(messages: { role: string; content: string }[]): ChatMessage[] {
  return messages
    .slice(-(HISTORY_LENGTH + 1), -1)
    .filter(m => (m.role === 'user' || m.role === 'assistant') && m.content?.trim())
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
}

export async function POST(req: NextRequest) {
  try {
    const { messages, documentId, documentTitle, isProcessed } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'Faltan mensajes' }, { status: 400 })
    }

    const lastQuestion = messages[messages.length - 1]?.content || ''

    const validation = MessageSchema.safeParse({ question: lastQuestion })
    if (!validation.success) {
      return Response.json(
        { error: validation.error.issues[0]?.message ?? 'Pregunta inválida' },
        { status: 400 }
      )
    }

    // prepareRagPrompt busca los fragmentos con la service role key (sin RLS):
    // antes hay que confirmar que el documento es del usuario de la sesión
    if (documentId) {
      const access = await checkDocumentAccess(String(documentId))
      if (access !== 'ok') return accessDeniedResponse(access)
    } else {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return accessDeniedResponse('unauthenticated')
    }

    const keys = await getUserKeys()
    const userContext = buildUserContext(req)

    // ── Caso RAG: documento procesado ─────────────────────────────────────────
    if (isProcessed && documentId) {
      const previousQuestion = messages.slice(0, -1).findLast((m: { role: string }) => m.role === 'user')?.content ?? ''
      const context = await prepareRagPrompt(
        lastQuestion, documentId, documentTitle, keys, userContext, previousQuestion
      )
      return await sseResponse(
        streamAnswer(
          [...recentHistory(messages), { role: 'user', content: context.prompt }],
          context.mode,
          keys
        ),
        { sources: context.sources, confidence: context.confidence },
        await saveToHistory(String(documentId), lastQuestion, context.sources, context.confidence)
      )
    }

    // ── Caso genérico: documento todavía procesando ────────────────────────────
    const systemPrompt = `Sos archiChat, un asistente para analizar documentos.
${documentTitle ? `El documento activo se llama "${documentTitle}".` : ''}
El documento todavía está siendo procesado. Respondé preguntas generales mientras tanto.
${userContext}
Respondé en español, de forma directa y concisa. Sin listas innecesarias.`

    return await sseResponse(
      streamAnswer([{ role: 'system', content: systemPrompt }, ...messages], 'doc', keys),
      { sources: [], confidence: null },
      documentId ? await saveToHistory(String(documentId), lastQuestion, [], null) : undefined
    )

  } catch (error: unknown) {
    console.error('Error en chat:', error)
    const message = error instanceof Error ? error.message : 'Error interno'
    return Response.json({ error: message }, { status: 500 })
  }
}
