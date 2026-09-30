// lib/transcription.ts
// Transcripción de audio con Groq Whisper para ArchiChat Sessions.
// Recibe un tramo de ~10 segundos y devuelve el texto limpio.

import Groq from 'groq-sdk'
import { MODELS } from './models'
import type { UserKeys } from './ai'

// Segmento de la respuesta verbose_json de Whisper (solo los campos que usamos)
export interface WhisperSegment {
  text: string
  no_speech_prob: number
  compression_ratio?: number
}

// Frases que Whisper "inventa" cuando el audio es silencio o ruido.
// Salen de los subtítulos con los que se entrenó el modelo.
const HALLUCINATIONS = [
  /^gracias\.?$/i,
  /^¡?gracias por (ver|mirar|su atención).*$/i,
  /^subt[ií]tulos? (realizados? )?(por|de) .*$/i,
  /amara\.org/i,
  /^suscr[ií]bete.*$/i,
  /^[.…\s]*$/,
]

// Segmentos con más de este valor de "probabilidad de que no haya habla" se descartan
const NO_SPEECH_THRESHOLD = 0.6
// Texto muy repetitivo (se comprime demasiado): típico de Whisper en bucle
const MAX_COMPRESSION_RATIO = 2.4

const normalize = (t: string) => t.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/g, ' ').trim()

// Arma el texto final a partir de los segmentos, descartando silencio y alucinaciones.
// `previousText` es lo último transcripto: con música o silencio Whisper a veces
// repite en bucle el contexto que le pasamos ("D. Rompe las cifras." ×3).
export function cleanTranscript(segments: WhisperSegment[], previousText = ''): string {
  const previous = normalize(previousText)
  const kept: string[] = []
  for (const segment of segments) {
    const text = segment.text.trim()
    const norm = normalize(text)
    if (segment.no_speech_prob >= NO_SPEECH_THRESHOLD) continue
    if ((segment.compression_ratio ?? 0) > MAX_COMPRESSION_RATIO) continue
    if (HALLUCINATIONS.some(re => re.test(text))) continue
    // Repite lo anterior (del tramo previo o del mismo tramo)
    if (norm && (previous.endsWith(norm) || normalize(kept.at(-1) ?? '') === norm)) continue
    kept.push(text)
  }
  return kept.join(' ').replace(/\s+/g, ' ').trim()
}

export interface TranscriptionResult {
  texto: string
  duracion_segundos: number
}

// Transcribe un tramo de audio. `previousText` son las últimas palabras ya
// transcriptas: Whisper las usa como contexto para no cortar frases ni cambiar
// la ortografía de los nombres entre un tramo y el siguiente.
export async function transcribeAudio(
  audio: File,
  previousText: string,
  keys?: UserKeys
): Promise<TranscriptionResult> {
  const groq = new Groq({ apiKey: keys?.groq || process.env.GROQ_API_KEY! })
  let lastError: unknown

  for (const model of [MODELS.whisper, MODELS.whisperFallback]) {
    try {
      const response = await groq.audio.transcriptions.create({
        file: audio,
        model,
        language: 'es',
        response_format: 'verbose_json',
        temperature: 0,
        ...(previousText && { prompt: previousText.slice(-200) }),
      })
      // verbose_json trae segments y duration, pero el SDK tipa solo `text`
      const verbose = response as unknown as { segments?: WhisperSegment[]; duration?: number }
      return {
        texto: cleanTranscript(verbose.segments ?? [{ text: response.text, no_speech_prob: 0 }], previousText),
        duracion_segundos: Math.round(verbose.duration ?? 0),
      }
    } catch (error) {
      console.warn(`Whisper ${model} falló`, error)
      lastError = error
    }
  }
  throw lastError
}
