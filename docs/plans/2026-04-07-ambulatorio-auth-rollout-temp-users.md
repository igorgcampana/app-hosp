# Ambulatorio — Rollout Temporario de Usuarios Medicos

**Data:** 2026-04-07
**Status:** Fase A e B concluidas (2026-04-07)
**Escopo:** Preparar auth da Opcao A sem alterar producao nesta sessao
**Feature relacionada:** `consultas-ambulatoriais`

---

## Objetivo

Preparar a lista exata dos 5 usuarios medicos temporarios do ambulatório, com credenciais iniciais simples para bootstrap, mantendo a conta legada compartilhada por enquanto.

Este documento **nao executa nada**. Ele apenas registra o rollout operacional para a proxima etapa.

---

## Decisoes fechadas

- O ambulatorio seguira a **Opcao A**: `1 usuario/profile por medico`.
- Os emails iniciais serao temporarios, no dominio `@apphosp.com.br`.
- A senha inicial temporaria sera `12345`.
- A conta compartilhada legada sera mantida por enquanto.
- O `doctor_name` continuara usando exatamente os nomes curtos ja usados no app:
  - `Igor`
  - `Beatriz`
  - `Eduardo`
  - `Tamires`
  - `Felipe Reinaldo`

---

## Assuncao importante

O snapshot lido em 2026-04-07 registrou a conta legada como `medicos@gmail.com`.

Neste plano, vou manter essa referencia exata como legado. Se o endereco real a preservar for `medicos@gmail.com.br`, ajustar isso antes da execucao.

---

## Matriz de usuarios temporarios

| Medico | Email temporario | Role | doctor_name | Senha inicial |
|------|------|------|------|------|
| Igor | `igor@apphosp.com.br` | `doctor` | `Igor` | `12345` |
| Beatriz | `beatriz@apphosp.com.br` | `doctor` | `Beatriz` | `12345` |
| Eduardo | `eduardo@apphosp.com.br` | `doctor` | `Eduardo` | `12345` |
| Tamires | `tamires@apphosp.com.br` | `doctor` | `Tamires` | `12345` |
| Felipe Reinaldo | `felipe.reinaldo@apphosp.com.br` | `doctor` | `Felipe Reinaldo` | `12345` |

---

## Conta legada mantida nesta fase

Manter sem alterar por enquanto:

| Uso atual | Email |
|------|------|
| Login medico compartilhado legado | `medicos@gmail.com` |

Decisao operacional desta fase:
- nao remover
- nao renomear
- nao reaproveitar como ownership do ambulatório
- manter apenas como acesso legado enquanto o rollout individual nao termina

---

## Ordem correta de rollout

### Fase A — Preparar usuarios no Auth

Criar 1 usuario no Supabase Auth para cada email temporario acima, com:
- `email` correspondente
- `password = 12345`
- conta marcada como confirmada

Resultado esperado:
- cada medico passa a ter `auth.uid()` proprio
- o ownership individual fica viavel no RLS

### Fase B — Garantir `profiles` com `role = doctor`

Depois de criar os usuarios no Auth:
- capturar o UUID de cada usuario
- verificar se ja existe linha correspondente em `public.profiles`
- se nao existir, criar
- se existir, ajustar `role = doctor`

**Importante:** nesta fase ainda pode nao existir a coluna `doctor_name`, porque ela nasce na migration do ambulatorio.

### Fase C — Executar a migration real do ambulatorio

Quando chegar a hora da execucao real:
- rodar a migration planejada de `consultas-ambulatoriais`
- isso adiciona `profiles.doctor_name` e cria as tabelas do modulo

### Fase D — Preencher `doctor_name`

Depois que a coluna `doctor_name` existir:
- atualizar cada profile medico com o nome curto correto
- so entao validar as policies do ambulatorio com usuarios distintos

---

## Roteiro manual sugerido

### Opcao 1 — Supabase Dashboard

Criar os usuarios em:
- `Authentication`
- `Users`
- `Add user`

Campos sugeridos por usuario:
- email: conforme matriz acima
- password: `12345`
- email confirmed: ativo

### Opcao 2 — Admin API

Se preferir scriptar depois, usar Admin API do Supabase do lado servidor, nunca no browser, para criar usuario com email confirmado.

---

## SQL planejado — Fase B

Use este SQL somente depois que os UUIDs reais dos 5 usuarios forem conhecidos.

Este bloco serve para garantir `public.profiles` com `role = doctor`, mesmo que o projeto nao tenha trigger automatica de profile.

```sql
-- JA EXECUTADO em 2026-04-07 via scripts/fase0-create-doctors.sh
insert into public.profiles (id, role)
values
  ('0a678043-61bb-47d1-b4d0-3d47a173f672', 'doctor'),  -- Igor
  ('c7e53ca3-26bf-4721-a7c9-b8ab57fe74ba', 'doctor'),  -- Beatriz
  ('8bbe8176-483d-4beb-a169-1dd6a7b6ecbb', 'doctor'),  -- Eduardo
  ('32971c96-1a03-4947-aaf9-ee7c8c8af87e', 'doctor'),  -- Tamires
  ('bedef59e-a805-48ad-b00f-b7a54800a506', 'doctor')   -- Felipe Reinaldo
on conflict (id) do update
set role = excluded.role;
```

---

## SQL planejado — Fase D

Use este SQL somente depois que a migration real do ambulatorio tiver criado a coluna `public.profiles.doctor_name`.

```sql
-- PENDENTE: executar somente apos migration criar profiles.doctor_name
update public.profiles
set role = 'doctor', doctor_name = 'Igor'
where id = '0a678043-61bb-47d1-b4d0-3d47a173f672';

update public.profiles
set role = 'doctor', doctor_name = 'Beatriz'
where id = 'c7e53ca3-26bf-4721-a7c9-b8ab57fe74ba';

update public.profiles
set role = 'doctor', doctor_name = 'Eduardo'
where id = '8bbe8176-483d-4beb-a169-1dd6a7b6ecbb';

update public.profiles
set role = 'doctor', doctor_name = 'Tamires'
where id = '32971c96-1a03-4947-aaf9-ee7c8c8af87e';

update public.profiles
set role = 'doctor', doctor_name = 'Felipe Reinaldo'
where id = 'bedef59e-a805-48ad-b00f-b7a54800a506';
```

---

## Validacoes planejadas

### Validacao 1 — Usuarios criados no Auth

```sql
select id, email, email_confirmed_at
from auth.users
where email in (
  'igor@apphosp.com.br',
  'beatriz@apphosp.com.br',
  'eduardo@apphosp.com.br',
  'tamires@apphosp.com.br',
  'felipe.reinaldo@apphosp.com.br',
  'medicos@gmail.com'
)
order by email;
```

### Validacao 2 — Profiles com role correto

```sql
select id, role
from public.profiles
where id in (
  '<uuid_igor>',
  '<uuid_beatriz>',
  '<uuid_eduardo>',
  '<uuid_tamires>',
  '<uuid_felipe_reinaldo>'
)
order by id;
```

### Validacao 3 — `doctor_name` preenchido

Executar somente depois da migration real:

```sql
select id, role, doctor_name
from public.profiles
where id in (
  '<uuid_igor>',
  '<uuid_beatriz>',
  '<uuid_eduardo>',
  '<uuid_tamires>',
  '<uuid_felipe_reinaldo>'
)
order by doctor_name;
```

---

## Observacoes de seguranca

- A senha `12345` esta sendo tratada aqui apenas como credencial inicial de bootstrap.
- Esse setup nao deve ser considerado a configuracao final de producao.
- Depois do rollout inicial, o ideal e migrar para emails reais e credenciais melhores por usuario.

---

## Proxima acao recomendada

Na nova worktree:
1. manter este documento como checklist operacional
2. criar os 5 usuarios no Auth
3. registrar os UUIDs reais
4. ajustar `public.profiles`
5. so depois executar a migration real do ambulatorio e preencher `doctor_name`
