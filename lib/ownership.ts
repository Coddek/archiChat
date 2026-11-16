// lib/ownership.ts
// Verifica que un documento sea del usuario de la sesión.
//
// Las rutas que usan SUPABASE_SERVICE_ROLE_KEY saltean RLS, así que el
// documentId que manda el navegador no alcanza: hay que confirmar que ese
// documento es del usuario antes de leer o escribir sus chunks.

import { createClient } from './supabase/server'

export type DocumentAccess = 'ok' | 'unauthenticated' | 'not_found'

export async function checkDocumentAccess(documentId: string): Promise<DocumentAccess> {
  // Cliente de sesión (anon key + cookies): acá sí aplica RLS
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return 'unauthenticated'

  // Un id mal formado da error de Postgres y data null: se trata como "no existe"
  const { data } = await supabase
    .from('documents')
    .select('id')
    .eq('id', documentId)
    .eq('user_id', user.id)
    .maybeSingle()

  return data ? 'ok' : 'not_found'
}

// Respuesta para cuando no hay acceso. Un documento ajeno responde igual que
// uno que no existe, para no confirmar qué ids son válidos.
export function accessDeniedResponse(access: Exclude<DocumentAccess, 'ok'>): Response {
  return access === 'unauthenticated'
    ? Response.json({ error: 'No autenticado' }, { status: 401 })
    : Response.json({ error: 'Documento no encontrado' }, { status: 404 })
}
