# DocChat — Plan completo de implementación
> App de RAG: subís documentos (PDF, texto, URL) y chateás con ellos usando IA.
> Stack: Next.js + Tailwind + shadcn/ui + Supabase + pgvector + Groq (gratis)

---

## Antes de arrancar — Cuentas necesarias

Creá estas cuentas si no las tenés. Todas son gratis:

- [ ] **Supabase** → https://supabase.com (proyecto nuevo, anotá la URL y la anon key)
- [ ] **Groq** → https://console.groq.com (API key gratis, modelo: llama-3.1-70b-versatile)
- [ ] **Gemini** → https://aistudio.google.com (API key gratis, modelo: gemini-1.5-flash)
- [ ] **Vercel** → https://vercel.com (conectado a tu GitHub)
- [ ] **GitHub** → repo nuevo vacío llamado `docchat`

Abrí un archivo `PROCESO.md` en la raíz del proyecto y anotá cada prompt que uses durante el desarrollo. Lo vas a necesitar para el documento de entrega del TP.

---

## FASE 1 — Prototipo base con Bolt.new

### Paso 1.1 — Generar el prototipo

Abrí https://bolt.new y pegá este prompt exacto. **Guardalo en tu PROCESO.md antes de enviarlo.**

```
Creame una app web llamada "DocChat" con Next.js 14 App Router, Tailwind CSS y shadcn/ui.

Es una app donde el usuario sube documentos y chatea con ellos usando IA.

Stack requerido:
- Next.js 14 con App Router y TypeScript
- Tailwind CSS + shadcn/ui para la UI
- Supabase para auth y base de datos
- Diseño oscuro, minimalista

Pantallas que necesito:

1. /auth → Login y registro con email/password via Supabase Auth

2. /dashboard → Lista de documentos del usuario con:
   - Título del documento
   - Tipo (PDF / Texto / URL) con un badge de color distinto por tipo
   - Fecha de creación
   - Botón para eliminar
   - Botón grande "Nuevo documento" arriba a la derecha

3. /upload → Formulario con 3 tabs:
   - Tab "PDF": input para subir archivo PDF
   - Tab "Texto": textarea para pegar texto largo
   - Tab "URL": input para ingresar una URL
   - Campo de título en todos los tabs
   - Botón "Procesar documento"
   - Solo UI por ahora, el botón puede mostrar un toast "Procesando..."

4. /chat/[id] → Pantalla de chat:
   - Sidebar izquierdo con lista de documentos del usuario
   - Panel principal con historial de mensajes (burbujas user/assistant)
   - Input de texto abajo con botón enviar
   - Header con el título del documento activo
   - Solo UI por ahora, los mensajes pueden ser hardcodeados

CRUD de documentos:
- Crear: desde /upload guarda en Supabase tabla "documents"
  con campos: id, user_id, title, source_type, created_at
- Leer: en /dashboard lista los documentos del usuario logueado
- Eliminar: botón en cada documento con confirmación

No implementes embeddings ni lógica de IA todavía.
Solo estructura, UI y CRUD básico con Supabase.
```

### Paso 1.2 — Mientras Bolt genera

Sacá screenshots de:
- [ ] El prompt que enviaste
- [ ] El prototipo generado en pantalla (antes de exportar)
- [ ] Las pantallas principales (dashboard, upload, chat)

Estos screenshots van al documento de proceso del TP.

### Paso 1.3 — Exportar a GitHub

1. En Bolt.new → botón "Export" o "Connect to GitHub"
2. Conectá al repo `docchat` que creaste
3. Cloná el repo localmente: `git clone https://github.com/TU_USUARIO/docchat`
4. Abrí la carpeta en VS Code con Claude Code

---

## FASE 2 — Setup de Supabase

### Paso 2.1 — Activar pgvector

En Supabase → SQL Editor, ejecutá:

```sql
create extension if not exists vector;
```

### Paso 2.2 — Crear las tablas

Ejecutá esto en el SQL Editor de Supabase:

```sql
-- Documentos subidos por el usuario
create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text not null,
  source_type text check (source_type in ('pdf', 'text', 'url')),
  raw_content text,
  created_at timestamptz default now()
);

-- Chunks del documento con su embedding
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents on delete cascade,
  content text not null,
  embedding vector(1536),
  chunk_index int not null
);

-- Conversaciones (una por documento por usuario)
create table conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  document_id uuid references documents on delete cascade,
  created_at timestamptz default now()
);

-- Mensajes del chat
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations on delete cascade,
  role text check (role in ('user', 'assistant')) not null,
  content text not null,
  sources jsonb,
  created_at timestamptz default now()
);

-- Row Level Security (RLS): cada usuario solo ve sus datos
alter table documents enable row level security;
alter table chunks enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;

create policy "users see own documents"
  on documents for all using (auth.uid() = user_id);

create policy "users see own chunks"
  on chunks for all using (
    document_id in (select id from documents where user_id = auth.uid())
  );

create policy "users see own conversations"
  on conversations for all using (auth.uid() = user_id);

create policy "users see own messages"
  on messages for all using (
    conversation_id in (
      select id from conversations where user_id = auth.uid()
    )
  );
```

### Paso 2.3 — Crear la función de búsqueda semántica

```sql
create or replace function match_chunks(
  query_embedding vector(1536),
  match_document_id uuid,
  match_count int default 4
)
returns table (
  id uuid,
  content text,
  chunk_index int,
  similarity float
)
language sql stable as $$
  select
    id,
    content,
    chunk_index,
    1 - (embedding <=> query_embedding) as similarity
  from chunks
  where document_id = match_document_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
```

### Paso 2.4 — Variables de entorno

Creá `.env.local` en la raíz del proyecto:

```env
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key
GROQ_API_KEY=tu_groq_api_key
GEMINI_API_KEY=tu_gemini_api_key
```

Creá también `.env.example` con los mismos campos pero sin valores (para el repo público):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
GROQ_API_KEY=
GEMINI_API_KEY=
```

Agregá `.env.local` al `.gitignore`.

---

## FASE 3 — Pipeline de procesamiento (el corazón del RAG)

Pedile a Claude Code que cree estos archivos. Podés pasarle el código como referencia o pedirle que lo implemente desde el comentario.

### Paso 3.1 — Instalá las dependencias necesarias

```bash
npm install groq-sdk pdf-parse cheerio zod
npm install -D @types/pdf-parse
```

### Paso 3.2 — Cliente de IA con fallback

Creá `lib/ai.ts`:

```typescript
// lib/ai.ts
// Cliente de IA con fallback automático: Groq primario, Gemini si falla

import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Genera un embedding para un texto dado
// Un embedding es un array de números que representa el significado del texto
export async function getEmbedding(text: string): Promise<number[]> {
  // Groq no tiene endpoint de embeddings, usamos su API de chat
  // para generar un vector de características del texto.
  // Alternativa: usar la API de embeddings de OpenAI o Cohere (ambas tienen free tier)
  
  // Por ahora usamos el endpoint de Groq con un prompt especial
  // TODO en Paso 3.3: integrar API de embeddings dedicada
  throw new Error('Implementar en paso 3.3')
}

// Llama a la IA con fallback automático
export async function callAI(prompt: string): Promise<string> {
  // Intento 1: Groq (rápido, gratuito)
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.1-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
    })
    return response.choices[0].message.content ?? ''
  } catch (error) {
    console.warn('Groq falló, intentando con Gemini...', error)
  }

  // Intento 2: Gemini Flash (fallback gratuito)
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        }),
      }
    )
    const data = await response.json()
    return data.candidates[0].content.parts[0].text
  } catch (error) {
    console.error('Gemini también falló', error)
    throw new Error('Todos los proveedores de IA fallaron')
  }
}
```

### Paso 3.3 — Embeddings con Groq

Groq no tiene API de embeddings propia. Vas a usar **Together AI** que tiene embeddings gratis:

1. Creá cuenta en https://api.together.xyz (gratis)
2. Conseguí tu API key
3. Agregá al `.env.local`: `TOGETHER_API_KEY=tu_key`

Actualizá `lib/ai.ts` con esta función:

```typescript
export async function getEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.together.xyz/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.TOGETHER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'togethercomputer/m2-bert-80M-8k-retrieval',
      input: text,
    }),
  })
  
  if (!response.ok) throw new Error('Error generando embedding')
  
  const data = await response.json()
  return data.data[0].embedding
}
```

> **Nota para entender:** el modelo de embeddings convierte texto en un array de 768 números
> que representan el "significado" semántico del texto. Textos similares tienen
> arrays de números similares. Eso permite buscar por significado, no por palabras exactas.

### Paso 3.4 — Chunking con overlap

Creá `lib/chunker.ts`:

```typescript
// lib/chunker.ts
// Divide un texto largo en pedazos (chunks) con overlap
// 
// ¿Por qué overlap? Si una idea cruza el límite entre dos chunks,
// sin overlap la IA nunca la ve completa. Con overlap, los últimos
// N caracteres del chunk anterior se repiten al inicio del siguiente.

const CHUNK_SIZE = 1500    // caracteres por chunk (aprox 300 palabras)
const OVERLAP = 200        // caracteres que se repiten entre chunks

export function chunkText(text: string): string[] {
  // Primero limpiamos el texto
  const cleaned = text
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (cleaned.length <= CHUNK_SIZE) {
    return [cleaned]
  }

  const chunks: string[] = []
  let start = 0

  while (start < cleaned.length) {
    let end = start + CHUNK_SIZE

    // Si no estamos al final, intentamos cortar en un punto o salto de línea
    // para no cortar palabras a la mitad
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
    start = end - OVERLAP
  }

  return chunks.filter(c => c.length > 50) // descartamos chunks muy cortos
}
```

### Paso 3.5 — Extractor de texto por tipo de fuente

Creá `lib/extractor.ts`:

```typescript
// lib/extractor.ts
// Extrae texto plano de cualquier tipo de fuente

import pdf from 'pdf-parse'
import * as cheerio from 'cheerio'

export async function extractFromPDF(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer)
  return data.text
}

export async function extractFromText(text: string): Promise<string> {
  return text.trim()
}

export async function extractFromURL(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  })
  
  if (!response.ok) throw new Error(`No se pudo acceder a la URL: ${url}`)
  
  const html = await response.text()
  const $ = cheerio.load(html)
  
  // Eliminamos elementos que no tienen contenido útil
  $('script, style, nav, footer, header, aside').remove()
  
  // Extraemos el texto del body
  const text = $('body').text()
  
  return text
    .replace(/\s+/g, ' ')
    .trim()
}
```

### Paso 3.6 — Pipeline completo

Creá `lib/pipeline.ts`:

```typescript
// lib/pipeline.ts
// Orquesta todo el proceso: recibe el documento, lo procesa y guarda en Supabase

import { createClient } from '@supabase/supabase-js'
import { chunkText } from './chunker'
import { extractFromPDF, extractFromText, extractFromURL } from './extractor'
import { getEmbedding } from './ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // necesitás agregar esta variable
)

type SourceType = 'pdf' | 'text' | 'url'

interface ProcessInput {
  documentId: string
  sourceType: SourceType
  content: string | Buffer  // texto/URL como string, PDF como Buffer
}

export async function processDocument({ documentId, sourceType, content }: ProcessInput) {
  
  // PASO 1: Extraer texto según el tipo
  let rawText: string
  
  if (sourceType === 'pdf') {
    rawText = await extractFromPDF(content as Buffer)
  } else if (sourceType === 'url') {
    rawText = await extractFromURL(content as string)
  } else {
    rawText = await extractFromText(content as string)
  }
  
  if (!rawText || rawText.length < 50) {
    throw new Error('No se pudo extraer texto suficiente del documento')
  }

  // PASO 2: Dividir en chunks
  const chunks = chunkText(rawText)
  console.log(`Documento dividido en ${chunks.length} chunks`)

  // PASO 3: Generar embeddings y guardar
  // Procesamos de a uno para no saturar la API
  for (let i = 0; i < chunks.length; i++) {
    const embedding = await getEmbedding(chunks[i])
    
    const { error } = await supabase.from('chunks').insert({
      document_id: documentId,
      content: chunks[i],
      embedding,
      chunk_index: i,
    })
    
    if (error) throw error
    
    console.log(`Chunk ${i + 1}/${chunks.length} procesado`)
  }

  // Actualizar el documento con el texto raw (útil para debug)
  await supabase
    .from('documents')
    .update({ raw_content: rawText.slice(0, 5000) }) // guardamos los primeros 5000 chars
    .eq('id', documentId)

  return { chunksProcessed: chunks.length }
}
```

---

## FASE 4 — El chat con RAG

### Paso 4.1 — Función de query RAG

Creá `lib/rag.ts`:

```typescript
// lib/rag.ts
// El corazón del sistema: recibe una pregunta y devuelve una respuesta
// usando los chunks más relevantes del documento como contexto

import { createClient } from '@supabase/supabase-js'
import { getEmbedding, callAI } from './ai'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface RAGResult {
  answer: string
  sources: Array<{
    content: string
    chunk_index: number
    similarity: number
  }>
}

export async function ragQuery(
  question: string,
  documentId: string
): Promise<RAGResult> {

  // PASO 1: Convertir la pregunta a embedding
  const questionEmbedding = await getEmbedding(question)

  // PASO 2: Buscar los chunks más relevantes en Supabase
  // match_chunks es la función SQL que creamos en Fase 2
  const { data: relevantChunks, error } = await supabase.rpc('match_chunks', {
    query_embedding: questionEmbedding,
    match_document_id: documentId,
    match_count: 4,
  })

  if (error) throw error
  if (!relevantChunks || relevantChunks.length === 0) {
    return {
      answer: 'No encontré información relevante en el documento para responder esa pregunta.',
      sources: [],
    }
  }

  // PASO 3: Armar el contexto con los chunks encontrados
  const context = relevantChunks
    .map((chunk: any, i: number) => `[Fragmento ${i + 1}]:\n${chunk.content}`)
    .join('\n\n---\n\n')

  // PASO 4: Construir el prompt
  // La instrucción "responde SOLO con el contexto" es clave
  // para evitar que la IA invente cosas que no están en el documento
  const prompt = `Sos un asistente que responde preguntas sobre documentos.
Respondé la siguiente pregunta usando ÚNICAMENTE la información del contexto.
Si la respuesta no está en el contexto, decí exactamente: "No encontré esa información en el documento."
No inventes ni agregues información que no esté en el contexto.

CONTEXTO DEL DOCUMENTO:
${context}

PREGUNTA: ${question}

RESPUESTA:`

  // PASO 5: Llamar a la IA (con fallback automático)
  const answer = await callAI(prompt)

  // PASO 6: Devolver respuesta + sources (citations)
  // Las sources le muestran al usuario qué fragmentos usó la IA
  return {
    answer,
    sources: relevantChunks.map((chunk: any) => ({
      content: chunk.content.slice(0, 150) + '...',
      chunk_index: chunk.chunk_index,
      similarity: Math.round(chunk.similarity * 100),
    })),
  }
}
```

### Paso 4.2 — API Routes

Creá `app/api/process/route.ts`:

```typescript
// app/api/process/route.ts
// Endpoint que recibe el documento y dispara el pipeline

import { NextRequest, NextResponse } from 'next/server'
import { processDocument } from '@/lib/pipeline'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    
    const documentId = formData.get('documentId') as string
    const sourceType = formData.get('sourceType') as 'pdf' | 'text' | 'url'
    const content = formData.get('content')

    if (!documentId || !sourceType || !content) {
      return NextResponse.json(
        { error: 'Faltan campos requeridos' },
        { status: 400 }
      )
    }

    let processedContent: string | Buffer

    if (sourceType === 'pdf' && content instanceof File) {
      const buffer = Buffer.from(await content.arrayBuffer())
      processedContent = buffer
    } else {
      processedContent = content as string
    }

    const result = await processDocument({
      documentId,
      sourceType,
      content: processedContent,
    })

    return NextResponse.json({ success: true, ...result })
    
  } catch (error: any) {
    console.error('Error procesando documento:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
```

Creá `app/api/chat/route.ts`:

```typescript
// app/api/chat/route.ts
// Endpoint del chat: recibe pregunta + documentId, devuelve respuesta RAG

import { NextRequest, NextResponse } from 'next/server'
import { ragQuery } from '@/lib/rag'

export async function POST(req: NextRequest) {
  try {
    const { question, documentId, conversationId } = await req.json()

    if (!question || !documentId) {
      return NextResponse.json(
        { error: 'Falta question o documentId' },
        { status: 400 }
      )
    }

    const result = await ragQuery(question, documentId)

    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Error en chat:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno' },
      { status: 500 }
    )
  }
}
```

---

## FASE 5 — Mejoras que pide el TP (hacelas en Cursor)

Cada uno de estos puntos usá Cursor para implementarlo. **Guardá el prompt que usaste en PROCESO.md.**

### Paso 5.1 — Refactorizar un componente

Le pedís a Cursor:
```
Refactorizá el componente de mensaje del chat en un archivo separado
components/ChatMessage.tsx con TypeScript y props tipadas.
Debe recibir: role ('user'|'assistant'), content (string),
sources (opcional, array de objetos con content y similarity).
Si role es 'assistant' y hay sources, mostrar los fragmentos
usados como referencias expandibles al final del mensaje.
```

### Paso 5.2 — Validaciones con Zod

Le pedís a Cursor:
```
Creá un archivo lib/validations.ts con schemas de Zod para:
1. DocumentSchema: title (string, min 3 chars, max 100),
   sourceType ('pdf'|'text'|'url'), content (string, min 50 chars).
   Si sourceType es 'url', content debe ser una URL válida.
2. MessageSchema: question (string, min 2 chars, max 2000)
Usá estos schemas en los formularios de upload y en el input del chat.
```

### Paso 5.3 — Manejo de errores con toasts

Le pedís a Cursor:
```
Agregá manejo de errores con toasts de shadcn/ui en:
- El proceso de upload: "Procesando documento...", "✓ Listo" o "✗ Error al procesar"
- El chat: "✗ Error al conectar con la IA, intentando alternativa..."
- Las operaciones de Supabase: toast genérico de error
Usá el componente Toaster de shadcn ya instalado.
```

### Paso 5.4 — Rate limiting básico

Le pedís a Cursor:
```
Implementá rate limiting básico en las API routes.
Guardá en Supabase una tabla simple:
  rate_limits(user_id, requests_today, last_reset)
Máximo 50 requests por día por usuario en /api/chat.
Si supera el límite, devolver 429 con mensaje claro.
```

---

## FASE 6 — Tests mínimos (el TP pide 3)

Instalá Vitest:
```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react
```

Creá `lib/__tests__/chunker.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { chunkText } from '../chunker'

describe('chunkText', () => {
  
  // TEST 1: texto corto no se divide
  test('texto corto queda en un solo chunk', () => {
    const shortText = 'Este es un texto corto que no debería dividirse.'
    const chunks = chunkText(shortText)
    expect(chunks).toHaveLength(1)
    expect(chunks[0]).toBe(shortText)
  })

  // TEST 2: texto largo se divide en múltiples chunks
  test('texto largo se divide en múltiples chunks', () => {
    const longText = 'palabra '.repeat(1000) // ~7000 chars
    const chunks = chunkText(longText)
    expect(chunks.length).toBeGreaterThan(1)
  })

  // TEST 3: hay overlap entre chunks consecutivos
  test('chunks consecutivos tienen contenido en común (overlap)', () => {
    const longText = 'Este es el inicio. '.repeat(200)
    const chunks = chunkText(longText)
    
    if (chunks.length >= 2) {
      // Las últimas palabras del chunk 0 deben aparecer al inicio del chunk 1
      const endOfChunk0 = chunks[0].slice(-100)
      const startOfChunk1 = chunks[1].slice(0, 100)
      
      // Al menos algunas palabras deben coincidir
      const wordsEnd = endOfChunk0.split(' ').filter(w => w.length > 3)
      const wordsStart = startOfChunk1.split(' ').filter(w => w.length > 3)
      const overlap = wordsEnd.filter(w => wordsStart.includes(w))
      
      expect(overlap.length).toBeGreaterThan(0)
    }
  })

})
```

Creá `lib/__tests__/validations.test.ts`:

```typescript
import { describe, test, expect } from 'vitest'
import { DocumentSchema, MessageSchema } from '../validations'

describe('DocumentSchema', () => {
  
  // TEST 4: rechaza documento sin título
  test('falla si el título está vacío', () => {
    const result = DocumentSchema.safeParse({
      title: '',
      sourceType: 'text',
      content: 'Contenido de prueba que es suficientemente largo'
    })
    expect(result.success).toBe(false)
  })

  // TEST 5: rechaza URL inválida
  test('falla si sourceType es url y el content no es URL válida', () => {
    const result = DocumentSchema.safeParse({
      title: 'Doc de prueba',
      sourceType: 'url',
      content: 'esto no es una url'
    })
    expect(result.success).toBe(false)
  })

  // TEST 6: acepta datos válidos
  test('pasa con datos correctos', () => {
    const result = DocumentSchema.safeParse({
      title: 'Mi documento',
      sourceType: 'text',
      content: 'Este es un contenido válido que tiene más de cincuenta caracteres sin duda.'
    })
    expect(result.success).toBe(true)
  })

})
```

Ejecutá los tests:
```bash
npx vitest run
```

---

## FASE 7 — Deploy en Vercel

### Paso 7.1 — Preparar el repo

```bash
git add .
git commit -m "feat: implementación completa de DocChat con RAG"
git push origin main
```

### Paso 7.2 — Deploy

1. Entrá a https://vercel.com
2. "New Project" → importá el repo `docchat`
3. En "Environment Variables" agregá todas las variables del `.env.local`
4. Click "Deploy"

### Paso 7.3 — Variables de entorno en Supabase

En Supabase → Settings → API, copiá la **service_role key** (distinta a la anon key) y agregala a Vercel como `SUPABASE_SERVICE_ROLE_KEY`. Esta key se usa en el pipeline de procesamiento del lado del servidor.

---

## FASE 8 — Documentación (entregable del TP)

### README.md

Reemplazá el README generado por Bolt con este template:

```markdown
# DocChat

Chat inteligente con tus documentos usando RAG (Retrieval-Augmented Generation).

## ¿Qué hace?

Subís un PDF, pegás texto, o ingresás una URL. La app procesa el contenido,
lo divide en fragmentos con overlap, genera embeddings semánticos, y te permite
chatear con ese material en lenguaje natural.

La IA responde usando únicamente el contenido de tu documento y te muestra
qué fragmentos usó para construir cada respuesta.

## Stack

- **Frontend**: Next.js 14 + Tailwind CSS + shadcn/ui
- **Backend**: Next.js API Routes
- **Base de datos**: Supabase (PostgreSQL + pgvector)
- **IA**: Groq (Llama 3.1 70B) con fallback a Gemini Flash
- **Embeddings**: Together AI (m2-bert-80M)
- **Deploy**: Vercel

## Decisiones técnicas

### Chunking con overlap
Los documentos se dividen en fragmentos de ~1500 caracteres con 200 de overlap.
El overlap evita que una idea que cruza el límite entre dos chunks se pierda.

### Búsqueda semántica con pgvector
En lugar de buscar por palabras exactas, buscamos por similitud semántica
usando vectores en PostgreSQL. Esto permite encontrar información aunque
el usuario no use las mismas palabras que el documento.

### Fallback de IAs
Si Groq falla por rate limit, la app intenta automáticamente con Gemini Flash.
Esto garantiza disponibilidad sin costo adicional.

## Setup local

1. Clonar el repo:
   \`\`\`bash
   git clone https://github.com/TU_USUARIO/docchat
   cd docchat
   npm install
   \`\`\`

2. Copiar variables de entorno:
   \`\`\`bash
   cp .env.example .env.local
   # Completar con tus API keys
   \`\`\`

3. Ejecutar migraciones en Supabase:
   Correr los SQLs de la carpeta `/supabase/migrations` en el SQL Editor

4. Iniciar el servidor:
   \`\`\`bash
   npm run dev
   \`\`\`

## Tests

\`\`\`bash
npx vitest run
\`\`\`

## Demo

[URL de la app deployada en Vercel]
```

### PROCESO.md

Al final del proyecto completá este archivo que fuiste llenando:

```markdown
# Documento de Proceso — DocChat

## Herramientas de IA usadas
- Bolt.new: generación del prototipo inicial
- Claude Code (Cursor): implementación del pipeline RAG y mejoras
- Groq API: modelo de lenguaje principal
- Gemini API: fallback del modelo

## Prompts usados en Bolt.new
[los prompts que usaste]

## Screenshots: prototipo inicial vs final
[adjuntar imágenes]

## Cambios realizados con Claude Code en Cursor
- Pipeline de chunking: prompt → "..."
- Función ragQuery: prompt → "..."
- Validaciones Zod: prompt → "..."
- Refactor ChatMessage: prompt → "..."
- Rate limiting: prompt → "..."

## Decisiones técnicas y por qué
- Chunk size 1500 chars: balance entre contexto y costo de tokens
- Overlap 200 chars: preservar ideas que cruzan límites de chunks
- Groq como primario: latencia baja, free tier generoso
- pgvector en lugar de búsqueda full-text: precisión semántica

## Dificultades y cómo las resolví
[completar durante el desarrollo]

## Tiempo estimado vs real
- Sin IA: ~35 horas estimadas
- Con IA: ~12 horas reales
```

---

## Checklist final de entrega

```
□ Repo público en GitHub con licencia MIT
□ README completo con descripción, stack, setup y decisiones técnicas
□ .env.example con todas las variables (sin valores)
□ App deployada en Vercel con URL funcional
□ Auth funcionando (registro + login con email)
□ CRUD completo de documentos
□ Pipeline RAG funcionando (PDF + texto + URL)
□ Chat con citations (muestra qué fragmentos usó)
□ 1 componente refactorizado (ChatMessage)
□ Validaciones con Zod
□ Manejo de errores con toasts
□ Fallback de IAs (Groq → Gemini)
□ Mínimo 6 tests pasando (npx vitest run → todo verde)
□ PROCESO.md completado con prompts y screenshots
```

---

## Cuando te trabés

No es si te trabás, es cuándo. Para cada bloqueo:

1. Describí el error exacto a Claude Code en Cursor
2. Si el error es de Supabase, revisá los logs en Supabase → Logs
3. Si el error es de la IA, revisá que las API keys estén bien en `.env.local`
4. Si el error es de pgvector, verificá que ejecutaste `create extension vector` en Supabase

Documentá los problemas y soluciones en PROCESO.md. El TP pide esto explícitamente y es lo más valioso para aprender.
