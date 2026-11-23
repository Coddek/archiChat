import { describe, test, expect } from 'vitest'
import { filasParaGuardar, mensajesDesdeFilas, MAX_CONTENIDO } from '../historial'

const fuentes = [{ content: 'La inflación es...', chunk_index: 2, similarity: 74 }]
const ahora = new Date('2026-11-23T15:00:00.000Z')

describe('filas a guardar después de una respuesta', () => {
  test('guarda la pregunta y la respuesta, en ese orden', () => {
    const filas = filasParaGuardar('doc-1', '¿Qué es la inflación?', 'Es la suba...', fuentes, 74, ahora)
    expect(filas).toHaveLength(2)
    expect(filas[0]).toMatchObject({ document_id: 'doc-1', role: 'user', content: '¿Qué es la inflación?', sources: null, confidence: null })
    expect(filas[1]).toMatchObject({ document_id: 'doc-1', role: 'assistant', content: 'Es la suba...', sources: fuentes, confidence: 74 })
  })

  test('la respuesta queda después de la pregunta aunque se inserten juntas', () => {
    const [p, r] = filasParaGuardar('doc-1', 'p', 'r', [], null, ahora)
    expect(new Date(r.created_at).getTime()).toBeGreaterThan(new Date(p.created_at).getTime())
  })

  test('si la respuesta quedó vacía no se guarda nada', () => {
    expect(filasParaGuardar('doc-1', 'p', '   ', [], null, ahora)).toEqual([])
  })

  test('recorta textos más largos que el límite de la tabla', () => {
    const [, r] = filasParaGuardar('doc-1', 'p', 'a'.repeat(MAX_CONTENIDO + 50), [], null, ahora)
    expect(r.content.length).toBe(MAX_CONTENIDO)
  })

  test('sin fragmentos, las fuentes quedan en null', () => {
    const [, r] = filasParaGuardar('doc-1', 'p', 'r', [], null, ahora)
    expect(r.sources).toBeNull()
  })
})

describe('mensajes a partir de las filas guardadas', () => {
  test('respeta el orden y arma cada mensaje con sus fuentes', () => {
    const msgs = mensajesDesdeFilas([
      { id: 'a', role: 'user', content: 'p', sources: null, confidence: null, created_at: '2026-11-23T15:00:00Z' },
      { id: 'b', role: 'assistant', content: 'r', sources: fuentes, confidence: 74, created_at: '2026-11-23T15:00:00.001Z' },
    ])
    expect(msgs.map(m => m.role)).toEqual(['user', 'assistant'])
    expect(msgs[1]).toMatchObject({ id: 'b', content: 'r', sources: fuentes, confidence: 74 })
  })

  test('ignora filas con un rol desconocido', () => {
    const msgs = mensajesDesdeFilas([
      { id: 'x', role: 'system', content: 'no', sources: null, confidence: null, created_at: '2026-11-23T15:00:00Z' },
    ])
    expect(msgs).toEqual([])
  })
})
