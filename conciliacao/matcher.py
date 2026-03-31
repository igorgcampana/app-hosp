import unicodedata
from datetime import datetime, timedelta
from typing import Set, List

SCORE_THRESHOLD = 80
DATE_FMT = "%d/%m/%Y"
SUPABASE_DATE_FMT = "%Y-%m-%d"


def normalize(name: str) -> str:
    """Remove accents and convert to uppercase."""
    name = name.upper()
    nfkd = unicodedata.normalize("NFKD", name)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def date_range(start: str, end: str) -> Set[str]:
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


def sort_dates(dates) -> List[str]:
    """Sort dates chronologically (DD/MM/YYYY format)."""
    return sorted(dates, key=lambda d: datetime.strptime(d, DATE_FMT))


def parse_supabase_date(date_str: str) -> str:
    """Convert YYYY-MM-DD to DD/MM/YYYY."""
    return datetime.strptime(date_str, SUPABASE_DATE_FMT).strftime(DATE_FMT)


from typing import Dict, Optional
from thefuzz import process


def reconcile(dados_pdf: dict, dados_supabase: List[Dict]) -> List[Dict]:
    periodo_inicio = dados_pdf["periodo_inicio"]
    periodo_fim = dados_pdf["periodo_fim"]

    # Build lookup structures for Supabase data
    supa_normalized: Dict[str, str] = {}
    supa_by_original: Dict[str, dict] = {}
    for p in dados_supabase:
        norm = normalize(p["nome"])
        supa_normalized[norm] = p["nome"]
        supa_by_original[p["nome"]] = p

    supa_norm_keys = list(supa_normalized.keys())
    matched_supabase: set = set()
    results: List[Dict] = []

    for pac_pdf in dados_pdf["pacientes"]:
        nome_pdf = pac_pdf["nome"]
        datas_pagas: Set[str] = set(pac_pdf["datas"])

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
) -> Set[str]:
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


def _classify(datas_nao_pagas: List[str], datas_extras: List[str]) -> str:
    has_missing = len(datas_nao_pagas) > 0
    has_extra = len(datas_extras) > 0
    if has_missing and has_extra:
        return "Glosa + Pagamento a Maior"
    if has_missing:
        return "Glosa"
    if has_extra:
        return "Pagamento a Maior"
    return "Match Perfeito"


def _not_found(nome_pdf: str, datas_pagas: Set[str]) -> Dict:
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
