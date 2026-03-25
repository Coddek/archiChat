-- Tabla para guardar las API keys de cada usuario
-- Ejecutar en el SQL Editor de Supabase

create table user_settings (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  groq_api_key   text,
  gemini_api_key text,
  updated_at  timestamptz default now()
);

-- Row Level Security: cada usuario solo puede ver y modificar sus propias settings
alter table user_settings enable row level security;

create policy "users_own_settings"
  on user_settings
  for all
  using (auth.uid() = user_id);
