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
  var parts = dateStr.split('/').map(Number);
  return new Date(parts[2], parts[1] - 1, parts[0]);
}

function concFormatDate(date) {
  // Format Date object to DD/MM/YYYY
  var d = String(date.getDate()).padStart(2, '0');
  var m = String(date.getMonth() + 1).padStart(2, '0');
  var y = date.getFullYear();
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
