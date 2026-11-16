// lib/chunkRotation.ts
// Cuándo cortar un tramo de audio durante una sesión.
//
// Cortar cada 10 s exactos parte palabras al medio, y Whisper las escribe mal
// en los dos tramos. En cambio se espera a la primera pausa del que habla
// después de los 10 s; si no hay ninguna (música de fondo, alguien que no
// para), se corta igual a los 14 s para que el texto no tarde en aparecer.
//
// El mínimo es 10 s porque Whisper factura 10 s por pedido aunque el tramo sea
// más corto: tramos más cortos gastarían más cuota.

export const MIN_CHUNK_MS = 10_000
export const MAX_CHUNK_MS = 14_000

// Cada cuánto se mide el volumen y cuántas mediciones seguidas en silencio
// hacen una pausa (~300 ms). Menos que eso puede ser el corte de una
// consonante ("p", "t", "k") en el medio de una palabra.
export const LEVEL_SAMPLE_MS = 100
export const PAUSE_SAMPLES = 3
// Nivel (RMS) por debajo del cual se considera que nadie habla (~-40 dB)
export const PAUSE_RMS = 0.01

export function shouldCutChunk(elapsedMs: number, quietSamples: number, meterOk: boolean): boolean {
  // Sin medidor de volumen no se puede buscar una pausa: corte fijo, como antes
  if (!meterOk) return elapsedMs >= MIN_CHUNK_MS
  if (elapsedMs >= MAX_CHUNK_MS) return true
  return elapsedMs >= MIN_CHUNK_MS && quietSamples >= PAUSE_SAMPLES
}
