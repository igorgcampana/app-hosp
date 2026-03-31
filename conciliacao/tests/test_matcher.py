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
