// app/api/sesion-estudio/route.ts
// Modo estudio: arma tarjetas de repaso (flashcards) con lo que quedó de una
// sesión finalizada (resumen, conceptos, preguntas del usuario y lo que marcó).
// No se guardan: se generan cada vez que se piden.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callJSON } from '@/lib/ai'
import { buildFlashcardsPrompt, parseFlashcards } from '@/lib/estudio'
import { z } from 'zod'

const BodySchema = z.object({ sesionId: z.string().uuid('Sesión inválida') })

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
    .select('titulo, resumen')
    .eq('id', sesionId)
    .single()
  if (!sesion) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 })
  if (!sesion.resumen) {
    return NextResponse.json({ error: 'Primero generá el resumen de la sesión.' }, { status: 409 })
  }

  const [{ data: conceptos }, { data: preguntas }, { data: notas }, { data: lineas }, { data: settings }] = await Promise.all([
    supabase.from('contextos').select('concepto, explicacion, timestamp_segundos').eq('sesion_id', sesionId).order('timestamp_segundos'),
    supabase.from('preguntas_sesion').select('pregunta, respuesta, timestamp_segundos').eq('sesion_id', sesionId).order('timestamp_segundos'),
    // Si la tabla notas_sesion no existe todavía, data es null y se sigue sin notas
    supabase.from('notas_sesion').select('texto, timestamp_segundos').eq('sesion_id', sesionId).order('timestamp_segundos'),
    // Solo para saber qué se estaba diciendo en cada momento marcado
    supabase.from('transcripciones').select('texto, timestamp_segundos').eq('sesion_id', sesionId).order('timestamp_segundos'),
    supabase.from('user_settings').select('groq_api_key, gemini_api_key').eq('user_id', user.id).single(),
  ])

  try {
    const raw = await callJSON<unknown>(
      buildFlashcardsPrompt(sesion.titulo || 'Sesión', sesion.resumen, conceptos ?? [], preguntas ?? [], notas ?? [], notas?.length ? lineas ?? [] : []),
      { groq: settings?.groq_api_key || undefined, gemini: settings?.gemini_api_key || undefined }
    )
    const tarjetas = parseFlashcards(raw)
    if (tarjetas.length === 0) throw new Error('El modelo no devolvió tarjetas')
    return NextResponse.json({ tarjetas })
  } catch (e) {
    console.error('Error generando tarjetas:', e)
    return NextResponse.json({ error: 'No se pudieron armar las tarjetas. Probá de nuevo en un momento.' }, { status: 502 })
  }
}
