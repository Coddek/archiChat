// app/api/finalizar-sesion/route.ts
// Cierra una sesión: genera el resumen y la convierte en un documento más de
// archiChat (tipo 'sesion'), indexado con el mismo pipeline que los PDFs, para
// poder chatear con ella desde el chat normal.
// También sirve para sesiones viejas que quedaron sin resumen.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai'
import { processDocument } from '@/lib/pipeline'
import { buildSummaryPrompt, buildSessionDocument } from '@/lib/sesion'
import { z } from 'zod'

const BodySchema = z.object({ sesionId: z.string().uuid('Sesión inválida') })

// Una clase de 2 horas son ~100 fragmentos para indexar (~1-2 min con los
// embeddings de Gemini): se amplía el tiempo máximo de la función en Vercel
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const validation = BodySchema.safeParse(await req.json().catch(() => ({})))
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const { sesionId } = validation.data

  // RLS: si la sesión no es del usuario, no aparece
  const { data: sesion } = await supabase
    .from('sesiones')
    .select('id, titulo, fecha, resumen, document_id')
    .eq('id', sesionId)
    .single()
  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })

  // Ya se finalizó antes: se devuelve lo que hay
  if (sesion.resumen && sesion.document_id) {
    return NextResponse.json({ resumen: sesion.resumen, documentId: sesion.document_id })
  }

  const [{ data: lineas }, { data: preguntas }, { data: settings }] = await Promise.all([
    supabase.from('transcripciones').select('texto, timestamp_segundos').eq('sesion_id', sesionId).order('timestamp_segundos'),
    supabase.from('preguntas_sesion').select('pregunta, respuesta, timestamp_segundos').eq('sesion_id', sesionId).order('timestamp_segundos'),
    supabase.from('user_settings').select('groq_api_key, gemini_api_key').eq('user_id', user.id).single(),
  ])
  const keys = {
    groq:   settings?.groq_api_key   || undefined,
    gemini: settings?.gemini_api_key || undefined,
  }

  if (!lineas || lineas.length === 0) {
    await supabase.from('sesiones').update({ estado: 'finalizada' }).eq('id', sesionId)
    return NextResponse.json({ resumen: null, documentId: null })
  }

  const titulo = sesion.titulo || 'Sesión'

  // 1. Resumen. Una sesión larga supera el límite de 8.000 tokens/min de Groq:
  //    callAI cae solo a Gemini, que acepta textos mucho más largos.
  let resumen = sesion.resumen as string | null
  if (!resumen) {
    try {
      resumen = (await callAI(buildSummaryPrompt(titulo, lineas, preguntas ?? []), keys)).trim()
    } catch (e) {
      console.error('Error generando resumen:', e)
      return NextResponse.json({ error: 'No se pudo generar el resumen. Probá de nuevo en un momento.' }, { status: 502 })
    }
    await supabase.from('sesiones').update({ estado: 'finalizada', resumen }).eq('id', sesionId)
  }

  // 2. Documento para el chat normal
  const { data: doc, error: docError } = await supabase
    .from('documents')
    .insert({ user_id: user.id, title: titulo, source_type: 'sesion' })
    .select('id')
    .single()
  if (docError || !doc) {
    console.error('Error creando documento de la sesión:', docError)
    return NextResponse.json({ resumen, documentId: null, error: 'Se generó el resumen, pero no se pudo crear el documento para el chat.' })
  }

  try {
    await processDocument({
      documentId: doc.id,
      sourceType: 'sesion',
      content: buildSessionDocument(titulo, sesion.fecha, resumen, lineas, preguntas ?? []),
      keys,
    })
  } catch (e) {
    console.error('Error indexando la sesión:', e)
    await supabase.from('documents').delete().eq('id', doc.id)
    return NextResponse.json({ resumen, documentId: null, error: 'Se generó el resumen, pero no se pudo preparar el chat. Probá de nuevo desde Sesiones.' })
  }

  await supabase.from('sesiones').update({ document_id: doc.id }).eq('id', sesionId)
  return NextResponse.json({ resumen, documentId: doc.id })
}
