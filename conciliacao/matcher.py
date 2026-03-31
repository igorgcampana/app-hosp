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
