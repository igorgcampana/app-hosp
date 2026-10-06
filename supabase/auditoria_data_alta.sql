-- Correção: data de alta = data da última avaliação (última visita em historico).
-- Escopo: altas de 01/09/2026 até hoje — pela data de alta atual OU pela última visita.
-- Rodar no SQL Editor do Supabase. Passo 1 só lê. Passo 2 altera.

-- PASSO 1 — Conferir (somente leitura)
with ultima as (
  select patient_id, max(data) as ultima_visita
  from public.historico
  group by patient_id
)
select
  p.id,
  p.pacientenome,
  p.hospital,
  p.dataprimeiraavaliacao,
  p.dataalta                         as dataalta_atual,
  u.ultima_visita                    as dataalta_correta,
  p.dataalta - u.ultima_visita       as dias_de_diferenca,
  case
    when u.ultima_visita is null then 'sem visita em historico'
    when p.dataalta > u.ultima_visita then 'alta depois da última visita'
    else 'visita depois da alta'
  end                                as situacao
from public.patients p
left join ultima u on u.patient_id = p.id
where p.statusmanual = 'Alta'
  and p.dataalta is distinct from u.ultima_visita
  and (p.dataalta >= date '2026-09-01' or u.ultima_visita >= date '2026-09-01')
order by situacao, dias_de_diferenca desc nulls last, p.pacientenome;


-- PASSO 2 — Corrigir. Rodar sozinho, depois de revisar o passo 1.
-- Mesmo filtro do passo 1: altera exatamente as linhas listadas lá,
-- menos as "sem visita em historico", que ficam para revisão manual.

with ultima as (
  select patient_id, max(data) as ultima_visita
  from public.historico
  group by patient_id
)
update public.patients p
set dataalta = u.ultima_visita,
    dataultimavisita = u.ultima_visita
from ultima u
where u.patient_id = p.id
  and p.statusmanual = 'Alta'
  and p.dataalta is distinct from u.ultima_visita
  and (p.dataalta >= date '2026-09-01' or u.ultima_visita >= date '2026-09-01')
returning p.id, p.pacientenome, p.dataalta;
