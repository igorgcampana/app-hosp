import json
import time

from google import genai
from google.genai import types

EXTRACTION_PROMPT = """Analyze this hospital billing PDF ("Analitico de Repasse a Terceiros") and extract structured data.

RULES:
1. Extract the coverage period from the header ("Periodo: X ate Y").
2. Iterate ALL execution lines across ALL pages and ALL insurance plan sections.
3. Group by PATIENT NAME — the same patient may appear under different insurance plans in different sections. Merge them.
4. ALL procedure types count as a paid visit: Visita hospitalar, Consulta eletiva, Parecer Medico, Em Pronto Socorro.
5. For each patient, list every individual Dt. Exec. date. Remove duplicates within the same patient.
6. Return patient names in UPPERCASE exactly as they appear in the PDF.
7. Date format must be DD/MM/YYYY.

Return ONLY the JSON. No additional text."""

RESPONSE_SCHEMA = {
    "type": "object",
    "properties": {
        "periodo_inicio": {"type": "string", "description": "Start date DD/MM/YYYY"},
        "periodo_fim": {"type": "string", "description": "End date DD/MM/YYYY"},
        "pacientes": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "nome": {"type": "string", "description": "Patient name in UPPERCASE"},
                    "datas": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "List of Dt. Exec. dates in DD/MM/YYYY format",
                    },
                },
                "required": ["nome", "datas"],
            },
        },
    },
    "required": ["periodo_inicio", "periodo_fim", "pacientes"],
}


def extract(pdf_path: str) -> dict:
    """Upload PDF to Gemini and extract structured billing data."""
    client = genai.Client()

    print(f"  Enviando PDF para Gemini...")
    uploaded_file = client.files.upload(file=pdf_path)

    max_retries = 3
    for attempt in range(max_retries):
        try:
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=[uploaded_file, EXTRACTION_PROMPT],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_json_schema=RESPONSE_SCHEMA,
                ),
            )

            data = json.loads(response.text)

            if not data.get("pacientes"):
                raise ValueError(
                    "Gemini retornou lista de pacientes vazia. Verifique se o PDF esta correto."
                )

            return data

        except Exception as e:
            if attempt < max_retries - 1:
                wait = 2 ** (attempt + 1)
                print(f"  Tentativa {attempt + 1} falhou: {e}. Retentando em {wait}s...")
                time.sleep(wait)
            else:
                raise RuntimeError(
                    f"Falha na extracao apos {max_retries} tentativas: {e}"
                )
