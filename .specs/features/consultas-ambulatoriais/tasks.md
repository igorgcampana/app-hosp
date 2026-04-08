# Tasks: Consultas Ambulatoriais

**Date:** 2026-04-07  
**Última revisão:** 2026-04-08  
**Status:** T00–T24 concluídos · T25–T27 pendentes  
**Refs:** spec.md

---

## Desvio Arquitetural Registrado (2026-04-08)

As tarefas T04–T07 foram planejadas como adição de aba no SPA (`index.html`). A implementação real adotou **módulo standalone** (`ambulatorio.html` + `ambulatorio.js`), alinhada à decisão de feedback do projeto (`feedback_modulos_separados.md`). O resultado funcional é idêntico ao planejado; apenas a integração na navegação mudou (link no header do `index.html` em vez de aba bottom-nav).

---

## Dependencias Gerais

```text
FASE 1 (Banco + RLS)
  -> FASE 2 (Estrutura HTML/CSS + bootstrap do modulo)
  -> FASE 3 (Configuracoes financeiras)
  -> FASE 4 (Formulario + calculo)
  -> FASE 5 (Historico + filtros + edicao)
  -> FASE 6 (Resumo mensal)
  -> FASE 7 (Integracao com repasse)
  -> FASE 8 (Validacao + go-live)
```

---

## Precondicao de Execucao

- `PRE-001`: A decisao de auth foi fechada em favor da Opcao A: criar 1 usuario/profile por medico para viabilizar ownership por `profiles.doctor_name`.

**Regra de execucao:** seguir implementacao com a suposicao mais simples e segura:
- `doctor` nao altera financeiro
- `doctor` pode criar/editar apenas consultas conjuntas
- `doctor` edita apenas as proprias consultas conjuntas
- status iniciais: `pendente`, `pago`, `parcial`
- `valor_recebido` como campo unico acumulado

**Dependencia operacional confirmada em 2026-04-07:**
- com apenas 1 `profile` de `doctor`, nao ha como mapear ownership individual de Igor, Beatriz, Eduardo, Tamires e Felipe Reinaldo via RLS
- antes da implementacao, sera preciso:
  - criar 1 usuario/profile por medico
  - garantir `public.profiles` com `role = doctor` para os novos usuarios
  - executar a migration real para criar `profiles.doctor_name`
  - preencher `profiles.doctor_name` com os nomes curtos corretos
  - so depois validar o RLS com usuarios distintos

### T00 — Preparar rollout de auth dos medicos ✅ CONCLUÍDO (2026-04-07)
**Depende de:** decisao da Opcao A ja tomada
**Arquivo:** Supabase Auth / `profiles`

Executar antes da FASE 1:
- levantar login/e-mail de cada medico
- criar 1 auth user por medico
- garantir 1 `profile` por medico com `role = doctor`
- registrar os UUIDs reais de cada usuario
- preparar o preenchimento futuro de `doctor_name` com:
  - `Igor`
  - `Beatriz`
  - `Eduardo`
  - `Tamires`
  - `Felipe Reinaldo`

**Verificacao:** cada medico passa a possuir `auth.uid()` proprio e `role = doctor`; depois da migration real, `doctor_name` deve ficar consistente com os nomes curtos ja usados no app.

---

## FASE 1 — Banco de Dados e RLS ✅ CONCLUÍDA

### T01 — Criar tabela `ambulatorio_config` ✅ CONCLUÍDO
**Depende de:** nada
**Arquivo:** Supabase SQL Editor / migration

Criar tabela de configuracao com linha unica:
- `valor_fixo_medico_conjunta`
- `pct_imposto_medico`
- `pct_imposto_samira`
- `pct_administracao_medico`
- `updated_at`

Adicionar linha inicial com defaults:
- `valor_fixo_medico_conjunta = 600`
- percentuais iniciais definidos com Igor/Samira antes de go-live

Criar RLS:
- leitura para autenticados
- escrita apenas para usuarios com permissao financeira

**Verificacao:** a tabela existe, tem 1 linha, e apenas perfil autorizado consegue editar.

---

### T02 — Criar tabela `consultas_ambulatoriais` ✅ CONCLUÍDO
**Depende de:** nada
**Arquivo:** Supabase SQL Editor / migration

Criar tabela com os campos definidos no spec:
- identificacao
- dados da consulta
- valores brutos
- percentuais usados no momento da consulta
- descontos/impostos calculados
- valores liquidos
- status de pagamento
- valor recebido
- observacoes
- auditoria (`created_by`, `created_at`, `updated_at`)

Criar validacoes basicas:
- `valor_total >= 0`
- `valor_medico >= 0`
- `valor_samira >= 0`
- `valor_liquido_medico >= 0`
- `valor_liquido_samira >= 0`
- `status_pagamento` limitado aos valores aceitos

**Verificacao:** tabela criada com schema completo e tipos corretos.

---

### T03 — Definir policies de RLS do modulo ambulatorial ✅ CONCLUÍDO
**Depende de:** T01, T02
**Arquivo:** Supabase SQL Editor / migration

Aplicar policies para:
- `admin`: controle total
- `manager`: leitura total + escrita financeira
- `doctor`: leitura conforme regra atual do projeto e eventual escrita nao financeira se permitido

Observacao atual de planejamento:
- a regra funcional do `doctor` ja esta fechada
- a decisao de auth tambem ja foi fechada em favor de 1 usuario/profile por medico
- a policy planejada em `migration.sql` fica operacionalmente correta depois da execucao da T00

**Verificacao:** perfis distintos conseguem exatamente o que foi planejado, sem brecha de escrita indevida.

---

## FASE 2 — Estrutura da Tela e Bootstrap ✅ CONCLUÍDA (com desvio — ver nota acima)

### T04 — Adicionar aba `Ambulatorio` na navegacao principal ✅ CONCLUÍDO (como link no header, não aba bottom-nav)
**Depende de:** nada
**Arquivos:** `index.html`, `styles.css`

Adicionar botao de navegacao no mesmo padrao das screens atuais.

**Verificacao:** aba aparece e alterna corretamente para a nova screen.

---

### T05 — Criar `#screen-ambulatorio` ✅ CONCLUÍDO (implementado como ambulatorio.html standalone)
**Depende de:** T04
**Arquivo:** `index.html`

Adicionar estrutura base da tela com:
- header
- bloco de configuracoes/resumo
- formulario
- filtros
- tabela/historico
- estado vazio

**Verificacao:** screen existe no DOM e navega sem erros.

---

### T06 — Criar modulo isolado `ambulatorio.js` ✅ CONCLUÍDO
**Depende de:** T05
**Arquivos:** `ambulatorio.js` novo, `index.html`

Criar arquivo separado para evitar inflar ainda mais o monolito em [script.js](/Users/igorcampana/projetos_programacao/AppHosp/script.js).

Estrutura inicial:
- estado local do modulo
- init
- load config
- load consultas
- helpers de calculo
- render
- listeners

Carregar `ambulatorio.js` apos `script.js`, no mesmo modelo usado por `repasse.js`.

**Verificacao:** modulo carrega sem erro e `initAmbulatorio()` pode ser chamado no bootstrap.

---

### T07 — Integrar o bootstrap do modulo no app principal ✅ CONCLUÍDO (link no header visível apenas para admin)
**Depende de:** T06
**Arquivo:** `script.js`

No final do init principal, chamar `initAmbulatorio()` se a funcao existir.

**Verificacao:** abrir o app inicializa o modulo sem quebrar as telas existentes.

---

## FASE 3 — Configuracoes Financeiras ✅ CONCLUÍDA

### T08 — Carregar configuracao do ambulatorio ✅ CONCLUÍDO
**Depende de:** T01, T06
**Arquivo:** `ambulatorio.js`

Implementar busca da linha unica de `ambulatorio_config`.

**Verificacao:** a tela carrega os valores padrao ao abrir.

---

### T09 — UI de configuracao financeira ✅ CONCLUÍDO
**Depende de:** T08
**Arquivos:** `index.html`, `styles.css`, `ambulatorio.js`

Criar bloco ou modal para editar:
- valor fixo do medico em consulta conjunta
- imposto do medico
- imposto da Samira
- administracao do medico

Restringir edicao a perfil com permissao financeira.

**Verificacao:** usuario autorizado salva configuracao; usuario sem permissao apenas visualiza.

---

### T10 — Persistir configuracao financeira ✅ CONCLUÍDO
**Depende de:** T09
**Arquivo:** `ambulatorio.js`

Salvar alteracoes em `ambulatorio_config` e recarregar valores de calculo padrao para novos registros.

**Verificacao:** atualizar, recarregar tela e confirmar persistencia.

---

## FASE 4 — Formulario e Calculo da Consulta ✅ CONCLUÍDA

### T11 — Criar formulario de cadastro ✅ CONCLUÍDO
**Depende de:** T05
**Arquivos:** `index.html`, `styles.css`

Campos minimos:
- paciente
- data
- medico
- consulta conjunta
- valor total
- status de pagamento
- valor recebido
- observacoes

Area de demonstrativo de calculo:
- valor medico
- valor Samira
- impostos
- administracao
- liquidos

**Verificacao:** formulario renderiza corretamente em desktop e mobile.

---

### T12 — Implementar helper de calculo financeiro ✅ CONCLUÍDO (`calcConsulta()` em ambulatorio.js)
**Depende de:** T08
**Arquivo:** `ambulatorio.js`

Criar funcao pura para calcular:
- bruto do medico
- bruto da Samira
- imposto do medico
- imposto da Samira
- administracao do medico
- liquidos finais

Essa funcao deve aceitar override manual de campos quando permitido.

**Verificacao:** casos de teste manual batem com calculo externo.

---

### T13 — Aplicar calculo automatico no formulario ✅ CONCLUÍDO
**Depende de:** T11, T12
**Arquivo:** `ambulatorio.js`

Ao alterar:
- consulta conjunta
- valor total
- medico
- configuracoes padrao

Atualizar o resumo financeiro na tela.

**Verificacao:** mudar valor total ou tipo da consulta recalcula imediatamente.

---

### T14 — Implementar validacoes de formulario ✅ CONCLUÍDO
**Depende de:** T13
**Arquivo:** `ambulatorio.js`

Validar:
- paciente obrigatorio
- data obrigatoria
- valor total obrigatorio
- consulta conjunta com valor total menor que `600` exige confirmacao/ajuste manual
- `valor_recebido` nao pode exceder `valor_total` sem confirmacao explicita

**Verificacao:** formulario bloqueia entradas invalidas com mensagem clara.

---

### T15 — Salvar nova consulta ✅ CONCLUÍDO
**Depende de:** T03, T14
**Arquivo:** `ambulatorio.js`

Persistir consulta com:
- percentuais usados no momento
- valores calculados finais
- status e valor recebido
- `created_by`

**Verificacao:** consulta aparece no banco e no historico imediatamente apos salvar.

---

## FASE 5 — Historico, Filtros e Edicao ✅ CONCLUÍDA

### T16 — Renderizar historico de consultas ✅ CONCLUÍDO
**Depende de:** T15
**Arquivos:** `ambulatorio.js`, `index.html`

Tabela/lista com:
- paciente
- data
- medico
- conjunta
- valor total
- valor liquido medico
- valor liquido Samira
- status

**Verificacao:** historico ordenado por data decrescente.

---

### T17 — Implementar filtros ✅ CONCLUÍDO (período, médico, status)
**Depende de:** T16
**Arquivo:** `ambulatorio.js`

Filtros por:
- periodo
- medico
- status

**Verificacao:** combinacoes de filtros retornam linhas corretas.

---

### T18 — Editar consulta existente ✅ CONCLUÍDO
**Depende de:** T16
**Arquivo:** `ambulatorio.js`

Permitir abrir consulta em modo edicao com os mesmos calculos e validacoes do cadastro.

Respeitar o perfil do usuario.

**Verificacao:** editar e salvar atualiza historico sem duplicar registro.

---

### T19 — Excluir consulta ✅ CONCLUÍDO (modal de confirmação)
**Depende de:** T16
**Arquivo:** `ambulatorio.js`

Adicionar exclusao com confirmacao.

**Verificacao:** registro some da tela e do banco apenas para usuario autorizado.

---

## FASE 6 — Resumo Mensal ✅ CONCLUÍDA

### T20 — Criar resumo consolidado por periodo ✅ CONCLUÍDO
**Depende de:** T16
**Arquivo:** `ambulatorio.js`

Calcular:
- quantidade de consultas
- valor total
- total liquido por medico
- total liquido da Samira
- separacao entre consultas conjuntas e exclusivas

**Verificacao:** resumo bate com soma manual de um mes de teste.

---

### T21 — Exibir resumo mensal na UI ✅ CONCLUÍDO (cards de resumo no topo da tela)
**Depende de:** T20
**Arquivos:** `index.html`, `styles.css`, `ambulatorio.js`

Exibir cards/resumo no topo da tela com leitura rapida para fechamento mensal.

**Verificacao:** resumo atualiza ao trocar filtros de periodo.

---

## FASE 7 — Integracao com Repasse ✅ CONCLUÍDA

### T22 — Definir contrato de integracao com `repasse.js` ✅ CONCLUÍDO (2026-04-08)
**Depende de:** T20
**Arquivos:** `repasse.js` (ambulatorio.js não foi tocado)

Decisão: leitura direta da tabela `consultas_ambulatoriais` pelo `repasse.js`. Constante `AMB_COLS` centraliza colunas. Função `loadAmbulatorioMes()` carrega, `calcAmbulatorioResumo()` agrega.

**Verificacao:** contrato documentado em comentário no código (linhas 481–484 de repasse.js). Nenhuma regra de cálculo duplicada — valores lidos do banco como estão.

---

### T23 — Incluir ambulatorio no fechamento mensal do repasse ✅ CONCLUÍDO (2026-04-08)
**Depende de:** T22
**Arquivo:** `repasse.js`

Seção condicional de ambulatório adicionada em `renderPag1()` (totais) e `renderPag2()` (por médico). Também funciona em `baixarPDFHistorico()`. Exibição separada: visitas hospitalares + consultas ambulatoriais.

**Verificacao:** repasse continua batendo para visitas; ambulatorio soma corretamente em separado.

---

### T24 — Validar que o repasse antigo nao regrediu ✅ CONCLUÍDO (2026-04-08)
**Depende de:** T23
**Arquivo:** verificação por análise de código

`calcAmbulatorioResumo([])` retorna `null` → rendering condicional `${null ? ... : ''}` produz string vazia → relatório idêntico ao anterior em meses sem consultas ambulatoriais. `calcularRepasse()` não foi alterado.

**Verificacao:** em mes sem consultas ambulatoriais, o resultado do repasse permanece identico ao anterior.

---

## FASE 8 — Validacao e Go-Live

### Bugs Encontrados e Corrigidos Durante Integração (2026-04-08)

Antes de iniciar T25, os seguintes bugs foram descobertos e corrigidos:

1. **RLS Policies incompletas:** Políticas de escrita para `repasse_fatura` e `repasse_paciente` apenas permitiam `manager`, bloqueando `admin`. Corrigido: adicionado `admin` role.

2. **Nome da coluna inconsistente:** Constante `AMB_COLS` em `repasse.js` usava `conjunta` enquanto `ambulatorio.js` e a tabela usam `consulta_conjunta`. Corrigido.

3. **Escopo de função quebrado:** `esc()` era definida dentro do closure de `script.js` (DOMContentLoaded), inacessível para `repasse.js`. Corrigido: função redefinida localmente em `repasse.js`.

4. **Auto-fill de pagamento:** Campo `valor_recebido` permanecia zerado mesmo com status SIM/RETAGUARDA. Corrigido: implementado auto-fill usando fórmula `(valor_visita × dias) − desconto` via função `calcValorEsperado()`.

5. **Relatório sem discriminação:** Pág. 1 e Pág. 2 do repasse mostravam apenas totais de ambulatório. Corrigido: adicionadas tabelas detalhadas com paciente, tipo de consulta, status e valores.

**Impacto:** Integração estável em `main` desde bde38a0. T25 pode proceder.

---

### T25 — Rodar bateria de testes manuais do modulo ⏳ PENDENTE (2026-04-08)
**Depende de:** T21 ✅ + T22-T24 (integração com repasse) ✅

Casos minimos:
- consulta conjunta normal
- consulta so da Samira
- consulta conjunta com ajuste manual
- consulta parcial
- edicao de consulta
- exclusao de consulta
- filtro por medico
- filtro por periodo

**Verificacao:** todos os cenarios aprovados sem regressao visual em desktop e mobile.

---

### T26 — Homologacao com casos reais ⏳ PENDENTE (2026-04-08)
**Depende de:** T25

Validar com 3 a 5 consultas reais do fluxo da equipe.

**Verificacao:** valores e regras aceitos por voce e pela Samira.

---

### T27 — Checklist de producao ⏳ PENDENTE (2026-04-08)
**Depende de:** T26

Checklist:
- schema aplicado em producao
- policies revisadas
- perfis corretos
- dados iniciais configurados
- backup/export validado

**Verificacao:** modulo apto para go-live.

---

## Ordem Recomendada de Commits

1. `feat(ambulatorio): add schema and rls`
2. `feat(ambulatorio): add screen scaffold and module bootstrap`
3. `feat(ambulatorio): add financial settings`
4. `feat(ambulatorio): add form and calculation flow`
5. `feat(ambulatorio): add history filters and editing`
6. `feat(ambulatorio): add monthly summary`
7. `feat(repasse): integrate ambulatorial totals`
8. `test(ambulatorio): validate manual go-live checklist`
