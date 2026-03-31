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
