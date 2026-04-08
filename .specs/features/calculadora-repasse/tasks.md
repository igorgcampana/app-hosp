# Tasks: Calculadora de Repasse de Visitas

**Date:** 2026-03-30
**Status:** Ready
**Refs:** spec.md, design.md

---

## Dependências Gerais

```
FASE 1 (Banco) → FASE 2 (Estrutura) → FASE 3 (Entrada de Dados)
                                     → FASE 4 (Cálculo + Relatório)
                                     → FASE 5 (Impressão)
FASE 6 (RBAC) pode rodar em paralelo com FASE 3–5
```

---

## FASE 1 — Banco de Dados (Supabase)

### T01 — Criar tabela `repasse_config`
**Depende de:** nada
**Arquivo:** Supabase SQL Editor

```sql
CREATE TABLE repasse_config (
  id             int8 PRIMARY KEY DEFAULT 1,
  pct_impostos   numeric(5,2) NOT NULL DEFAULT 16.33,
  pct_adm        numeric(5,2) NOT NULL DEFAULT 10.00,
  pct_samira     numeric(5,2) NOT NULL DEFAULT 30.00,
  descontos_sala jsonb NOT NULL DEFAULT '{}',
  medicos        jsonb NOT NULL DEFAULT '{}',
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Linha inicial
INSERT INTO repasse_config (id) VALUES (1);

-- RLS
ALTER TABLE repasse_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura autenticados" ON repasse_config FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escrita autenticados" ON repasse_config FOR UPDATE USING (auth.role() = 'authenticated');
```

**Verificação:** Abrir Supabase → Table Editor → `repasse_config` tem 1 linha com defaults.

---

### T02 — Criar tabela `repasse_fatura`
**Depende de:** nada

```sql
CREATE TABLE repasse_fatura (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mes                  int4 NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano                  int4 NOT NULL,
  valor_total_recebido numeric(12,2) NOT NULL DEFAULT 0,
  created_by           uuid REFERENCES auth.users,
  updated_at           timestamptz DEFAULT now(),
  UNIQUE (mes, ano)
);

ALTER TABLE repasse_fatura ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura autenticados" ON repasse_fatura FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escrita manager" ON repasse_fatura FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
```

**Verificação:** Tentar INSERT como `doctor` → bloqueado. INSERT como `manager` → ok.

---

### T03 — Criar tabela `repasse_paciente`
**Depende de:** T02

```sql
CREATE TABLE repasse_paciente (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id        uuid NOT NULL REFERENCES repasse_fatura(id) ON DELETE CASCADE,
  patient_id       uuid REFERENCES patients(id),
  nome_override    text,
  periodo_inicio   date NOT NULL,
  periodo_fim      date,
  hospital         text,
  status_pagamento text CHECK (status_pagamento IN ('SIM','NÃO','PARCIAL','RETAGUARDA')),
  valor_recebido   numeric(12,2),
  incluido         boolean NOT NULL DEFAULT true,
  updated_at       timestamptz DEFAULT now()
);

ALTER TABLE repasse_paciente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leitura autenticados" ON repasse_paciente FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "escrita manager" ON repasse_paciente FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
);
```

**Verificação:** Schema correto no Table Editor. ON DELETE CASCADE funcionando.

---

## FASE 2 — Estrutura HTML + CSS Base

### T04 — Adicionar aba "Repasse" no bottom nav
**Depende de:** nada
**Arquivo:** `index.html`

Adicionar botão no `.bottom-nav` após a aba Calendário:
```html
<button class="nav-btn" data-target="screen-repasse">
  <svg class="tab-icon"><!-- ícone cifrão ou calculadora --></svg>
  <span class="tab-label">Repasse</span>
</button>
```

**Verificação:** Aba aparece no mobile e desktop; clique alterna para screen-repasse (ainda vazia).

---

### T05 — Criar estrutura base do `#screen-repasse`
**Depende de:** T04
**Arquivo:** `index.html`

Adicionar `<section id="screen-repasse" class="screen">` com:
- `.repasse-header` (seletor mês/ano + botões)
- `.repasse-entrada` (container da entrada de dados — vazio por ora)
- `.repasse-relatorio` (container do relatório — vazio por ora)
- `#repasse-config-modal` (modal de configurações — vazio por ora)

**Verificação:** Screen existe no DOM; `data-target="screen-repasse"` navega para ela.

---

### T06 — Criar `repasse.js` com estrutura e estado inicial
**Depende de:** T05
**Arquivo:** `repasse.js` (novo) + `index.html` (adicionar `<script src="repasse.js">`)

Estrutura inicial:
```javascript
// === REPASSE STATE ===
let repasseConfig = null;
let repasseFatura = null;
let repassePacientes = [];
let historicoMes = [];

// === INIT ===
async function initRepasse() { ... }

// === CONFIG ===
async function loadRepasseConfig() { ... }
async function saveRepasseConfig(updates) { ... }

// === FATURA ===
async function loadOrCreateFatura(mes, ano) { ... }
async function saveFatura(mes, ano, valorTotal) { ... }

// === PACIENTES ===
async function loadPacientesFatura(faturaId) { ... }
async function pré_popularPacientes(mes, ano) { ... }
async function savePaciente(dados) { ... }
async function deletePaciente(id) { ... }

// === CÁLCULO ===
function calcularRepasse(config, fatura, pacientes, historico) { ... }

// === RENDER ===
function renderRepasseEntrada() { ... }
function renderRepasseRelatorio(dados) { ... }
function renderPag1(dados) { ... }
function renderPag2(medico, dados) { ... }

// === MODAL CONFIG ===
function openRepasseConfigModal() { ... }
function renderConfigModal() { ... }
```

**Verificação:** `repasse.js` carrega sem erros no console. `initRepasse()` pode ser chamada.

---

### T07 — Estilos base da tela de repasse
**Depende de:** T05
**Arquivo:** `styles.css`

Adicionar:
- Layout `.repasse-header` (flex, espaçamento)
- Alternância de modos: `.modo-entrada .repasse-relatorio { display:none }` etc.
- Estilos da tabela de pacientes (`.repasse-pacientes-table`)
- Estilos dos cards de cálculo (`.repasse-calc-card`)
- Estilos `.repasse-pag1` e `.repasse-pag2` (layout A4-like, fundo branco)
- `@media print` completo (ver design.md seção 5)

**Verificação:** Tela não quebra visualmente. Modo relatório oculta entrada e vice-versa.

---

## FASE 3 — Entrada de Dados

### T08 — Seletor de mês/ano + carregamento inicial
**Depende de:** T06
**Arquivo:** `repasse.js`

Implementar em `initRepasse()`:
1. Popular `#repasse-ano` (ano atual ± 2) e `#repasse-mes` (Jan–Dez)
2. Default: mês e ano atuais
3. Ao mudar seletor → `loadOrCreateFatura(mes, ano)` → `renderRepasseEntrada()`

**Verificação:** Trocar mês recarrega a tela sem erros.

---

### T09 — Pré-popular lista de pacientes do mês
**Depende de:** T08
**Arquivo:** `repasse.js`

Implementar `pré_popularPacientes(mes, ano)`:
- Filtrar `patients[]` (já em memória global do `script.js`) pela regra:
  - `dataprimeiraavaliacao <= último dia do mês` E
  - (`dataultimavisita >= primeiro dia do mês` OU `statusmanual = 'Internado'`)
- Retornar array de objetos `{patient_id, nome, periodo_inicio, periodo_fim, hospital}`

Se já existe `repasse_fatura` para o mês → carregar `repasse_paciente` do banco em vez de pré-popular.

**Verificação:** Selecionar um mês com pacientes internados → lista mostra os corretos.

---

### T10 — Renderizar tabela de entrada de pacientes
**Depende de:** T09
**Arquivo:** `repasse.js` + `index.html`

Implementar `renderRepasseEntrada()`:
- Renderizar `.repasse-pacientes-table` com uma linha por paciente
- Cada linha: nome (readonly), período início (date input), período fim (date input), hospital (readonly), status (select), valor (number input), toggle incluído (checkbox)
- Campos financeiros (status + valor) com classe `.financeiro-only`
- Botão "+ Adicionar paciente" no final

**Verificação:** Lista renderiza corretamente. Campos editáveis funcionam.

---

### T11 — Salvar alterações de pacientes (auto-save ou botão)
**Depende de:** T10
**Arquivo:** `repasse.js`

Ao alterar qualquer campo da linha:
1. `saveFatura()` (upsert `repasse_fatura`) — garante que fatura existe
2. `savePaciente()` (upsert `repasse_paciente`) — salva a linha

Usar debounce de 800ms para evitar requests a cada tecla.

**Verificação:** Editar status de um paciente → reabrir o mês → valor persiste.

---

### T12 — Adicionar/remover pacientes manualmente
**Depende de:** T11
**Arquivo:** `repasse.js`

- Botão "+ Adicionar": abre mini-form inline (nome manual, período, hospital, status, valor) → `savePaciente()` com `patient_id = null` e `nome_override`
- Toggle "incluído": salva `incluido = false` → linha fica com visual dimmed mas permanece editável
- Ícone de lixeira (`.manager-only`): `deletePaciente(id)` com `showConfirm()`

**Verificação:** Adicionar paciente manual → aparece na lista. Desmarcar incluído → some do relatório mas continua na lista de entrada.

---

### T13 — Modal de configurações
**Depende de:** T06
**Arquivo:** `repasse.js` + `index.html`

Implementar `openRepasseConfigModal()`:
- Seção 1: Percentuais (impostos, adm, Samira) — inputs numéricos
- Seção 2: Descontos de sala — lista de médicos (de `DOCTORS`) com input de valor por linha
- Seção 3: Médicos — por médico: nome completo + CRM
- Botão "Salvar" → `saveRepasseConfig()` → upsert `repasse_config` → `showToast()`

**Verificação:** Alterar percentual → salvar → reabrir modal → valor persiste.

---

## FASE 4 — Cálculo e Relatório

### T14 — Implementar `calcularRepasse()`
**Depende de:** T08
**Arquivo:** `repasse.js`

Implementar a função pura de cálculo (ver design.md seção 4):
- Inputs: `config`, `fatura`, `pacientes`, `historicoMes`
- Output: objeto com todos os valores intermediários + `repassePorMedico`
- `historicoMes`: filtrar `historico[]` global por mês/ano selecionado

Incluir o cálculo do repasse por paciente por médico:
```javascript
// Para cada médico, agrupar visitas por patient_id
// valorRepasse = valorPorVisita * visitasDoMedicoAoPaciente
```

**Verificação:** Testar com dados do PDF de referência → resultados batem (R$ 48.792,38 / 149 × 23 = R$ 7.531,71).

---

### T15 — Renderizar Pág. 1 (Fatura Detalhada)
**Depende de:** T14
**Arquivo:** `repasse.js`

Implementar `renderPag1(dados)`:
- Cabeçalho: período da fatura, data de emissão (`new Date()`)
- Memória de cálculo: bloco com todos os valores intermediários formatados em BRL
- Tabela: apenas pacientes com `incluido = true` E `status_pagamento != 'NÃO'`
  - Colunas: Paciente, Período da Cobrança, Pagou?, Valor Recebido, Unidade
- Rodapé: Valor Total Recebido

**Verificação:** Visual corresponde ao PDF de referência.

---

### T16 — Renderizar Pág. 2 por médico
**Depende de:** T14
**Arquivo:** `repasse.js`

Implementar `renderPag2(medico, dados)` para cada médico com `visitasMedico > 0`:
- Cabeçalho: nome completo + CRM (de `config.medicos[medico]`)
- Bloco de totais: visitas equipe, visitas médico, valor bruto, desconto sala, valor líquido
- Memória de cálculo individual
- Tabela de pacientes:
  - Colunas: Paciente, Qtd visitas, Datas das visitas, Valor do Repasse
  - Datas: listar todas as datas do `historico` daquele médico + paciente no mês

**Verificação:** Visual corresponde ao PDF. Valor por paciente = `valorPorVisita × qtdVisitas`.

---

### T17 — Prompt de CRM faltante
**Depende de:** T16
**Arquivo:** `repasse.js`

Antes de renderizar cada Pág. 2, verificar `config.medicos[medico]?.crm`:
- Se ausente: exibir `showPrompt()` pedindo o CRM
- `showPrompt()`: criar função mínima (input text em modal, botão Confirmar)
- Salvar CRM em `repasse_config` via `saveRepasseConfig()`
- Continuar renderização

**Verificação:** Médico sem CRM cadastrado → prompt aparece → CRM salvo → próxima geração não pede mais.

---

### T18 — Botão "Gerar Relatório" e alternância de modos
**Depende de:** T15, T16
**Arquivo:** `repasse.js`

- Botão "Gerar Relatório": `saveRepasseData()` → `calcularRepasse()` → `renderPag1()` + loop `renderPag2()` → `screen.classList.replace('modo-entrada', 'modo-relatorio')`
- Botão "← Editar": `screen.classList.replace('modo-relatorio', 'modo-entrada')`
- Validação antes de gerar: `valor_total_recebido > 0`, pelo menos 1 paciente incluído

**Verificação:** Fluxo completo: preencher dados → Gerar → ver relatório → Editar → voltar para entrada.

---

## FASE 5 — Impressão

### T19 — Botão "Imprimir" e `@media print`
**Depende de:** T18
**Arquivo:** `repasse.js` + `styles.css`

- Botão flutuante "Imprimir" visível apenas no modo relatório: `window.print()`
- Confirmar que `@media print` (criado em T07) funciona: navegação oculta, quebras de página corretas
- Testar Chrome "Salvar como PDF": layout A4, margens corretas

**Verificação:** PDF gerado visualmente corresponde ao documento de referência.

---

## FASE 6 — RBAC

### T20 — Bloquear campos financeiros para `doctor`
**Depende de:** T10
**Arquivo:** `styles.css`

```css
body:not(.role-manager) .financeiro-only input,
body:not(.role-manager) .financeiro-only select {
  pointer-events: none;
  opacity: 0.5;
  cursor: not-allowed;
}
body:not(.role-manager) .manager-only {
  display: none !important;
}
```

**Verificação:** Logar como `doctor` → campos de status/valor visíveis mas não editáveis. Botão de deletar paciente oculto.

---

## Ordem de Execução Recomendada

```
T01 → T02 → T03   (banco, paralelo entre si)
T04 → T05 → T06 → T07   (estrutura base)
T08 → T09 → T10 → T11 → T12   (entrada de dados)
T13   (config modal, pode rodar após T06)
T14 → T15 → T16 → T17 → T18   (cálculo + relatório)
T19   (impressão)
T20   (RBAC, pode rodar após T10)
```

**Total estimado:** 20 tarefas atômicas
