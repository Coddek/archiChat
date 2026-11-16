// Las rutas que usan la service role key saltean RLS: tienen que verificar que
// el documento sea del usuario de la sesión antes de leer o escribir chunks.

import { describe, test, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const OWNER = 'user-owner'
const INTRUDER = 'user-intruder'
const DOC_ID = '11111111-1111-4111-8111-111111111111'

// Usuario de la sesión en cada test (null = sin sesión)
let sessionUser: string | null = INTRUDER

// Cliente de sesión falso: `documents` solo devuelve el documento a su dueño
// (lo que haría RLS); el resto de las tablas devuelve vacío.
function fakeSessionClient() {
  return {
    auth: { getUser: async () => ({ data: { user: sessionUser ? { id: sessionUser } : null } }) },
    from(table: string) {
      const filters: Record<string, unknown> = {}
      const result = () => {
        const owned = table === 'documents' && sessionUser === OWNER
          && filters.id === DOC_ID && (filters.user_id ?? OWNER) === OWNER
        return { data: owned ? { id: DOC_ID } : null, error: null }
      }
      const query = {
        select: () => query,
        eq: (column: string, value: unknown) => { filters[column] = value; return query },
        single: async () => result(),
        maybeSingle: async () => result(),
      }
      return query
    },
  }
}

const serviceFrom = vi.fn(() => {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => ({ data: [{ content: 'contenido privado del documento' }], error: null }),
  }
  return query
})

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => fakeSessionClient() }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: serviceFrom, rpc: vi.fn() }) }))

const prepareRagPrompt = vi.fn(async () => ({ prompt: 'p', mode: 'doc', sources: [], confidence: null }))
vi.mock('@/lib/rag', () => ({ prepareRagPrompt }))

const callAI = vi.fn(async () => '¿Pregunta uno sobre el texto?\n¿Pregunta dos sobre el texto?')
vi.mock('@/lib/ai', () => ({
  callAI,
  streamAnswer: async function* () { yield 'respuesta' },
}))

const processDocument = vi.fn(async () => ({ chunksProcessed: 1 }))
vi.mock('@/lib/pipeline', () => ({ processDocument }))

const chatRequest = () => new NextRequest('http://localhost/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    messages: [{ role: 'user', content: '¿Qué dice el documento?' }],
    documentId: DOC_ID,
    isProcessed: true,
  }),
})

const suggestRequest = () => new NextRequest(`http://localhost/api/suggest?documentId=${DOC_ID}`)

const processRequest = () => {
  const form = new FormData()
  form.append('documentId', DOC_ID)
  form.append('sourceType', 'text')
  form.append('content', 'texto que alguien quiere meter en el documento')
  return new NextRequest('http://localhost/api/process', { method: 'POST', body: form })
}

beforeEach(() => {
  sessionUser = INTRUDER
  vi.clearAllMocks()
})

describe('/api/chat', () => {
  test('no busca fragmentos de un documento ajeno', async () => {
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(chatRequest())
    expect(res.status).toBe(404)
    expect(prepareRagPrompt).not.toHaveBeenCalled()
  })

  test('sin sesión responde 401', async () => {
    sessionUser = null
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(chatRequest())
    expect(res.status).toBe(401)
    expect(prepareRagPrompt).not.toHaveBeenCalled()
  })

  test('el dueño puede chatear con su documento', async () => {
    sessionUser = OWNER
    const { POST } = await import('@/app/api/chat/route')
    const res = await POST(chatRequest())
    expect(res.status).toBe(200)
    expect(prepareRagPrompt).toHaveBeenCalledOnce()
  })
})

describe('/api/suggest', () => {
  test('no lee los chunks de un documento ajeno', async () => {
    const { GET } = await import('@/app/api/suggest/route')
    const res = await GET(suggestRequest())
    expect(await res.json()).toEqual({ questions: [] })
    expect(serviceFrom).not.toHaveBeenCalled()
    expect(callAI).not.toHaveBeenCalled()
  })

  test('el dueño recibe sugerencias', async () => {
    sessionUser = OWNER
    const { GET } = await import('@/app/api/suggest/route')
    const res = await GET(suggestRequest())
    expect((await res.json()).questions).toHaveLength(2)
  })
})

describe('/api/process', () => {
  test('no indexa contenido en un documento ajeno', async () => {
    const { POST } = await import('@/app/api/process/route')
    const res = await POST(processRequest())
    expect(res.status).toBe(404)
    expect(processDocument).not.toHaveBeenCalled()
  })

  test('sin sesión responde 401', async () => {
    sessionUser = null
    const { POST } = await import('@/app/api/process/route')
    const res = await POST(processRequest())
    expect(res.status).toBe(401)
    expect(processDocument).not.toHaveBeenCalled()
  })

  test('el dueño puede procesar su documento', async () => {
    sessionUser = OWNER
    const { POST } = await import('@/app/api/process/route')
    const res = await POST(processRequest())
    expect(res.status).toBe(200)
    expect(processDocument).toHaveBeenCalledOnce()
  })
})
