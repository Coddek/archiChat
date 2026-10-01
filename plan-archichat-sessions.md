# ArchiChat Sessions — Plan de desarrollo
## Tomador de notas con contexto en tiempo real

> **Cómo usar este documento:**
> - Tachá cada ítem cuando esté terminado (`- [x]`)
> - Si aparece un bug, anotalo debajo del paso con `> 🐛 Bug: descripción`
> - Pasale este archivo completo a Claude Code al inicio de cada sesión

---

## Contexto del proyecto

**Qué es:** Una nueva sección dentro de ArchiChat que transcribe audio en tiempo real, detecta conceptos y busca contexto automáticamente mientras escuchás una reunión, clase o video. Al final genera un resumen estructurado y **la sesión queda guardada como un documento más de ArchiChat**, para chatear con ella después con el RAG que ya existe.

**Dos momentos, dos usos distintos:**

| | Durante la sesión (en vivo) | Después (chat normal de ArchiChat) |
|---|---|---|
| Para qué | No perderte: entender en el momento | Estudiar / repasar tranquilo |
| Qué hace | Explica conceptos solo (sin que preguntes) + pregunta rápida | Chat completo con RAG sobre toda la sesión |
| Contexto | Los últimos minutos de transcripción, directo en el prompt | Toda la transcripción indexada (chunks + embeddings) |
| Ejemplos | "¿Qué es eso que acaba de decir?", "no entendí lo último" | "¿Qué dijo sobre árboles B+?", "puntos de acción", "armame preguntas de examen" |
| Se combina con | Nada, es de esa sesión | Otros documentos (el PDF de la materia + la clase) |

**Por qué es diferente a Otter/Fireflies:** Esos solo transcriben y resumen. Este sistema detecta conceptos en tiempo real y te explica qué significa lo que están diciendo, sin que vos lo pidas.

**Stack:**
- Frontend: Next.js + TypeScript (ya existe en ArchiChat)
> **Regla del proyecto: todo 100% gratis (free tier permanente).** Nada pago, nada de créditos de prueba que se terminan. Solo modelos estables (no `preview`, no alias `-latest`, no modelos que devuelvan "high demand").

- Transcripción: Groq `whisper-large-v3-turbo` (gratis, 8 horas de audio por día)
- LLM detección de conceptos: Gemini `gemini-3.5-flash-lite` — ver por qué abajo
- LLM pregunta en vivo, resumen y chat: Groq `openai/gpt-oss-120b` (fallback: `gemini-3.5-flash-lite`)
- Tareas cortas (clasificar intención, sugerencias): Groq `openai/gpt-oss-20b`

**Prueba de estabilidad (2026-09-30, 5 llamadas a cada modelo con keys free):**

| Modelo | Resultado | Tiempo típico | Uso |
|---|---|---|---|
| Groq `openai/gpt-oss-120b` | ✅ 5/5 | ~0,9 s | Chat, resumen, pregunta en vivo |
| Groq `openai/gpt-oss-20b` | ✅ 5/5 | ~0,8 s | Tareas cortas; búsqueda web con `browser_search` ✅ |
| Gemini `gemini-3.5-flash-lite` | ✅ 5/5 | ~1 s | Conceptos en vivo, fallback general |
| Gemini `gemini-2.5-flash` | ✅ 5/5 (un pico de 39 s) | ~4,5 s | Solo OCR de imágenes y búsqueda web de respaldo (`google_search` ✅) |
| Gemini `gemini-3.5-flash` | ✅ 5/5 pero lento | ~12 s | ❌ Muy lento para chat |
| Gemini `gemini-3.6-flash` | ⚠️ 4/5, "high demand" | — | ❌ Descartado |
| Gemini `gemini-3.8-flash` | ❌ 0/5, "high demand" | — | ❌ Descartado |
| Gemini `gemini-flash-latest` | ❌ 0/5, sin cuota free | — | ❌ Descartado |
| Gemini `gemini-2.5-flash-lite` | ❌ ya no existe | — | ❌ Descartado |
| `google_search` en `gemini-3.5-flash-lite` | ❌ sin cuota free | — | ❌ No usar para búsqueda web |

Una prueba no garantiza estabilidad futura: **todo llamado a un LLM debe tener fallback a otro proveedor** (Groq ↔ Gemini), para que si retiran un modelo no se caiga la app como pasó con Llama/Compound.
- ⚠️ Llama 3.3 70B, Llama 3.1 8B y Compound/Compound Mini **fueron retirados de Groq** (ago/sep 2026). Verificado con la API el 2026-09-30.
- Base de datos: Supabase (mismo proyecto de ArchiChat)
- Audio: `getDisplayMedia` (audio de pestaña / sistema) + `getUserMedia` (micrófono), mezclados con Web Audio API

**Límites de Groq free tier (validados en console.groq.com, Sep 2026):**
- Whisper (large-v3 y turbo): 20 req/min, 2.000 req/día, 7.200 seg de audio/hora, 28.800 seg de audio/día
- Whisper factura **mínimo 10 segundos por request** aunque mandes menos
- `openai/gpt-oss-120b` y `openai/gpt-oss-20b` (cada uno): 30 req/min, 1.000 req/día, **8.000 tokens/min, 200.000 tokens/día**
- ⚠️ **Los límites son por organización, no por API key ni por usuario.** Si los usuarios usan las keys del servidor, todos comparten la misma cuota. El chat normal de ArchiChat también gasta de la cuota de `gpt-oss-120b`.
- Los `gpt-oss` son modelos que "razonan" antes de responder: usar `reasoning_effort: 'low'` para gastar menos tokens y responder más rápido.

**Cuentas reales:**
- Chunks de 5 seg → 720 req/hora → el límite de 2.000 req/día alcanza para ~2,7 h/día. Además pagás 10 seg por cada 5 → se gasta el doble de cuota de audio.
- Chunks de 10 seg → 360 req/hora → ~5,5 h/día (por req/día) y 8 h/día (por segundos de audio). **Usamos 10 seg.**
- Detección de conceptos cada 20 seg → 180 req/hora, ~700 tokens cada una → ~126.000 tokens/hora. Con el límite de 200.000 tokens/día de Groq alcanza para **~1,5 h de sesión por día**, y además le saca cuota al chat. **Usamos Gemini Flash-Lite para la detección** (cuota separada de Groq) y dejamos `gpt-oss-120b` para la pregunta en vivo, el resumen y el chat.
- Si igual hace falta ahorrar: analizar cada 40 seg en vez de 20 (la mitad de requests).

---

## Fase previa — Arreglar el chat caído (modelos retirados)

> Groq retiró `llama-3.3-70b-versatile` (16/08/2026) y `compound-beta-mini` (21/09/2026). El chat respondía directo con esos modelos, sin fallback → cada mensaje fallaba.

- [x] Centralizar los nombres de modelos en un solo lugar (`lib/models.ts`) para que un retiro futuro sea un cambio de una línea
- [x] Reemplazar Llama 3.3 70B → `openai/gpt-oss-120b` (chat) y `openai/gpt-oss-20b` (tareas cortas)
- [x] Reemplazar Compound Mini → `gpt-oss-20b` con `browser_search` (fallback: Gemini 2.5 Flash con `google_search`)
- [x] Limpiar las marcas de cita `【1†L3-L4】` que devuelve `browser_search`
- [x] Fallback Gemini `3.5-flash-lite` en el streaming del chat (antes no tenía)
- [x] Fallback Gemini en `/api/suggest`
- [x] Tipos (`tsc`) + lint + tests (`vitest`, 8/8) sin errores
- [x] `npm run build` sin errores
- [x] Probar funciones con keys reales (script): chat ✅, búsqueda web ✅, Groq roto → Gemini ✅, Groq roto en web → Gemini con Google Search ✅, RAG completo con documento real ✅
- [x] Probar en la app con tu usuario logueado (usado en producción el 2026-09-30)
- [x] Commit + push a GitHub (`1652517`, 2026-09-30) → Vercel deploya solo
- [x] Confirmar que el deploy de Vercel terminó bien y probar en producción (el chat responde)

> 🐛 Bug (prueba en producción, doc de economía): "¿Cuánto está el dólar hoy?" respondió en **pesos mexicanos** con un dato del 10/09. Causas:
> 1. El prompt no dice la fecha ni el país del usuario
> 2. El chat con documento no manda el historial: cada pregunta llega sola al modelo
> 3. Las respuestas de búsqueda web muestran "4 fragmentos usados" del documento aunque no se usaron

- [x] Agregar fecha de hoy y país del usuario al prompt (país desde el header `x-vercel-ip-country` de Vercel; por defecto Argentina)
- [x] Mandar los últimos 6 mensajes de la conversación junto con la pregunta
- [x] Clasificar la intención viendo también la pregunta anterior ("¿y el blue?" → WEB)
- [x] No mostrar fragmentos del documento en respuestas de búsqueda web
- [x] Probar por script: "¿cuánto está el dólar hoy?" → pesos argentinos, fecha de hoy ✅; "¿y el blue?" → busca ✅; pregunta del apunte → usa el documento ✅

> 🐛 Bug: en una prueba la búsqueda respondió "no tengo acceso a internet". Causa: **una búsqueda con `browser_search` gasta ~6.000 tokens** y el límite es 8.000 tokens/min por modelo → se agotó; el respaldo `gemini-2.5-flash` estaba con "high demand"; terminó respondiendo Flash-Lite sin búsqueda.

- [x] Web: `gpt-oss-20b` → `gpt-oss-120b` (cada uno tiene su propio límite) → `gemini-2.5-flash` + Google Search (máx. 25 s) → Flash-Lite avisando "no pude consultar internet, probá en un minuto" (sin inventar cifras)
- [x] Chat con documento: `gpt-oss-120b` → `gpt-oss-20b` → Gemini Flash-Lite
- [x] Probado: con `gpt-oss-20b` agotado, respondió `gpt-oss-120b` sin que se note ✅

**⚠️ Capacidad real de búsqueda web (free):** 200.000 tokens/día por modelo ÷ ~6.000 por búsqueda ≈ **33 búsquedas/día por modelo, ~66/día entre los dos** (compartido entre todos los usuarios que usan las keys del servidor). Gemini 3.x con Google Search **no tiene cuota free** (probado); solo `gemini-2.5-flash`, que a veces tarda >1 min.

**Rotar API keys — Pendiente (probado 2026-09-30):** se probó una segunda key de Groq y resultó ser de la **misma organización** (`org_01km8v8...`) que la actual. Los límites son por organización, así que varias keys de la misma cuenta comparten la misma cuota y rotarlas no suma nada. Usar keys de otras cuentas para saltar los límites. La rotación que sí vale es **entre modelos y proveedores** (ya implementada) y que cada usuario pueda cargar su propia key (ya existe en Configuración).

---

## Fase 0 — Base de datos en Supabase

- [x] Ejecutar el SQL del schema en el SQL Editor de Supabase
- [x] Verificar que aparecen las 3 tablas en Table Editor: `sesiones`, `transcripciones`, `contextos` (verificado por API, 2026-09-30)
- [x] Verificar que RLS está activo en las 3 tablas (probado 2026-09-30: sin usuario, insert y select bloqueados en las 3)

**SQL a ejecutar:**
```sql
CREATE TABLE sesiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users NOT NULL,
  titulo TEXT,
  fecha TIMESTAMPTZ DEFAULT now(),
  estado TEXT DEFAULT 'activa' CHECK (estado IN ('activa', 'finalizada')),
  resumen TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE transcripciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE NOT NULL,
  texto TEXT NOT NULL,
  timestamp_segundos INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE contextos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES sesiones(id) ON DELETE CASCADE NOT NULL,
  concepto TEXT NOT NULL,
  explicacion TEXT NOT NULL,
  timestamp_segundos INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sesiones_owner ON sesiones(owner_id);
CREATE INDEX idx_transcripciones_sesion ON transcripciones(sesion_id);
CREATE INDEX idx_contextos_sesion ON contextos(sesion_id);

ALTER TABLE sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE transcripciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE contextos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sesiones_own" ON sesiones
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "transcripciones_own" ON transcripciones
  FOR ALL USING (
    sesion_id IN (SELECT id FROM sesiones WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    sesion_id IN (SELECT id FROM sesiones WHERE owner_id = auth.uid())
  );

CREATE POLICY "contextos_own" ON contextos
  FOR ALL USING (
    sesion_id IN (SELECT id FROM sesiones WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    sesion_id IN (SELECT id FROM sesiones WHERE owner_id = auth.uid())
  );
```

---

## Fase 1 — Captura de audio y transcripción básica

> **Objetivo de esta fase:** El micrófono escucha, el texto aparece en pantalla. Sin LLM todavía.

> **Por qué empezamos acá:** La captura de audio es lo más difícil y lo más crítico. Si esto no funciona bien, todo lo demás no sirve. Es mejor validarlo solo antes de agregar complejidad.

### 1.1 — Estructura de archivos nuevos en ArchiChat

- [x] Crear `/app/sesion/page.tsx` — página principal de sesión activa
- [x] Crear `/app/sesiones/page.tsx` — historial de sesiones
- [x] Crear `/hooks/useAudioCapture.ts` — hook que captura audio (pestaña/sistema + micrófono)
- [x] Crear `/hooks/useTranscription.ts` — hook que manda audio a Groq
- [x] Crear `/app/api/transcribir/route.ts` — endpoint que recibe audio y llama a Groq Whisper
- [x] Agregar link a "Sesiones" en la navegación existente de ArchiChat

### 1.2 — API Route para transcripción

- [x] Crear `/app/api/transcribir/route.ts`
- [x] Recibe un blob de audio (FormData)
- [x] Lo manda a Groq Whisper con `groq.audio.transcriptions.create()` (modelo `whisper-large-v3-turbo`, `language: 'es'`)
- [x] Reutilizar la lógica de keys de `lib/ai.ts` (key del usuario → fallback a `process.env.GROQ_API_KEY`), no duplicarla
- [x] Devuelve `{ texto: string, duracion_segundos: number }`
- [x] Manejar errores: rate limit (429), audio vacío, archivo muy grande

**Lógica clave — por qué usamos una API Route y no llamamos a Groq directo desde el cliente:**
La API key de Groq nunca debe estar en el navegador — cualquiera podría verla en las DevTools. La API Route corre en el servidor de Next.js (Vercel) y la key solo vive ahí.

### 1.3 — Hook useAudioCapture

**Fuente de audio — el usuario elige al iniciar:**
- [x] **"Pestaña del navegador"** (Meet, Zoom web, Teams web, YouTube, clases grabadas): `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` → el usuario elige la pestaña y tilda "Compartir audio de la pestaña". Descartar el track de video.
- [x] **"Pantalla completa + audio del sistema"** (app de escritorio de Zoom/Teams/Discord): mismo `getDisplayMedia`, eligiendo pantalla entera y tildando "Compartir audio del sistema". Funciona en Chrome/Edge en Windows (y macOS con Chrome 141+).
- [x] **"Micrófono"** (clase presencial, reunión en persona): `getUserMedia({ audio: true })`
- [x] **Opción "incluir mi voz"**: mezclar pestaña/sistema + micrófono con `AudioContext` → `createMediaStreamSource` ×2 → `createMediaStreamDestination`. Sin esto, en una reunión solo se transcribe a los demás, no a vos.
- [x] Si el usuario no tildó "compartir audio" (`stream.getAudioTracks().length === 0`) → mostrar error claro con instrucción de volver a elegir
- [x] Detectar cuando el usuario corta el compartir desde la barra de Chrome (`track.onended`) → pausar la sesión
- [x] Detectar soporte real antes de mostrar opciones (`'getDisplayMedia' in navigator.mediaDevices`) y ocultar las fuentes que no funcionan en ese navegador (ver tabla de compatibilidad abajo)
- [x] En navegadores sin captura de audio: ofrecer solo micrófono y avisar "para capturar reuniones o videos usá Chrome o Edge en una computadora"
- [x] Elegir el formato según el navegador con `MediaRecorder.isTypeSupported()`: `audio/webm` en Chrome/Edge/Firefox, `audio/mp4` en Safari/iOS. Whisper acepta los dos; mandar el nombre de archivo con la extensión correcta (`chunk.webm` / `chunk.mp4`)

**⚠️ Compatibilidad por navegador — leer antes de probar con usuarios:**

| Navegador | Pestaña | Pantalla + audio del sistema | Micrófono |
|---|---|---|---|
| Chrome / Edge — Windows | ✅ | ✅ | ✅ |
| Chrome / Edge — macOS | ✅ | ✅ desde Chrome 141 | ✅ |
| Firefox (escritorio) | ❌ sin audio | ❌ sin audio | ✅ |
| Safari (macOS) | ❌ sin audio | ❌ sin audio | ✅ |
| **iPhone / iPad (cualquier navegador)** | ❌ no existe `getDisplayMedia` | ❌ | ✅ con limitaciones |
| Android (Chrome) | ❌ | ❌ | ✅ |

**Lo que implica para iPhone:**
- En iOS todos los navegadores (incluido Chrome) usan el motor de Safari, así que **en iPhone solo hay micrófono**, sin importar qué navegador use el usuario de prueba.
- Sirve para clases presenciales o reuniones en persona. **No sirve para una videollamada en el mismo iPhone**: la app de Zoom/Meet toma el audio y, al salir de Safari o bloquear la pantalla, iOS suspende la página y se corta la grabación.
- `MediaRecorder` en iOS graba en `mp4`/AAC, no en webm (de ahí el ítem de `isTypeSupported` de arriba).
- Hay que mantener la pantalla encendida y Safari en primer plano mientras dura la sesión. Mostrar este aviso en la UI cuando se detecte iOS.
- [ ] Probar en un iPhone real antes de dárselo a usuarios de prueba: grabación de 5 min con la pantalla encendida, y confirmar qué pasa al bloquearla (esperado: se corta → la sesión debe pausarse y avisar, no perder lo transcripto)

**Captura en chunks:**
- [x] Chunks de **10 segundos**, **deteniendo y reiniciando el `MediaRecorder` en cada chunk** (NO usar `start(timeslice)`)
- [x] Exportar: `{ iniciar, detener, pausar, reanudar, estado, error, elapsedSeconds }` (la fuente la guarda la página)
- [x] Manejar caso: usuario deniega permiso
- [x] Manejar caso: navegador no soporta MediaRecorder

**Por qué NO `start(timeslice)`:**
Con `mediaRecorder.start(5000)` solo el primer blob tiene el encabezado del webm; los siguientes no son archivos válidos por sí solos y Whisper los rechaza. Reiniciando el recorder cada 10 seg, cada blob es un webm completo. Costo: se pueden perder unos milisegundos entre chunks (aceptable para transcripción).

**Por qué 10 segundos y no 5:**
Whisper factura mínimo 10 seg por request. Con 5 seg pagás el doble y además hacés el doble de requests (2.000/día por organización). 10 seg de delay sigue siendo "en tiempo real" para leer.

**Por qué no solo micrófono:**
Con el micrófono, el audio de una reunión con auriculares no se escucha nunca, y con parlantes llega con eco y ruido. Capturar la pestaña/sistema da el audio digital limpio.

### 1.4 — Hook useTranscription

- [x] Recibe cada chunk de audio del hook anterior
- [x] Lo manda a `/api/transcribir`
- [x] Acumula el texto en un array con timestamps
- [x] Maneja la cola: si llega un chunk mientras otro se está procesando, lo encola
- [x] Exportar: `{ transcripciones, procesando, error }`

### 1.5 — Página de sesión activa (UI básica)

- [x] Botón "Iniciar sesión" — pide nombre opcional + fuente de audio (pestaña / pantalla+sistema / micrófono, con check "incluir mi voz") y arranca
- [x] Indicador visual de que está grabando (punto rojo animado)
- [x] Área de texto que va mostrando la transcripción en tiempo real
- [x] Botón "Pausar / Reanudar"
- [x] Botón "Finalizar sesión"
- [x] Contador de tiempo transcurrido

### 1.6 — Guardar en Supabase

- [x] Al iniciar sesión: crear registro en tabla `sesiones`
- [x] Cada vez que llega texto: insertar en `transcripciones` con timestamp
- [x] Al finalizar: actualizar `estado` a 'finalizada' en `sesiones`
- [x] Extra: filtro de frases que Whisper inventa con silencio ("Gracias por ver", "Subtítulos por Amara.org") + 4 tests
- [x] Extra: Whisper recibe las últimas palabras transcriptas como contexto (continuidad entre tramos)
- [x] Extra: respaldo `whisper-large-v3-turbo` → `whisper-large-v3` (cada uno con su propio límite)
- [x] Probado por script: voz en español → texto en ~0,6–1,6 s ✅; silencio → vacío, sin frases inventadas ✅
- [x] Probar en el navegador con un video de YouTube (video de 9 min, 2026-09-30)
- [ ] Probar pestaña de Meet, audio de la computadora y micrófono

### ✅ Criterio de éxito Fase 1
Reproducir un video de YouTube en otra pestaña durante 2 minutos, capturar esa pestaña, y ver el texto aparecer en pantalla con menos de ~15 segundos de delay. Probar también con micrófono. El texto debe guardarse en Supabase.

---

## Fase 2 — Detección de conceptos y contexto automático

> **Objetivo:** Mientras transcribís, el sistema detecta automáticamente términos técnicos o desconocidos y los explica al costado.

> **Por qué después de la Fase 1:** Si mezclas audio + LLM desde el principio y algo falla, no sabés qué está fallando. Primero audio solo, después agregás la capa de inteligencia.

### 2.1 — API Route para análisis de conceptos

- [ ] Crear `/app/api/analizar-concepto/route.ts` — con **Gemini Flash-Lite** (`gemini-3.5-flash-lite`, ver límites arriba) y respuesta en JSON (`responseMimeType: 'application/json'`)
- [ ] Recibe: `{ texto: string, contexto_previo: string }`
- [ ] Prompt al LLM:
  ```
  Sos un asistente que ayuda a entender conversaciones en tiempo real.
  
  Contexto previo de la conversación:
  {contexto_previo}
  
  Texto nuevo:
  {texto}
  
  Analizá si en el texto nuevo aparece algún concepto técnico, término 
  especializado, sigla, o idea que un estudiante podría no conocer.
  
  Si encontrás uno, respondé EXACTAMENTE en este formato JSON:
  {"encontrado": true, "concepto": "nombre del concepto", "explicacion": "explicación breve en 2-3 oraciones, sin tecnicismos"}
  
  Si no hay ningún concepto nuevo relevante, respondé:
  {"encontrado": false}
  
  Solo respondé el JSON, nada más.
  ```
- [ ] Parsear la respuesta JSON
- [ ] Devolver `{ encontrado: boolean, concepto?: string, explicacion?: string }`

**Por qué este prompt específico:**
Pedimos JSON estricto porque parsear texto libre es frágil. El LLM puede alucinar formato si no le das una estructura exacta. Con `{"encontrado": false}` nos ahorramos procesamiento cuando no hay nada relevante.

### 2.2 — Hook useContextDetection

- [ ] Recibe texto nuevo cada vez que llega una transcripción
- [ ] Acumula texto hasta tener ~50 palabras o 20 segundos (lo que llegue primero) — con chunks de 10 seg son 2 chunks
- [ ] Pasarle al LLM la lista de conceptos ya detectados para que no repita
- [ ] Manda el lote a `/api/analizar-concepto` con los últimos 200 palabras como contexto previo
- [ ] Si encuentra concepto: guarda en tabla `contextos` de Supabase
- [ ] Exportar: `{ contextos, analizando }`

**Por qué 50 palabras o 20 segundos:**
En 20 segundos tenemos 2 chunks = suficiente texto para que el LLM detecte algo con sentido. Analizar cada chunk suelto da poco contexto y duplica los requests.

### 2.3 — Panel de contexto en la UI

- [ ] Panel lateral (o debajo en mobile) que muestra los contextos detectados
- [ ] Cada contexto aparece con: nombre del concepto en negrita + explicación
- [ ] Animación suave cuando aparece un concepto nuevo (no intrusiva)
- [ ] Badge contador: "3 conceptos detectados"
- [ ] Los conceptos más recientes aparecen arriba

### 2.4 — Pregunta rápida en vivo

- [x] Input chico debajo del panel de contexto: "Preguntá sobre lo que se está diciendo"
- [x] Crear `/app/api/sesion-pregunta/route.ts`: recibe `{ sesion_id, pregunta }`
- [x] Contexto = últimos ~10 minutos de transcripción (texto directo en el prompt, **sin RAG**) + conceptos detectados
- [x] Respuesta corta (2-4 oraciones), pensada para leer sin perder el hilo de la reunión
- [x] Botón rápido "¿Qué dijo recién?" → explica los últimos 60 segundos

### 2.5 — Ventana flotante (para no salir del video)

> Surgió al probar la Fase 1: el video está en una pestaña y archiChat en otra, así que para preguntar había que dejar el video.

- [x] Ventana flotante con **Document Picture-in-Picture** (Chrome/Edge 116+): queda siempre encima, incluso de la app de escritorio de Zoom
- [x] Contiene: reloj + estado, Pausar/Reanudar/Finalizar, últimas líneas de la transcripción, chat de preguntas rápidas
- [x] Botones rápidos: "¿Qué dijo recién?", "Explicámelo más simple", "Resumen hasta ahora"
- [x] Mismo estado que la página (React portal): lo que preguntás en la ventana aparece también en la página
- [x] Al elegir la pestaña, quedarse en archiChat (`CaptureController.setFocusBehavior('no-focus-change')`) para poder abrir la ventana
- [x] Temporizadores en un Web Worker: Chrome frena los `setInterval` de pestañas ocultas (después de 5 min, a 1 vez por minuto), los workers no
- [x] Sin framer-motion dentro de la ventana: usa `requestAnimationFrame` de la pestaña principal, que se congela cuando está oculta
- [x] Navegadores sin Document PiP (Firefox, Safari): ocultar el botón; se usa la página normal
- [x] Probado en el navegador con un video de 9 min (2026-09-30): transcripción y preguntas en vivo funcionan bien
- [x] Probar una sesión de más de 10 min con la pestaña oculta: clase real por Zoom, +26 min sin cortes ✅ (el Worker funciona)

> 🐛 Bug (prueba 2026-09-30): Whisper repitió "D. Rompe las cifras." 3 veces (08:10–08:30, con música/silencio) → se descartan tramos que repiten el final del anterior y segmentos con `compression_ratio` > 2,4 (+4 tests) ✅
> 🐛 Bug: "¿qué me perdí desde mi última pregunta?" respondía sobre otro minuto → cada pregunta viaja con el minuto en que se hizo ✅ (probado con la transcripción real: resume de 01:00 a 05:00)
> 💡 Mejora futura: palabras clave al iniciar la sesión, pasadas a Whisper como contexto, para que escriba bien términos técnicos ("Claude Code" y no "Cloud Code", "Glob" y no "Glove")

> 🐛 Bug (prueba 2026-09-30): dejó de transcribir en el minuto 5:20 con la pestaña oculta → freno de temporizadores de Chrome (se arregla con el Worker de arriba). Al finalizar tiró `stopTickerRef.current.call is not a function`: fue la recarga en caliente de Next.js mientras se editaba el hook en plena sesión (solo en desarrollo). Recargar la página antes de probar.

**Por qué sin RAG en vivo:**
10 minutos de habla son ~1.500 palabras, entran enteras en el prompt. Indexar con embeddings en vivo sería lento y gastaría cuota de Gemini sin necesidad. El RAG se usa después, cuando la sesión ya terminó (ver Fase 6).

> 🐛 Bug (clase real, 2026-09-30): el chat en vivo **le dio la razón a un concepto equivocado** (KNN "elige el grupo más cercano"), **inventó un minuto** (22:43) y tomó "la pregunta que hizo él" como la del usuario → prompt corrige en vez de confirmar, cita solo minutos reales, "él/el profe" = quien habla; razonamiento `medium` en preguntas en vivo ✅ (probado con la misma pregunta: ahora corrige)

### ✅ Criterio de éxito Fase 2
Hablar sobre un tema técnico (ej: "vamos a usar pgvector para búsqueda semántica con embeddings") y que el sistema detecte y explique "pgvector" y "embeddings" automáticamente en menos de 30 segundos.

---

## Fase 3 — Resumen final

> **Objetivo:** Al finalizar la sesión, generar un resumen estructurado de todo lo que se habló.

### 3.1 — API Route para resumen

- [ ] Crear `/app/api/resumir-sesion/route.ts`
- [ ] Recibe: `{ sesion_id: string }`
- [ ] Busca todas las transcripciones de esa sesión en Supabase
- [ ] Concatena el texto en orden cronológico
- [ ] Prompt al LLM:
  ```
  Sos un asistente que crea resúmenes de reuniones y clases.
  
  Transcripción completa:
  {transcripcion_completa}
  
  Creá un resumen estructurado con este formato exacto:
  
  ## Resumen general
  [2-3 oraciones con la idea principal de lo que se habló]
  
  ## Puntos clave
  - [punto 1]
  - [punto 2]
  - [punto 3]
  
  ## Decisiones o conclusiones
  - [si hay decisiones tomadas]
  
  ## Términos importantes mencionados
  - [lista de términos técnicos que aparecieron]
  ```
- [ ] Guardar el resumen en `sesiones.resumen`
- [ ] Devolver el resumen

**Por qué guardamos el resumen en la tabla sesiones:**
El resumen es un dato de la sesión, no un mensaje aparte. Si el usuario cierra la app y vuelve, el resumen ya está ahí sin tener que regenerarlo.

### 3.2 — UI de resumen

- [ ] Cuando el usuario toca "Finalizar", mostrar loader mientras se genera el resumen
- [ ] Mostrar el resumen en formato markdown renderizado
- [ ] Botón "Copiar resumen"
- [ ] Botón "Ver transcripción completa" (accordion que expande)

### ✅ Criterio de éxito Fase 3
Después de una sesión de 5 minutos sobre cualquier tema, el resumen captura los puntos principales y los términos técnicos mencionados.

---

## Fase 4 — Historial de sesiones

> **Objetivo:** Ver todas las sesiones pasadas y poder revisarlas.

### 4.1 — Página de historial

- [ ] Listar sesiones agrupadas por fecha
- [ ] Cada sesión muestra: título, fecha, duración, cantidad de conceptos detectados
- [ ] Click en una sesión → ver detalle completo

### 4.2 — Página de detalle de sesión

- [ ] Resumen arriba
- [ ] Transcripción completa con timestamps
- [ ] Panel de conceptos detectados durante esa sesión
- [ ] Opción de exportar como texto plano o markdown

### ✅ Criterio de éxito Fase 4
Poder revisar una sesión de hace 3 días con toda la transcripción y los conceptos detectados.

---

## Fase 4.5 — La sesión como documento de ArchiChat

> **Objetivo:** Al finalizar, la sesión aparece en el dashboard junto a los PDFs y URLs, y se puede chatear con ella con el chat normal (RAG) — sola o combinada con otros documentos.

### 4.5.1 — Base de datos
- [x] Correr `supabase/sessions.sql` en el SQL Editor de Supabase (2026-09-30):
  - amplía el check de `documents.source_type` para aceptar `'sesion'` (busca el check por definición, no por nombre)
  - agrega `sesiones.document_id`
  - crea la tabla `preguntas_sesion` (pregunta, respuesta, minuto) con RLS
- [x] Verificar el resultado: check, columna y política OK en el editor + tablas accesibles por API

### 4.5.2 — Indexación al finalizar
- [ ] Guardar también las preguntas en vivo con sus respuestas (hoy se pierden al recargar) e incluirlas en el documento: así el chat principal sabe qué no entendió el usuario
- [ ] Al finalizar la sesión (después del resumen): crear un registro en `documents` con `source_type = 'sesion'`, título = título de la sesión
- [ ] Texto a indexar: resumen + transcripción con marcas de tiempo (`[12:30] ...`) + conceptos detectados
- [ ] Reutilizar `processDocument` de `lib/pipeline.ts` (chunking + embeddings) — agregar el caso `'sesion'` que usa el texto tal cual
- [ ] Guardar `sesiones.document_id`

### 4.5.3 — UI
- [ ] En el dashboard, ícono distinto para documentos de tipo sesión (ej: micrófono)
- [ ] Desde el detalle de sesión: botón "Chatear con esta sesión" → `/chat/[document_id]`
- [ ] Las citas del chat muestran el minuto del fragmento

**Por qué reutilizar `documents` en vez de un chat aparte:**
Todo el pipeline (chunks, embeddings, `match_chunks`, fallback Groq→Gemini, búsqueda web) ya existe y funciona. Una sesión es "un documento hecho de audio".

### ✅ Criterio de éxito Fase 4.5
Terminar una clase de 20 min, ir al chat normal y preguntar "¿qué dijo sobre X?" → responde citando el fragmento con su minuto.

---

## Fase 5 — Polish y deploy

### 5.1 — UX improvements

- [x] Soporte para pausar y reanudar sin perder el contexto (usado en el recreo de la clase)
- [ ] Indicador de uso de la API (cuántos requests quedan del día — Groq devuelve headers `x-ratelimit-remaining-requests`)
- [ ] Decidir política de cuota compartida: si el usuario no tiene key propia, ¿límite de X minutos de sesión por día?
- [x] Modo oscuro (las páginas nuevas usan el tema de la app; la ventana flotante copia el tema)
- [ ] Mobile responsive — que funcione bien en celu (en celular solo existe la fuente micrófono, ver tabla de compatibilidad en 1.3)
- [ ] En iOS: aviso visible "mantené la pantalla encendida y Safari abierto" + pausar sesión automáticamente con `visibilitychange` cuando la página pasa a segundo plano

### 5.2 — Manejo de errores robusto

- [ ] Si Groq falla: reintentar automáticamente con backoff exponencial
- [ ] Si se alcanza el rate limit: pausar y avisar al usuario cuántos segundos esperar
- [ ] Si el usuario pierde conexión a internet: encolar chunks y reenviar cuando vuelve
- [ ] Si el audio es silencio: no mandar el chunk (detectar con análisis de energía del audio)

**Por qué detectar silencio:**
Si mandás silencio a Whisper igual te cobra 10 segundos mínimos. En una reunión hay pausas. Detectar que el audio tiene energía por debajo de un umbral ahorra requests.

### 5.3 — Deploy

- [x] Variables de entorno en Vercel: `GROQ_API_KEY` ya estaba de ArchiChat
- [x] Hacer push a GitHub → Vercel deploya automáticamente
- [ ] Probar en mobile desde la URL de Vercel

### ✅ Criterio de éxito Fase 5
La app funciona en el celu, maneja errores sin romperse y el deploy está en producción.

---

## Bugs y problemas encontrados

> Anotá acá los bugs a medida que aparecen para no perderlos

| # | Descripción | Fase | Estado |
|---|-------------|------|--------|
|   |             |      |        |

---

## Decisiones técnicas tomadas

> Para que Claude Code entienda el razonamiento detrás de cada decisión

| Decisión | Alternativa descartada | Por qué esta |
|----------|----------------------|--------------|
| Chunks de 10 segundos | 5 o 30 segundos | Whisper cobra mínimo 10 seg; 5 duplica la cuota, 30 es mucha espera |
| Reiniciar MediaRecorder por chunk | `start(timeslice)` | Con timeslice solo el primer blob es un webm válido |
| Audio de pestaña/sistema + mic opcional | Solo micrófono | Audio limpio de Meet/Zoom/YouTube, sin eco |
| Mismo producto en celular, solo con micrófono | Bloquear el uso en celular | En iPhone/Android no hay captura de audio de pestaña ni del sistema; el micrófono sigue sirviendo para clases presenciales |
| Detección cada 20 seg con Gemini Flash-Lite | Cada chunk / con Groq gpt-oss | El límite de 200K tokens/día de Groq no alcanza; Gemini tiene cuota aparte y Groq queda para el chat |
| Transcripción en tramos con Groq Whisper | Streaming real (Deepgram, ElevenLabs, AssemblyAI) | Groq es gratis permanente; los otros son pagos o solo dan crédito de prueba |
| Solo modelos estables y gratis | Modelos `preview`, alias `-latest`, planes pagos | Regla del proyecto; los `-latest` y 3.6/3.8 Flash fallaron por demanda o cuota en la prueba |
| Pregunta en vivo sin RAG | RAG en vivo | 10 min de texto entran en el prompt; más rápido y barato |
| Sesión = documento (`source_type 'sesion'`) | Chat separado para sesiones | Reutiliza todo el pipeline RAG existente |
| API Route para Groq | Llamar desde cliente | La API key no puede estar en el navegador |
| JSON estricto en prompt | Texto libre | Parseo confiable, sin alucinaciones de formato |
| Guardar resumen en sesiones | Tabla separada | El resumen es un dato de la sesión |

---

## Prompt para pasar a Claude Code al inicio de cada sesión

```
Estoy construyendo una feature de transcripción en tiempo real con 
detección de conceptos para ArchiChat, un proyecto Next.js con Supabase.

El plan completo está en este archivo MD. Estamos en la Fase X, paso Y.

Lo que ya funciona:
- [listar lo que tachaste]

Lo que quiero hacer ahora:
- [el próximo ítem del plan]

Si aparece un error, explicame por qué ocurre antes de resolverlo.
Quiero entender cada decisión técnica, no solo que funcione.
```

---

*Plan creado: Sep 2026 | Revisado 2026-09-30: límites validados, captura de pestaña/sistema, pregunta en vivo, sesión como documento | Proyecto: ArchiChat Sessions*
