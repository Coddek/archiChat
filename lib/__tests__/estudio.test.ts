import { describe, test, expect } from 'vitest'
import { buildFlashcardsPrompt, parseFlashcards, toAnkiTSV, MAX_TARJETAS } from '../estudio'

describe('parseFlashcards', () => {

  test('devuelve las tarjetas válidas, sin espacios de más', () => {
    const tarjetas = parseFlashcards({ tarjetas: [{ pregunta: ' ¿Qué es un índice? ', respuesta: ' Una estructura para buscar rápido. ' }] })
    expect(tarjetas).toEqual([{ pregunta: '¿Qué es un índice?', respuesta: 'Una estructura para buscar rápido.' }])
  })

  test('descarta tarjetas incompletas o con tipos raros', () => {
    const tarjetas = parseFlashcards({ tarjetas: [
      { pregunta: '¿Sin respuesta?' },
      { pregunta: '', respuesta: 'Sin pregunta' },
      { pregunta: 42, respuesta: 'Número' },
      null,
      { pregunta: '¿Válida?', respuesta: 'Sí.' },
    ] })
    expect(tarjetas).toEqual([{ pregunta: '¿Válida?', respuesta: 'Sí.' }])
  })

  test('descarta preguntas repetidas', () => {
    const tarjetas = parseFlashcards({ tarjetas: [
      { pregunta: '¿Qué es GIN?', respuesta: 'Un índice.' },
      { pregunta: '¿qué es gin?', respuesta: 'Otra respuesta.' },
    ] })
    expect(tarjetas).toHaveLength(1)
  })

  test('no devuelve más que el máximo', () => {
    const muchas = Array.from({ length: 30 }, (_, i) => ({ pregunta: `¿Pregunta ${i}?`, respuesta: 'Respuesta.' }))
    expect(parseFlashcards({ tarjetas: muchas })).toHaveLength(MAX_TARJETAS)
  })

  test('si el modelo devuelve cualquier cosa, no rompe', () => {
    expect(parseFlashcards(null)).toEqual([])
    expect(parseFlashcards({})).toEqual([])
    expect(parseFlashcards({ tarjetas: 'texto' })).toEqual([])
  })
})

describe('toAnkiTSV', () => {

  test('una tarjeta por línea, anverso y reverso separados por tabulación', () => {
    const tsv = toAnkiTSV([
      { pregunta: '¿Uno?', respuesta: 'Sí.' },
      { pregunta: '¿Dos?', respuesta: 'También.' },
    ])
    expect(tsv).toBe('¿Uno?\tSí.\n¿Dos?\tTambién.')
  })

  test('saca tabulaciones y saltos de línea que romperían la importación', () => {
    const tsv = toAnkiTSV([{ pregunta: '¿Con\tsalto?', respuesta: 'Línea uno.\nLínea dos.' }])
    expect(tsv).toBe('¿Con salto? Línea uno. Línea dos.'.replace('? ', '?\t'))
  })
})

describe('buildFlashcardsPrompt', () => {

  test('incluye el resumen, los conceptos, las preguntas y lo marcado', () => {
    const prompt = buildFlashcardsPrompt(
      'Bases de datos',
      'Se vieron índices.',
      [{ concepto: 'GIN', explicacion: 'Índice para texto completo.', timestamp_segundos: 25 }],
      [{ pregunta: '¿Cuándo uso B-tree?', respuesta: 'Para rangos.', timestamp_segundos: 30 }],
      [{ texto: 'Entra en el parcial', timestamp_segundos: 20 }],
      [{ texto: 'Un índice B-tree sirve para búsquedas por rango.', timestamp_segundos: 12 }]
    )
    expect(prompt).toContain('Se vieron índices.')
    expect(prompt).toContain('GIN: Índice para texto completo.')
    expect(prompt).toContain('¿Cuándo uso B-tree?')
    expect(prompt).toContain('Entra en el parcial')
  })

  test('sin conceptos, preguntas ni notas, no deja secciones vacías', () => {
    const prompt = buildFlashcardsPrompt('Bases de datos', 'Se vieron índices.')
    expect(prompt).not.toContain('CONCEPTOS EXPLICADOS')
    expect(prompt).not.toContain('PREGUNTAS QUE HIZO')
    expect(prompt).not.toContain('MARCÓ COMO IMPORTANTE')
  })
})
