# archiChat

Chat inteligente con tus documentos potenciado por IA.

## ¿Qué hace?

Subís un PDF, pegás texto, o ingresás una URL. La app procesa el contenido, lo divide en fragmentos con overlap, genera embeddings semánticos, y te permite chatear con ese material en lenguaje natural.

La IA responde usando el contenido de tu documento. Si la pregunta no está relacionada al documento, puede responder desde su conocimiento general o buscar información en internet en tiempo real.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14 + Tailwind CSS + shadcn/ui |
| Backend | Next.js API Routes |
| Base de datos | Supabase (PostgreSQL + pgvector) |
| IA (chat) | Groq — llama-3.3-70b-versatile + compound-beta-mini (búsqueda web) |
| IA (fallback) | Google Gemini Flash — si Groq falla |
| IA (embeddings) | Gemini — gemini-embedding-001 |
| Deploy | Vercel |

## Decisiones técnicas

### Chunking con overlap
Los documentos se dividen en fragmentos de ~1500 caracteres con 200 de overlap. El overlap evita que una idea que cruza el límite entre dos chunks se pierda al momento de buscar.

### Búsqueda semántica con pgvector
En lugar de buscar por palabras exactas, buscamos por similitud semántica usando vectores en PostgreSQL. Esto permite encontrar información aunque el usuario no use las mismas palabras que el documento.

### Umbral de similitud
Si la similitud entre la pregunta y los chunks es menor a 0.3, la IA responde desde su conocimiento general en lugar de restringirse al documento. Así el chat es útil para cualquier pregunta, no solo las del documento.

### Fallback de IAs
Si Groq falla por rate limit, la app intenta automáticamente con Gemini Flash. Esto garantiza disponibilidad sin costo adicional.

## Características

- Subir documentos PDF, texto plano o URL
- Chat con streaming token por token
- Búsqueda semántica con pgvector
- Búsqueda web en tiempo real para preguntas fuera del documento
- Sugerencias automáticas de preguntas al abrir un documento
- Interfaz responsiva con modo claro y oscuro
- Sistema de confianza por respuesta (muestra qué tan relevantes fueron los fragmentos usados)
- Cada usuario configura sus propias API keys desde el panel de ajustes

## Setup local

1. Clonar el repo:
   ```bash
   git clone https://github.com/Coddek/archiChat
   cd archiChat
   npm install
   ```

2. Copiar variables de entorno:
   ```bash
   cp .env.example .env.local
   # Completar con tus API keys
   ```

3. Configurar Supabase:
   - Crear proyecto en supabase.com
   - Ejecutar el SQL de `/supabase/schema.sql` en el SQL Editor
   - Ejecutar el SQL de `/supabase/user_settings.sql` en el SQL Editor
   - Copiar la URL y las keys al `.env.local`

4. Iniciar el servidor:
   ```bash
   npm run dev
   ```

## Tests

```bash
npx vitest run
```

8 tests cubriendo el chunker y las validaciones de Zod.

## Proceso de desarrollo

Este proyecto fue desarrollado como proyecto final del Curso de IA para Desarrolladores usando:
- **Bolt.new**: prototipo inicial de la UI
- **Claude Code**: implementación del pipeline RAG, embeddings, validaciones y tests

Ver [PROCESO.md](./PROCESO.md) para el detalle completo de prompts y decisiones.

## Licencia

MIT
