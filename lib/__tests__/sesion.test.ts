import { describe, test, expect } from 'vitest'
import { buildSummaryPrompt, buildSessionDocument, notasConMinutos, describirSesion, terminosClave } from '../sesion'

const lineas = [
  { texto: 'Hoy vemos índices en Postgres.', timestamp_segundos: 0 },
  { texto: 'Un índice B-tree sirve para búsquedas por rango.', timestamp_segundos: 12 },
  { texto: 'El índice GIN es para texto completo.', timestamp_segundos: 25 },
]

describe('notasConMinutos', () => {

  test('una nota escrita queda con su minuto', () => {
    const texto = notasConMinutos([{ texto: 'Entra en el parcial', timestamp_segundos: 20 }], lineas)
    expect(texto).toContain('[00:20] Entra en el parcial')
  })

  test('un momento marcado sin texto muestra lo que se estaba diciendo', () => {
    const texto = notasConMinutos([{ texto: '', timestamp_segundos: 20 }], lineas)
    expect(texto).toContain('[00:20] Momento marcado')
    // A los 20 s todavía se estaba diciendo el tramo que empezó a los 12 s
    expect(texto).toContain('Un índice B-tree sirve para búsquedas por rango.')
    expect(texto).not.toContain('GIN')
  })

  test('una marca antes de la primera línea no inventa contexto', () => {
    const texto = notasConMinutos(
      [{ texto: '', timestamp_segundos: 3 }],
      [{ texto: 'Arranca tarde.', timestamp_segundos: 10 }]
    )
    expect(texto).toBe('[00:03] Momento marcado')
  })
})

describe('notas en el resumen y en el documento', () => {
  const notas = [{ texto: 'Entra en el parcial', timestamp_segundos: 20 }]

  test('el prompt del resumen incluye las notas y pide la sección', () => {
    const prompt = buildSummaryPrompt('Bases de datos', lineas, [], [], notas)
    expect(prompt).toContain('Entra en el parcial')
    expect(prompt).toContain('## Lo que marcaste')
  })

  test('sin notas, el prompt no pide la sección', () => {
    const prompt = buildSummaryPrompt('Bases de datos', lineas, [], [])
    expect(prompt).not.toContain('## Lo que marcaste')
  })

  test('el documento de la sesión incluye las notas', () => {
    const doc = buildSessionDocument('Bases de datos', '2026-11-16T15:00:00Z', 'Resumen.', lineas, [], [], notas)
    expect(doc).toContain('## Notas y momentos marcados')
    expect(doc).toContain('[00:20] Entra en el parcial')
  })

  test('sin notas, el documento no tiene la sección', () => {
    const doc = buildSessionDocument('Bases de datos', '2026-11-16T15:00:00Z', 'Resumen.', lineas, [])
    expect(doc).not.toContain('Notas y momentos marcados')
  })
})

describe('descripción de una sesión a partir de su resumen', () => {
  const resumen = `## Resumen general
La clase explicó qué es la inflación y cómo se mide con el índice de precios al consumidor. También se vio por qué una suba aislada no alcanza.

## Puntos clave
- Definición de inflación (00:10)

## Términos importantes
- **Inflación**: suba generalizada y sostenida de los precios.
- **IPC**: índice que sigue el precio de una canasta.
- **Canasta básica**: conjunto de bienes de referencia.
- **Deflación**: baja sostenida de precios.`

  test('toma la primera oración del resumen general', () => {
    expect(describirSesion(resumen)).toBe(
      'La clase explicó qué es la inflación y cómo se mide con el índice de precios al consumidor.'
    )
  })

  test('recorta una oración muy larga sin cortar palabras', () => {
    const largo = `## Resumen general\n${'palabra '.repeat(60).trim()}.`
    const d = describirSesion(largo, 80)!
    expect(d.length).toBeLessThanOrEqual(81)
    expect(d.endsWith('…')).toBe(true)
    expect(d).not.toMatch(/palab…$/)
  })

  test('sin resumen o sin la sección, no hay descripción', () => {
    expect(describirSesion(null)).toBeNull()
    expect(describirSesion('## Puntos clave\n- algo')).toBeNull()
  })

  test('saca hasta tres términos importantes', () => {
    expect(terminosClave(resumen)).toEqual(['Inflación', 'IPC', 'Canasta básica'])
  })

  test('sin la sección de términos, la lista queda vacía', () => {
    expect(terminosClave('## Resumen general\nAlgo.')).toEqual([])
    expect(terminosClave(null)).toEqual([])
  })
})
