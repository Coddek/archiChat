-- ArchiChat Sessions — cambios para la Fase 4.5 (la sesión como documento)
-- y para guardar las preguntas en vivo.
-- Se puede correr más de una vez sin romper nada.

-- 1. Permitir documentos de tipo 'sesion'
--    (el check actual solo acepta pdf, text y url; se busca por definición
--    porque no sabemos con qué nombre se creó)
DO $$
DECLARE c text;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'documents'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.documents DROP CONSTRAINT %I', c);
  END LOOP;
END $$;

ALTER TABLE public.documents ADD CONSTRAINT documents_source_type_check
  CHECK (source_type IN ('pdf', 'text', 'url', 'sesion'));

-- 2. Cada sesión apunta al documento que se genera al finalizarla
ALTER TABLE public.sesiones
  ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE SET NULL;

-- 3. Preguntas en vivo con sus respuestas (hoy se pierden al recargar)
CREATE TABLE IF NOT EXISTS public.preguntas_sesion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sesion_id UUID REFERENCES public.sesiones(id) ON DELETE CASCADE NOT NULL,
  pregunta TEXT NOT NULL,
  respuesta TEXT NOT NULL,
  timestamp_segundos INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_preguntas_sesion_sesion ON public.preguntas_sesion(sesion_id);

ALTER TABLE public.preguntas_sesion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preguntas_sesion_own" ON public.preguntas_sesion;
CREATE POLICY "preguntas_sesion_own" ON public.preguntas_sesion
  FOR ALL USING (
    sesion_id IN (SELECT id FROM public.sesiones WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    sesion_id IN (SELECT id FROM public.sesiones WHERE owner_id = auth.uid())
  );

-- 4. Verificación: debería mostrar el check nuevo, la columna y la política
SELECT 'check' AS que, pg_get_constraintdef(oid) AS detalle
  FROM pg_constraint WHERE conname = 'documents_source_type_check'
UNION ALL
SELECT 'columna', column_name || ' ' || data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sesiones' AND column_name = 'document_id'
UNION ALL
SELECT 'politica', policyname
  FROM pg_policies WHERE tablename = 'preguntas_sesion';
