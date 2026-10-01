import { describe, test, expect } from 'vitest'
import { cleanTranscript } from '../transcription'

describe('cleanTranscript', () => {

  test('une los segmentos con habla', () => {
    const text = cleanTranscript([
      { text: ' Hoy vamos a ver ', no_speech_prob: 0.01 },
      { text: 'árboles B+.', no_speech_prob: 0.05 },
    ])
    expect(text).toBe('Hoy vamos a ver árboles B+.')
  })

  test('descarta segmentos que Whisper marca como silencio', () => {
    const text = cleanTranscript([
      { text: 'Primera idea.', no_speech_prob: 0.02 },
      { text: 'Gracias.', no_speech_prob: 0.9 },
    ])
    expect(text).toBe('Primera idea.')
  })

  test('descarta las frases que Whisper inventa con silencio', () => {
    const text = cleanTranscript([
      { text: 'Subtítulos realizados por la comunidad de Amara.org', no_speech_prob: 0.1 },
      { text: '¡Gracias por ver el video!', no_speech_prob: 0.1 },
      { text: '...', no_speech_prob: 0.1 },
    ])
    expect(text).toBe('')
  })

  test('no descarta "gracias" dentro de una frase real', () => {
    const text = cleanTranscript([
      { text: 'Muchas gracias a todos por venir hoy.', no_speech_prob: 0.02 },
    ])
    expect(text).toBe('Muchas gracias a todos por venir hoy.')
  })
})

describe('cleanTranscript — repeticiones de Whisper', () => {

  test('descarta un tramo que repite el final del tramo anterior', () => {
    const text = cleanTranscript(
      [{ text: 'D. Rompe las cifras.', no_speech_prob: 0.1 }],
      'La sustitución de variables ya resuelve el problema. D. Rompe las cifras.'
    )
    expect(text).toBe('')
  })

  test('descarta segmentos repetidos dentro del mismo tramo', () => {
    const text = cleanTranscript([
      { text: 'Rompe las cifras.', no_speech_prob: 0.1 },
      { text: 'rompe las cifras', no_speech_prob: 0.1 },
    ])
    expect(text).toBe('Rompe las cifras.')
  })

  test('descarta texto demasiado repetitivo (compression ratio alto)', () => {
    const text = cleanTranscript([
      { text: 'la la la la la la la la la la', no_speech_prob: 0.1, compression_ratio: 3.1 },
    ])
    expect(text).toBe('')
  })

  test('mantiene texto nuevo aunque haya contexto previo', () => {
    const text = cleanTranscript(
      [{ text: 'Eso fue dominio 2 completo.', no_speech_prob: 0.05 }],
      'D. Rompe las cifras.'
    )
    expect(text).toBe('Eso fue dominio 2 completo.')
  })
})

describe('cleanTranscript — vocabulario', () => {

  test('descarta un segmento que solo repite el vocabulario', () => {
    const text = cleanTranscript(
      [{ text: 'K-Nearest Neighbors, Gentoo.', no_speech_prob: 0.2 }],
      '',
      'Clase 8 de Machine Learning. K-Nearest Neighbors, Gentoo, matriz de confusión'
    )
    expect(text).toBe('')
  })

  test('mantiene frases reales que usan palabras del vocabulario', () => {
    const text = cleanTranscript(
      [{ text: 'El pingüino Gentoo tiene la aleta más larga.', no_speech_prob: 0.05 }],
      '',
      'K-Nearest Neighbors, Gentoo'
    )
    expect(text).toBe('El pingüino Gentoo tiene la aleta más larga.')
  })
})
