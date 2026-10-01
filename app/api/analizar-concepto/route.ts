// app/api/analizar-concepto/route.ts
// Detección automática de conceptos: cada ~20 segundos la página manda lo nuevo
// que se transcribió, y si aparece un término que un estudiante podría no
// conocer, se explica solo, sin que el usuario pregunte.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callJSON } from '@/lib/ai'
import { AnalizarConceptoSchema } from '@/lib/validations'

// Como mucho 2 conceptos por tanda: más que eso distrae en plena clase
const MAX_CONCEPTOS = 2

interface Respuesta {
  conceptos?: { concepto?: string; explicacion?: string }[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 })

  const validation = AnalizarConceptoSchema.safeParse(await req.json().catch(() => ({})))
  if (!validation.success) {
    return NextResponse.json({ error: validation.error.issues[0]?.message ?? 'Datos inválidos' }, { status: 400 })
  }
  const { sesionId, texto, contextoPrevio, conocidos, timestampSegundos } = validation.data

  const prompt = `Ayudás a un estudiante a entender una clase, reunión o video EN VIVO.
La transcripción es automática y puede escribir mal los términos técnicos (por ejemplo "guento" = Gentoo, "caque" = K, "Cloud Code" = Claude Code): usá siempre el nombre correcto.

CONTEXTO PREVIO:
${contextoPrevio || '(inicio de la sesión)'}

TEXTO NUEVO:
${texto}

CONCEPTOS YA EXPLICADOS (no los repitas):
${conocidos.length ? conocidos.join(', ') : '(ninguno)'}

Buscá en el TEXTO NUEVO hasta ${MAX_CONCEPTOS} conceptos técnicos, términos especializados o siglas que un estudiante podría no conocer y que sean importantes para seguir el tema.
No incluyas palabras comunes, nombres de personas ni cosas que se entienden solas.
Para cada uno, una explicación simple de 1 o 2 oraciones, en español, sin tecnicismos y aplicada a lo que se está hablando.

Respondé SOLO este JSON:
{"conceptos": [{"concepto": "nombre correcto", "explicacion": "..."}]}
Si no hay ningún concepto nuevo que valga la pena, respondé {"conceptos": []}.`

  const { data: settings } = await supabase
    .from('user_settings')
    .select('groq_api_key, gemini_api_key')
    .eq('user_id', user.id)
    .single()

  let respuesta: Respuesta
  try {
    respuesta = await callJSON<Respuesta>(prompt, {
      groq:   settings?.groq_api_key   || undefined,
      gemini: settings?.gemini_api_key || undefined,
    })
  } catch (e) {
    console.error('Error detectando conceptos:', e)
    return NextResponse.json({ conceptos: [] })
  }

  const yaConocidos = new Set(conocidos.map(c => c.toLowerCase()))
  const nuevos = (respuesta.conceptos ?? [])
    .filter(c => c.concepto?.trim() && c.explicacion?.trim())
    .filter(c => !yaConocidos.has(c.concepto!.trim().toLowerCase()))
    .slice(0, MAX_CONCEPTOS)
    .map(c => ({
      sesion_id: sesionId,
      concepto: c.concepto!.trim().slice(0, 100),
      explicacion: c.explicacion!.trim().slice(0, 600),
      timestamp_segundos: timestampSegundos,
    }))

  if (nuevos.length === 0) return NextResponse.json({ conceptos: [] })

  // RLS verifica que la sesión sea del usuario
  const { data, error } = await supabase
    .from('contextos')
    .insert(nuevos)
    .select('concepto, explicacion, timestamp_segundos')
  if (error) {
    console.error('Error guardando conceptos:', error)
    return NextResponse.json({ conceptos: [] })
  }
  return NextResponse.json({ conceptos: data })
}
