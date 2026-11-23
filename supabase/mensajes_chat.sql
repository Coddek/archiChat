-- ArchiChat — historial del chat de cada documento.
-- Correr en el SQL Editor de Supabase. Se puede correr más de una vez.
-- (En un proyecto nuevo no hace falta: ya está incluido en schema.sql)

CREATE TABLE IF NOT EXISTS public.mensajes_chat (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL DEFAULT auth.uid(),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL CHECK (char_length(content) <= 20000),
  -- fragmentos citados y nivel de respaldo (solo en las respuestas)
  sources JSONB,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensajes_chat_documento
  ON public.mensajes_chat(document_id, created_at);

ALTER TABLE public.mensajes_chat ENABLE ROW LEVEL SECURITY;

-- Cada cuenta ve, guarda y borra solo los mensajes de sus propios documentos
DROP POLICY IF EXISTS "mensajes_chat_own" ON public.mensajes_chat;
CREATE POLICY "mensajes_chat_own" ON public.mensajes_chat
  FOR ALL USING (
    user_id = auth.uid()
    AND document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND document_id IN (SELECT id FROM public.documents WHERE user_id = auth.uid())
  );
