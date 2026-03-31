# Conciliacao de Faturamento (Frontend) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nova aba "Conciliacao" no AppHosp que cruza PDF de faturamento hospitalar com o Supabase, exibindo divergencias numa tabela colorida com opcao de exportar Excel — tudo rodando no browser.

**Architecture:** Upload de PDF → conversao base64 → Gemini REST API (extracao estruturada) → consulta Supabase (pacientes HSL no periodo) → fuzzy match com fuzzball → render tabela + cards resumo → export Excel via SheetJS. Chave Gemini armazenada em localStorage.

**Tech Stack:** Vanilla JS, Supabase JS (ja carregado), Gemini REST API (fetch), fuzzball (CDN), SheetJS/xlsx (CDN)

**Spec:** `.specs/features/conciliacao-faturamento/spec-frontend.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `index.html` | CDN scripts (fuzzball, xlsx), 5o botao nav, section `screen-conciliacao` com HTML do upload |
| `styles.css` | Estilos da aba: upload area, loading, summary cards, tabela colorida, responsivo |
| `conciliacao.js` | Modulo completo: helpers, gemini, supabase, matcher, render, excel, orchestrator |
| `script.js` | Adicionar chamada `initConciliacao()` apos auth + regra RBAC para manager |

---

### Task 1: HTML Scaffolding

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add CDN scripts in `<head>`**

Add after the jsPDF script tag (line 33):

```html
  <!-- Fuzzy matching -->
  <script src="https://cdn.jsdelivr.net/npm/fuzzball@2.1.3/dist/fuzzball.umd.min.js"></script>
  <!-- Excel export -->
  <script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>
```

- [ ] **Step 2: Add nav button**

Add after the Repasse `</li>` (line 111), before `</ul>` (line 112):

```html
      <!-- Tab: Conciliacao -->
      <li>
        <button class="nav-btn" data-target="screen-conciliacao">
          <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="9" y1="15" x2="15" y2="15"/>
            <line x1="12" y1="12" x2="12" y2="18"/>
          </svg>
          <span class="tab-label">Conciliacao</span>
        </button>
      </li>
```

- [ ] **Step 3: Add screen section**

Add before `</main>` (line 507):

```html
    <!-- TELA 5 — Conciliacao de Faturamento -->
    <section id="screen-conciliacao" class="screen">
      <header class="screen-header">
        <h2 class="title">Conciliacao de Faturamento</h2>
      </header>

      <div id="conciliacao-content">
        <!-- Estado: Upload -->
        <div id="conciliacao-upload" class="card conciliacao-upload-card">
          <div class="conciliacao-upload-area">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="12" y1="18" x2="12" y2="12"/>
              <polyline points="9 15 12 12 15 15"/>
            </svg>
            <p class="conciliacao-upload-text">Selecione o PDF do Analitico de Repasse</p>
            <input type="file" id="conciliacao-pdf-input" accept=".pdf" style="display:none">
            <button id="conciliacao-select-btn" class="btn-secondary" onclick="document.getElementById('conciliacao-pdf-input').click()">
              Escolher arquivo
            </button>
            <span id="conciliacao-file-name" class="conciliacao-file-name"></span>
          </div>

          <div class="form-group" style="margin-top: 1rem;">
            <label for="conciliacao-gemini-key">Chave Gemini API</label>
            <input type="password" id="conciliacao-gemini-key" placeholder="Cole sua chave aqui"
              style="font-family: var(--font-body); font-size: 0.85rem;">
          </div>

          <button id="conciliacao-processar-btn" class="btn-primary" style="width: 100%; margin-top: 1rem;" disabled>
            Processar
          </button>
        </div>

        <!-- Estado: Loading -->
        <div id="conciliacao-loading" class="card conciliacao-loading-card" style="display:none;">
          <div class="conciliacao-spinner"></div>
          <p id="conciliacao-loading-msg" class="conciliacao-loading-text">Extraindo dados do PDF via Gemini...</p>
        </div>

        <!-- Estado: Resultados -->
        <div id="conciliacao-results" style="display:none;">
          <div id="conciliacao-summary-cards" class="conciliacao-summary"></div>
          <div class="conciliacao-actions">
            <button id="conciliacao-export-btn" class="btn-primary">Exportar Excel</button>
            <button id="conciliacao-nova-btn" class="btn-secondary">Nova Conciliacao</button>
          </div>
          <div class="card" style="overflow-x: auto;">
            <table id="conciliacao-table">
              <thead>
                <tr>
                  <th>Nome Faturamento</th>
                  <th>Nome Supabase</th>
                  <th>Score</th>
                  <th>Dias Esperados</th>
                  <th>Dias Pagos</th>
                  <th>Datas Nao Pagas</th>
                  <th>Datas Extras</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody id="conciliacao-table-body"></tbody>
            </table>
          </div>
        </div>

        <!-- Estado: Erro -->
        <div id="conciliacao-error" class="card conciliacao-error-card" style="display:none;">
          <p id="conciliacao-error-msg" style="color: #d9534f; font-weight: 600;"></p>
          <button id="conciliacao-retry-btn" class="btn-secondary" style="margin-top: 1rem;">Tentar novamente</button>
        </div>
      </div>
    </section>
```

- [ ] **Step 4: Add conciliacao.js script tag**

Add after the repasse.js script tag (line 511):

```html
  <script src="conciliacao.js"></script>
```

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(conciliacao): add HTML scaffolding for billing reconciliation tab"
```

---

### Task 2: CSS Styles

**Files:**
- Modify: `styles.css`

- [ ] **Step 1: Add conciliacao styles**

Append to the end of `styles.css`:

```css
/* === CONCILIACAO === */

.conciliacao-upload-card {
  max-width: 480px;
  margin: 0 auto;
}

.conciliacao-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  padding: 2rem;
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-md, 8px);
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s;
}

.conciliacao-upload-area:hover {
  border-color: var(--color-primary);
}

.conciliacao-upload-text {
  color: var(--color-text-secondary);
  font-family: var(--font-body);
  font-size: 0.9rem;
}

.conciliacao-file-name {
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--color-primary);
  font-weight: 600;
  word-break: break-all;
}

/* Loading */
.conciliacao-loading-card {
  max-width: 480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 3rem 2rem;
}

.conciliacao-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.conciliacao-loading-text {
  font-family: var(--font-body);
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

/* Summary Cards */
.conciliacao-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.conciliacao-summary-card {
  background: var(--color-white);
  border-radius: var(--radius-md, 8px);
  padding: 1rem;
  text-align: center;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}

.conciliacao-summary-card .summary-value {
  font-family: var(--font-title);
  font-size: 1.5rem;
  font-weight: 700;
  display: block;
  margin-bottom: 0.25rem;
}

.conciliacao-summary-card .summary-label {
  font-family: var(--font-body);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
}

/* Results Table */
#conciliacao-table {
  width: 100%;
  border-collapse: collapse;
  font-family: var(--font-body);
  font-size: 0.8rem;
}

#conciliacao-table th {
  background: var(--color-primary);
  color: var(--color-white);
  padding: 0.6rem 0.5rem;
  text-align: left;
  font-family: var(--font-title);
  font-weight: 600;
  font-size: 0.8rem;
  white-space: nowrap;
}

#conciliacao-table td {
  padding: 0.5rem;
  border-bottom: 1px solid var(--color-border);
  vertical-align: top;
}

#conciliacao-table tr.status-match { background: #D5F5E3; }
#conciliacao-table tr.status-glosa { background: #FADBD8; }
#conciliacao-table tr.status-pagamento-maior { background: #FEF9E7; }
#conciliacao-table tr.status-nao-encontrado { background: #F6DDCC; }

/* Actions bar */
.conciliacao-actions {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

/* Error */
.conciliacao-error-card {
  max-width: 480px;
  margin: 0 auto;
  text-align: center;
}

/* Responsive */
@media (max-width: 768px) {
  .conciliacao-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  #conciliacao-table {
    font-size: 0.7rem;
  }

  #conciliacao-table th,
  #conciliacao-table td {
    padding: 0.4rem 0.3rem;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add styles.css
git commit -m "feat(conciliacao): add CSS styles for reconciliation tab"
```

---

### Task 3: conciliacao.js — State, Helpers, and Constants

**Files:**
- Create: `conciliacao.js`

- [ ] **Step 1: Create conciliacao.js with state, constants, and helpers**

Write to `conciliacao.js`:

```javascript
// === CONCILIACAO STATE ===
let conciliacaoResultados = null;
let conciliacaoDadosPdf = null;

// === CONSTANTS ===
const CONC_SCORE_THRESHOLD = 80;
const CONC_DATE_FMT_BR = 'DD/MM/YYYY';

const CONC_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CONC_EXTRACTION_PROMPT = `Analyze this hospital billing PDF ("Analitico de Repasse a Terceiros") and extract structured data.

RULES:
1. Extract the coverage period from the header ("Periodo: X ate Y").
2. Iterate ALL execution lines across ALL pages and ALL insurance plan sections.
3. Group by PATIENT NAME — the same patient may appear under different insurance plans in different sections. Merge them.
4. ALL procedure types count as a paid visit: Visita hospitalar, Consulta eletiva, Parecer Medico, Em Pronto Socorro.
5. For each patient, list every individual Dt. Exec. date. Remove duplicates within the same patient.
6. Return patient names in UPPERCASE exactly as they appear in the PDF.
7. Date format must be DD/MM/YYYY.

Return ONLY the JSON. No additional text.`;

const CONC_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    periodo_inicio: { type: 'STRING', description: 'Start date DD/MM/YYYY' },
    periodo_fim: { type: 'STRING', description: 'End date DD/MM/YYYY' },
    pacientes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          nome: { type: 'STRING', description: 'Patient name in UPPERCASE' },
          datas: {
            type: 'ARRAY',
            items: { type: 'STRING' },
            description: 'List of Dt. Exec. dates in DD/MM/YYYY format',
          },
        },
        required: ['nome', 'datas'],
      },
    },
  },
  required: ['periodo_inicio', 'periodo_fim', 'pacientes'],
};

const CONC_STATUS_COLORS = {
  'Match Perfeito': 'status-match',
  'Glosa': 'status-glosa',
  'Glosa + Pagamento a Maior': 'status-glosa',
  'Nao Faturado': 'status-glosa',
  'Pagamento a Maior': 'status-pagamento-maior',
  'Nao Encontrado': 'status-nao-encontrado',
};

// === HELPERS ===

function concNormalize(name) {
  return name
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function concParseDate(dateStr) {
  // Parse DD/MM/YYYY to Date object
  const [d, m, y] = dateStr.split('/').map(Number);
  return new Date(y, m - 1, d);
}

function concFormatDate(date) {
  // Format Date object to DD/MM/YYYY
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return d + '/' + m + '/' + y;
}

function concDateRange(startStr, endStr) {
  // Generate Set of date strings (DD/MM/YYYY) from start to end inclusive
  var start = concParseDate(startStr);
  var end = concParseDate(endStr);
  if (start > end) return new Set();
  var dates = new Set();
  var current = new Date(start);
  while (current <= end) {
    dates.add(concFormatDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function concSortDates(dates) {
  // Sort dates chronologically (accepts Set or Array)
  return Array.from(dates).sort(function(a, b) {
    return concParseDate(a) - concParseDate(b);
  });
}

function concParseSupabaseDate(dateStr) {
  // Convert YYYY-MM-DD to DD/MM/YYYY
  var parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function concReadFileAsBase64(file) {
  return new Promise(function(resolve, reject) {
    var reader = new FileReader();
    reader.onload = function() {
      var base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao.js
git commit -m "feat(conciliacao): add state, constants, and helper functions"
```

---

### Task 4: conciliacao.js — Gemini PDF Extraction

**Files:**
- Modify: `conciliacao.js`

- [ ] **Step 1: Append Gemini extraction function**

Append to `conciliacao.js`:

```javascript
// === GEMINI EXTRACTION ===

async function concExtractFromPdf(file, apiKey) {
  var base64 = await concReadFileAsBase64(file);

  var body = {
    contents: [{
      parts: [
        { inline_data: { mime_type: 'application/pdf', data: base64 } },
        { text: CONC_EXTRACTION_PROMPT },
      ],
    }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: CONC_RESPONSE_SCHEMA,
    },
  };

  var maxRetries = 3;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      var response = await fetch(CONC_GEMINI_URL + '?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        var errText = await response.text();
        throw new Error('HTTP ' + response.status + ': ' + errText);
      }

      var result = await response.json();
      var text = result.candidates[0].content.parts[0].text;
      var data = JSON.parse(text);

      if (!data.pacientes || data.pacientes.length === 0) {
        throw new Error('Gemini retornou lista de pacientes vazia.');
      }

      return data;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        var wait = Math.pow(2, attempt + 1) * 1000;
        await new Promise(function(r) { setTimeout(r, wait); });
      } else {
        throw new Error('Falha na extracao apos ' + maxRetries + ' tentativas: ' + e.message);
      }
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao.js
git commit -m "feat(conciliacao): add Gemini PDF extraction via REST API"
```

---

### Task 5: conciliacao.js — Supabase Query + Reconciliation

**Files:**
- Modify: `conciliacao.js`

- [ ] **Step 1: Append Supabase fetch and reconcile functions**

Append to `conciliacao.js`:

```javascript
// === SUPABASE ===

async function concFetchPatients(periodoInicio, periodoFim) {
  // Convert DD/MM/YYYY to YYYY-MM-DD for Supabase query
  var inicio = concParseDate(periodoInicio);
  var fim = concParseDate(periodoFim);
  var inicioIso = inicio.getFullYear() + '-' +
    String(inicio.getMonth() + 1).padStart(2, '0') + '-' +
    String(inicio.getDate()).padStart(2, '0');
  var fimIso = fim.getFullYear() + '-' +
    String(fim.getMonth() + 1).padStart(2, '0') + '-' +
    String(fim.getDate()).padStart(2, '0');

  var response = await supabaseClient
    .from('patients')
    .select('pacientenome, dataprimeiraavaliacao, dataultimavisita')
    .eq('hospital', 'HSL')
    .lte('dataprimeiraavaliacao', fimIso)
    .gte('dataultimavisita', inicioIso);

  if (response.error) throw new Error('Supabase: ' + response.error.message);

  return response.data.map(function(row) {
    return {
      nome: row.pacientenome,
      data_inicio: row.dataprimeiraavaliacao,
      data_fim: row.dataultimavisita,
    };
  });
}

// === MATCHER ===

function concCalcExpectedDates(pacSupa, periodoInicio, periodoFim) {
  var pInicio = concParseDate(periodoInicio);
  var pFim = concParseDate(periodoFim);
  var sInicio = concParseDate(concParseSupabaseDate(pacSupa.data_inicio));
  var sFim = concParseDate(concParseSupabaseDate(pacSupa.data_fim));

  var inicio = pInicio > sInicio ? pInicio : sInicio;
  var fim = pFim < sFim ? pFim : sFim;

  if (inicio > fim) return new Set();
  return concDateRange(concFormatDate(inicio), concFormatDate(fim));
}

function concClassify(datasNaoPagas, datasExtras) {
  var hasMissing = datasNaoPagas.length > 0;
  var hasExtra = datasExtras.length > 0;
  if (hasMissing && hasExtra) return 'Glosa + Pagamento a Maior';
  if (hasMissing) return 'Glosa';
  if (hasExtra) return 'Pagamento a Maior';
  return 'Match Perfeito';
}

function concNotFound(nomePdf, datasPagas) {
  return {
    nome_pdf: nomePdf,
    nome_supabase: null,
    score_match: 0,
    datas_esperadas: [],
    datas_pagas: concSortDates(datasPagas),
    datas_nao_pagas: [],
    datas_extras: [],
    status: 'Nao Encontrado',
  };
}

function concReconcile(dadosPdf, dadosSupabase) {
  var periodoInicio = dadosPdf.periodo_inicio;
  var periodoFim = dadosPdf.periodo_fim;

  // Build lookup structures
  var supaNormalized = {};
  var supaByOriginal = {};
  dadosSupabase.forEach(function(p) {
    var norm = concNormalize(p.nome);
    supaNormalized[norm] = p.nome;
    supaByOriginal[p.nome] = p;
  });

  var supaNormKeys = Object.keys(supaNormalized);
  var matchedSupabase = {};
  var results = [];

  dadosPdf.pacientes.forEach(function(pacPdf) {
    var nomePdf = pacPdf.nome;
    var datasPagas = new Set(pacPdf.datas);

    if (supaNormKeys.length === 0) {
      results.push(concNotFound(nomePdf, datasPagas));
      return;
    }

    // Fuzzy match using fuzzball
    var normalizedPdf = concNormalize(nomePdf);
    var matches = fuzzball.extract(normalizedPdf, supaNormKeys, {
      scorer: fuzzball.ratio,
      limit: 1,
    });

    if (matches.length > 0 && matches[0][1] >= CONC_SCORE_THRESHOLD) {
      var nomeSupaNorm = matches[0][0];
      var score = matches[0][1];
      var nomeSupaOriginal = supaNormalized[nomeSupaNorm];
      var pacSupa = supaByOriginal[nomeSupaOriginal];
      matchedSupabase[nomeSupaOriginal] = true;

      var datasEsperadas = concCalcExpectedDates(pacSupa, periodoInicio, periodoFim);

      // Set difference: esperadas - pagas
      var datasNaoPagas = concSortDates(
        new Set([...datasEsperadas].filter(function(d) { return !datasPagas.has(d); }))
      );
      // Set difference: pagas - esperadas
      var datasExtras = concSortDates(
        new Set([...datasPagas].filter(function(d) { return !datasEsperadas.has(d); }))
      );

      var status = concClassify(datasNaoPagas, datasExtras);

      results.push({
        nome_pdf: nomePdf,
        nome_supabase: nomeSupaOriginal,
        score_match: score,
        datas_esperadas: concSortDates(datasEsperadas),
        datas_pagas: concSortDates(datasPagas),
        datas_nao_pagas: datasNaoPagas,
        datas_extras: datasExtras,
        status: status,
      });
    } else {
      results.push(concNotFound(nomePdf, datasPagas));
    }
  });

  // Reverse path: Supabase patients without PDF match
  dadosSupabase.forEach(function(pacSupa) {
    if (!matchedSupabase[pacSupa.nome]) {
      var datasEsperadas = concCalcExpectedDates(pacSupa, periodoInicio, periodoFim);
      results.push({
        nome_pdf: null,
        nome_supabase: pacSupa.nome,
        score_match: null,
        datas_esperadas: concSortDates(datasEsperadas),
        datas_pagas: [],
        datas_nao_pagas: concSortDates(datasEsperadas),
        datas_extras: [],
        status: 'Nao Faturado',
      });
    }
  });

  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao.js
git commit -m "feat(conciliacao): add Supabase query and reconciliation logic with fuzzy matching"
```

---

### Task 6: conciliacao.js — UI Rendering

**Files:**
- Modify: `conciliacao.js`

- [ ] **Step 1: Append UI rendering functions**

Append to `conciliacao.js`:

```javascript
// === UI RENDERING ===

function concShowState(stateId) {
  ['conciliacao-upload', 'conciliacao-loading', 'conciliacao-results', 'conciliacao-error']
    .forEach(function(id) {
      var el = document.getElementById(id);
      if (el) el.style.display = (id === stateId) ? '' : 'none';
    });
}

function concSetLoading(message) {
  concShowState('conciliacao-loading');
  document.getElementById('conciliacao-loading-msg').textContent = message;
}

function concShowError(message) {
  concShowState('conciliacao-error');
  document.getElementById('conciliacao-error-msg').textContent = message;
}

function concRenderSummary(resultados) {
  var statuses = resultados.map(function(r) { return r.status; });
  var totalGlosaDias = resultados.reduce(function(sum, r) { return sum + r.datas_nao_pagas.length; }, 0);
  var glosaCount = statuses.filter(function(s) {
    return s === 'Glosa' || s === 'Glosa + Pagamento a Maior';
  }).length;

  var cards = [
    { label: 'Pacientes PDF', value: resultados.filter(function(r) { return r.nome_pdf; }).length, color: 'var(--color-primary)' },
    { label: 'Match Perfeito', value: statuses.filter(function(s) { return s === 'Match Perfeito'; }).length, color: '#27ae60' },
    { label: 'Glosas', value: glosaCount + ' (' + totalGlosaDias + ' dias)', color: '#c0392b' },
    { label: 'Nao Faturados', value: statuses.filter(function(s) { return s === 'Nao Faturado'; }).length, color: '#c0392b' },
    { label: 'Nao Encontrados', value: statuses.filter(function(s) { return s === 'Nao Encontrado'; }).length, color: '#e67e22' },
  ];

  var html = '';
  cards.forEach(function(c) {
    html += '<div class="conciliacao-summary-card">' +
      '<span class="summary-value" style="color:' + c.color + '">' + c.value + '</span>' +
      '<span class="summary-label">' + c.label + '</span>' +
      '</div>';
  });
  document.getElementById('conciliacao-summary-cards').innerHTML = html;
}

function concRenderTable(resultados) {
  var tbody = document.getElementById('conciliacao-table-body');
  var html = '';

  resultados.forEach(function(r) {
    var cssClass = CONC_STATUS_COLORS[r.status] || '';
    html += '<tr class="' + cssClass + '">' +
      '<td>' + (r.nome_pdf || '') + '</td>' +
      '<td>' + (r.nome_supabase || '') + '</td>' +
      '<td>' + (r.score_match != null ? r.score_match : '') + '</td>' +
      '<td>' + r.datas_esperadas.length + '</td>' +
      '<td>' + r.datas_pagas.length + '</td>' +
      '<td>' + r.datas_nao_pagas.join(', ') + '</td>' +
      '<td>' + r.datas_extras.join(', ') + '</td>' +
      '<td>' + r.status + '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
}

function concRenderResults(resultados, dadosPdf) {
  concShowState('conciliacao-results');
  concRenderSummary(resultados);
  concRenderTable(resultados);
}
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao.js
git commit -m "feat(conciliacao): add UI rendering (summary cards, status-colored table)"
```

---

### Task 7: conciliacao.js — Excel Export

**Files:**
- Modify: `conciliacao.js`

- [ ] **Step 1: Append Excel export function**

Append to `conciliacao.js`:

```javascript
// === EXCEL EXPORT ===

function concExportToExcel(resultados, periodoInicio) {
  var rows = resultados.map(function(r) {
    return {
      'Nome Faturamento': r.nome_pdf || '',
      'Nome Supabase': r.nome_supabase || '',
      'Score Match': r.score_match != null ? r.score_match : '',
      'Dias Esperados': r.datas_esperadas.length,
      'Dias Pagos': r.datas_pagas.length,
      'Datas Nao Pagas': r.datas_nao_pagas.join(', '),
      'Datas Extras': r.datas_extras.join(', '),
      'Status': r.status,
    };
  });

  // Summary rows
  var statuses = resultados.map(function(r) { return r.status; });
  var totalGlosaDias = resultados.reduce(function(sum, r) { return sum + r.datas_nao_pagas.length; }, 0);
  var glosaCount = statuses.filter(function(s) { return s === 'Glosa' || s === 'Glosa + Pagamento a Maior'; }).length;

  var summaryRows = [
    {},
    { 'Nome Faturamento': 'Total pacientes PDF:', 'Nome Supabase': String(resultados.filter(function(r) { return r.nome_pdf; }).length) },
    { 'Nome Faturamento': 'Total pacientes Supabase:', 'Nome Supabase': String(resultados.filter(function(r) { return r.nome_supabase; }).length) },
    { 'Nome Faturamento': 'Match Perfeito:', 'Nome Supabase': String(statuses.filter(function(s) { return s === 'Match Perfeito'; }).length) },
    { 'Nome Faturamento': 'Glosas:', 'Nome Supabase': glosaCount + ' (' + totalGlosaDias + ' dias nao pagos)' },
    { 'Nome Faturamento': 'Nao Faturados:', 'Nome Supabase': String(statuses.filter(function(s) { return s === 'Nao Faturado'; }).length) },
    { 'Nome Faturamento': 'Nao Encontrados:', 'Nome Supabase': String(statuses.filter(function(s) { return s === 'Nao Encontrado'; }).length) },
  ];

  var allRows = rows.concat(summaryRows);

  var ws = XLSX.utils.json_to_sheet(allRows);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conciliacao');

  // Auto-adjust column widths
  var colWidths = Object.keys(allRows[0] || {}).map(function(key) {
    var maxLen = key.length;
    allRows.forEach(function(row) {
      var val = row[key];
      if (val != null) {
        var len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(maxLen + 4, 50) };
  });
  ws['!cols'] = colWidths;

  // Generate filename from period
  var dateParts = periodoInicio.split('/');
  var filename = 'conciliacao_' + dateParts[2] + '-' + dateParts[1] + '.xlsx';

  XLSX.writeFile(wb, filename);
}
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao.js
git commit -m "feat(conciliacao): add Excel export with SheetJS"
```

---

### Task 8: conciliacao.js — Orchestrator + Init + Integration

**Files:**
- Modify: `conciliacao.js`
- Modify: `script.js`
- Modify: `styles.css`

- [ ] **Step 1: Append orchestrator and init to conciliacao.js**

Append to `conciliacao.js`:

```javascript
// === ORCHESTRATOR ===

async function concProcessar() {
  var fileInput = document.getElementById('conciliacao-pdf-input');
  var file = fileInput.files[0];
  var apiKey = document.getElementById('conciliacao-gemini-key').value.trim();

  if (!file) return;
  if (!apiKey) {
    alert('Insira sua chave Gemini API.');
    return;
  }

  // Save API key for next time
  localStorage.setItem('geminiApiKey', apiKey);

  try {
    // 1. Extract from PDF
    concSetLoading('Extraindo dados do PDF via Gemini...');
    conciliacaoDadosPdf = await concExtractFromPdf(file, apiKey);

    // 2. Query Supabase
    concSetLoading('Consultando pacientes no Supabase...');
    var dadosSupabase = await concFetchPatients(
      conciliacaoDadosPdf.periodo_inicio,
      conciliacaoDadosPdf.periodo_fim
    );

    // 3. Reconcile
    concSetLoading('Cruzando dados...');
    conciliacaoResultados = concReconcile(conciliacaoDadosPdf, dadosSupabase);

    // 4. Render results
    concRenderResults(conciliacaoResultados, conciliacaoDadosPdf);

  } catch (e) {
    console.error('Conciliacao error:', e);
    concShowError(e.message);
  }
}

// === INIT ===

function initConciliacao() {
  // Restore saved API key
  var savedKey = localStorage.getItem('geminiApiKey');
  var keyInput = document.getElementById('conciliacao-gemini-key');
  if (savedKey && keyInput) {
    keyInput.value = savedKey;
  }

  // File input change — show file name + enable button
  var fileInput = document.getElementById('conciliacao-pdf-input');
  var processarBtn = document.getElementById('conciliacao-processar-btn');
  var fileNameSpan = document.getElementById('conciliacao-file-name');

  if (fileInput) {
    fileInput.addEventListener('change', function() {
      if (fileInput.files.length > 0) {
        fileNameSpan.textContent = fileInput.files[0].name;
        processarBtn.disabled = false;
      } else {
        fileNameSpan.textContent = '';
        processarBtn.disabled = true;
      }
    });
  }

  // Make upload area clickable
  var uploadArea = document.querySelector('.conciliacao-upload-area');
  if (uploadArea) {
    uploadArea.addEventListener('click', function(e) {
      if (e.target.tagName !== 'BUTTON') {
        fileInput.click();
      }
    });
  }

  // Processar button
  if (processarBtn) {
    processarBtn.addEventListener('click', concProcessar);
  }

  // Export Excel button
  var exportBtn = document.getElementById('conciliacao-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      if (conciliacaoResultados && conciliacaoDadosPdf) {
        concExportToExcel(conciliacaoResultados, conciliacaoDadosPdf.periodo_inicio);
      }
    });
  }

  // Nova conciliacao button
  var novaBtn = document.getElementById('conciliacao-nova-btn');
  if (novaBtn) {
    novaBtn.addEventListener('click', function() {
      conciliacaoResultados = null;
      conciliacaoDadosPdf = null;
      var fileInput = document.getElementById('conciliacao-pdf-input');
      fileInput.value = '';
      document.getElementById('conciliacao-file-name').textContent = '';
      document.getElementById('conciliacao-processar-btn').disabled = true;
      concShowState('conciliacao-upload');
    });
  }

  // Retry button
  var retryBtn = document.getElementById('conciliacao-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function() {
      concShowState('conciliacao-upload');
    });
  }
}
```

- [ ] **Step 2: Add initConciliacao call in script.js**

In `script.js`, inside the `DOMContentLoaded` callback, after the line that calls `initRepasse()` (or equivalent initialization), add:

```javascript
  if (typeof initConciliacao === 'function') initConciliacao();
```

Find the section that looks like:

```javascript
  document.body.style.visibility = 'visible';
  applyRolePermissions(userRole);
```

Add `initConciliacao()` right after the existing initializations in that block.

- [ ] **Step 3: Add RBAC rule for manager in styles.css**

Append to the existing `body.role-manager` rules in `styles.css`:

```css
body.role-manager #conciliacao-processar-btn,
body.role-manager #conciliacao-export-btn {
  display: none !important;
}
```

- [ ] **Step 4: Commit**

```bash
git add conciliacao.js script.js styles.css
git commit -m "feat(conciliacao): add orchestrator, init, event bindings, and RBAC integration"
```

---

### Task 9: Manual Verification

- [ ] **Step 1: Open the app in browser**

Navigate to the AppHosp URL. Verify:
- 5th tab "Conciliacao" appears in the bottom nav
- Clicking it shows the upload screen
- File input accepts only PDFs
- Gemini API key field auto-fills from localStorage (if previously saved)

- [ ] **Step 2: Test with a real PDF**

1. Select the PDF "CLINICA MEDICA APOSTOLOS analitico.pdf"
2. Enter the Gemini API key
3. Click "Processar"
4. Verify loading states transition correctly
5. Verify results table renders with colored rows
6. Verify summary cards show correct counts

- [ ] **Step 3: Test Excel export**

1. Click "Exportar Excel"
2. Verify `.xlsx` file downloads
3. Open and verify formatting (headers, row colors, summary block)

- [ ] **Step 4: Test "Nova Conciliacao" reset**

1. Click "Nova Conciliacao"
2. Verify it returns to upload screen
3. File input is cleared, button disabled

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(conciliacao): complete frontend billing reconciliation tab"
```
