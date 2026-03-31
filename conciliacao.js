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
