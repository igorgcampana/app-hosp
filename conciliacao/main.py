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
