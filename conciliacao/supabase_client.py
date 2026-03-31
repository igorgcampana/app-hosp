from datetime import datetime

from supabase import create_client, Client


def fetch_patients(url: str, key: str, periodo_inicio: str, periodo_fim: str) -> list:
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
