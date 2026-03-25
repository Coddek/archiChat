// app/api/suggest/route.ts
// Genera 3 preguntas relevantes sobre un documento para mostrarle al usuario
// como punto de partida cuando abre el chat por primera vez

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function GET(req: NextRequest) {
  try {
    const documentId = req.nextUrl.searchParams.get('documentId')
    if (!documentId) return NextResponse.json({ questions: [] })

    // Traemos los primeros chunks del documento para entender de qué trata
    const { data: chunks } = await supabase
      .from('chunks')
      .select('content')
      .eq('document_id', documentId)
      .order('chunk_index', { ascending: true })
      .limit(3)

    if (!chunks || chunks.length === 0) return NextResponse.json({ questions: [] })

    const preview = chunks.map(c => c.content).join('\n\n').slice(0, 1500)

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{
        role: 'user',
        content: `Dado este fragmento de un documento, generá exactamente 3 preguntas cortas y específicas que un usuario podría hacerle a una IA sobre este contenido.
Las preguntas deben ser concretas, útiles, y directamente respondibles con el texto.
Respondé SOLO con las 3 preguntas, una por línea, sin numeración ni viñetas ni guiones.

FRAGMENTO:
${preview}

PREGUNTAS:`
      }],
      max_tokens: 200,
      temperature: 0.7,
    })

    const raw = response.choices[0].message.content ?? ''
    const questions = raw
      .split('\n')
      .map(q => q.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(q => q.length > 10 && q.includes('?'))
      .slice(0, 3)

    return NextResponse.json({ questions })
  } catch {
    // Si falla, simplemente no mostramos sugerencias — no es crítico
    return NextResponse.json({ questions: [] })
  }
}
