// app/api/chat/route.ts
// Se llama cada vez que el usuario manda un mensaje
// Si el documento ya fue procesado, usa RAG para responder con contexto real
// Si no, responde como LLM genérico

import { NextRequest, NextResponse } from 'next/server'
import { ragQuery } from '@/lib/rag'
import { MessageSchema } from '@/lib/validations'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const { messages, documentId, documentTitle, isProcessed } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Faltan mensajes' }, { status: 400 })
    }

    const lastQuestion = messages[messages.length - 1]?.content || ''

    // Validamos que la pregunta tenga el formato correcto antes de procesarla
    const validation = MessageSchema.safeParse({ question: lastQuestion })
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    // Si el documento fue procesado, usamos RAG
    // La IA responde basándose en los chunks del documento
    if (isProcessed && documentId) {
      const result = await ragQuery(lastQuestion, documentId)
      return NextResponse.json({
        answer: result.answer,
        sources: result.sources,
      })
    }

    // Si no fue procesado todavía, respondemos como LLM genérico
    // Esto cubre el caso de que el usuario chatee antes de que termine el procesamiento
    const systemPrompt = `Sos archiChat, un asistente para analizar documentos.
${documentTitle ? `El documento activo se llama "${documentTitle}".` : ''}
El documento todavía está siendo procesado. Respondé preguntas generales mientras tanto.
Respondé en español, de forma directa y concisa. Sin listas innecesarias.`

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 1024,
      temperature: 0.7,
    })

    return NextResponse.json({
      answer: completion.choices[0].message.content ?? '',
      sources: [],
    })

  } catch (error: unknown) {
    console.error('Error en chat:', error)
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
