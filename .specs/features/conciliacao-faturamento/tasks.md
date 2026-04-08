# Conciliacao de Faturamento — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Script Python CLI que cruza PDF de faturamento hospitalar com o Supabase, identificando visitas nao pagas por data.

**Architecture:** Pipeline linear de 4 modulos (extractor → supabase_client → matcher → reporter) orquestrado por um CLI. O matcher e o nucleo de logica pura, testado com TDD. Os demais modulos dependem de APIs externas e sao validados por contrato.

**Tech Stack:** Python 3.11+, google-genai (Gemini 2.5 Flash), supabase-py, thefuzz, pandas, openpyxl, python-dotenv, pytest

**Spec:** `.specs/features/conciliacao-faturamento/spec.md`

---

## File Map

| File | Responsibility |
|------|---------------|
| `conciliacao/main.py` | CLI entry point, orquestra o pipeline |
| `conciliacao/extractor.py` | Envia PDF ao Gemini, retorna JSON estruturado |
| `conciliacao/supabase_client.py` | Consulta pacientes no Supabase por periodo |
| `conciliacao/matcher.py` | Fuzzy match + intersecao de datas + classificacao |
| `conciliacao/reporter.py` | Gera Excel formatado com divergencias |
| `conciliacao/requirements.txt` | Dependencias Python |
| `conciliacao/.env.example` | Template de variaveis de ambiente |
| `conciliacao/tests/test_matcher.py` | Testes unitarios do matcher (TDD) |

---

### Task 1: Project Scaffolding

**Files:**
- Create: `conciliacao/requirements.txt`
- Create: `conciliacao/.env.example`
- Create: `conciliacao/.gitignore`
- Create: `conciliacao/tests/__init__.py`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p conciliacao/tests
```

- [ ] **Step 2: Create requirements.txt**

Write to `conciliacao/requirements.txt`:

```
google-genai
supabase
thefuzz
python-Levenshtein
pandas
openpyxl
python-dotenv
pytest
```

- [ ] **Step 3: Create .env.example**

Write to `conciliacao/.env.example`:

```
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_service_role_key_here
```

- [ ] **Step 4: Create .gitignore**

Write to `conciliacao/.gitignore`:

```
.env
__pycache__/
*.pyc
*.xlsx
.pytest_cache/
```

- [ ] **Step 5: Create tests/__init__.py**

Write empty file to `conciliacao/tests/__init__.py`:

```python
```

- [ ] **Step 6: Install dependencies**

```bash
cd conciliacao && pip install -r requirements.txt
```

- [ ] **Step 7: Commit**

```bash
git add conciliacao/requirements.txt conciliacao/.env.example conciliacao/.gitignore conciliacao/tests/__init__.py
git commit -m "feat(conciliacao): scaffold project structure"
```

---

### Task 2: Matcher — Helpers (TDD)

**Files:**
- Create: `conciliacao/tests/test_matcher.py`
- Create: `conciliacao/matcher.py`

- [ ] **Step 1: Write failing tests for normalize and date helpers**

Write to `conciliacao/tests/test_matcher.py`:

```python
from datetime import datetime
from matcher import normalize, date_range, sort_dates, parse_supabase_date


def test_normalize_removes_accents():
    assert normalize("Jordão Baise") == "JORDAO BAISE"


def test_normalize_uppercase():
    assert normalize("edna mouzinho") == "EDNA MOUZINHO"


def test_normalize_already_clean():
    assert normalize("JORDAO BAISE") == "JORDAO BAISE"


def test_date_range_basic():
    result = date_range("29/12/2025", "01/01/2026")
    assert result == {
        "29/12/2025", "30/12/2025", "31/12/2025", "01/01/2026",
    }


def test_date_range_single_day():
    result = date_range("15/01/2026", "15/01/2026")
    assert result == {"15/01/2026"}


def test_date_range_empty_when_start_after_end():
    result = date_range("20/01/2026", "15/01/2026")
    assert result == set()


def test_sort_dates_chronological():
    dates = {"01/01/2026", "30/12/2025", "31/12/2025"}
    result = sort_dates(dates)
    assert result == ["30/12/2025", "31/12/2025", "01/01/2026"]


def test_parse_supabase_date():
    assert parse_supabase_date("2025-12-29") == "29/12/2025"
    assert parse_supabase_date("2026-01-01") == "01/01/2026"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd conciliacao && python -m pytest tests/test_matcher.py -v
```

Expected: FAIL — `ModuleNotFoundError: No module named 'matcher'`

- [ ] **Step 3: Implement helper functions**

Write to `conciliacao/matcher.py`:

```python
import unicodedata
from datetime import datetime, timedelta

SCORE_THRESHOLD = 80
DATE_FMT = "%d/%m/%Y"
SUPABASE_DATE_FMT = "%Y-%m-%d"


def normalize(name: str) -> str:
    """Remove accents and convert to uppercase."""
    name = name.upper()
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def date_range(start: str, end: str) -> set[str]:
    """Generate set of dates (DD/MM/YYYY) from start to end inclusive."""
    d_start = datetime.strptime(start, DATE_FMT)
    d_end = datetime.strptime(end, DATE_FMT)
    if d_start > d_end:
        return set()
    dates = set()
    current = d_start
    while current <= d_end:
        dates.add(current.strftime(DATE_FMT))
        current += timedelta(days=1)
    return dates


def sort_dates(dates) -> list[str]:
    """Sort dates chronologically (DD/MM/YYYY format)."""
    return sorted(dates, key=lambda d: datetime.strptime(d, DATE_FMT))


def parse_supabase_date(date_str: str) -> str:
    """Convert YYYY-MM-DD to DD/MM/YYYY."""
    return datetime.strptime(date_str, SUPABASE_DATE_FMT).strftime(DATE_FMT)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd conciliacao && python -m pytest tests/test_matcher.py -v
```

Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add conciliacao/matcher.py conciliacao/tests/test_matcher.py
git commit -m "feat(conciliacao): add matcher helpers with TDD (normalize, date_range, sort_dates)"
```

---

### Task 3: Matcher — Reconcile Logic (TDD)

**Files:**
- Modify: `conciliacao/tests/test_matcher.py`
- Modify: `conciliacao/matcher.py`

- [ ] **Step 1: Write failing tests for reconcile**

Append to `conciliacao/tests/test_matcher.py`:

```python
from matcher import reconcile


def _make_pdf(pacientes, inicio="16/01/2026", fim="15/02/2026"):
    return {
        "periodo_inicio": inicio,
        "periodo_fim": fim,
        "pacientes": pacientes,
    }


def _make_supa(nome, inicio, fim):
    return {"nome": nome, "data_inicio": inicio, "data_fim": fim}


def test_reconcile_perfect_match():
    pdf = _make_pdf([
        {"nome": "EDNA MOUZINHO BARRETO", "datas": ["29/01/2026", "30/01/2026"]},
    ])
    supa = [_make_supa("Edna Mouzinho Barreto", "2026-01-29", "2026-01-30")]

    results = reconcile(pdf, supa)

    assert len(results) == 1
    assert results[0]["status"] == "Match Perfeito"
    assert results[0]["datas_nao_pagas"] == []
    assert results[0]["datas_extras"] == []


def test_reconcile_glosa():
    pdf = _make_pdf([
        {"nome": "JORDAO BAISE", "datas": ["16/01/2026", "17/01/2026"]},
    ])
    # Supabase says 4 days, PDF only paid 2
    supa = [_make_supa("Jordão Baise", "2026-01-16", "2026-01-19")]

    results = reconcile(pdf, supa)

    assert results[0]["status"] == "Glosa"
    assert results[0]["datas_nao_pagas"] == ["18/01/2026", "19/01/2026"]


def test_reconcile_pagamento_a_maior():
    pdf = _make_pdf([
        {"nome": "IKO NAGAO", "datas": ["29/01/2026", "30/01/2026", "31/01/2026"]},
    ])
    # Supabase says 2 days, PDF paid 3
    supa = [_make_supa("Iko Nagao", "2026-01-29", "2026-01-30")]

    results = reconcile(pdf, supa)

    assert results[0]["status"] == "Pagamento a Maior"
    assert results[0]["datas_extras"] == ["31/01/2026"]


def test_reconcile_nao_encontrado():
    pdf = _make_pdf([
        {"nome": "PACIENTE DESCONHECIDO", "datas": ["20/01/2026"]},
    ])
    supa = [_make_supa("Outro Nome Completamente", "2026-01-20", "2026-01-20")]

    results = reconcile(pdf, supa)

    found = [r for r in results if r["nome_pdf"] == "PACIENTE DESCONHECIDO"]
    assert found[0]["status"] == "Nao Encontrado"


def test_reconcile_nao_faturado():
    pdf = _make_pdf([])  # No patients in PDF
    supa = [_make_supa("Fulano de Tal", "2026-01-20", "2026-01-22")]

    results = reconcile(pdf, supa)

    assert len(results) == 1
    assert results[0]["status"] == "Nao Faturado"
    assert results[0]["nome_pdf"] is None
    assert results[0]["datas_nao_pagas"] == ["20/01/2026", "21/01/2026", "22/01/2026"]


def test_reconcile_intersection_clamps_to_pdf_period():
    """Patient interned 01/01 to 31/01, but PDF covers 16/01 to 15/02.
    Expected range: 16/01 to 31/01 (intersection)."""
    pdf = _make_pdf([
        {"nome": "VILSON LAPERUTA", "datas": [
            "16/01/2026", "17/01/2026", "18/01/2026", "19/01/2026",
            "20/01/2026", "21/01/2026", "22/01/2026", "23/01/2026",
            "24/01/2026", "25/01/2026", "26/01/2026", "27/01/2026",
            "28/01/2026", "29/01/2026", "30/01/2026", "31/01/2026",
        ]},
    ])
    supa = [_make_supa("Vilson Laperuta", "2026-01-01", "2026-01-31")]

    results = reconcile(pdf, supa)

    assert results[0]["status"] == "Match Perfeito"
    assert len(results[0]["datas_esperadas"]) == 16  # 16/01 to 31/01


def test_reconcile_glosa_plus_extra():
    """Missing some expected dates AND has extra dates outside range."""
    pdf = _make_pdf([
        {"nome": "ELZA HENKE DE SOUSA", "datas": ["16/01/2026", "20/01/2026"]},
    ])
    # Expected: 16, 17, 18 — paid: 16, 20 — missing: 17, 18 — extra: 20
    supa = [_make_supa("Elza Henke de Sousa", "2026-01-16", "2026-01-18")]

    results = reconcile(pdf, supa)

    assert results[0]["status"] == "Glosa + Pagamento a Maior"
    assert results[0]["datas_nao_pagas"] == ["17/01/2026", "18/01/2026"]
    assert results[0]["datas_extras"] == ["20/01/2026"]
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd conciliacao && python -m pytest tests/test_matcher.py -v
```

Expected: FAIL — `ImportError: cannot import name 'reconcile' from 'matcher'`

- [ ] **Step 3: Implement reconcile function**

Append to `conciliacao/matcher.py`:

```python
from thefuzz import process


def reconcile(dados_pdf: dict, dados_supabase: list[dict]) -> list[dict]:
    periodo_inicio = dados_pdf["periodo_inicio"]
    periodo_fim = dados_pdf["periodo_fim"]

    # Build lookup structures for Supabase data
    supa_normalized = {}
    supa_by_original = {}
    for p in dados_supabase:
        norm = normalize(p["nome"])
        supa_normalized[norm] = p["nome"]
        supa_by_original[p["nome"]] = p

    supa_norm_keys = list(supa_normalized.keys())
    matched_supabase = set()
    results = []

    for pac_pdf in dados_pdf["pacientes"]:
        nome_pdf = pac_pdf["nome"]
        datas_pagas = set(pac_pdf["datas"])

        if not supa_norm_keys:
            results.append(_not_found(nome_pdf, datas_pagas))
            continue

        match = process.extractOne(normalize(nome_pdf), supa_norm_keys)

        if match and match[1] >= SCORE_THRESHOLD:
            nome_supa_norm = match[0]
            score = match[1]
            nome_supa_original = supa_normalized[nome_supa_norm]
            pac_supa = supa_by_original[nome_supa_original]
            matched_supabase.add(nome_supa_original)

            datas_esperadas = _calc_expected_dates(
                pac_supa, periodo_inicio, periodo_fim,
            )

            datas_nao_pagas = sort_dates(datas_esperadas - datas_pagas)
            datas_extras = sort_dates(datas_pagas - datas_esperadas)

            status = _classify(datas_nao_pagas, datas_extras)

            results.append({
                "nome_pdf": nome_pdf,
                "nome_supabase": nome_supa_original,
                "score_match": score,
                "datas_esperadas": sort_dates(datas_esperadas),
                "datas_pagas": sort_dates(datas_pagas),
                "datas_nao_pagas": datas_nao_pagas,
                "datas_extras": datas_extras,
                "status": status,
            })
        else:
            results.append(_not_found(nome_pdf, datas_pagas))

    # Reverse path: Supabase patients without PDF match
    for pac_supa in dados_supabase:
        if pac_supa["nome"] not in matched_supabase:
            datas_esperadas = _calc_expected_dates(
                pac_supa, periodo_inicio, periodo_fim,
            )
            results.append({
                "nome_pdf": None,
                "nome_supabase": pac_supa["nome"],
                "score_match": None,
                "datas_esperadas": sort_dates(datas_esperadas),
                "datas_pagas": [],
                "datas_nao_pagas": sort_dates(datas_esperadas),
                "datas_extras": [],
                "status": "Nao Faturado",
            })

    return results


def _calc_expected_dates(
    pac_supa: dict, periodo_inicio: str, periodo_fim: str,
) -> set[str]:
    inicio = max(
        datetime.strptime(periodo_inicio, DATE_FMT),
        datetime.strptime(parse_supabase_date(pac_supa["data_inicio"]), DATE_FMT),
    )
    fim = min(
        datetime.strptime(periodo_fim, DATE_FMT),
        datetime.strptime(parse_supabase_date(pac_supa["data_fim"]), DATE_FMT),
    )
    if inicio > fim:
        return set()
    return date_range(inicio.strftime(DATE_FMT), fim.strftime(DATE_FMT))


def _classify(datas_nao_pagas: list, datas_extras: list) -> str:
    has_missing = len(datas_nao_pagas) > 0
    has_extra = len(datas_extras) > 0
    if has_missing and has_extra:
        return "Glosa + Pagamento a Maior"
    if has_missing:
        return "Glosa"
    if has_extra:
        return "Pagamento a Maior"
    return "Match Perfeito"


def _not_found(nome_pdf: str, datas_pagas: set[str]) -> dict:
    return {
        "nome_pdf": nome_pdf,
        "nome_supabase": None,
        "score_match": 0,
        "datas_esperadas": [],
        "datas_pagas": sort_dates(datas_pagas),
        "datas_nao_pagas": [],
        "datas_extras": [],
        "status": "Nao Encontrado",
    }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd conciliacao && python -m pytest tests/test_matcher.py -v
```

Expected: All 15 tests PASS

- [ ] **Step 5: Commit**

```bash
git add conciliacao/matcher.py conciliacao/tests/test_matcher.py
git commit -m "feat(conciliacao): implement reconcile logic with TDD (fuzzy match, intersection, classification)"
```

---

### Task 4: Extractor Module (Gemini)

**Files:**
- Create: `conciliacao/extractor.py`

- [ ] **Step 1: Implement extractor**

Write to `conciliacao/extractor.py`:

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao/extractor.py
git commit -m "feat(conciliacao): add Gemini PDF extractor with structured output and retry"
```

---

### Task 5: Supabase Client Module

**Files:**
- Create: `conciliacao/supabase_client.py`

- [ ] **Step 1: Implement supabase_client**

Write to `conciliacao/supabase_client.py`:

```python
from datetime import datetime

from supabase import create_client, Client


def fetch_patients(url: str, key: str, periodo_inicio: str, periodo_fim: str) -> list[dict]:
    """Fetch patients from Supabase whose internment intersects the PDF period.

    Args:
        url: Supabase project URL.
        key: Supabase service_role key.
        periodo_inicio: Start date DD/MM/YYYY.
        periodo_fim: End date DD/MM/YYYY.

    Returns:
        List of dicts with nome, data_inicio (YYYY-MM-DD), data_fim (YYYY-MM-DD).
    """
    supabase: Client = create_client(url, key)

    # Convert DD/MM/YYYY to YYYY-MM-DD for Supabase query
    inicio_iso = datetime.strptime(periodo_inicio, "%d/%m/%Y").strftime("%Y-%m-%d")
    fim_iso = datetime.strptime(periodo_fim, "%d/%m/%Y").strftime("%Y-%m-%d")

    response = (
        supabase.table("patients")
        .select("pacientenome, dataprimeiraavaliacao, dataultimavisita")
        .eq("hospital", "HSL")
        .lte("dataprimeiraavaliacao", fim_iso)
        .gte("dataultimavisita", inicio_iso)
        .execute()
    )

    return [
        {
            "nome": row["pacientenome"],
            "data_inicio": row["dataprimeiraavaliacao"],
            "data_fim": row["dataultimavisita"],
        }
        for row in response.data
    ]
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao/supabase_client.py
git commit -m "feat(conciliacao): add Supabase client for patient queries"
```

---

### Task 6: Reporter Module (Excel)

**Files:**
- Create: `conciliacao/reporter.py`

- [ ] **Step 1: Implement reporter**

Write to `conciliacao/reporter.py`:

```python
from datetime import datetime

import pandas as pd
from openpyxl.styles import Alignment, Font, PatternFill


STATUS_FILLS = {
    "Match Perfeito": PatternFill(start_color="D5F5E3", fill_type="solid"),
    "Glosa": PatternFill(start_color="FADBD8", fill_type="solid"),
    "Glosa + Pagamento a Maior": PatternFill(start_color="FADBD8", fill_type="solid"),
    "Nao Faturado": PatternFill(start_color="FADBD8", fill_type="solid"),
    "Pagamento a Maior": PatternFill(start_color="FEF9E7", fill_type="solid"),
    "Nao Encontrado": PatternFill(start_color="F6DDCC", fill_type="solid"),
}

HEADER_FILL = PatternFill(start_color="20515F", end_color="20515F", fill_type="solid")
HEADER_FONT = Font(color="FFFFFF", bold=True)


def to_excel(results: list[dict], periodo_inicio: str, output_dir: str = ".") -> str:
    """Generate formatted Excel report from reconciliation results."""
    dt = datetime.strptime(periodo_inicio, "%d/%m/%Y")
    filename = f"{output_dir}/conciliacao_{dt.strftime('%Y-%m')}.xlsx"

    rows = []
    for r in results:
        rows.append({
            "Nome Faturamento": r["nome_pdf"] or "",
            "Nome Supabase": r["nome_supabase"] or "",
            "Score Match": r["score_match"] if r["score_match"] is not None else "",
            "Dias Esperados": len(r["datas_esperadas"]),
            "Dias Pagos": len(r["datas_pagas"]),
            "Datas Nao Pagas": ", ".join(r["datas_nao_pagas"]),
            "Datas Extras": ", ".join(r["datas_extras"]),
            "Status": r["status"],
        })

    df = pd.DataFrame(rows)

    with pd.ExcelWriter(filename, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Conciliacao", startrow=0)
        ws = writer.sheets["Conciliacao"]

        # Format header row
        for cell in ws[1]:
            cell.fill = HEADER_FILL
            cell.font = HEADER_FONT
            cell.alignment = Alignment(horizontal="center")

        # Format data rows by status
        status_col_idx = 8  # Column H
        for row_idx in range(2, len(rows) + 2):
            status_value = ws.cell(row=row_idx, column=status_col_idx).value
            fill = STATUS_FILLS.get(status_value)
            if fill:
                for col_idx in range(1, 9):
                    ws.cell(row=row_idx, column=col_idx).fill = fill

        # Auto-adjust column widths
        for col in ws.columns:
            max_len = 0
            for cell in col:
                if cell.value:
                    max_len = max(max_len, len(str(cell.value)))
            ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 50)

        # Summary block
        summary_row = len(rows) + 3
        statuses = [r["status"] for r in results]
        total_glosa_dias = sum(len(r["datas_nao_pagas"]) for r in results)
        glosa_count = statuses.count("Glosa") + statuses.count("Glosa + Pagamento a Maior")

        summary = [
            ("Total de pacientes no PDF:", sum(1 for r in results if r["nome_pdf"])),
            ("Total de pacientes no Supabase:", sum(1 for r in results if r["nome_supabase"])),
            ("Match Perfeito:", statuses.count("Match Perfeito")),
            ("Glosas:", f"{glosa_count} ({total_glosa_dias} dias nao pagos)"),
            ("Nao Faturados:", statuses.count("Nao Faturado")),
            ("Nao Encontrados:", statuses.count("Nao Encontrado")),
        ]

        bold = Font(bold=True)
        for i, (label, value) in enumerate(summary):
            ws.cell(row=summary_row + i, column=1, value=label).font = bold
            ws.cell(row=summary_row + i, column=2, value=str(value))

    return filename
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao/reporter.py
git commit -m "feat(conciliacao): add Excel reporter with status-colored rows and summary"
```

---

### Task 7: Main CLI Orchestrator

**Files:**
- Create: `conciliacao/main.py`

- [ ] **Step 1: Implement main.py**

Write to `conciliacao/main.py`:

```python
import os
import sys

from dotenv import load_dotenv

from extractor import extract
from supabase_client import fetch_patients
from matcher import reconcile
from reporter import to_excel


def main():
    load_dotenv()

    if len(sys.argv) < 2:
        print("Uso: python main.py <caminho_para_pdf>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    if not os.path.isfile(pdf_path):
        print(f"Erro: Arquivo nao encontrado: {pdf_path}")
        sys.exit(1)

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_key = os.getenv("SUPABASE_KEY")
    gemini_key = os.getenv("GEMINI_API_KEY")

    if not all([supabase_url, supabase_key, gemini_key]):
        print("Erro: Defina SUPABASE_URL, SUPABASE_KEY e GEMINI_API_KEY no arquivo .env")
        sys.exit(1)

    # Set Gemini API key for the SDK
    os.environ["GOOGLE_API_KEY"] = gemini_key

    # 1. Extract from PDF
    print("Extraindo dados do PDF via Gemini...")
    dados_pdf = extract(pdf_path)
    print(f"  Periodo: {dados_pdf['periodo_inicio']} a {dados_pdf['periodo_fim']}")
    print(f"  Pacientes encontrados: {len(dados_pdf['pacientes'])}")

    # 2. Query Supabase
    print("Consultando Supabase...")
    dados_supabase = fetch_patients(
        supabase_url,
        supabase_key,
        dados_pdf["periodo_inicio"],
        dados_pdf["periodo_fim"],
    )
    print(f"  Pacientes no periodo: {len(dados_supabase)}")

    # 3. Reconcile
    print("Cruzando dados...")
    resultados = reconcile(dados_pdf, dados_supabase)

    # 4. Generate report
    print("Gerando relatorio Excel...")
    arquivo = to_excel(resultados, dados_pdf["periodo_inicio"])

    # Terminal summary
    statuses = [r["status"] for r in resultados]
    total_glosa = sum(len(r["datas_nao_pagas"]) for r in resultados)
    glosa_count = statuses.count("Glosa") + statuses.count("Glosa + Pagamento a Maior")
    pdf_count = sum(1 for r in resultados if r["nome_pdf"])
    supa_count = sum(1 for r in resultados if r["nome_supabase"])

    print(f"\nConciliacao concluida!")
    print(f"Periodo: {dados_pdf['periodo_inicio']} a {dados_pdf['periodo_fim']}")
    print(f"Pacientes PDF: {pdf_count} | Supabase: {supa_count}")
    print(f"Match Perfeito: {statuses.count('Match Perfeito')} | Glosas: {glosa_count} ({total_glosa} dias) | Nao Faturados: {statuses.count('Nao Faturado')}")
    print(f"Relatorio salvo em: {arquivo}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
git add conciliacao/main.py
git commit -m "feat(conciliacao): add CLI orchestrator (main.py)"
```

---

### Task 8: Integration Smoke Test

**Files:**
- Create: `conciliacao/.env` (manual — not committed)

- [ ] **Step 1: Create .env with real credentials**

Copy `.env.example` to `.env` and fill in the real values:

```bash
cp conciliacao/.env.example conciliacao/.env
```

Edit `conciliacao/.env` with your actual keys.

- [ ] **Step 2: Run the full pipeline with the sample PDF**

```bash
cd conciliacao && python main.py "/path/to/CLINICA MEDICA APOSTOLOS analitico.pdf"
```

Expected output:

```
Extraindo dados do PDF via Gemini...
  Enviando PDF para Gemini...
  Periodo: 16/01/2026 a 15/02/2026
  Pacientes encontrados: 8
Consultando Supabase...
  Pacientes no periodo: N
Cruzando dados...
Gerando relatorio Excel...

Conciliacao concluida!
Periodo: 16/01/2026 a 15/02/2026
Pacientes PDF: 8 | Supabase: N
Match Perfeito: X | Glosas: Y (Z dias) | Nao Faturados: W
Relatorio salvo em: conciliacao_2026-01.xlsx
```

- [ ] **Step 3: Open the Excel file and visually verify**

Check:
- Header row has `#20515F` background with white text
- Rows are colored by status (green/red/yellow)
- "Datas Nao Pagas" column lists specific missing dates
- Summary block at the bottom has correct counts

- [ ] **Step 4: Run all unit tests**

```bash
cd conciliacao && python -m pytest tests/ -v
```

Expected: All tests PASS

- [ ] **Step 5: Final commit**

```bash
git add conciliacao/
git commit -m "feat(conciliacao): complete billing reconciliation script"
```
