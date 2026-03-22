// lib/chunker.ts
// Divide un texto largo en pedazos (chunks) con overlap
//
// CHUNK_SIZE: cuántos caracteres tiene cada chunk (~300 palabras)
// OVERLAP: cuántos caracteres se repiten entre chunks consecutivos
//          para no perder ideas que cruzan el límite entre dos chunks

const CHUNK_SIZE = 1500
const OVERLAP = 200

export function chunkText(text: string): string[] {
  // Limpiamos el texto: normalizamos saltos de línea y espacios
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  // Si el texto es más corto que un chunk, lo devolvemos tal cual
  if (cleaned.length <= CHUNK_SIZE) {
    return [cleaned]
  }

  const chunks: string[] = []
  let start = 0

  while (start < cleaned.length) {
    let end = start + CHUNK_SIZE

    // Si no llegamos al final, intentamos cortar en un punto o salto de línea
    // para no cortar una oración a la mitad
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('.', end)
      const lastNewline = cleaned.lastIndexOf('\n', end)
      const cutPoint = Math.max(lastPeriod, lastNewline)

      if (cutPoint > start + CHUNK_SIZE / 2) {
        end = cutPoint + 1
      }
    }

    chunks.push(cleaned.slice(start, end).trim())

    // El próximo chunk empieza OVERLAP caracteres antes del fin de este
    // Eso genera la superposición entre chunks
    start = end - OVERLAP
  }

  // Descartamos chunks muy cortos (menos de 50 chars) — no aportan info útil
  return chunks.filter(c => c.length > 50)
}
