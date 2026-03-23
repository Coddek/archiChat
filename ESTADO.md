# Estado actual — archiChat

## ✅ Completado

### Funcionalidad core
- Auth con email/password via Supabase
- CRUD de documentos (crear, leer, eliminar)
- Soporte de 3 tipos: PDF, texto plano, URL
- Pipeline RAG completo: extracción → chunks → embeddings → búsqueda semántica
- Chat con RAG activo + fallback a conocimiento general (threshold 0.3)
- Fallback de IA: Groq primario → Gemini Flash si falla

### Requisitos del TP
- ✅ Componente `ChatMessage` refactorizado en `components/ChatMessage.tsx`
- ✅ Validaciones con Zod en `lib/validations.ts` + usadas en `app/api/chat/route.ts`
- ✅ Manejo de errores con toasts (sonner)
- ✅ 8 tests con Vitest en `lib/__tests__/` (TP pide mínimo 3)
- ✅ README.md completo
- ✅ `.env.example`
- ✅ Código pusheado a GitHub

---

## ⏳ En progreso

- **Deploy en Vercel** — último push corrigió errores de build, esperando resultado

---

## ❌ Pendiente

- Confirmar URL de Vercel funcionando
- Sacar screenshot y agregarlo al README (`public/screenshot.png`)
- Completar `PROCESO.md` con prompts usados y dificultades

---

## Checklist del TP

```
✅ Repo público en GitHub con licencia MIT
✅ README con descripción, stack, setup y decisiones técnicas
✅ .env.example con todas las variables
⏳ App deployada en Vercel con URL funcional
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

## Archivos clave

| Archivo | Qué hace |
|---|---|
| `lib/chunker.ts` | Divide texto en chunks de 1500 chars con 200 overlap |
| `lib/extractor.ts` | Extrae texto de PDF (unpdf), URL (cheerio), texto plano |
| `lib/ai.ts` | Embeddings con Gemini, chat con Groq + fallback Gemini |
| `lib/pipeline.ts` | Orquesta todo el procesamiento de documentos |
| `lib/rag.ts` | Búsqueda semántica + generación de respuesta |
| `lib/validations.ts` | Schemas Zod para documentos y mensajes |
| `components/ChatMessage.tsx` | Componente de burbuja de chat |
| `lib/__tests__/` | 8 tests con Vitest |
