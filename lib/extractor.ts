// lib/extractor.ts
// Extrae texto plano de cualquier tipo de fuente
//
// El objetivo es siempre el mismo: devolver un string con el texto limpio
// sin importar si la fuente es un PDF, texto directo o una página web

import * as cheerio from 'cheerio'

export async function extractFromPDF(buffer: Buffer): Promise<string> {
  // unpdf está diseñado para funcionar en entornos serverless y Next.js App Router
  // Recibe un ArrayBuffer y devuelve el texto plano del PDF
  const { extractText } = await import('unpdf')
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true })
  return text
}

export async function extractFromText(text: string): Promise<string> {
  // Para texto plano no hay nada que hacer, solo limpiamos espacios
  return text.trim()
}

export async function extractFromURL(url: string): Promise<string> {
  // 1. Hacemos fetch de la URL como si fuera un navegador
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' } // nos identificamos como navegador
  })

  if (!response.ok) {
    throw new Error(`No se pudo acceder a la URL: ${url}`)
  }

  // 2. Obtenemos el HTML crudo
  const html = await response.text()

  // 3. Cargamos el HTML en cheerio para poder manipularlo
  const $ = cheerio.load(html)

  // 4. Eliminamos elementos que no tienen contenido útil
  $('script, style, nav, footer, header, aside, iframe').remove()

  // 5. Extraemos solo el texto del body
  const text = $('body').text()

  // 6. Limpiamos espacios múltiples que quedan tras eliminar elementos
  return text
    .replace(/\s+/g, ' ')
    .trim()
}
