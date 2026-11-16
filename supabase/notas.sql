-- ArchiChat Sessions — notas y momentos marcados durante una sesión.
-- Correr en el SQL Editor de Supabase. Se puede correr más de una vez.
-- (En un proyecto nuevo no hace falta: ya está incluido en schema.sql)

CREATE TABLE IF NOT EXISTS public.notas_sesion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES public.sesiones(id) ON DELETE CASCADE NOT NULL,
  -- vacío = solo una marca ("esto es importante")
  texto TEXT NOT NULL DEFAULT '' CHECK (char_length(texto) <= 500),
  timestamp_segundos INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notas_sesion_sesion ON public.notas_sesion(sesion_id);

ALTER TABLE public.notas_sesion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notas_sesion_own" ON public.notas_sesion;
CREATE POLICY "notas_sesion_own" ON public.notas_sesion
  FOR ALL USING (
    sesion_id IN (SELECT id FROM public.sesiones WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    sesion_id IN (SELECT id FROM public.sesiones WHERE owner_id = auth.uid())
  );
