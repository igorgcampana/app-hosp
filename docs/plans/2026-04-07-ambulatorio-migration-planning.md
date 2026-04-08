# Consultas Ambulatoriais — Registro da Sessao de Planejamento SQL

**Data:** 2026-04-07
**Status:** Planejamento atualizado e registrado
**Execucao em producao:** Nao realizada
**Feature:** `consultas-ambulatoriais`

---

## Objetivo da sessao

Retomar o planejamento da feature **Consultas Ambulatoriais** exatamente do ponto parado e escrever a migration SQL definitiva como documentacao/plano, sem executar nada em producao.

---

## O que foi feito

1. Leitura e consolidacao do contexto do projeto:
   - `README.md`
   - `.specs/project/PROJECT.md`
   - `.specs/project/ROADMAP.md`
   - `.specs/project/STATE.md`
   - `.specs/features/consultas-ambulatoriais/spec.md`
   - `.specs/features/consultas-ambulatoriais/tasks.md`
   - `.specs/features/consultas-ambulatoriais/design.md`

2. Escrita da migration planejada em:
   - `.specs/features/consultas-ambulatoriais/migration.sql`

3. Consolidacao das regras fechadas no SQL planejado:
   - `manager` cadastra e edita tudo
   - `doctor` cadastra/edita apenas consultas conjuntas em que ele e o medico responsavel
   - `admin` existe e participa do acesso total
   - `valor_recebido` e unico por consulta
   - status de pagamento: `pendente`, `pago`, `parcial`
   - consulta conjunta sempre paga `R$ 600,00` bruto ao medico
   - percentuais podem nascer neutros/editaveis

4. Leitura remota somente-leitura do Supabase atual para confirmar o estado real de `profiles` e `auth.users`.

---

## Entregaveis produzidos

### 1. Migration SQL planejada

Arquivo:
- `.specs/features/consultas-ambulatoriais/migration.sql`

Conteudo principal:
- `ALTER TABLE profiles ADD COLUMN doctor_name`
- criacao de `ambulatorio_config`
- criacao de `consultas_ambulatoriais`
- constraints financeiras e de consistencia
- triggers de `updated_at`
- trigger de guarda para proteger o escopo de escrita do `doctor`
- policies de RLS para `admin`, `manager` e `doctor`

### 2. Atualizacao do design da feature

Arquivo:
- `.specs/features/consultas-ambulatoriais/design.md`

Atualizacoes:
- confirmacao real da existencia da role `admin`
- registro do snapshot real de auth
- bloqueio formal do seed definitivo de `doctor_name`
- explicacao do impacto do login medico compartilhado

### 3. Atualizacao do estado do projeto

Arquivo:
- `.specs/project/STATE.md`

Atualizacoes:
- nova proxima acao do planejamento
- decisao registrada sobre o auth atual
- bloqueador ativo formalizado para o ambulatorio

---

## Snapshot real do Supabase lido nesta sessao

Leitura realizada em 2026-04-07, sem qualquer escrita:

```text
profiles
- 3fa5986f-d1c8-4fd7-a719-b615fc5f0ea0 | doctor  | medicos@gmail.com
- d8ac7ac4-3fd8-483f-9784-d252308841f2 | manager | gestor@gmail.com
- 0e19f090-944c-4b5b-abea-959bc0351826 | admin   | admin@apphosp.com.br
```

Conclusoes confirmadas:
- a role `admin` existe de fato no projeto
- hoje existe apenas **1** usuario/profile com role `doctor`
- esse `doctor` usa login compartilhado (`medicos@gmail.com`)

---

## Conclusao tecnica da sessao

O schema da migration do ambulatorio ficou fechado como planejamento.

Porem, o seed definitivo de `profiles.doctor_name` **nao pode ser fechado de forma real** com o auth atual, porque:
- nao existe um `profile` por medico
- existe apenas um `doctor` compartilhado
- a regra de RLS "doctor so edita consultas conjuntas em que ele e o medico responsavel" depende de ownership individual por medico

Em outras palavras:
- o SQL de estrutura esta pronto
- o SQL de seed por medico ficou apenas como **seed alvo futuro**
- o bloqueio restante agora e de **modelo de autenticacao**, nao de schema

---

## Decisao registrada para retomada futura

Antes de implementar o modulo ambulatorial, o projeto precisa escolher um destes caminhos:

### Opcao A — Separar os logins medicos

Criar 1 usuario/profile por medico:
- Igor
- Beatriz
- Eduardo
- Tamires
- Felipe Reinaldo

Depois disso, aplicar o seed real de `doctor_name` e manter o RLS planejado.

### Opcao B — Manter login medico compartilhado

Aceitar que o RLS por ownership individual nao fecha com `profiles.doctor_name` e redesenhar a permissao do `doctor` no modulo ambulatorial.

---

## Melhor ponto para retomar depois

1. Criar 1 usuario/profile por medico
2. Garantir `public.profiles` com `role = doctor` para esses usuarios
3. Executar a migration real do ambulatorio
4. Preencher o seed real de `profiles.doctor_name`
5. So depois iniciar UI e implementacao do modulo ambulatorial

---

## Observacao importante

Nenhuma migration foi executada.
Nenhuma escrita foi feita em producao.
As unicas consultas remotas desta sessao foram de leitura, para confirmar o estado real do Supabase.

---

## Analise das opcoes de auth

### Opcao A — Separar os logins medicos

Vantagens:
- preserva exatamente a regra funcional ja aprovada no spec
- mantem ownership por medico no banco, e nao apenas na UI
- deixa auditoria, historico e responsabilizacao coerentes
- reaproveita o RLS ja planejado em `.specs/features/consultas-ambulatoriais/migration.sql`
- reduz risco de um medico editar consulta conjunta atribuida a outro

Custos:
- exige criar 1 auth user/profile por medico
- exige definir e-mails, acesso inicial e onboarding simples para cada medico
- exige seed real de `profiles.doctor_name` apos a criacao desses usuarios

Impacto tecnico estimado no app atual:
- baixo no frontend atual
- o app hoje ja diferencia comportamento por `role`
- a mudanca principal fica no auth/profile do Supabase, nao na arquitetura do frontend

### Opcao B — Manter login medico compartilhado

Vantagens:
- evita mexer agora no cadastro de usuarios do Supabase
- reduz atrito operacional no curtissimo prazo

Custos:
- quebra a regra de ownership individual por medico no banco
- enfraquece auditoria, porque varias pessoas escreveriam com o mesmo `auth.uid()`
- obriga redesenho do RLS e possivelmente do proprio requirement `AMB-REG-007`
- empurra controle real para a UI, com menos garantia de seguranca
- aumenta chance de retrabalho em spec, design, tasks e migration

Impacto tecnico estimado no app atual:
- medio
- o modulo ambulatorial precisaria nascer com permissao redesenhada para `doctor`
- a migration atual deixaria de ser "quase pronta" e voltaria para revisao estrutural de policy

---

## Recomendacao pratica

Para esta feature, a opcao tecnicamente mais limpa e mais barata no acumulado e a **Opcao A — separar os logins medicos antes do go-live do ambulatorio**.

Motivo:
- a regra funcional ja esta fechada com ownership por medico
- o SQL planejado ja esta alinhado com esse modelo
- o app atual parece sentir pouco impacto de frontend com a separacao de usuarios
- manter login compartilhado agora ate pode parecer mais rapido, mas transforma o bloqueio atual de auth em retrabalho de regra, RLS e auditoria

Recomendacao operacional:
- se o projeto quiser manter o login compartilhado por mais tempo, o caminho mais seguro nao e liberar escrita para `doctor`
- nesse cenario, o ambulatorio deveria nascer inicialmente como modulo controlado por `admin`/`manager`, com acesso `doctor` apenas depois do redesenho formal da permissao

**Status atual:** em 2026-04-07, Igor confirmou seguir com a **Opcao A**.

---

## Impacto por cenario nos artefatos ja escritos

### Se o projeto escolher a Opcao A

Os artefatos atuais continuam validos com ajustes pequenos:
- `spec.md`: substituir a open question pela decisao fechada da Opcao A
- `design.md`: manter a estrategia atual de `profiles.doctor_name`
- `tasks.md`: desbloquear FASE 1 apos criar os usuarios/perfis medicos
- `migration.sql`: continua valida como schema planejado; falta apenas preencher o seed real dos UUIDs medicos

### Se o projeto escolher a Opcao B

Os artefatos atuais precisarao de revisao antes de qualquer implementacao:
- `spec.md`: revisar `AMB-REG-007` e possivelmente `AMB-RBAC-004`
- `design.md`: redesenhar ownership e remover dependencia forte de `profiles.doctor_name`
- `tasks.md`: reabrir FASE 1 para redefinir policies e guard rails
- `migration.sql`: manter estrutura de tabelas, mas reescrever trigger/policies relacionadas ao `doctor`

---

## Plano de retomada recomendado

### Passo 1 — Executar a decisao de auth

Executar nesta ordem:
1. levantar os e-mails/login de cada medico
2. criar 1 auth user por medico no Supabase
3. criar ou ajustar 1 `profile` por medico com `role = doctor`
4. registrar os UUIDs reais dos novos usuarios
5. executar a migration real do ambulatorio
6. preencher `profiles.doctor_name` com os nomes curtos corretos
7. validar que cada medico enxerga o app com o mesmo `role`, mas agora com ownership individual no banco
8. retomar a implementacao do modulo ambulatorial sem reabrir o desenho de RLS

---

## Checklist objetivo para a proxima sessao

- trazer a lista final de medicos e seus logins/e-mails
- confirmar se `doctor_name` continuara usando nome curto exatamente igual ao ja usado no app: `Beatriz`, `Eduardo`, `Felipe Reinaldo`, `Igor`, `Tamires`
- so apos isso transformar `.specs/features/consultas-ambulatoriais/migration.sql` em migration executavel real e preencher `doctor_name`
- manter a implementacao de UI do ambulatorio pausada ate o modelo de auth ficar fechado
