import { describe, test, expect } from 'vitest'
import { chunkText } from '../chunker'

describe('chunkText', () => {

  // TEST 1: un texto corto no debería dividirse
  // Si el texto entra en un solo chunk, no tiene sentido partirlo
  test('texto corto queda en un solo chunk', () => {
    const shortText = 'Este es un texto corto que no debería dividirse.'
    const chunks = chunkText(shortText)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(shortText)
  })

  // TEST 2: un texto largo sí debe dividirse en varios chunks
  // 'palabra '.repeat(1000) genera ~7000 caracteres, bien por encima del límite de 1500
  test('texto largo se divide en múltiples chunks', () => {
    const longText = 'palabra '.repeat(1000)
    const chunks = chunkText(longText)
    expect(chunks.length).toBeGreaterThan(1)
  })

  // TEST 3: ningún chunk debería estar vacío
  // El filtro de chunks < 50 chars en chunker.ts existe para esto
  test('no genera chunks vacíos', () => {
    const longText = 'Este es un texto de prueba. '.repeat(200)
    const chunks = chunkText(longText)
    chunks.forEach(chunk => {
      expect(chunk.trim().length).toBeGreaterThan(0)
    })
  })

})
