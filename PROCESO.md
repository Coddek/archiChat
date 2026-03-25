# Proceso de desarrollo — archiChat

Proyecto final del Curso de IA para Desarrolladores.

## Punto de partida

La idea surgió de una necesidad concreta: muchas veces tenés que leerte documentos largos para encontrar una sola respuesta. El objetivo fue construir una app que le permita a cualquier persona hacer preguntas en lenguaje natural sobre cualquier documento que cargue.

---

## Fase 1 — Prototipo de UI con Bolt.new

El primer paso fue armar la estructura visual de la app sin preocuparme por la lógica de IA. Usé Bolt.new para generar una interfaz funcional con:

- Pantalla de autenticación
- Dashboard de documentos
- Pantalla de chat

**Prompt inicial en Bolt.new:**
> Creá una app en Next.js 14 con App Router que tenga: login/signup con Supabase Auth, un dashboard donde se listen documentos del usuario, y una pantalla de chat. Usá Tailwind CSS y shadcn/ui. Diseño oscuro, minimalista.

El prototipo dio una base funcional pero con toda la lógica de IA pendiente.

---

## Fase 2 — Pipeline RAG con Claude Code

La parte técnica del proyecto fue implementada con Claude Code. Los pasos del pipeline RAG son:

### 2.1 Extracción de texto

Implementé tres extractores según el tipo de fuente:
- **PDF**: usando `pdf-parse` para extraer texto de binario
- **Texto plano**: sanitización del input directo
- **URL**: fetch + `cheerio` para extraer texto del HTML sin tags

### 2.2 Chunking con overlap

El texto extraído se divide en fragmentos de ~1500 caracteres con 200 de overlap. El overlap es clave: si una idea importante cruza el límite entre dos chunks, el overlap asegura que ningún fragmento quede incompleto.

**Prompt usado:**
> Implementá una función `chunkText(text: string): string[]` que divida el texto en fragmentos de 1500 caracteres con 200 de overlap. Los chunks deben respetar los límites de párrafos cuando sea posible. Filtrá chunks vacíos o menores a 50 caracteres.

### 2.3 Embeddings con Gemini

Cada chunk se convierte en un vector de 768 dimensiones usando el modelo `gemini-embedding-001`. Este vector es la "representación numérica del significado" del texto.

**Decisión técnica:** Elegí Gemini embeddings sobre OpenAI porque tiene capa gratuita y la calidad es comparable para español.

### 2.4 Almacenamiento en Supabase con pgvector

Los chunks y sus embeddings se guardan en una tabla `chunks` en PostgreSQL con la extensión `pgvector`. Esto permite búsquedas de similitud semántica directamente en la base de datos con la función `match_chunks` (creada con SQL personalizado).

### 2.5 Búsqueda semántica en tiempo de respuesta

Cuando el usuario hace una pregunta:
1. La pregunta se convierte en embedding
2. Se buscan los 4 chunks más similares con `cosine_similarity`
3. Si la similitud máxima es > 0.3, se considera que la pregunta es relevante al documento
4. Se construye el prompt con esos 4 fragmentos como contexto

### 2.6 Detección de intención

Antes de responder, la app clasifica la pregunta en:
- `DOC`: pregunta sobre el documento → responde usando los chunks
- `WEB`: el usuario pide buscar en internet → usa `compound-beta-mini` de Groq (modelo con acceso a web en tiempo real)
- `GENERAL`: pregunta general → responde desde conocimiento propio

**Prompt de clasificación:**
```
Clasificá la siguiente pregunta en UNA de estas categorías:
- WEB: si el usuario pide buscar en internet, comparar precios, ver otros sitios, info actual
- DOC: si pregunta sobre el contenido del documento
- GENERAL: cualquier otra pregunta
```

---

## Fase 3 — Streaming y UX del chat

Implementé streaming SSE (Server-Sent Events) para mostrar la respuesta token por token, lo que hace que la interfaz se sienta mucho más responsiva. El route de chat usa `ReadableStream` de la Web API nativa.

También agregué:
- **Sugerencias automáticas**: al abrir un chat, la app genera 3 preguntas relevantes basadas en los primeros chunks del documento
- **Badge de confianza**: cada respuesta muestra el porcentaje de similitud del mejor chunk encontrado
- **Fuentes desplegables**: el usuario puede ver qué fragmentos del documento usó la IA para responder

---

## Fase 4 — Refinamiento con Claude Code

### Light mode / Dark mode
La app usa variables CSS con valores HSL y Tailwind para el theming. Un bug crítico encontrado: Tailwind requiere que los colores semánticos estén envueltos en `hsl()` en `tailwind.config.ts`, de lo contrario genera CSS inválido y los fondos quedan transparentes.

### Responsive design
Se agregó soporte mobile con:
- Sidebar con overlay en mobile, fijo en desktop
- Breakpoints `md:` para padding, tipografía y layout
- Touch targets de al menos 44px

### Sistema de API keys por usuario
Para que cualquier persona pueda usar la app trayendo sus propias claves de API, se implementó un sistema de configuración por usuario con:
- Tabla `user_settings` en Supabase con RLS
- Modal de onboarding para usuarios nuevos
- Gear icon en dashboard y chat para acceder a configuración en cualquier momento

---

## Desafíos y soluciones

| Desafío | Solución |
|---|---|
| Rate limit de Gemini embeddings | Delay de 1s cada 10 chunks en el pipeline |
| Groq puede fallar por rate limit | Fallback automático a Gemini Flash |
| `next build` más estricto que `next dev` | Agregar tipos correctos (`LucideIcon`, `Chunk`) y eslint-disable comments justificados |
| Texto invisible en light mode | Bug en `tailwind.config.ts` — colores sin `hsl()` wrapper generaban CSS inválido |
| Borders diferentes entre light y dark | Usar `border-border/40 dark:border-white/5` en lugar de solo una de las dos |

---

## Tests

Se implementaron 8 tests con Vitest cubriendo:

- **chunker.test.ts** (3 tests): texto corto no se divide, texto largo sí, no genera chunks vacíos
- **validations.test.ts** (5 tests): título muy corto falla, URL inválida falla, datos válidos pasan, pregunta vacía falla, pregunta válida pasa

```bash
npx vitest run
```

---

## Herramientas usadas

- **Bolt.new**: prototipo inicial de la UI
- **Claude Code**: pipeline RAG, embeddings, validaciones, tests, light mode, responsive, sistema de API keys
- **Supabase**: base de datos, autenticación, pgvector
- **Groq**: inferencia LLM (llama-3.3-70b-versatile, compound-beta-mini)
- **Google AI Studio**: embeddings (gemini-embedding-001), fallback (Gemini Flash)
- **Vercel**: deploy continuo desde GitHub
