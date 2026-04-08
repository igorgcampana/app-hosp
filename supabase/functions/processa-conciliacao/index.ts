import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

serve(async (req) => {
  // Configuração do CORS para preflight requests automáticas do navegador (OPTIONS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { base64Pdf } = await req.json();

    if (!base64Pdf) {
      return new Response(
        JSON.stringify({ error: 'PDF em base64 não fornecido no corpo da requisição.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'A chave de API GEMINI_API_KEY não está configurada no servidor Supabase.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
    
    // O texto vem no interior do payload do Gemini
    const extractedText = result.candidates[0].content.parts[0].text;
    const data = JSON.parse(extractedText);

    if (!data.pacientes || data.pacientes.length === 0) {
      return new Response(
        JSON.stringify({ error: 'A inteligência artificial retornou uma lista de pacientes vazia.' }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Retorna o objeto higienizado para o frontend
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: `Falha interna na Edge Function: ${error.message}` }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
