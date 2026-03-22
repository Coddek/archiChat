import { describe, test, expect } from 'vitest'
import { DocumentSchema, MessageSchema } from '../validations'

describe('DocumentSchema', () => {

  // TEST 4: título vacío debe fallar
  test('falla si el título tiene menos de 3 caracteres', () => {
    const result = DocumentSchema.safeParse({
      title: 'AB',
      sourceType: 'text',
      content: 'Este es un contenido de prueba que tiene más de cincuenta caracteres.',
    })
    expect(result.success).toBe(false)
  })

  // TEST 5: URL inválida debe fallar cuando sourceType es 'url'
  test('falla si sourceType es url y el content no es una URL válida', () => {
    const result = DocumentSchema.safeParse({
      title: 'Mi documento',
      sourceType: 'url',
      content: 'esto no es una url',
    })
    expect(result.success).toBe(false)
  })

  // TEST 6: datos correctos deben pasar
  test('acepta datos válidos de tipo text', () => {
    const result = DocumentSchema.safeParse({
      title: 'Mi documento de prueba',
      sourceType: 'text',
      content: 'Este es un contenido válido que tiene más de cincuenta caracteres sin ninguna duda.',
    })
    expect(result.success).toBe(true)
  })

})

describe('MessageSchema', () => {

  // TEST 7: pregunta vacía debe fallar
  test('falla si la pregunta está vacía', () => {
    const result = MessageSchema.safeParse({ question: '' })
    expect(result.success).toBe(false)
  })

  // TEST 8: pregunta normal debe pasar
  test('acepta una pregunta válida', () => {
    const result = MessageSchema.safeParse({ question: '¿De qué trata el documento?' })
    expect(result.success).toBe(true)
  })

})
