// app/api/sesion-pregunta/route.ts
// Preguntas rápidas durante una sesión en vivo ("¿qué dijo recién?", "¿qué es eso?").
// El contexto son los últimos ~10 minutos de transcripción, directo en el prompt:
// entran enteros y es más rápido que buscar con embeddings (RAG).

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callAI } from '@/lib/ai'
import { formatTime } from '@/lib/utils'
import { PreguntaSesionSchema } from '@/lib/validations'

const CONTEXT_SECONDS = 10 * 60
// 10 minutos en tramos de 10 segundos, con margen
const MAX_LINES = 80

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const validation = PreguntaSesionSchema.safeParse(await req.json().catch(() => ({})))
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }
  const { sesionId, pregunta, historial, segundoActual } = validation.data

  // RLS: solo devuelve líneas si la sesión es del usuario
  const { data: lineas, error } = await supabase
    .from('transcripciones')
    .select('texto, timestamp_segundos')
    .eq('sesion_id', sesionId)
    .order('timestamp_segundos', { ascending: false })
    .limit(MAX_LINES)
  if (error) return NextResponse.json({ error: 'No se pudo leer la transcripción' }, { status: 500 })

  const ultimo = lineas?.[0]?.timestamp_segundos ?? 0
  const ahora = Math.max(ultimo, segundoActual)
  const transcripcion = (lineas ?? [])
    .filter(l => l.timestamp_segundos >= ultimo - CONTEXT_SECONDS)
    .reverse()
    .map(l => `[${formatTime(l.timestamp_segundos)}] ${l.texto}`)
    .join('\n')

  const conversacion = historial
    .map(m => `${m.role === 'user' ? 'Usuario' : 'Vos'}: ${m.content}`)
    .join('\n')

  const prompt = `Sos archiChat, un asistente que acompaña al usuario mientras mira un video, una clase o una reunión EN VIVO.
El usuario te pregunta sin dejar de mirar, así que respondé CORTO: 2 a 4 oraciones, en español, fácil de leer de un vistazo. Usá **negritas** solo para lo clave.

- Si pregunta qué se dijo (recién, hace un rato), respondé con lo que dice la transcripción y mencioná el minuto.
- Si pregunta qué se perdió desde su pregunta anterior, resumí lo que se dijo entre el minuto de esa pregunta (figura en la conversación previa) y ahora.
- Si pide explicar un concepto, explicalo simple, con un ejemplo si ayuda. Podés usar tu conocimiento general.
- Si la transcripción no alcanza para responder, decilo en una oración.

TRANSCRIPCIÓN DE LOS ÚLTIMOS MINUTOS (ahora vamos por el minuto ${formatTime(ahora)}):
${transcripcion || '(todavía no hay transcripción)'}
${conversacion ? `\nCONVERSACIÓN PREVIA (con el minuto de cada pregunta):\n${conversacion}\n` : ''}
PREGUNTA (minuto ${formatTime(ahora)}): ${pregunta}

RESPUESTA:`

  const { data: settings } = await supabase
    .from('user_settings')
    .select('groq_api_key, gemini_api_key')
    .eq('user_id', user.id)
    .single()

  try {
    const respuesta = await callAI(prompt, {
      groq:   settings?.groq_api_key   || undefined,
      gemini: settings?.gemini_api_key || undefined,
    })

    // Se guarda para el resumen final y el chat normal (sección "Para repasar")
    const { error: saveError } = await supabase.from('preguntas_sesion').insert({
      sesion_id: sesionId,
      pregunta,
      respuesta,
      timestamp_segundos: ahora,
    })
    if (saveError) console.error('No se pudo guardar la pregunta en vivo:', saveError)

    return NextResponse.json({ respuesta })
  } catch (e) {
    console.error('Error en pregunta de sesión:', e)
    return NextResponse.json({ error: 'No se pudo responder ahora. Probá de nuevo en un momento.' }, { status: 502 })
  }
}
