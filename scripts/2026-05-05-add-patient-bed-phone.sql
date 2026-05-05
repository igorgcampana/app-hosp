alter table public.patients
  add column if not exists leito text,
  add column if not exists telefone text;
