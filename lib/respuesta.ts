// Ayudas para mostrar y preparar respuestas del chat.

// El modelo a veces escribe <br> dentro de las celdas de una tabla markdown.
// No se interpreta HTML (por seguridad), así que se separa en líneas a mano.
export function partirSaltos(texto: string): string[] {
  return texto.split(/<br\s*\/?>/i)
}

// Un fragmento que no es el primero del documento puede empezar a mitad de
// palabra (por el solapamiento entre fragmentos): se saltea ese pedazo.
export function recortarFragmento(texto: string, chunkIndex: number): string {
  if (chunkIndex === 0 || !/^[a-záéíóúñü]/.test(texto)) return texto
  const espacio = texto.indexOf(' ')
  if (espacio < 0 || espacio > 25) return texto
  return '…' + texto.slice(espacio + 1)
}

// Preguntas sobre el documento entero ("¿de qué trata?", "resumen"): no se
// parecen a ningún fragmento en particular, así que la búsqueda por similitud
// no sirve para elegir el contexto ni para medir el respaldo.
const GENERAL = [
  /\bde\s+qu[eé]\s+(se\s+)?trata\b/,
  /\bde\s+qu[eé]\s+habla\b/,
  // \b no sirve con letras acentuadas en JS: se usan espacios o bordes del texto
  /^(hac[eé]me\s+un\s+|dame\s+un\s+|un\s+)?resum(en|í|i|ir|ime|ímelo|imelo)(?=\s|$)/,
  /(^|\s)resum(í|i|ir)(?=\s|$)/,
  /\btemas?\s+(principal|principales|centrales|clave)\b/,
  /\bidea\s+(principal|central|general)\b/,
]

export function esPreguntaGeneral(pregunta: string): boolean {
  const q = pregunta.toLowerCase().replace(/[¿?¡!.,]/g, ' ').replace(/\s+/g, ' ').trim()
  return GENERAL.some(re => re.test(q))
}

// k índices repartidos parejo entre 0 y n-1 (para tomar fragmentos de todo el documento)
export function repartirIndices(n: number, k: number): number[] {
  if (n <= k) return Array.from({ length: n }, (_, i) => i)
  return Array.from({ length: k }, (_, i) => Math.round((i * (n - 1)) / (k - 1)))
}
