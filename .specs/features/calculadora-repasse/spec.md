# Feature Spec: Calculadora de Repasse de Visitas

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Large
**Area:** Nova tela — Repasse

---

## Summary

Nova aba "Repasse" que permite ao gestor inserir os dados financeiros mensais e gera automaticamente dois relatórios prontos para impressão: a fatura detalhada por paciente (Pág. 1) e o demonstrativo de repasse individual por médico (Pág. 2), usando como base os dados de visitas já registrados no sistema.

---

## Problema

Hoje o cálculo do repasse mensal é feito manualmente fora do sistema. O AppHosp já possui todos os dados de visitas (quem visitou, quando, quantas visitas), mas não há nenhuma tela que consolide isso com os dados financeiros do mês para gerar o demonstrativo de pagamento.

---

## Goal

O sistema deve gerar automaticamente o demonstrativo de repasse mensal a partir de:
- Dados de visitas já existentes no `historico`
- Dados financeiros inseridos pelo gestor (valor recebido, status de pagamento por paciente)
- Parâmetros configuráveis (percentuais de desconto, locação de sala)

---

## Atores

| Ator | Capacidade |
|------|-----------|
| `manager` | Inserir/editar dados financeiros (valor total, status e valor por paciente, incluir/excluir pacientes), visualizar relatório de todos |
| `doctor` | Ajustar configurações (percentuais, desconto de sala, CRM), gerar e imprimir relatório; **não pode** editar dados financeiros |

---

## Requirements

### Configurações (Settings)

- `REP-CFG-001`: O sistema deve permitir ao gestor configurar os percentuais de cálculo: impostos (%), administração (%), e repasse Dra. Samira (% sobre o restante).
- `REP-CFG-002`: O sistema deve permitir ao gestor configurar o desconto de locação de sala por médico (valor em R$, zerado por padrão para quem não tem desconto).
- `REP-CFG-003`: As configurações devem ser persistidas no Supabase e carregadas automaticamente ao abrir a tela de repasse.
- `REP-CFG-004`: Qualquer usuário autenticado pode editar as configurações (percentuais, descontos de sala, CRMs). Apenas o gestor pode editar dados financeiros (valor total recebido, status e valor por paciente).
- `REP-CFG-005`: O sistema deve armazenar, por médico (keyed pelo nome curto usado no `historico`): nome completo com tratamento (ex: "Dr. Igor Gusmão Campana") e CRM. Na primeira geração de relatório que inclua um médico sem CRM cadastrado, o sistema deve solicitar o CRM antes de imprimir. Nas gerações seguintes, o valor é preenchido automaticamente.

### Seleção de Período

- `REP-PER-001`: O usuário deve poder selecionar mês e ano de referência para gerar o repasse.
- `REP-PER-002`: O período padrão ao abrir a tela deve ser o mês atual.

### Entrada de Dados Financeiros (Gestor)

- `REP-FIN-001`: O gestor deve poder informar o Valor Total Recebido no mês.
- `REP-FIN-002`: O sistema deve pré-popular automaticamente a lista de pacientes do mês com: nome do paciente, período da internação (`dataprimeiraavaliacao` – `dataultimavisita`) e hospital — vindos da tabela `patients`.
- `REP-FIN-003`: Os pacientes pré-populados são aqueles com internação ativa no mês selecionado (`dataprimeiraavaliacao <= último dia do mês` E `dataultimavisita >= primeiro dia do mês`, OU ainda internados).
- `REP-FIN-004`: Para cada paciente listado, o gestor deve poder informar manualmente: status de pagamento (SIM / NÃO / PARCIAL / RETAGUARDA) e valor recebido (R$).
- `REP-FIN-005`: O gestor deve poder editar o período de internação exibido (início e fim) diretamente na linha do paciente, caso precise ajustar para fins de faturamento.
- `REP-FIN-006`: O gestor deve poder incluir ou excluir qualquer paciente da lista do mês — incluir pacientes que não foram pré-populados automaticamente, e excluir os que não devem entrar naquele faturamento.
- `REP-FIN-007`: Apenas pacientes marcados como incluídos E com status diferente de NÃO aparecem na fatura impressa (Pág. 1). Todos os pacientes da lista (incluídos ou excluídos) permanecem editáveis na tela de entrada.
- `REP-FIN-008`: Os dados financeiros por mês/paciente devem ser persistidos no Supabase para revisão futura.

### Cálculo do Repasse

- `REP-CALC-001`: O sistema deve calcular automaticamente, a partir do Valor Total Recebido:
  - Impostos = Total × % impostos
  - Administração = Total × % adm
  - Restante = Total − Impostos − Administração
  - Dra. Samira = Restante × % Samira
  - Divisão da Equipe = Total − Impostos − Administração − Dra. Samira
- `REP-CALC-002`: O sistema deve calcular o total de visitas da equipe e por médico usando a tabela `historico` filtrada pelo mês selecionado (somando o campo `visitas`).
- `REP-CALC-003`: O valor por visita = Divisão da Equipe / Total de visitas equipe.
- `REP-CALC-004`: Para cada médico: Valor bruto = valor por visita × visitas do médico.
- `REP-CALC-005`: Para cada médico: Valor líquido = Valor bruto − Desconto locação de sala.
- `REP-CALC-006`: O valor do repasse por paciente, para um dado médico = valor por visita × visitas daquele médico àquele paciente no mês.

### Relatório — Página 1: Fatura Detalhada

- `REP-PAG1-001`: O relatório Pág. 1 deve exibir cabeçalho com: período da fatura, data de emissão.
- `REP-PAG1-002`: Deve exibir a memória de cálculo com todos os valores intermediários (impostos, adm, Dra. Samira, divisão da equipe).
- `REP-PAG1-003`: Deve listar os pacientes com status de pagamento SIM, PARCIAL ou RETAGUARDA, com: nome completo, período de cobrança (dataprimeiraavaliacao – dataultimavisita), status, valor recebido, hospital.
- `REP-PAG1-004`: Deve exibir o Valor Total Recebido ao final da tabela.

### Relatório — Página 2: Repasse Individual por Médico

- `REP-PAG2-001`: A Pág. 2 deve ser gerada para cada médico com visitas no mês selecionado.
- `REP-PAG2-002`: Deve exibir: total de visitas da equipe, total de visitas do médico, valor bruto, desconto locação de sala, valor líquido.
- `REP-PAG2-003`: Deve exibir a memória de cálculo individual.
- `REP-PAG2-004`: Deve listar os pacientes visitados pelo médico no mês com: nome, quantidade de visitas, datas das visitas, valor do repasse.
- `REP-PAG2-005`: O nome do médico no relatório deve usar o mapeamento de nomes completos (mesmo padrão de `report-full-doctor-names`).

### Impressão

- `REP-PRINT-001`: O relatório deve ter um layout específico para impressão (`@media print`) que oculta navegação, botões e exibe apenas o conteúdo do relatório.
- `REP-PRINT-002`: Cada página do relatório (Pág. 1 e cada Pág. 2 de médico) deve ter quebra de página automática ao imprimir.
- `REP-PRINT-003`: Deve haver um botão "Imprimir" que aciona `window.print()`.

---

## Non-Goals

- Não gerar PDF diretamente (o usuário usa `Ctrl+P` / "Salvar como PDF" do navegador).
- Não calcular impostos individuais por médico (apenas o bloco geral da clínica).
- Não integrar com sistemas de pagamento externos.
- Não enviar relatório por e-mail ou WhatsApp automaticamente.

---

## Novas Tabelas Supabase Necessárias

### `repasse_config`
Armazena os parâmetros configuráveis da clínica.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | int8 PK | |
| `pct_impostos` | numeric | % impostos (ex: 16.33) |
| `pct_adm` | numeric | % administração (ex: 10) |
| `pct_samira` | numeric | % Dra. Samira sobre o restante (ex: 30) |
| `descontos_sala` | jsonb | `{"Igor": 2700, "Beatriz": 0, ...}` |
| `medicos` | jsonb | `{"Igor": {"nome_completo": "Dr. Igor Gusmão Campana", "crm": "186186"}, ...}` |
| `updated_at` | timestamptz | |

### `repasse_fatura`
Uma entrada por mês processado.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | |
| `mes` | int4 | 1–12 |
| `ano` | int4 | ex: 2026 |
| `valor_total_recebido` | numeric | Valor bruto do mês |
| `created_by` | uuid (ref auth.users) | |
| `updated_at` | timestamptz | |

### `repasse_paciente`
Dados financeiros por paciente por mês.

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `id` | uuid PK | |
| `fatura_id` | uuid (ref repasse_fatura) | |
| `patient_id` | uuid (ref patients) | |
| `status_pagamento` | text | SIM / NÃO / PARCIAL / RETAGUARDA |
| `valor_recebido` | numeric | |
| `updated_at` | timestamptz | |

---

## Acceptance Criteria

1. O gestor seleciona Fevereiro/2026, informa o valor total e os dados por paciente → o sistema exibe o cálculo completo em tempo real.
2. Ao clicar em "Imprimir", o layout exibe Pág. 1 (fatura) seguida de uma Pág. 2 por médico, sem elementos de navegação.
3. O total de visitas e o repasse por médico batem com a fórmula: `(Divisão da Equipe / Total visitas equipe) × visitas do médico`.
4. O desconto de locação de sala é subtraído corretamente do valor bruto de cada médico configurado.
5. Um médico logado como `doctor` consegue visualizar o relatório mas não consegue editar valores financeiros.
6. Ao salvar os dados de fevereiro e reabrir o mês, os valores preenchidos são carregados automaticamente.
7. Paciente com status NÃO não aparece na fatura impressa mas permanece editável na lista de entrada.

---

## Risks

- **Médio:** Lógica de quais pacientes "pertencem" a um mês pode ser ambígua para internações muito longas que cruzam vários meses. A regra `REP-FIN-002` cobre o caso mas pode incluir pacientes que o gestor não quer faturar naquele mês — mitigado pela possibilidade de remoção manual (`REP-FIN-006`).
- **Baixo:** O `script.js` já tem 1520 linhas. Adicionar a lógica de repasse aumenta consideravelmente o tamanho — considerar separar em `repasse.js` para manutenibilidade.
- **Baixo:** Layout de impressão requer testes em diferentes navegadores (Chrome vs Safari vs Firefox) para garantir quebras de página corretas.

---

## Open Questions

- `OQ-001`: ~~Resolvido~~ — gestor controla quais pacientes entram via `REP-FIN-006`/`REP-FIN-007`.
- `OQ-002`: ~~Resolvido~~ — o CRM é inserido pelo gestor na primeira geração do relatório de cada médico e persistido para uso automático nos meses seguintes. Ver `REP-CFG-005`.
