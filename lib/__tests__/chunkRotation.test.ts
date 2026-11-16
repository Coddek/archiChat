import { describe, test, expect } from 'vitest'
import { shouldCutChunk, MIN_CHUNK_MS, MAX_CHUNK_MS, PAUSE_SAMPLES } from '../chunkRotation'

describe('shouldCutChunk', () => {

  test('no corta antes del mínimo aunque haya una pausa', () => {
    expect(shouldCutChunk(MIN_CHUNK_MS - 100, PAUSE_SAMPLES + 5, true)).toBe(false)
  })

  test('después del mínimo, corta en la primera pausa', () => {
    expect(shouldCutChunk(MIN_CHUNK_MS + 500, PAUSE_SAMPLES, true)).toBe(true)
  })

  test('si siguen hablando, espera', () => {
    expect(shouldCutChunk(MIN_CHUNK_MS + 500, 0, true)).toBe(false)
  })

  test('un silencio muy corto (una consonante) no cuenta como pausa', () => {
    expect(shouldCutChunk(MIN_CHUNK_MS + 500, PAUSE_SAMPLES - 1, true)).toBe(false)
  })

  test('sin ninguna pausa, corta igual al llegar al máximo', () => {
    expect(shouldCutChunk(MAX_CHUNK_MS, 0, true)).toBe(true)
  })

  test('sin medidor de volumen, corta fijo en el mínimo', () => {
    expect(shouldCutChunk(MIN_CHUNK_MS - 100, 0, false)).toBe(false)
    expect(shouldCutChunk(MIN_CHUNK_MS, 0, false)).toBe(true)
  })
})
