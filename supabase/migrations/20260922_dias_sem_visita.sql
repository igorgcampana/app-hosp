-- Dia em que ninguém visitou o paciente. Tira o dia da cobrança e da trava de alta.
-- Não é uma visita: não entra em historico.

create table if not exists public.dias_sem_visita (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  data date not null,
  created_at timestamptz not null default now(),
  unique (patient_id, data)
);

alter table public.dias_sem_visita enable row level security;

grant select, insert, delete on public.dias_sem_visita to authenticated;

drop policy if exists "dias_sem_visita_select_authenticated" on public.dias_sem_visita;
create policy "dias_sem_visita_select_authenticated"
on public.dias_sem_visita
for select
using (auth.role() = 'authenticated');

drop policy if exists "dias_sem_visita_insert_admin_doctor" on public.dias_sem_visita;
create policy "dias_sem_visita_insert_admin_doctor"
on public.dias_sem_visita
for insert
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'doctor')
  )
);

drop policy if exists "dias_sem_visita_delete_admin_doctor" on public.dias_sem_visita;
create policy "dias_sem_visita_delete_admin_doctor"
on public.dias_sem_visita
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'doctor')
  )
);
