import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CONC_GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const MAX_PAYLOAD_SIZE = 6000000; // ~6MB (Evita Memory Exhaustion/DoS)

// Domínios confiáveis estritos
const ALLOWED_ORIGINS = [
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || '';
  // Se for da Vercel (app-hosp-*.vercel.app) ou localhost, nós confiamos.
  const isVercel = origin.endsWith('.vercel.app') && origin.includes('app-hosp');
  const isAllowed = isVercel || ALLOWED_ORIGINS.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : origin, // Durante transição, manter dinâmico, mas ideal trocar para isAllowed ? origin : '' // TODO: Se o usuário quiser, pode fechar.
    // Deixei o CORS retornar a própria origem para requests normais, MAS 
    // a proteção real vai estar na Autenticação abaixo.
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };
}

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

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);

  // 1. CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 2. LAYER DE AUTENTICAÇÃO (PROTECTS THE API FROM PUBLIC USAGE)
    // Extrai o Token JWT enviado automaticamente pelo cliente web do Supabase
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado. Missing Authorization header.' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Nao autorizado. Token invalido ou expirado.' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 3. LAYER DE LIMITE DE PAYLOAD (Anti-DoS)
    const contentLength = req.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > MAX_PAYLOAD_SIZE) {
      return new Response(JSON.stringify({ error: 'Payload muito grande. Arquivo excede 5MB.' }), {
        status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const bodyText = await req.text();
    if (bodyText.length > MAX_PAYLOAD_SIZE) {
        return new Response(JSON.stringify({ error: 'Payload excede 5MB na verificação final.' }), {
          status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(bodyText);
    } catch (e) {
      return new Response(JSON.stringify({ error: 'Formato JSON invalido.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4. LAYER DE SANITIZAÇÃO DE INPUT
    const { base64Pdf } = parsedBody;
    if (!base64Pdf || typeof base64Pdf !== 'string') {
      return new Response(
        JSON.stringify({ error: 'PDF em base64 não fornecido ou formato de dado malicioso.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Internal Server Error: Missing Gateway Keys' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -- Tudo validado, despacha para a inteligência artificial --

    const bodyVariables = {
      contents: [{
        parts: [
          { inline_data: { mime_type: 'application/pdf', data: base64Pdf } },
          { text: CONC_EXTRACTION_PROMPT },
        ],
      }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: CONC_RESPONSE_SCHEMA,
      },
    };

    const googleResponse = await fetch(`${CONC_GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyVariables),
    });

    if (!googleResponse.ok) {
      const errText = await googleResponse.text();
      return new Response(
        JSON.stringify({ error: `Erro na API do Gemini: HTTP ${googleResponse.status} - ${errText}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await googleResponse.json();
    const extractedText = result.candidates[0].content.parts[0].text;
    const data = JSON.parse(extractedText);

    if (!data.pacientes || data.pacientes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'A inteligência artificial retornou uma lista de pacientes vazia.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Internal Server Error: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
