// === CONCILIACAO STATE ===
let conciliacaoResultados = null;
let conciliacaoDadosPdf = null;

// === CONSTANTS ===
const CONC_SCORE_THRESHOLD = 80;

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
  let parts = dateStr.split('/').map(Number);
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

function concFormatDate(date) {
  // Format Date object to DD/MM/YYYY
  let d = String(date.getDate()).padStart(2, '0');
  let m = String(date.getMonth() + 1).padStart(2, '0');
  let y = date.getFullYear();
  return d + '/' + m + '/' + y;
}

function concDateRange(startStr, endStr) {
  // Generate Set of date strings (DD/MM/YYYY) from start to end inclusive
  let start = concParseDate(startStr);
  let end = concParseDate(endStr);
  if (start > end) return new Set();
  let dates = new Set();
  let current = new Date(start);
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
  let parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function concReadFileAsBase64(file) {
  return new Promise(function(resolve, reject) {
    let reader = new FileReader();
    reader.onload = function() {
      let base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// === GEMINI EXTRACTION ===

async function concExtractFromPdf(file, apiKey) {
  let base64 = await concReadFileAsBase64(file);

  let body = {
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

  let maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      let response = await fetch(CONC_GEMINI_URL + '?key=' + apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let errText = await response.text();
        throw new Error('HTTP ' + response.status + ': ' + errText);
      }

      let result = await response.json();
      let text = result.candidates[0].content.parts[0].text;
      let data = JSON.parse(text);

      if (!data.pacientes || data.pacientes.length === 0) {
        throw new Error('Gemini retornou lista de pacientes vazia.');
      }

      return data;
    } catch (e) {
      if (attempt < maxRetries - 1) {
        let wait = Math.pow(2, attempt + 1) * 1000;
        await new Promise(function(r) { setTimeout(r, wait); });
      } else {
        throw new Error('Falha na extracao apos ' + maxRetries + ' tentativas: ' + e.message);
      }
    }
  }
}

// === SUPABASE ===

async function concFetchPatients(periodoInicio, periodoFim) {
  // Convert DD/MM/YYYY to YYYY-MM-DD for Supabase query
  let inicio = concParseDate(periodoInicio);
  let fim = concParseDate(periodoFim);
  let inicioIso = inicio.getFullYear() + '-' +
    String(inicio.getMonth() + 1).padStart(2, '0') + '-' +
    String(inicio.getDate()).padStart(2, '0');
  let fimIso = fim.getFullYear() + '-' +
    String(fim.getMonth() + 1).padStart(2, '0') + '-' +
    String(fim.getDate()).padStart(2, '0');

  let response = await supabaseClient
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
  let pInicio = concParseDate(periodoInicio);
  let pFim = concParseDate(periodoFim);
  let sInicio = concParseDate(concParseSupabaseDate(pacSupa.data_inicio));
  let sFim = concParseDate(concParseSupabaseDate(pacSupa.data_fim));

  let inicio = pInicio > sInicio ? pInicio : sInicio;
  let fim = pFim < sFim ? pFim : sFim;

  if (inicio > fim) return new Set();
  return concDateRange(concFormatDate(inicio), concFormatDate(fim));
}

function concClassify(datasNaoPagas, datasExtras) {
  let hasMissing = datasNaoPagas.length > 0;
  let hasExtra = datasExtras.length > 0;
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
  let periodoInicio = dadosPdf.periodo_inicio;
  let periodoFim = dadosPdf.periodo_fim;

  // Build lookup structures
  let supaNormalized = {};
  let supaByOriginal = {};
  dadosSupabase.forEach(function(p) {
    let norm = concNormalize(p.nome);
    supaNormalized[norm] = p.nome;
    supaByOriginal[p.nome] = p;
  });

  let supaNormKeys = Object.keys(supaNormalized);
  let matchedSupabase = {};
  let results = [];

  dadosPdf.pacientes.forEach(function(pacPdf) {
    let nomePdf = pacPdf.nome;
    let datasPagas = new Set(pacPdf.datas);

    if (supaNormKeys.length === 0) {
      results.push(concNotFound(nomePdf, datasPagas));
      return;
    }

    // Fuzzy match using fuzzball
    let normalizedPdf = concNormalize(nomePdf);
    let matches = fuzzball.extract(normalizedPdf, supaNormKeys, {
      scorer: fuzzball.ratio,
      limit: 1,
    });

    if (matches.length > 0 && matches[0][1] >= CONC_SCORE_THRESHOLD) {
      let nomeSupaNorm = matches[0][0];
      let score = matches[0][1];
      let nomeSupaOriginal = supaNormalized[nomeSupaNorm];
      let pacSupa = supaByOriginal[nomeSupaOriginal];
      matchedSupabase[nomeSupaOriginal] = true;

      let datasEsperadas = concCalcExpectedDates(pacSupa, periodoInicio, periodoFim);

      // Set difference: esperadas - pagas
      let datasNaoPagas = concSortDates(
        new Set([...datasEsperadas].filter(function(d) { return !datasPagas.has(d); }))
      );
      // Set difference: pagas - esperadas
      let datasExtras = concSortDates(
        new Set([...datasPagas].filter(function(d) { return !datasEsperadas.has(d); }))
      );

      let status = concClassify(datasNaoPagas, datasExtras);

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
      let datasEsperadas = concCalcExpectedDates(pacSupa, periodoInicio, periodoFim);
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

// === UI RENDERING ===

function concShowState(stateId) {
  ['conciliacao-upload', 'conciliacao-loading', 'conciliacao-results', 'conciliacao-error']
    .forEach(function(id) {
      let el = document.getElementById(id);
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
  let statuses = resultados.map(function(r) { return r.status; });
  let totalGlosaDias = resultados.reduce(function(sum, r) { return sum + r.datas_nao_pagas.length; }, 0);
  let glosaCount = statuses.filter(function(s) {
    return s === 'Glosa' || s === 'Glosa + Pagamento a Maior';
  }).length;

  let cards = [
    { label: 'Pacientes PDF', value: resultados.filter(function(r) { return r.nome_pdf; }).length, color: 'let(--color-primary)' },
    { label: 'Match Perfeito', value: statuses.filter(function(s) { return s === 'Match Perfeito'; }).length, color: '#27ae60' },
    { label: 'Glosas', value: glosaCount + ' (' + totalGlosaDias + ' dias)', color: '#c0392b' },
    { label: 'Nao Faturados', value: statuses.filter(function(s) { return s === 'Nao Faturado'; }).length, color: '#c0392b' },
    { label: 'Nao Encontrados', value: statuses.filter(function(s) { return s === 'Nao Encontrado'; }).length, color: '#e67e22' },
  ];

  let html = '';
  cards.forEach(function(c) {
    html += '<div class="conciliacao-summary-card">' +
      '<span class="summary-value" style="color:' + c.color + '">' + c.value + '</span>' +
      '<span class="summary-label">' + c.label + '</span>' +
      '</div>';
  });
  document.getElementById('conciliacao-summary-cards').innerHTML = html;
}

function concRenderTable(resultados) {
  let tbody = document.getElementById('conciliacao-table-body');
  let html = '';

  resultados.forEach(function(r) {
    let cssClass = CONC_STATUS_COLORS[r.status] || '';
    html += '<tr class="' + cssClass + '">' +
      '<td>' + esc(r.nome_pdf || '') + '</td>' +
      '<td>' + esc(r.nome_supabase || '') + '</td>' +
      '<td>' + (r.score_match != null ? r.score_match : '') + '</td>' +
      '<td>' + r.datas_esperadas.length + '</td>' +
      '<td>' + r.datas_pagas.length + '</td>' +
      '<td>' + r.datas_nao_pagas.join(', ') + '</td>' +
      '<td>' + r.datas_extras.join(', ') + '</td>' +
      '<td>' + esc(r.status) + '</td>' +
      '</tr>';
  });

  tbody.innerHTML = html;
}

function concRenderResults(resultados, dadosPdf) {
  concShowState('conciliacao-results');
  concRenderSummary(resultados);
  concRenderTable(resultados);
}

// === EXCEL EXPORT ===

function concExportToExcel(resultados, periodoInicio) {
  let rows = resultados.map(function(r) {
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
  let statuses = resultados.map(function(r) { return r.status; });
  let totalGlosaDias = resultados.reduce(function(sum, r) { return sum + r.datas_nao_pagas.length; }, 0);
  let glosaCount = statuses.filter(function(s) { return s === 'Glosa' || s === 'Glosa + Pagamento a Maior'; }).length;

  let summaryRows = [
    {},
    { 'Nome Faturamento': 'Total pacientes PDF:', 'Nome Supabase': String(resultados.filter(function(r) { return r.nome_pdf; }).length) },
    { 'Nome Faturamento': 'Total pacientes Supabase:', 'Nome Supabase': String(resultados.filter(function(r) { return r.nome_supabase; }).length) },
    { 'Nome Faturamento': 'Match Perfeito:', 'Nome Supabase': String(statuses.filter(function(s) { return s === 'Match Perfeito'; }).length) },
    { 'Nome Faturamento': 'Glosas:', 'Nome Supabase': glosaCount + ' (' + totalGlosaDias + ' dias nao pagos)' },
    { 'Nome Faturamento': 'Nao Faturados:', 'Nome Supabase': String(statuses.filter(function(s) { return s === 'Nao Faturado'; }).length) },
    { 'Nome Faturamento': 'Nao Encontrados:', 'Nome Supabase': String(statuses.filter(function(s) { return s === 'Nao Encontrado'; }).length) },
  ];

  let allRows = rows.concat(summaryRows);

  let ws = XLSX.utils.json_to_sheet(allRows);
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Conciliacao');

  // Auto-adjust column widths
  let colWidths = Object.keys(allRows[0] || {}).map(function(key) {
    let maxLen = key.length;
    allRows.forEach(function(row) {
      let val = row[key];
      if (val != null) {
        let len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    return { wch: Math.min(maxLen + 4, 50) };
  });
  ws['!cols'] = colWidths;

  // Generate filename from period
  let dateParts = periodoInicio.split('/');
  let filename = 'conciliacao_' + dateParts[2] + '-' + dateParts[1] + '.xlsx';

  XLSX.writeFile(wb, filename);
}

// === ORCHESTRATOR ===

async function concProcessar() {
  let fileInput = document.getElementById('conciliacao-pdf-input');
  let file = fileInput.files[0];
  let apiKey = document.getElementById('conciliacao-gemini-key').value.trim();

  if (!file) return;
  if (!apiKey) {
    alert('Insira sua chave Gemini API.');
    return;
  }

  // Save API key for the current session only
  sessionStorage.setItem('geminiApiKey', apiKey);

  try {
    // 1. Extract from PDF
    concSetLoading('Extraindo dados do PDF via Gemini...');
    conciliacaoDadosPdf = await concExtractFromPdf(file, apiKey);

    // 2. Query Supabase
    concSetLoading('Consultando pacientes no Supabase...');
    let dadosSupabase = await concFetchPatients(
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
  // Restore saved API key from session instead of local storage
  let savedKey = sessionStorage.getItem('geminiApiKey');
  let keyInput = document.getElementById('conciliacao-gemini-key');
  if (savedKey && keyInput) {
    keyInput.value = savedKey;
  }

  // File input change — show file name + enable button
  let fileInput = document.getElementById('conciliacao-pdf-input');
  let processarBtn = document.getElementById('conciliacao-processar-btn');
  let fileNameSpan = document.getElementById('conciliacao-file-name');

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
  let uploadArea = document.querySelector('.conciliacao-upload-area');
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
  let exportBtn = document.getElementById('conciliacao-export-btn');
  if (exportBtn) {
    exportBtn.addEventListener('click', function() {
      if (conciliacaoResultados && conciliacaoDadosPdf) {
        concExportToExcel(conciliacaoResultados, conciliacaoDadosPdf.periodo_inicio);
      }
    });
  }

  // Nova conciliacao button
  let novaBtn = document.getElementById('conciliacao-nova-btn');
  if (novaBtn) {
    novaBtn.addEventListener('click', function() {
      conciliacaoResultados = null;
      conciliacaoDadosPdf = null;
      let fi = document.getElementById('conciliacao-pdf-input');
      fi.value = '';
      document.getElementById('conciliacao-file-name').textContent = '';
      document.getElementById('conciliacao-processar-btn').disabled = true;
      concShowState('conciliacao-upload');
    });
  }

  // Retry button
  let retryBtn = document.getElementById('conciliacao-retry-btn');
  if (retryBtn) {
    retryBtn.addEventListener('click', function() {
      concShowState('conciliacao-upload');
    });
  }
}
