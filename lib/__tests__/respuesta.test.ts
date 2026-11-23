import { describe, test, expect } from 'vitest'
import { partirSaltos, recortarFragmento, esPreguntaGeneral, repartirIndices } from '../respuesta'
import { chunkText } from '../chunker'

describe('saltos de línea en celdas de tabla', () => {
  test('el modelo escribe <br> en las celdas: se separa en líneas', () => {
    expect(partirSaltos('- Aritméticos.<br>- Relacionales.<br/>- Lógicos.')).toEqual([
      '- Aritméticos.', '- Relacionales.', '- Lógicos.',
    ])
  })
  test('sin <br> queda igual', () => {
    expect(partirSaltos('Texto común')).toEqual(['Texto común'])
  })
})

describe('fragmentos citados', () => {
  test('si empieza a mitad de palabra, se saltea ese pedazo', () => {
    expect(recortarFragmento('icos (se utilizan para evaluar valores) y más texto', 1))
      .toBe('…(se utilizan para evaluar valores) y más texto')
  })
  test('el primer fragmento del documento no se toca', () => {
    expect(recortarFragmento('icos al principio', 0)).toBe('icos al principio')
  })
  test('si empieza con mayúscula o signo, queda igual', () => {
    expect(recortarFragmento('Volver a empezar', 3)).toBe('Volver a empezar')
    expect(recortarFragmento('«Cita» textual', 3)).toBe('«Cita» textual')
  })
})

describe('preguntas generales sobre el documento', () => {
  test.each([
    '¿De qué trata el documento?',
    'de que se trata esto',
    'Haceme un resumen',
    '¿Cuáles son los temas principales?',
    '¿De qué habla el texto?',
    'resumí la clase',
  ])('«%s» es general', q => expect(esPreguntaGeneral(q)).toBe(true))

  test.each([
    '¿Qué es una variable?',
    '¿Cómo funciona el bucle FOR?',
    '¿Qué dijo el profe sobre el resumen de ventas?',
  ])('«%s» es específica', q => expect(esPreguntaGeneral(q)).toBe(false))
})

describe('fragmentos repartidos por todo el documento', () => {
  test('toma índices parejos desde el principio hasta el final', () => {
    expect(repartirIndices(20, 5)).toEqual([0, 5, 10, 14, 19])
  })
  test('si hay menos fragmentos que los pedidos, los toma todos', () => {
    expect(repartirIndices(3, 6)).toEqual([0, 1, 2])
  })
})

describe('chunker', () => {
  test('ningún fragmento (salvo el primero) empieza a mitad de palabra', () => {
    const texto = 'Los operadores aritméticos sirven para calcular valores numéricos. '.repeat(120)
    const chunks = chunkText(texto)
    expect(chunks.length).toBeGreaterThan(1)
    for (const c of chunks.slice(1)) expect(c).toMatch(/^(Los|operadores|aritméticos|sirven|para|calcular|valores|numéricos)/)
  })
})
