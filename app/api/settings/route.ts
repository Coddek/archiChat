// app/api/settings/route.ts
// GET: devuelve si el usuario tiene keys configuradas (sin revelar las keys)
// POST: guarda/actualiza las keys del usuario en user_settings

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('user_settings')
    .select('groq_api_key, gemini_api_key')
    .eq('user_id', user.id)
    .single()

  return NextResponse.json({
    hasGroqKey:   !!(data?.groq_api_key),
    hasGeminiKey: !!(data?.gemini_api_key),
    hasKeys:      !!(data?.groq_api_key && data?.gemini_api_key),
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { groqKey, geminiKey } = await req.json()

  const { error } = await supabase
    .from('user_settings')
    .upsert({
      user_id:        user.id,
      groq_api_key:   groqKey   || null,
      gemini_api_key: geminiKey || null,
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
