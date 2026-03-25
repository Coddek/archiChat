// app/api/chat/route.ts
// Recibe la pregunta y devuelve un stream SSE con la respuesta token por token.
// Al final del stream manda las fuentes y el nivel de confianza como metadata.

import { NextRequest } from 'next/server'
import { prepareRagPrompt } from '@/lib/rag'
import { MessageSchema } from '@/lib/validations'
import { createClient } from '@/lib/supabase/server'
import Groq from 'groq-sdk'

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
    const groqApiKey = keys.groq || process.env.GROQ_API_KEY!
    const groq = new Groq({ apiKey: groqApiKey })
    const encoder = new TextEncoder()

    // ── Caso RAG: documento procesado ─────────────────────────────────────────
    if (isProcessed && documentId) {
      const context = await prepareRagPrompt(lastQuestion, documentId, documentTitle, keys)

      const groqStream = await groq.chat.completions.create({
        model: context.model,
        messages: [{ role: 'user', content: context.prompt }],
        stream: true,
        max_tokens: 1024,
        temperature: 0.7,
      })

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of groqStream) {
              const text = chunk.choices[0]?.delta?.content || ''
              if (text) {
                controller.enqueue(encoder.encode(
                  `data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`
                ))
              }
            }
            controller.enqueue(encoder.encode(
              `data: ${JSON.stringify({ type: 'done', sources: context.sources, confidence: context.confidence })}\n\n`
            ))
          } finally {
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

    // ── Caso genérico: documento todavía procesando ────────────────────────────
    const systemPrompt = `Sos archiChat, un asistente para analizar documentos.
${documentTitle ? `El documento activo se llama "${documentTitle}".` : ''}
El documento todavía está siendo procesado. Respondé preguntas generales mientras tanto.
Respondé en español, de forma directa y concisa. Sin listas innecesarias.`

    const groqStream = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
      max_tokens: 1024,
      temperature: 0.7,
    })

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of groqStream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              controller.enqueue(encoder.encode(
                `data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`
              ))
            }
          }
          controller.enqueue(encoder.encode(
            `data: ${JSON.stringify({ type: 'done', sources: [], confidence: null })}\n\n`
          ))
        } finally {
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

  } catch (error: unknown) {
    console.error('Error en chat:', error)
    const message = error instanceof Error ? error.message : 'Error interno'
    return Response.json({ error: message }, { status: 500 })
  }
}
