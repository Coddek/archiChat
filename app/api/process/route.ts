// app/api/process/route.ts
// Se llama una sola vez cuando el usuario sube un documento
// Dispara el pipeline completo: extracción → chunks → embeddings → Supabase

import { NextRequest, NextResponse } from 'next/server'
import { processDocument } from '@/lib/pipeline'

// Aumentamos el límite de tamaño del body a 10MB para aceptar PDFs grandes
export const config = {
  api: { bodyParser: { sizeLimit: '10mb' } }
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

    // Si es PDF, el content llega como File — lo convertimos a Buffer
    // Buffer es la representación en memoria de un archivo binario
    let processedContent: string | Buffer

    if (sourceType === 'pdf' && content instanceof File) {
      const arrayBuffer = await content.arrayBuffer()
      processedContent = Buffer.from(arrayBuffer)
    } else {
      processedContent = content as string
    }

    // Disparamos el pipeline — puede tardar varios segundos
    const result = await processDocument({
      documentId,
      sourceType,
      content: processedContent,
    })

    return NextResponse.json({ success: true, ...result })

  } catch (error: any) {
    console.error('Error procesando documento:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
