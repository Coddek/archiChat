import { describe, test, expect } from 'vitest'
import { nivelRespaldo } from '../confianza'

// Cortes medidos con documentos reales (23/11/2026): preguntas que el documento
// responde dieron 0,67–0,85 de similitud; preguntas de otro documento, 0,52–0,62.
describe('nivel de respaldo de una respuesta', () => {
  test('desde 72 el respaldo es fuerte', () => {
    expect(nivelRespaldo(72).nivel).toBe('fuerte')
    expect(nivelRespaldo(85).nivel).toBe('fuerte')
  })

  test('entre 65 y 71 es parcial', () => {
    expect(nivelRespaldo(65).nivel).toBe('parcial')
    expect(nivelRespaldo(71).nivel).toBe('parcial')
  })

  test('debajo de 65 es débil: lo que da una pregunta que el documento no responde', () => {
    expect(nivelRespaldo(64).nivel).toBe('debil')
    expect(nivelRespaldo(57).nivel).toBe('debil')
  })

  test('cada nivel explica qué significa', () => {
    for (const v of [80, 68, 50]) expect(nivelRespaldo(v).explicacion.length).toBeGreaterThan(20)
  })
})
