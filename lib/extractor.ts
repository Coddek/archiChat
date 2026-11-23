// lib/extractor.ts
// Extrae texto plano de cualquier tipo de fuente
//
// El objetivo es siempre el mismo: devolver un string con el texto limpio
// sin importar si la fuente es un PDF, texto directo o una página web

import * as cheerio from 'cheerio'
import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { MODELS } from './models'

// Bloques que se convierten en párrafos separados (\n\n) para que el chunker
// pueda cortar entre ideas y no a mitad de una.
const BLOQUES = 'h1, h2, h3, h4, h5, h6, p, li, pre, blockquote, figcaption, dt, dd, tr'

// Contenido principal de una página, sin menús, botones ni barras laterales.
// Usa Readability (el "modo lectura" de Firefox). null si no encuentra un artículo.
export function extractFromHTML(html: string, url: string): string | null {
  const { document } = parseHTML(html)
  // Readability necesita saber la URL para resolver links relativos
  try { Object.defineProperty(document, 'documentURI', { value: url }) } catch {}
  const article = new Readability(document as unknown as Document).parse()
  if (!article?.content) return null

  const { document: limpio } = parseHTML(`<html><body>${article.content}</body></html>`)
  const partes: string[] = []
  limpio.querySelectorAll(BLOQUES).forEach((el: Element) => {
    // Un <li> o <p> adentro de otro bloque ya cuenta en su contenedor
    if (el.parentElement?.closest(BLOQUES)) return
    // En una fila de tabla, las celdas van separadas para no pegar palabras
    const crudo = el.tagName === 'TR'
      ? Array.from(el.querySelectorAll('th, td')).map(c => c.textContent ?? '').join(' | ')
      : el.textContent ?? ''
    const texto = crudo.replace(/\s+/g, ' ').trim()
    if (texto) partes.push(texto)
  })
  const texto = partes.join('\n\n').trim()
  return texto.length >= MIN_ARTICLE_LENGTH ? texto : null
}

// Por debajo de esto, lo que encontró Readability no es un artículo
const MIN_ARTICLE_LENGTH = 200

// Umbral mínimo para considerar que unpdf extrajo texto real.
// Si está por debajo, el PDF probablemente es una imagen escaneada.
const MIN_PDF_TEXT_LENGTH = 100

export async function extractFromPDF(buffer: Buffer): Promise<string> {
  // INTENTO 1: unpdf — extrae texto de PDFs con texto digital
  const { extractText } = await import('unpdf')
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
  const { text } = await extractText(new Uint8Array(arrayBuffer), { mergePages: true })

  if (text && text.trim().length >= MIN_PDF_TEXT_LENGTH) {
    return text
  }

  // INTENTO 2: Gemini Vision via REST API — OCR para PDFs que son imágenes escaneadas
  // Usamos la misma REST API que en lib/ai.ts (sabemos que funciona)
  console.log('PDF sin texto suficiente, usando Gemini Vision para OCR...')

  const base64 = buffer.toString('base64')

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODELS.geminiVision}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: 'application/pdf', data: base64 } },
            { text: 'Extraé todo el texto de este documento. Devolvé únicamente el texto, sin comentarios ni explicaciones.' },
          ]
        }]
      }),
    }
  )

  if (!response.ok) {
    throw new Error(`Gemini Vision falló: ${response.status}`)
  }

  const data = await response.json()
  const extracted = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''

  if (!extracted || extracted.trim().length < MIN_PDF_TEXT_LENGTH) {
    throw new Error('No se pudo extraer texto del PDF. El archivo puede estar corrupto o protegido.')
  }

  return extracted
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

      // Primero Readability: solo el contenido, sin menús ni botones del sitio
      try {
        const articulo = extractFromHTML(html, url)
        if (articulo) return articulo
      } catch (error) {
        console.warn('Readability falló, se usa la extracción simple:', error)
      }

      // Respaldo: todo el texto de la página
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
