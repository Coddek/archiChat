// app/api/process/route.ts
// Se llama una sola vez cuando el usuario sube un documento
// Dispara el pipeline completo: extracción → chunks → embeddings → Supabase

import { NextRequest, NextResponse } from 'next/server'
import { processDocument } from '@/lib/pipeline'
import { createClient } from '@/lib/supabase/server'

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
    const formData = await req.formData()

    const documentId = formData.get('documentId') as string
    const sourceType = formData.get('sourceType') as 'pdf' | 'text' | 'url'
    const content = formData.get('content')

    if (!documentId || !sourceType || !content) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    let processedContent: string | Buffer

    if (sourceType === 'pdf' && content instanceof File) {
      const arrayBuffer = await content.arrayBuffer()
      processedContent = Buffer.from(arrayBuffer)
    } else {
      processedContent = content as string
    }

    const keys = await getUserKeys()

    const result = await processDocument({
      documentId,
      sourceType,
      content: processedContent,
      keys,
    })

    return NextResponse.json({ success: true, ...result })

  } catch (error: unknown) {
    console.error('Error procesando documento:', error)
    const message = error instanceof Error ? error.message : 'Error interno'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
