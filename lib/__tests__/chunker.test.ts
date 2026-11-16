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

  // TEST 4: al llegar al final no se agrega una cola repetida
  // Antes el loop daba una vuelta más y generaba un chunk extra que ya estaba
  // entero dentro del anterior: un embedding de más y un resultado duplicado
  test('el último chunk no repite el final del anterior', () => {
    // Palabras numeradas: con texto repetido cualquier pedazo estaría en el anterior
    // 2750 caracteres: el segundo chunk (desde 1300) llega justo al final y
    // quedan más de OVERLAP caracteres después de su inicio + 1300
    const text = Array.from({ length: 400 }, (_, i) => `palabra${i}`).join(' ').slice(0, 2750)
    const chunks = chunkText(text)
    const last = chunks.at(-1)!
    const previous = chunks.at(-2)!
    expect(previous.includes(last)).toBe(false)
  })

  // TEST 5: el texto completo sigue cubierto (no se pierde el final)
  test('el final del texto queda en el último chunk', () => {
    const text = 'palabra '.repeat(400) + 'FIN'
    const chunks = chunkText(text)
    expect(chunks.at(-1)!.endsWith('FIN')).toBe(true)
  })

})
