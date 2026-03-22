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

// Umbral mínimo de caracteres para considerar que Cheerio extrajo contenido útil.
// Si la página cargó contenido con JavaScript, Cheerio va a devolver muy poco texto.
const MIN_CONTENT_LENGTH = 500

export async function extractFromURL(url: string): Promise<string> {
  // INTENTO 1: Cheerio — rápido, sin dependencias externas
  // Funciona bien en páginas estáticas donde el contenido está en el HTML original
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })

    if (response.ok) {
      const html = await response.text()
      const $ = cheerio.load(html)
      $('script, style, nav, footer, header, aside, iframe').remove()
      const text = $('body').text().replace(/\s+/g, ' ').trim()

      // Si Cheerio extrajo suficiente contenido, lo usamos directamente
      if (text.length >= MIN_CONTENT_LENGTH) {
        return text
      }
      console.log(`Cheerio extrajo poco contenido (${text.length} chars), intentando con Jina...`)
    }
  } catch (error) {
    console.warn('Cheerio falló, intentando con Jina...', error)
  }

  // INTENTO 2: Jina AI Reader — maneja páginas con JavaScript
  // Jina renderiza la página completa y devuelve el contenido en markdown limpio
  // No requiere API key, es gratuito
  const jinaUrl = `https://r.jina.ai/${url}`
  const jinaResponse = await fetch(jinaUrl, {
    headers: { 'Accept': 'text/plain' }
  })

  if (!jinaResponse.ok) {
    throw new Error(`No se pudo acceder a la URL ni con Cheerio ni con Jina: ${url}`)
  }

  return jinaResponse.text()
}
