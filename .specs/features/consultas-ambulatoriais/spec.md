# Feature Spec: Consultas Ambulatoriais

**Date:** 2026-04-07
**Status:** Draft
**Scope:** Large
**Area:** Nova tela — Ambulatorio

---

## Summary

Nova aba "Ambulatorio" para registrar consultas ambulatoriais, calcular automaticamente a divisao financeira entre o medico e a Dra. Samira, controlar o status de pagamento e integrar esses valores ao fluxo de repasse mensal.

---

## Problema

Hoje as consultas ambulatoriais nao possuem um fluxo estruturado dentro do AppHosp. O controle tende a acontecer fora do sistema, o que aumenta risco de perda de informacao, retrabalho, erro no fechamento financeiro e falta de historico confiavel por medico e por mes.

---

## Goal

Permitir que a equipe registre consultas ambulatoriais dentro do AppHosp, com calculo financeiro automatico e editavel, acompanhamento de pagamento, historico filtravel e consolidacao no repasse mensal.

---

## Atores

| Ator | Capacidade |
|------|-----------|
| `admin` | Controle total do modulo, inclusive ajustes financeiros e correcoes |
| `doctor` | Visualizar historico e relatorios; pode cadastrar e editar apenas consultas conjuntas |
| `manager` | Visualizar historico, status e valores; editar dados financeiros e de pagamento |

---

## Regras de Negocio Confirmadas

- Consulta conjunta: o medico recebe `R$ 600,00` fixos.
- Em consulta conjunta, a Dra. Samira recebe `valor_total - 600`.
- Em consulta conjunta, tanto o medico quanto a Dra. Samira pagam imposto.
- Em consulta conjunta, apenas o medico paga administracao.
- Consulta apenas da Dra. Samira: a Dra. Samira recebe `100%` do valor e paga apenas imposto.
- Todos os valores calculados devem ser editaveis manualmente para correcao pontual.

---

## Requirements

### Tela e Navegacao

- `AMB-UI-001`: O sistema deve adicionar uma nova aba `Ambulatorio` na navegacao principal.
- `AMB-UI-002`: A nova aba deve seguir o padrao visual ja usado no AppHosp.
- `AMB-UI-003`: A tela deve conter formulario de cadastro, lista/historico e resumo financeiro do periodo selecionado.

### Registro de Consulta

- `AMB-REG-001`: O sistema deve permitir cadastrar uma consulta ambulatorial com os campos: nome do paciente, data, medico responsavel, consulta conjunta (sim/nao), valor total, status de pagamento e observacoes.
- `AMB-REG-002`: O nome do paciente deve ser digitado livremente, sem depender da tabela `patients`.
- `AMB-REG-003`: O campo de data deve usar o padrao `YYYY-MM-DD`, respeitando a mesma estrategia timezone-safe do restante do projeto.
- `AMB-REG-004`: O usuario deve poder registrar uma consulta apenas da Dra. Samira, sem medico vinculado da equipe.
- `AMB-REG-005`: O sistema deve permitir editar uma consulta ja registrada.
- `AMB-REG-006`: O sistema deve permitir excluir uma consulta registrada, mediante confirmacao.
- `AMB-REG-007`: Usuarios `doctor` devem poder criar e editar apenas consultas marcadas como conjuntas.
- `AMB-REG-008`: Consultas exclusivas da Dra. Samira devem ficar sob controle de `admin` e `manager`.

### Calculo Financeiro

- `AMB-CALC-001`: Em consulta conjunta, ao informar o valor total, o sistema deve calcular automaticamente:
  - `valor_medico = 600`
  - `valor_samira = valor_total - 600`
- `AMB-CALC-002`: O sistema deve calcular o imposto do medico e o imposto da Dra. Samira com base em percentuais configuraveis.
- `AMB-CALC-003`: O sistema deve calcular a administracao apenas sobre a parte do medico.
- `AMB-CALC-004`: O valor liquido do medico deve ser calculado como `valor_medico - imposto_medico - administracao_medico`.
- `AMB-CALC-005`: O valor liquido da Dra. Samira deve ser calculado como `valor_samira - imposto_samira`.
- `AMB-CALC-006`: Em consulta exclusiva da Dra. Samira, o sistema deve calcular automaticamente:
  - `valor_medico = 0`
  - `valor_samira = valor_total`
  - `administracao_medico = 0`
- `AMB-CALC-007`: Todos os valores calculados automaticamente devem poder ser ajustados manualmente antes de salvar.
- `AMB-CALC-008`: Em consulta conjunta, o valor bruto do medico deve ser sempre `R$ 600,00`.
- `AMB-CALC-009`: Se o valor total informado for menor que `R$ 600,00` em uma consulta marcada como conjunta, o sistema nao deve permitir salvar.

### Configuracoes Financeiras

- `AMB-CFG-001`: O sistema deve armazenar percentuais padrao de imposto do medico, imposto da Dra. Samira e administracao do medico.
- `AMB-CFG-002`: Esses percentuais devem ser editaveis por usuario com permissao financeira.
- `AMB-CFG-003`: O modulo deve carregar automaticamente os percentuais padrao ao abrir a tela.
- `AMB-CFG-004`: Alteracoes de configuracao devem valer para novos registros, sem reprocessar retroativamente consultas antigas ja salvas.

### Historico e Filtros

- `AMB-HIS-001`: O sistema deve listar as consultas registradas em ordem decrescente de data.
- `AMB-HIS-002`: O historico deve permitir filtro por periodo.
- `AMB-HIS-003`: O historico deve permitir filtro por medico.
- `AMB-HIS-004`: O historico deve permitir filtro por status de pagamento.
- `AMB-HIS-005`: Cada linha do historico deve exibir ao menos: paciente, data, medico, conjunta, valor total, valor medico, valor Samira, status de pagamento.
- `AMB-HIS-006`: O usuario deve conseguir abrir uma consulta existente para revisao e edicao.

### Status de Pagamento

- `AMB-PGTO-001`: Cada consulta deve possuir status de pagamento.
- `AMB-PGTO-002`: Os status iniciais devem ser `pendente`, `pago` e `parcial`.
- `AMB-PGTO-003`: O sistema deve permitir registrar um unico `valor_recebido` por consulta quando o status for `pago` ou `parcial`.
- `AMB-PGTO-004`: Quando o status for `parcial`, o sistema deve permitir registrar observacao explicando a diferenca.

### Relatorio Mensal

- `AMB-REL-001`: O sistema deve gerar um resumo mensal de consultas ambulatoriais.
- `AMB-REL-002`: O resumo mensal deve consolidar quantidade de consultas, valor total, valor liquido por medico e valor liquido da Dra. Samira.
- `AMB-REL-003`: O usuario deve poder filtrar o relatorio por mes e ano.
- `AMB-REL-004`: O resumo deve exibir separadamente consultas conjuntas e consultas exclusivas da Dra. Samira.

### Integracao com Repasse

- `AMB-REP-001`: O modulo de repasse deve passar a considerar as consultas ambulatoriais no fechamento mensal.
- `AMB-REP-002`: A integracao deve usar os valores liquidos ja salvos na consulta, sem recalcular regras financeiras dentro do repasse.
- `AMB-REP-003`: O repasse mensal deve deixar claro o que veio de visitas hospitalares e o que veio de consultas ambulatoriais.

### Permissoes

- `AMB-RBAC-001`: Apenas usuarios com permissao de escrita devem poder criar, editar ou excluir consultas.
- `AMB-RBAC-002`: Usuarios apenas-leitura devem conseguir visualizar historico e relatorios, sem botoes de edicao.
- `AMB-RBAC-003`: Apenas usuarios com permissao financeira devem poder editar configuracoes e status de pagamento.
- `AMB-RBAC-004`: Usuarios `doctor` nao devem poder criar, editar ou excluir consultas exclusivas da Dra. Samira.
- `AMB-RBAC-005`: Usuarios `doctor` nao devem poder alterar configuracoes financeiras do modulo.

---

## Non-Goals

- Integrar o modulo ambulatorial ao cadastro de pacientes internados.
- Emitir nota fiscal, recibo ou cobranca automatica.
- Criar agenda de consultas.
- Integrar com operadora, convênio ou prontuario externo.
- Refatorar o modulo de repasse inteiro neste momento.

---

## Nova Tabela Supabase Necessaria

### `consultas_ambulatoriais`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | uuid PK | Identificador da consulta |
| `paciente_nome` | text | Nome livre do paciente |
| `data_consulta` | date | Data da consulta |
| `medico` | text | Nome curto do medico da equipe; pode ser null em consulta so da Samira |
| `consulta_conjunta` | boolean | Indica se houve consulta conjunta |
| `valor_total` | numeric | Valor total cobrado |
| `valor_medico` | numeric | Parte bruta do medico |
| `valor_samira` | numeric | Parte bruta da Dra. Samira |
| `pct_imposto_medico` | numeric | Percentual usado no calculo do medico |
| `pct_imposto_samira` | numeric | Percentual usado no calculo da Dra. Samira |
| `pct_administracao_medico` | numeric | Percentual de administracao do medico |
| `imposto_medico` | numeric | Valor absoluto do imposto do medico |
| `imposto_samira` | numeric | Valor absoluto do imposto da Dra. Samira |
| `administracao_medico` | numeric | Valor absoluto da administracao do medico |
| `valor_liquido_medico` | numeric | Valor final do medico |
| `valor_liquido_samira` | numeric | Valor final da Dra. Samira |
| `status_pagamento` | text | `pendente`, `pago`, `parcial` |
| `valor_recebido` | numeric | Valor efetivamente recebido |
| `observacoes` | text | Notas livres |
| `created_by` | uuid | Usuario que criou |
| `created_at` | timestamptz | Criacao |
| `updated_at` | timestamptz | Ultima atualizacao |

---

## Tabela de Configuracao Necessaria

### `ambulatorio_config`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| `id` | int8 PK | Registro unico |
| `valor_fixo_medico_conjunta` | numeric | Padrao inicial: `600` |
| `pct_imposto_medico` | numeric | Percentual padrao do medico |
| `pct_imposto_samira` | numeric | Percentual padrao da Dra. Samira |
| `pct_administracao_medico` | numeric | Percentual padrao da administracao do medico |
| `updated_at` | timestamptz | Ultima atualizacao |

---

## Acceptance Criteria

1. O usuario consegue registrar uma consulta conjunta com valor total, e o sistema preenche automaticamente a divisao financeira inicial.
2. O usuario consegue registrar uma consulta exclusiva da Dra. Samira sem medico vinculado.
3. O usuario consegue editar manualmente os valores calculados antes de salvar.
4. O historico mostra consultas filtradas por periodo, medico e status.
5. O relatorio mensal consolida corretamente quantidade de consultas e totais liquidos.
6. O repasse mensal passa a incluir os valores liquidos ambulatoriais sem alterar o calculo das visitas hospitalares.
7. Um usuario apenas-leitura nao consegue alterar consultas nem configuracoes financeiras.

---

## Risks

- **Medio:** Misturar calculo automatico com edicao manual pode gerar inconsistencias se nao houver clareza visual sobre quais campos foram ajustados.
- **Medio:** A integracao com `repasse.js` pode introduzir regressao em um modulo considerado estavel se a consolidacao mensal nao for bem isolada.
- **Baixo:** O uso de nome livre do paciente evita burocracia, mas reduz padronizacao e busca futura.
- **Baixo:** O projeto ainda nao possui testes automatizados do frontend, entao a validacao manual dessa feature precisa ser rigorosa.

---

## Decisoes Confirmadas

- `DEC-001`: `manager` pode cadastrar e editar todas as consultas do modulo.
- `DEC-002`: `doctor` pode cadastrar e editar apenas consultas conjuntas.
- `DEC-003`: Os status iniciais de pagamento serao `pendente`, `pago` e `parcial`.
- `DEC-004`: `valor_recebido` sera um campo unico por consulta.
- `DEC-005`: Os percentuais padrao previstos no spec serao mantidos.
- `DEC-006`: Em consulta conjunta, a parte bruta do medico sera sempre `R$ 600,00`.
- `DEC-007`: O modulo ambulatorial seguira a Opcao A: 1 usuario/profile por medico para viabilizar ownership por `profiles.doctor_name`.

## Planning Notes

- Em 2026-04-07, a leitura real do Supabase confirmou que existe apenas 1 `profile` com role `doctor`, ligado ao login compartilhado `medicos@gmail.com`.
- A regra funcional ja foi fechada como: `doctor` cadastra/edita apenas consultas conjuntas em que ele e o medico responsavel.
- Em 2026-04-07, ficou decidido seguir com a separacao de logins medicos antes da implementacao do ambulatorio.
- Portanto, o schema da migration segue com `profiles.doctor_name`, e a proxima dependencia pratica e criar os usuarios/perfis medicos reais para preencher o seed de ownership.
