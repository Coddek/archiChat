// lib/extractor.ts
// Extrae texto plano de cualquier tipo de fuente
//
// El objetivo es siempre el mismo: devolver un string con el texto limpio
// sin importar si la fuente es un PDF, texto directo o una página web

import * as cheerio from 'cheerio'

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

  // INTENTO 2: Gemini Vision — OCR para PDFs que son imágenes escaneadas
  // Gemini puede "ver" el contenido de imágenes y extraer el texto
  // Usamos la misma API key que ya tenemos configurada
  console.log('PDF sin texto suficiente, usando Gemini Vision para OCR...')

  const { GoogleGenerativeAI } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

  // Convertimos el buffer a base64 para mandárselo a Gemini
  const base64 = buffer.toString('base64')

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType: 'application/pdf',
        data: base64,
      },
    },
    'Extraé todo el texto de este documento. Devolvé únicamente el texto, sin comentarios ni explicaciones.',
  ])

  const extracted = result.response.text()

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
