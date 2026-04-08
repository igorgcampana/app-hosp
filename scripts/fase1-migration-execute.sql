-- =========================================================
-- FASE 1 — Migration Consultas Ambulatoriais
-- Executar no SQL Editor do Supabase
-- Data: 2026-04-07
-- =========================================================

begin;

-- =========================================================
-- 1) PERFIS — adicionar doctor_name
-- =========================================================

alter table public.profiles
  add column if not exists doctor_name text;

comment on column public.profiles.doctor_name is
  'Nome curto do medico usado pelo RLS do modulo ambulatorial.';

-- =========================================================
-- 2) TABELA GLOBAL DE CONFIGURACAO
-- =========================================================

create table if not exists public.ambulatorio_config (
  id                        bigint primary key default 1,
  valor_fixo_medico_conjunta numeric(12,2) not null default 600.00,
  pct_imposto_medico        numeric(5,2) not null default 0,
  pct_imposto_samira        numeric(5,2) not null default 0,
  pct_administracao_medico  numeric(5,2) not null default 0,
  updated_at                timestamptz not null default now(),
  constraint ambulatorio_config_single_row_ck check (id = 1),
  constraint ambulatorio_config_valor_fixo_ck check (valor_fixo_medico_conjunta = 600.00),
  constraint ambulatorio_config_pct_imposto_medico_ck check (
    pct_imposto_medico >= 0 and pct_imposto_medico <= 100
  ),
  constraint ambulatorio_config_pct_imposto_samira_ck check (
    pct_imposto_samira >= 0 and pct_imposto_samira <= 100
  ),
  constraint ambulatorio_config_pct_administracao_medico_ck check (
    pct_administracao_medico >= 0 and pct_administracao_medico <= 100
  )
);

insert into public.ambulatorio_config (
  id,
  valor_fixo_medico_conjunta,
  pct_imposto_medico,
  pct_imposto_samira,
  pct_administracao_medico
)
values (
  1,
  600.00,
  0,
  0,
  0
)
on conflict (id) do nothing;

comment on table public.ambulatorio_config is
  'Configuracao global do modulo ambulatorial. Linha unica e editavel apenas por admin/manager.';

-- =========================================================
-- 3) TABELA DE CONSULTAS
-- =========================================================

create table if not exists public.consultas_ambulatoriais (
  id                        uuid primary key default gen_random_uuid(),
  paciente_nome             text not null,
  data_consulta             date not null,
  medico                    text,
  consulta_conjunta         boolean not null,
  valor_total               numeric(12,2) not null,
  valor_medico              numeric(12,2) not null,
  valor_samira              numeric(12,2) not null,
  pct_imposto_medico        numeric(5,2) not null default 0,
  pct_imposto_samira        numeric(5,2) not null default 0,
  pct_administracao_medico  numeric(5,2) not null default 0,
  imposto_medico            numeric(12,2) not null default 0,
  imposto_samira            numeric(12,2) not null default 0,
  administracao_medico      numeric(12,2) not null default 0,
  valor_liquido_medico      numeric(12,2) not null,
  valor_liquido_samira      numeric(12,2) not null,
  status_pagamento          text not null default 'pendente',
  valor_recebido            numeric(12,2) not null default 0,
  observacoes               text,
  created_by                uuid not null default auth.uid() references auth.users(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),

  constraint amb_paciente_nome_ck check (char_length(btrim(paciente_nome)) > 0),
  constraint amb_status_pagamento_ck check (status_pagamento in ('pendente', 'pago', 'parcial')),
  constraint amb_valor_total_ck check (valor_total > 0),
  constraint amb_valor_medico_ck check (valor_medico >= 0),
  constraint amb_valor_samira_ck check (valor_samira >= 0),
  constraint amb_pct_imposto_medico_ck check (
    pct_imposto_medico >= 0 and pct_imposto_medico <= 100
  ),
  constraint amb_pct_imposto_samira_ck check (
    pct_imposto_samira >= 0 and pct_imposto_samira <= 100
  ),
  constraint amb_pct_administracao_medico_ck check (
    pct_administracao_medico >= 0 and pct_administracao_medico <= 100
  ),
  constraint amb_imposto_medico_ck check (
    imposto_medico >= 0 and imposto_medico <= valor_medico
  ),
  constraint amb_imposto_samira_ck check (
    imposto_samira >= 0 and imposto_samira <= valor_samira
  ),
  constraint amb_administracao_medico_ck check (
    administracao_medico >= 0 and administracao_medico <= valor_medico
  ),
  constraint amb_valor_liquido_medico_ck check (valor_liquido_medico >= 0),
  constraint amb_valor_liquido_samira_ck check (valor_liquido_samira >= 0),
  constraint amb_valor_recebido_ck check (valor_recebido >= 0),
  constraint amb_liquido_medico_formula_ck check (
    valor_liquido_medico = round(valor_medico - imposto_medico - administracao_medico, 2)
  ),
  constraint amb_liquido_samira_formula_ck check (
    valor_liquido_samira = round(valor_samira - imposto_samira, 2)
  ),
  constraint amb_status_valor_recebido_relacao_ck check (
    (
      status_pagamento = 'pendente'
      and valor_recebido = 0
    )
    or
    (
      status_pagamento = 'pago'
      and valor_recebido = valor_total
    )
    or
    (
      status_pagamento = 'parcial'
      and valor_recebido > 0
      and valor_recebido < valor_total
    )
  ),
  constraint amb_tipo_consulta_ck check (
    (
      consulta_conjunta = true
      and medico is not null
      and char_length(btrim(medico)) > 0
      and valor_total >= 600.00
      and valor_medico = 600.00
      and valor_samira = round(valor_total - 600.00, 2)
    )
    or
    (
      consulta_conjunta = false
      and medico is null
      and valor_medico = 0
      and valor_samira = valor_total
      and imposto_medico = 0
      and administracao_medico = 0
      and valor_liquido_medico = 0
    )
  )
);

comment on table public.consultas_ambulatoriais is
  'Historico de consultas ambulatoriais com snapshot financeiro fechado por consulta.';

create index if not exists consultas_ambulatoriais_data_idx
  on public.consultas_ambulatoriais (data_consulta desc);

create index if not exists consultas_ambulatoriais_medico_data_idx
  on public.consultas_ambulatoriais (medico, data_consulta desc);

create index if not exists consultas_ambulatoriais_status_data_idx
  on public.consultas_ambulatoriais (status_pagamento, data_consulta desc);

create index if not exists consultas_ambulatoriais_created_by_data_idx
  on public.consultas_ambulatoriais (created_by, data_consulta desc);

-- =========================================================
-- 4) TRIGGERS DE APOIO
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.ambulatorio_guard_consultas_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_doctor_name text;
begin
  if tg_op = 'UPDATE' then
    if new.created_by is distinct from old.created_by then
      raise exception 'created_by nao pode ser alterado';
    end if;

    if new.created_at is distinct from old.created_at then
      raise exception 'created_at nao pode ser alterado';
    end if;
  end if;

  if v_uid is null then
    return new;
  end if;

  if tg_op = 'INSERT' and new.created_by is distinct from v_uid then
    raise exception 'created_by deve ser o usuario autenticado';
  end if;

  select p.role, p.doctor_name
    into v_role, v_doctor_name
  from public.profiles p
  where p.id = v_uid;

  if v_role in ('admin', 'manager') then
    return new;
  end if;

  if v_role = 'doctor' then
    if new.consulta_conjunta is distinct from true then
      raise exception 'doctor so pode gravar consultas conjuntas';
    end if;

    if new.medico is null or btrim(new.medico) = '' or new.medico <> v_doctor_name then
      raise exception 'doctor so pode gravar consultas conjuntas em que ele e o medico responsavel';
    end if;

    if tg_op = 'INSERT' then
      if new.status_pagamento <> 'pendente' or new.valor_recebido <> 0 then
        raise exception 'doctor nao pode criar consulta com controle financeiro de pagamento';
      end if;
    end if;

    if tg_op = 'UPDATE' then
      if new.status_pagamento is distinct from old.status_pagamento then
        raise exception 'doctor nao pode alterar status_pagamento';
      end if;

      if new.valor_recebido is distinct from old.valor_recebido then
        raise exception 'doctor nao pode alterar valor_recebido';
      end if;
    end if;

    return new;
  end if;

  raise exception 'usuario sem permissao para gravar consultas ambulatoriais';
end;
$$;

drop trigger if exists ambulatorio_config_set_updated_at on public.ambulatorio_config;
create trigger ambulatorio_config_set_updated_at
before update on public.ambulatorio_config
for each row
execute function public.set_updated_at();

drop trigger if exists consultas_ambulatoriais_set_updated_at on public.consultas_ambulatoriais;
create trigger consultas_ambulatoriais_set_updated_at
before update on public.consultas_ambulatoriais
for each row
execute function public.set_updated_at();

drop trigger if exists consultas_ambulatoriais_guard_write on public.consultas_ambulatoriais;
create trigger consultas_ambulatoriais_guard_write
before insert or update on public.consultas_ambulatoriais
for each row
execute function public.ambulatorio_guard_consultas_write();

-- =========================================================
-- 5) RLS
-- =========================================================

alter table public.ambulatorio_config enable row level security;
alter table public.consultas_ambulatoriais enable row level security;

create policy "ambulatorio_config_select_authenticated"
on public.ambulatorio_config
for select
using (auth.role() = 'authenticated');

create policy "ambulatorio_config_update_admin_manager"
on public.ambulatorio_config
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

create policy "consultas_ambulatoriais_select_authenticated"
on public.consultas_ambulatoriais
for select
using (auth.role() = 'authenticated');

create policy "consultas_ambulatoriais_insert_admin_manager"
on public.consultas_ambulatoriais
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

create policy "consultas_ambulatoriais_insert_doctor_own_conjunta"
on public.consultas_ambulatoriais
for insert
with check (
  created_by = auth.uid()
  and consulta_conjunta = true
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'doctor'
      and p.doctor_name = consultas_ambulatoriais.medico
  )
);

create policy "consultas_ambulatoriais_update_admin_manager"
on public.consultas_ambulatoriais
for update
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

create policy "consultas_ambulatoriais_update_doctor_responsavel"
on public.consultas_ambulatoriais
for update
using (
  consulta_conjunta = true
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'doctor'
      and p.doctor_name = consultas_ambulatoriais.medico
  )
)
with check (
  consulta_conjunta = true
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'doctor'
      and p.doctor_name = consultas_ambulatoriais.medico
  )
);

create policy "consultas_ambulatoriais_delete_admin_manager"
on public.consultas_ambulatoriais
for delete
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
  )
);

-- =========================================================
-- 6) SEED — doctor_name com UUIDs reais
-- =========================================================

update public.profiles set doctor_name = 'Igor'
where id = '0a678043-61bb-47d1-b4d0-3d47a173f672';

update public.profiles set doctor_name = 'Beatriz'
where id = 'c7e53ca3-26bf-4721-a7c9-b8ab57fe74ba';

update public.profiles set doctor_name = 'Eduardo'
where id = '8bbe8176-483d-4beb-a169-1dd6a7b6ecbb';

update public.profiles set doctor_name = 'Tamires'
where id = '32971c96-1a03-4947-aaf9-ee7c8c8af87e';

update public.profiles set doctor_name = 'Felipe Reinaldo'
where id = 'bedef59e-a805-48ad-b00f-b7a54800a506';

commit;
