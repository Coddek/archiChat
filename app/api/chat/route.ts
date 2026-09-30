// app/api/chat/route.ts
// Recibe la pregunta y devuelve un stream SSE con la respuesta token por token.
// Al final del stream manda las fuentes y el nivel de confianza como metadata.

import { NextRequest } from 'next/server'
import { prepareRagPrompt } from '@/lib/rag'
import type { Source } from '@/lib/rag'
import { MessageSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import { streamAnswer } from '@/lib/ai'

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
  meta: { sources: Source[]; confidence: number | null }
) {
  const encoder = new TextEncoder()
  const send = (data: object) => encoder.encode(`data: ${JSON.stringify(data)}

`)
  const first = await answer.next()

  const readable = new ReadableStream({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(send({ type: 'chunk', content: first.value }))
        for await (const text of answer) {
          controller.enqueue(send({ type: 'chunk', content: text }))
        }
      } catch (error) {
        console.error('Error a mitad del stream:', error)
      } finally {
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

    const keys = await getUserKeys()

    // ── Caso RAG: documento procesado ─────────────────────────────────────────
    if (isProcessed && documentId) {
      const context = await prepareRagPrompt(lastQuestion, documentId, documentTitle, keys)
      return await sseResponse(
        streamAnswer([{ role: 'user', content: context.prompt }], context.mode, keys),
        { sources: context.sources, confidence: context.confidence }
      )
    }

    // ── Caso genérico: documento todavía procesando ────────────────────────────
    const systemPrompt = `Sos archiChat, un asistente para analizar documentos.
${documentTitle ? `El documento activo se llama "${documentTitle}".` : ''}
El documento todavía está siendo procesado. Respondé preguntas generales mientras tanto.
Respondé en español, de forma directa y concisa. Sin listas innecesarias.`

    return await sseResponse(
      streamAnswer([{ role: 'system', content: systemPrompt }, ...messages], 'doc', keys),
      { sources: [], confidence: null }
    )

  } catch (error: unknown) {
    console.error('Error en chat:', error)
    const message = error instanceof Error ? error.message : 'Error interno'
    return Response.json({ error: message }, { status: 500 })
  }
}
