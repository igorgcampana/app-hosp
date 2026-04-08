# Design: Calculadora de Repasse de Visitas

**Date:** 2026-03-30
**Status:** Draft
**Refs:** spec.md

---

## 1. Decisões Arquiteturais

### 1.1 Novo arquivo `repasse.js` (não embutir em `script.js`)

`script.js` já tem 1520 linhas. A lógica de repasse é independente do resto da aplicação — estados próprios, tabelas próprias, tela própria. Embutir aumentaria o arquivo para ~2200 linhas e tornaria manutenção muito difícil.

**Decisão:** criar `repasse.js` como arquivo separado, carregado apenas em `index.html` após `script.js`. As funções de utilitários compartilhados (`showToast`, `showConfirm`, `supabaseClient`, `userRole`) continuam globais em `script.js` e ficam disponíveis para `repasse.js` sem nenhuma alteração.

### 1.2 Nova tela no SPA existente (não página separada)

Seguir o padrão `screen-based SPA navigation` já estabelecido. Adicionar `#screen-repasse` como quarta screen no `index.html`, com botão de navegação no bottom tab bar.

**Decisão:** quarta aba no bottom nav, `data-target="screen-repasse"`. Ícone: calculadora ou cifrão.

### 1.3 Estado da tela de repasse

A tela tem dois modos distintos que precisam de controle de estado:

```
MODO ENTRADA (padrão)
  ├── Seletor de mês/ano
  ├── Configurações (percentuais, descontos, CRMs)
  ├── Valor Total Recebido
  └── Tabela de pacientes editável

MODO RELATÓRIO (após "Gerar Relatório")
  ├── Pág. 1 — Fatura Detalhada
  └── Pág. 2..N — Repasse por Médico
  └── Botão "Imprimir" + Botão "← Editar"
```

Controle por classe CSS no container: `.repasse-mode-entrada` / `.repasse-mode-relatorio`.

### 1.4 Persistência de configurações — tabela única `repasse_config`

Uma única linha na tabela (id = 1). Evita over-engineering com múltiplas tabelas de configuração. Os campos `descontos_sala` e `medicos` usam JSONB para flexibilidade sem migrations ao adicionar médicos.

---

## 2. Schema do Banco de Dados

### Tabela `repasse_config` (1 linha global)

```sql
CREATE TABLE repasse_config (
  id            int8 PRIMARY KEY DEFAULT 1,
  pct_impostos  numeric(5,2) NOT NULL DEFAULT 16.33,
  pct_adm       numeric(5,2) NOT NULL DEFAULT 10.00,
  pct_samira    numeric(5,2) NOT NULL DEFAULT 30.00,
  descontos_sala jsonb NOT NULL DEFAULT '{}',
  -- ex: {"Igor": 2700, "Beatriz": 0}
  medicos       jsonb NOT NULL DEFAULT '{}',
  -- ex: {"Igor": {"nome_completo": "Dr. Igor Gusmão Campana", "crm": "186186"}}
  updated_at    timestamptz DEFAULT now()
);

-- Garante que só existe 1 linha
ALTER TABLE repasse_config ADD CONSTRAINT single_row CHECK (id = 1);
```

**RLS:**
- SELECT: autenticado (todos)
- UPDATE: apenas `manager`
- INSERT/DELETE: bloqueado (linha única gerenciada via upsert)

### Tabela `repasse_fatura` (1 por mês processado)

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
```

**RLS:**
- SELECT: autenticado (todos)
- INSERT/UPDATE: apenas `manager`
- DELETE: bloqueado

### Tabela `repasse_paciente` (N por fatura)

```sql
CREATE TABLE repasse_paciente (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fatura_id         uuid NOT NULL REFERENCES repasse_fatura(id) ON DELETE CASCADE,
  patient_id        uuid REFERENCES patients(id),
  -- patient_id NULL permite adicionar pacientes externos não cadastrados
  nome_override     text,
  -- usado quando patient_id é NULL (paciente manual) ou para override de nome
  periodo_inicio    date NOT NULL,
  periodo_fim       date,
  -- NULL = ainda internado
  hospital          text,
  status_pagamento  text CHECK (status_pagamento IN ('SIM','NÃO','PARCIAL','RETAGUARDA')),
  valor_recebido    numeric(12,2),
  incluido          boolean NOT NULL DEFAULT true,
  updated_at        timestamptz DEFAULT now()
);
```

**RLS:**
- SELECT: autenticado (todos)
- INSERT/UPDATE: apenas `manager`
- DELETE: apenas `manager`

---

## 3. Estrutura da Tela (`index.html`)

```
#screen-repasse
├── .repasse-header
│   ├── Seletor de mês/ano (#repasse-mes, #repasse-ano)
│   ├── Botão "Configurações" (abre modal)
│   └── Botão "Gerar Relatório" / "← Editar"
│
├── .repasse-entrada (visível no modo ENTRADA)
│   ├── .repasse-valor-total
│   │   └── Input: Valor Total Recebido
│   │
│   └── .repasse-pacientes-table
│       ├── [linha por paciente pré-populado]
│       │   ├── Nome (readonly, do banco)
│       │   ├── Período início (editável)
│       │   ├── Período fim (editável)
│       │   ├── Hospital (readonly)
│       │   ├── Status (select: SIM/NÃO/PARCIAL/RETAGUARDA)
│       │   ├── Valor (input numérico)
│       │   └── Toggle incluído/excluído
│       └── Botão "+ Adicionar paciente"
│
├── .repasse-relatorio (visível no modo RELATÓRIO)
│   ├── .repasse-pag1 (Fatura Detalhada)
│   │   ├── Cabeçalho (período, emissão)
│   │   ├── Memória de cálculo
│   │   └── Tabela de pacientes incluídos (SIM/PARCIAL/RETAGUARDA)
│   │
│   └── .repasse-pag2[data-medico] (1 por médico com visitas no mês)
│       ├── Cabeçalho do médico (nome completo + CRM)
│       ├── Totais (visitas equipe, visitas médico, valor bruto, desconto, líquido)
│       ├── Memória de cálculo
│       └── Tabela de pacientes visitados pelo médico
│
└── Botão flutuante "Imprimir"

#repasse-config-modal (modal global)
├── Percentuais (impostos, adm, Samira)
├── Descontos de sala por médico
└── Nomes completos e CRMs por médico
```

---

## 4. Fluxo de Dados

### Ao abrir a tela de repasse

```
renderRepasseScreen()
  → carrega repasse_config (percentuais, descontos, médicos)
  → verifica se existe repasse_fatura para o mês selecionado
      SIM → carrega repasse_paciente do fatura_id → popula tabela
      NÃO → busca patients ativos no mês → pré-popula tabela (sem persistir ainda)
```

### Ao salvar alterações (auto-save ou botão)

```
saveRepasseData()
  → upsert repasse_fatura (mes, ano, valor_total)
  → upsert/delete repasse_paciente (linhas da tabela)
```

### Ao gerar relatório

```
generateRepasse()
  → saveRepasseData() (garante persistência)
  → calcularRepasse() → objeto com todos os valores intermediários
  → renderPag1(dados)
  → para cada médico com visitas no mês:
      → busca historico filtrado: medico + mes/ano
      → renderPag2(medico, dados, historico)
  → alternar para modo RELATÓRIO
```

### Cálculo central (`calcularRepasse`)

```javascript
function calcularRepasse(config, fatura, pacientes) {
  const total = fatura.valor_total_recebido;
  const impostos = total * config.pct_impostos / 100;
  const adm = total * config.pct_adm / 100;
  const restante = total - impostos - adm;
  const samira = restante * config.pct_samira / 100;
  const divisaoEquipe = total - impostos - adm - samira;

  // visitas do historico já filtradas pelo mês
  const totalVisitasEquipe = historicoMes.reduce((s, h) => s + h.visitas, 0);
  const valorPorVisita = divisaoEquipe / totalVisitasEquipe;

  const repassePorMedico = DOCTORS.reduce((acc, medico) => {
    const visitasMedico = historicoMes
      .filter(h => h.medico === medico)
      .reduce((s, h) => s + h.visitas, 0);
    const valorBruto = valorPorVisita * visitasMedico;
    const desconto = config.descontos_sala[medico] || 0;
    acc[medico] = { visitasMedico, valorBruto, desconto, valorLiquido: valorBruto - desconto };
    return acc;
  }, {});

  return { total, impostos, adm, restante, samira, divisaoEquipe,
           totalVisitasEquipe, valorPorVisita, repassePorMedico };
}
```

---

## 5. CSS e Impressão

### Estrutura de classes

```css
/* Alternância de modos */
#screen-repasse.modo-entrada  .repasse-relatorio { display: none; }
#screen-repasse.modo-relatorio .repasse-entrada  { display: none; }
#screen-repasse.modo-relatorio .repasse-header   { display: none; }

/* Página de relatório */
.repasse-pag1,
.repasse-pag2 {
  background: white;
  padding: 32px;
  /* espaçamento para separar visualmente as páginas na tela */
  margin-bottom: 24px;
  border: 1px solid var(--color-secondary);
}
```

### Print

```css
@media print {
  /* Ocultar tudo exceto o relatório */
  body > *:not(#screen-repasse) { display: none !important; }
  .bottom-nav, .repasse-header, .btn-print, .btn-edit { display: none !important; }

  /* Quebra de página entre Pág. 1 e cada Pág. 2 */
  .repasse-pag1,
  .repasse-pag2 {
    page-break-after: always;
    border: none;
    margin: 0;
    padding: 20mm;
  }
}
```

---

## 6. RBAC na Nova Tela

| Elemento | `doctor` | `manager` |
|----------|----------|-----------|
| Ver relatório gerado | ✅ | ✅ |
| Editar valor total recebido | ❌ | ✅ |
| Editar status de pagamento e valor por paciente | ❌ | ✅ |
| Incluir/excluir pacientes da lista | ❌ | ✅ |
| Editar período de internação na linha | ❌ | ✅ |
| Abrir modal de configurações (percentuais, sala, CRM) | ✅ | ✅ |
| Gerar relatório (botão) | ✅ | ✅ |
| Imprimir | ✅ | ✅ |

**Implementação:**
- Dados financeiros: `body:not(.role-manager) .financeiro-only { pointer-events: none; opacity: 0.5 }` — campos de status/valor ficam visíveis mas bloqueados para `doctor`.
- Configurações: abertas para todos os autenticados. RLS da tabela `repasse_config` permite UPDATE para qualquer usuário autenticado.
- RLS de `repasse_fatura` e `repasse_paciente` permitem INSERT/UPDATE apenas para `manager`.

---

## 7. Prompt de CRM Faltante

Na primeira vez que `generateRepasse()` detectar um médico com visitas mas sem CRM em `repasse_config.medicos`:

```
→ showConfirm() adaptado como prompt de input
→ "Para gerar o relatório do Dr. X, informe o CRM:"
→ salva em repasse_config.medicos via UPDATE
→ continua geração
```

Usar o `showConfirm()` existente ou criar um `showPrompt()` mínimo se o confirm não suportar input.

---

## 8. Arquivos a Criar/Modificar

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `repasse.js` | Criar | Toda a lógica de repasse (~400 linhas estimadas) |
| `index.html` | Modificar | +1 aba no bottom nav, +1 screen, +1 modal de config |
| `styles.css` | Modificar | Estilos da tela de repasse + @media print |
| `script.js` | Modificar mínimo | Expor `userRole` globalmente se ainda não exposto |
| Supabase | Migrations | 3 novas tabelas + RLS policies |
