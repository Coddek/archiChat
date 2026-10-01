// app/api/transcribir/route.ts
// Recibe un tramo de ~10 segundos de audio de una sesión, lo transcribe con
// Groq Whisper y guarda el texto en la tabla `transcripciones`.
// La key de Groq vive solo en el servidor: nunca llega al navegador.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transcribeAudio } from '@/lib/transcription'
import { TranscripcionSchema } from '@/lib/validations'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const form = await req.formData()
  const validation = TranscripcionSchema.safeParse({
    sesionId:          form.get('sesion_id'),
    timestampSegundos: form.get('timestamp_segundos'),
    textoPrevio:       form.get('texto_previo') ?? '',
    vocabulario:       form.get('vocabulario') ?? '',
    audio:             form.get('audio'),
  })
  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? 'Datos inválidos' },
      { status: 400 }
    )
  }
  const { sesionId, timestampSegundos, textoPrevio, vocabulario, audio } = validation.data

  const { data: settings } = await supabase
    .from('user_settings')
    .select('groq_api_key')
    .eq('user_id', user.id)
    .single()

  let result
  try {
    result = await transcribeAudio(audio, textoPrevio, {
      groq: settings?.groq_api_key || undefined,
    }, vocabulario)
  } catch (error) {
    console.error('Error transcribiendo:', error)
    const status = (error as { status?: number }).status === 429 ? 429 : 502
    return NextResponse.json(
      { error: status === 429 ? 'Se alcanzó el límite de transcripción. Esperá un momento.' : 'No se pudo transcribir el audio' },
      { status }
    )
  }

  // Tramo sin habla (silencio, música): no se guarda nada
  if (!result.texto) return NextResponse.json({ texto: '', duracion_segundos: result.duracion_segundos })

  // RLS verifica que la sesión sea del usuario
  const { error } = await supabase.from('transcripciones').insert({
    sesion_id: sesionId,
    texto: result.texto,
    timestamp_segundos: timestampSegundos,
  })
  if (error) {
    console.error('Error guardando transcripción:', error)
    return NextResponse.json({ error: 'No se pudo guardar la transcripción' }, { status: 500 })
  }

  return NextResponse.json(result)
}
