-- archiChat — schema completo para un proyecto nuevo de Supabase.
-- Correr en el SQL Editor; después correr user_settings.sql.
-- (sessions.sql es la migración que se aplicó sobre una base existente:
--  en un proyecto nuevo no hace falta, ya está incluida acá)

create extension if not exists vector;

-- ─── Documentos y chat (RAG) ──────────────────────────────────────────────────

create table documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  title text not null,
  source_type text constraint documents_source_type_check
    check (source_type in ('pdf', 'text', 'url', 'sesion')),
  raw_content text,
  created_at timestamptz default now()
);

-- Fragmentos con su embedding (gemini-embedding-001 = 3072 dimensiones)
create table chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents on delete cascade,
  content text not null,
  embedding vector(3072),
  chunk_index int not null
);

alter table documents enable row level security;
alter table chunks enable row level security;

create policy "users see own documents"
  on documents for all using (auth.uid() = user_id);

create policy "users see own chunks"
  on chunks for all using (
    document_id in (select id from documents where user_id = auth.uid())
  );

-- Búsqueda semántica: los fragmentos más parecidos a la pregunta
create or replace function match_chunks(
  query_embedding vector(3072),
  match_document_id uuid,
  match_count int default 4
)
returns table (id uuid, content text, chunk_index int, similarity float)
language sql stable as $$
  select id, content, chunk_index, 1 - (embedding <=> query_embedding) as similarity
  from chunks
  where document_id = match_document_id
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ─── Sessions (transcripción en vivo) ─────────────────────────────────────────

create table sesiones (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users not null,
  titulo text,
  fecha timestamptz default now(),
  estado text default 'activa' check (estado in ('activa', 'finalizada')),
  resumen text,
  -- documento que se genera al finalizar, para chatear con la sesión
  document_id uuid references documents(id) on delete set null,
  created_at timestamptz default now()
);

create table transcripciones (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid references sesiones(id) on delete cascade not null,
  texto text not null,
  timestamp_segundos integer not null,
  created_at timestamptz default now()
);

-- Conceptos detectados automáticamente durante la sesión
create table contextos (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid references sesiones(id) on delete cascade not null,
  concepto text not null,
  explicacion text not null,
  timestamp_segundos integer not null,
  created_at timestamptz default now()
);

-- Preguntas en vivo con sus respuestas
create table preguntas_sesion (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid references sesiones(id) on delete cascade not null,
  pregunta text not null,
  respuesta text not null,
  timestamp_segundos integer not null,
  created_at timestamptz default now()
);

create index idx_sesiones_owner on sesiones(owner_id);
create index idx_transcripciones_sesion on transcripciones(sesion_id);
create index idx_contextos_sesion on contextos(sesion_id);
create index idx_preguntas_sesion_sesion on preguntas_sesion(sesion_id);

alter table sesiones enable row level security;
alter table transcripciones enable row level security;
alter table contextos enable row level security;
alter table preguntas_sesion enable row level security;

create policy "sesiones_own" on sesiones
  for all using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

create policy "transcripciones_own" on transcripciones
  for all using (sesion_id in (select id from sesiones where owner_id = auth.uid()))
  with check (sesion_id in (select id from sesiones where owner_id = auth.uid()));

create policy "contextos_own" on contextos
  for all using (sesion_id in (select id from sesiones where owner_id = auth.uid()))
  with check (sesion_id in (select id from sesiones where owner_id = auth.uid()));

create policy "preguntas_sesion_own" on preguntas_sesion
  for all using (sesion_id in (select id from sesiones where owner_id = auth.uid()))
  with check (sesion_id in (select id from sesiones where owner_id = auth.uid()));
