# Ambulatorio — Plano Operacional de Execucao

**Data:** 2026-04-07
**Status:** Fase 0 concluida (2026-04-07)
**Escopo:** Transformar o planejamento da feature em sequencia operacional para a proxima aba
**Feature:** `consultas-ambulatoriais`

---

## Objetivo

Executar a feature de Consultas Ambulatoriais em uma ordem segura, com o minimo de retrabalho e com checkpoints claros entre:
- preparacao de auth
- banco e RLS
- estrutura de UI
- comportamento funcional
- integracao
- validacao final

Este documento e um guia de execucao. Ele nao substitui:
- [tasks.md](/Users/igorcampana/projetos_programacao/AppHosp/.specs/features/consultas-ambulatoriais/tasks.md)
- [migration.sql](/Users/igorcampana/projetos_programacao/AppHosp/.specs/features/consultas-ambulatoriais/migration.sql)
- [auth rollout temporario](/Users/igorcampana/projetos_programacao/AppHosp/docs/plans/2026-04-07-ambulatorio-auth-rollout-temp-users.md)

---

## Premissas fechadas

- A feature seguira a **Opcao A**: `1 usuario/profile por medico`.
- Os usuarios iniciais serao temporarios:
  - `igor@apphosp.com.br`
  - `beatriz@apphosp.com.br`
  - `eduardo@apphosp.com.br`
  - `tamires@apphosp.com.br`
  - `felipe.reinaldo@apphosp.com.br`
- A senha inicial temporaria sera `12345`.
- A conta legada `medicos@gmail.com` sera mantida por enquanto.
- O modulo so deve liberar escrita de `doctor` depois que houver ownership individual validado por `auth.uid()` + `profiles.doctor_name`.

---

## Regra de ouro da execucao

Nao misturar fases.

So avancar quando a fase atual tiver:
- entregavel concreto
- verificacao concluida
- nenhum bloqueio estrutural em aberto

Se uma fase falhar:
- corrigir dentro dela
- nao compensar na UI um problema que deveria ser resolvido no banco ou no auth

---

## Visao geral das fases

| Fase | Nome | Tipo | Mexe em producao? | Saida principal |
|------|------|------|------|------|
| 0 | Auth dos medicos | operacional | sim, quando executar | 5 usuarios medicos individuais |
| 1 | Banco + RLS | banco | sim, quando executar | schema e policies reais do ambulatorio |
| 2 | Estrutura da tela | codigo local | nao, ate merge/deploy | aba e screen do ambulatorio |
| 3 | Configuracoes financeiras | codigo + banco | parcialmente | leitura/escrita de `ambulatorio_config` |
| 4 | Formulario e calculo | codigo local | nao, ate merge/deploy | cadastro funcional com calculo |
| 5 | Historico e edicao | codigo local | nao, ate merge/deploy | tabela, filtros e edicao |
| 6 | Resumo mensal | codigo local | nao, ate merge/deploy | resumo consolidado do periodo |
| 7 | Integracao com repasse | codigo local | nao, ate merge/deploy | ambulatorio incluido no fechamento |
| 8 | Validacao e go-live | validacao | sim, no go-live | liberacao segura |

---

## Fase 0 — Auth dos medicos

### Objetivo

Preparar a base de ownership individual antes de qualquer dependencia real do ambulatorio.

### Entradas

- decisao da Opcao A fechada
- matriz de usuarios temporarios definida

### Onde mexe

- Supabase Auth
- `public.profiles`

### Passos operacionais

1. Criar os 5 usuarios temporarios no Auth.
2. Registrar os UUIDs reais de cada usuario.
3. Verificar se existe `profile` automatico para cada UUID.
4. Se nao existir, criar `profile`.
5. Garantir `role = doctor` para os 5 novos usuarios.
6. Manter `medicos@gmail.com` sem alterar.

### Entregaveis

- 5 novos `auth.users`
- 5 `profiles` com `role = doctor`
- lista consolidada de UUID por medico

### Verificacao de saida

- cada medico possui `auth.uid()` proprio
- cada medico aparece em `public.profiles`
- nenhum dos novos usuarios depende do login compartilhado

### Nao fazer ainda

- nao preencher `doctor_name` antes da migration real
- nao excluir a conta legada
- nao testar RLS final do ambulatorio antes da coluna existir

### Referencia

- [auth rollout temporario](/Users/igorcampana/projetos_programacao/AppHosp/docs/plans/2026-04-07-ambulatorio-auth-rollout-temp-users.md)

---

## Fase 1 — Banco + RLS

### Objetivo

Executar o schema real do ambulatorio e deixar o banco pronto para uso seguro por `admin`, `manager` e `doctor`.

### Entradas

- Fase 0 concluida
- UUIDs reais dos medicos
- migration revisada

### Onde mexe

- Supabase SQL Editor / migration real

### Passos operacionais

1. Executar a migration do ambulatorio.
2. Confirmar criacao de:
   - `profiles.doctor_name`
   - `ambulatorio_config`
   - `consultas_ambulatoriais`
3. Aplicar o seed de `doctor_name` para os 5 medicos.
4. Validar triggers, constraints e policies.
5. Rodar checagem manual com perfis distintos:
   - `admin`
   - `manager`
   - um `doctor`

### Entregaveis

- schema real do ambulatorio criado
- `doctor_name` preenchido
- RLS operacional

### Verificacao de saida

- `doctor` so escreve consulta conjunta propria
- `doctor` nao altera financeiro indevido
- `manager` e `admin` mantem o escopo planejado

### Nao fazer ainda

- nao construir workaround de UI para compensar policy errada
- nao seguir para codigo da tela se o RLS ainda estiver instavel

### Referencias

- [migration.sql](/Users/igorcampana/projetos_programacao/AppHosp/.specs/features/consultas-ambulatoriais/migration.sql)
- [migration planning](/Users/igorcampana/projetos_programacao/AppHosp/docs/plans/2026-04-07-ambulatorio-migration-planning.md)

---

## Fase 2 — Estrutura da tela

### Objetivo

Criar o esqueleto visual e o bootstrap tecnico do modulo sem entrar ainda em toda a regra funcional.

### Onde mexe

- [index.html](/Users/igorcampana/projetos_programacao/AppHosp/index.html)
- [styles.css](/Users/igorcampana/projetos_programacao/AppHosp/styles.css)
- [script.js](/Users/igorcampana/projetos_programacao/AppHosp/script.js)
- novo [ambulatorio.js](/Users/igorcampana/projetos_programacao/AppHosp/ambulatorio.js)

### Passos operacionais

1. Adicionar a aba `Ambulatorio` na navegacao.
2. Criar `#screen-ambulatorio`.
3. Criar `ambulatorio.js` com estrutura inicial:
   - estado
   - init
   - loaders
   - render
   - listeners
4. Integrar `initAmbulatorio()` no bootstrap principal.

### Entregaveis

- tela aparece
- navegacao funciona
- modulo carrega sem erro

### Verificacao de saida

- abrir o app nao quebra nenhuma tela existente
- a nova screen existe e responde a navegacao

### Nao fazer ainda

- nao acoplar toda a logica financeira direto em `script.js`
- nao implementar relatorio mensal inteiro nesta fase

---

## Fase 3 — Configuracoes financeiras

### Objetivo

Ler e editar a configuracao global do ambulatorio com restricao correta por role.

### Onde mexe

- [index.html](/Users/igorcampana/projetos_programacao/AppHosp/index.html)
- [styles.css](/Users/igorcampana/projetos_programacao/AppHosp/styles.css)
- [ambulatorio.js](/Users/igorcampana/projetos_programacao/AppHosp/ambulatorio.js)

### Passos operacionais

1. Carregar `ambulatorio_config`.
2. Renderizar bloco de configuracao.
3. Restringir edicao a quem tem permissao financeira.
4. Persistir alteracoes e recarregar defaults locais.

### Entregaveis

- configuracao visivel
- configuracao editavel por perfil certo
- persistencia confirmada

### Criterio de parada

Se a tela ainda nao consegue carregar a linha unica de config de forma confiavel, nao avancar para calculo.

---

## Fase 4 — Formulario e calculo

### Objetivo

Permitir cadastro e edicao de consulta com calculo automatico e override manual seguro.

### Onde mexe

- [index.html](/Users/igorcampana/projetos_programacao/AppHosp/index.html)
- [styles.css](/Users/igorcampana/projetos_programacao/AppHosp/styles.css)
- [ambulatorio.js](/Users/igorcampana/projetos_programacao/AppHosp/ambulatorio.js)

### Passos operacionais

1. Criar formulario completo.
2. Implementar helper puro de calculo.
3. Aplicar recalculo ao alterar campos-base.
4. Validar regras de consulta conjunta vs exclusiva da Samira.
5. Salvar consulta no banco.
6. Permitir modo edicao.

### Entregaveis

- formulario funcional
- calculo coerente com o spec
- persistencia correta

### Verificacao de saida

- consulta conjunta com `valor_total >= 600`
- consulta exclusiva da Samira
- override manual de valores
- bloqueio visual e funcional para entradas invalidas

---

## Fase 5 — Historico, filtros e edicao

### Objetivo

Dar visibilidade operacional ao modulo ja com uso real.

### Passos operacionais

1. Listar consultas em ordem decrescente.
2. Adicionar filtros por:
   - periodo
   - medico
   - status
3. Permitir abrir consulta existente.
4. Permitir edicao conforme role.
5. Permitir exclusao com confirmacao para perfil autorizado.

### Entregaveis

- tabela funcional
- filtros operacionais
- fluxo de editar e excluir funcionando

### Criterio de parada

Se a edicao estiver conflitando com RLS, parar e corrigir o contrato banco/UI antes de seguir.

---

## Fase 6 — Resumo mensal

### Objetivo

Exibir consolidado gerencial do ambulatório sem depender ainda da tela de repasse.

### Passos operacionais

1. Gerar resumo mensal por mes/ano.
2. Consolidar:
   - quantidade
   - valor total
   - liquido por medico
   - liquido da Samira
3. Separar conjunta vs exclusiva da Samira.

### Entregaveis

- painel/resumo do periodo
- numeros coerentes com os registros persistidos

---

## Fase 7 — Integracao com repasse

### Objetivo

Fazer o fechamento mensal enxergar o ambulatorio sem recalcular regras financeiras.

### Onde mexe

- [repasse.js](/Users/igorcampana/projetos_programacao/AppHosp/repasse.js)
- possivelmente [script.js](/Users/igorcampana/projetos_programacao/AppHosp/script.js), se houver bootstrap compartilhado

### Passos operacionais

1. Definir ponto de integracao entre ambulatorio e repasse.
2. Somar apenas os liquidos persistidos.
3. Diferenciar origem:
   - visitas hospitalares
   - consultas ambulatoriais
4. Verificar se o repasse atual nao sofre regressao.

### Entregaveis

- repasse com bloco ambulatorial separado
- nenhuma mudanca indevida no calculo legado de visitas

### Criterio de parada

Se houver qualquer regressao no repasse atual, corrigir antes de seguir para go-live.

---

## Fase 8 — Validacao e go-live

### Objetivo

Fechar a feature com seguranca operacional.

### Checklist de validacao

- testar como `admin`
- testar como `manager`
- testar como `doctor`
- validar cadastro conjunto
- validar cadastro exclusivo da Samira
- validar edicao
- validar filtros
- validar resumo mensal
- validar integracao com repasse
- validar que `doctor` nao consegue ultrapassar seu ownership

### Saida final

- feature pronta para uso real
- sem brechas de permissao
- sem regressao nas telas existentes

---

## Sequencia recomendada por sessao

### Sessao 1

- Fase 0 completa
- Fase 1 completa

### Sessao 2

- Fase 2 completa
- Fase 3 completa

### Sessao 3

- Fase 4 completa
- Fase 5 completa

### Sessao 4

- Fase 6 completa
- Fase 7 completa
- inicio da Fase 8

---

## O que pode ser feito na nova aba sem risco

- criar worktree
- revisar docs de planejamento
- implementar Fase 2 localmente
- implementar parte visual da Fase 3 e Fase 4 localmente
- preparar SQL de execucao sem rodar

---

## O que nao deve ser feito sem pausa explicita

- executar migration real em producao sem revisar os UUIDs finais
- preencher `doctor_name` antes da coluna existir
- excluir a conta legada `medicos@gmail.com`
- mudar o comportamento do repasse existente sem validacao comparativa

---

## Prompt de retomada para a proxima aba

```text
Vamos continuar a feature consultas-ambulatoriais usando como guia:
- docs/plans/2026-04-07-ambulatorio-operational-execution-plan.md
- docs/plans/2026-04-07-ambulatorio-auth-rollout-temp-users.md
- .specs/features/consultas-ambulatoriais/tasks.md
- .specs/features/consultas-ambulatoriais/migration.sql

Quero seguir fase a fase, sem executar nada em producao sem confirmar antes.
Comece revisando a fase atual, o que ja esta pronto e o proximo passo operacional.
```
