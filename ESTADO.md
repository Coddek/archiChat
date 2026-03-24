# Estado actual — archiChat
> Última actualización: 2026-03-23

---

## ✅ Completado

### Requisitos del TP (Opción A)
- ✅ Auth con email/password via Supabase
- ✅ CRUD de documentos (crear, leer, eliminar)
- ✅ UI responsiva con Tailwind + shadcn/ui
- ✅ Componente `ChatMessage` refactorizado en `components/ChatMessage.tsx`
- ✅ Validaciones con Zod en `lib/validations.ts` + usadas en `app/api/chat/route.ts`
- ✅ Manejo de errores con toasts (sonner)
- ✅ 8 tests con Vitest en `lib/__tests__/` (TP pide mínimo 3)
- ✅ README.md completo
- ✅ `.env.example`
- ✅ Deploy en Vercel funcionando
- ✅ Código en GitHub (github.com/Coddek/archiChat)

### Funcionalidad extra (más allá del TP)
- ✅ Pipeline RAG completo (PDF + texto + URL)
- ✅ Embeddings semánticos con Gemini (3072 dims)
- ✅ Búsqueda semántica con pgvector en Supabase
- ✅ Fallback de IA: Groq → Gemini Flash
- ✅ URL scraping: Cheerio → Jina AI como fallback
- ✅ Búsqueda web en tiempo real con Groq Compound Mini
- ✅ Detección inteligente de intención: RAG / general / búsqueda web

---

## ⏳ En testeo

- **Compound Mini + búsqueda web** — funciona pero ajustando prompts para que busque mejor

---

## ❌ Pendiente para entrega

| Tarea | Detalle |
|---|---|
| Screenshot | Sacar screenshot de la app y guardarlo en `public/screenshot.png` |
| PROCESO.md | Completar con prompts usados, dificultades y soluciones |

---

## Checklist del TP

```
✅ Repo público en GitHub con licencia MIT
✅ README con descripción, stack, setup y decisiones técnicas
✅ .env.example con todas las variables
✅ App deployada en Vercel con URL funcional
✅ Auth funcionando (registro + login con email)
✅ CRUD completo de documentos
✅ Pipeline RAG funcionando (PDF + texto + URL)
✅ 1 componente refactorizado (ChatMessage)
✅ Validaciones con Zod
✅ Manejo de errores con toasts
✅ Fallback de IAs (Groq → Gemini)
✅ Mínimo 3 tests pasando (tenemos 8)
❌ PROCESO.md completado con prompts y screenshots
```

---

## Roadmap — lo que falta antes de entregar

### 1. Screenshot (5 min)
Sacar screenshot de la app en Vercel y guardarlo en `public/screenshot.png`.
Ya está referenciado en el README.

### 2. PROCESO.md (el más importante para el TP)
El TP pide un documento que incluya:
- Prompts iniciales usados en Bolt.new/Lovable
- Screenshots del prototipo inicial vs final
- Cambios realizados con Claude Code (con prompts usados)
- Dificultades encontradas y cómo las resolviste
- Comparación: tiempo estimado sin IA vs tiempo real

---

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `lib/chunker.ts` | Divide texto en chunks de 1500 chars con 200 overlap |
| `lib/extractor.ts` | Extrae texto — Cheerio primero, Jina AI como fallback |
| `lib/ai.ts` | Embeddings Gemini, chat Groq/Llama + Compound Mini + fallback Gemini |
| `lib/pipeline.ts` | Orquesta todo el procesamiento de documentos |
| `lib/rag.ts` | RAG + detección de intención (doc / general / web search) |
| `lib/validations.ts` | Schemas Zod para documentos y mensajes |
| `components/ChatMessage.tsx` | Componente de burbuja de chat |
| `lib/__tests__/` | 8 tests con Vitest |
