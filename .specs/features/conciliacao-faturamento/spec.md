# Conciliacao de Faturamento — Spec

## Objetivo

Script Python CLI que cruza dados de faturamento hospitalar (PDF "Analitico de Repasse a Terceiros") com o banco de dados Supabase do AppHosp, identificando divergencias entre visitas pagas pelo hospital e visitas registradas no sistema.

Responde a pergunta: **"Todas as visitas que fiz foram pagas? Se nao, quais datas ficaram sem pagamento?"**

## Contexto

- O hospital emite mensalmente um PDF com todas as visitas faturadas, cobrindo o periodo do dia 15/16 de um mes ao dia 15/16 do proximo.
- O Supabase contem o registro de cada paciente com `dataprimeiraavaliacao` e `dataultimavisita`, representando o periodo completo de internacao.
- O tempo de internacao = `dataultimavisita - dataprimeiraavaliacao + 1` (inclusive nas pontas).
- Cada dia de internacao deve corresponder a exatamente 1 visita paga no PDF.
- O script roda localmente, sob demanda (~1x/mes), sem deploy.

## Escopo

- **Incluso:** Extracao do PDF via Gemini, consulta ao Supabase, cruzamento por fuzzy match, relatorio Excel.
- **Excluso:** Interface web, integracao com AppHosp, multiplos hospitais (apenas Sirio-Libanes por ora), automacao/agendamento.

---

## Arquitetura

### Pipeline

```
PDF ──> [1. Extrator Gemini] ──> JSON intermediario
                                       |
Supabase ──> [2. Consulta DB] ──> pacientes + datas
                                       |
                              [3. Cruzamento] ──> divergencias
                                       |
                              [4. Relatorio] ──> Excel
```

### Estrutura de arquivos

```
conciliacao/
├── main.py              # Orquestrador CLI (entry point)
├── extractor.py         # Modulo 1: Gemini — recebe PDF, retorna JSON
├── supabase_client.py   # Modulo 2: Consulta ao Supabase
├── matcher.py           # Modulo 3: Fuzzy match + logica de intersecao
├── reporter.py          # Modulo 4: Gera Excel
├── .env                 # Chaves (GEMINI_API_KEY, SUPABASE_URL, SUPABASE_KEY)
├── .env.example         # Template sem secrets
└── requirements.txt
```

Sem classes, sem abstraccoes desnecessarias. Funcoes puras em modulos separados por responsabilidade.

---

## Modulo 1: Extrator Gemini (extractor.py)

### Responsabilidade

Receber o caminho do PDF, enviar para a API do Gemini 2.5 Flash de forma multimodal, e retornar um JSON estruturado.

### Input

- Caminho local do arquivo PDF.

### Output

```python
{
    "periodo_inicio": "16/01/2026",
    "periodo_fim": "15/02/2026",
    "pacientes": [
        {
            "nome": "EDNA MOUZINHO BARRETO",
            "datas": ["29/12/2025", "30/12/2025", "31/12/2025", "01/01/2026"]
        },
        {
            "nome": "IKO NAGAO",
            "datas": ["29/01/2026", "30/01/2026"]
        }
    ]
}
```

### Regras de extracao

1. Extrair o periodo de cobertura do cabecalho ("Periodo: X ate Y").
2. Iterar todas as linhas de execucao do PDF (todas as paginas).
3. Agrupar por nome do paciente — ignorar convennio/plano (mesmo paciente pode aparecer em secoes diferentes do PDF).
4. Contar todos os tipos de procedimento (Visita hospitalar, Consulta eletiva, Parecer Medico, Pronto Socorro) como visita paga.
5. Para cada paciente, listar cada Dt. Exec. como data individual, sem duplicatas.
6. Retornar nomes em CAIXA ALTA.

### Structured Output

Usar `response_mime_type="application/json"` + `response_schema` do SDK do Gemini para forcar o schema. Se o modelo nao conseguir atender o schema, a API retorna erro em vez de JSON malformado.

### Tratamento de erros

- **Timeout / rate limit:** retry com backoff exponencial (max 3 tentativas).
- **Resposta vazia:** se `pacientes` for lista vazia, lancar erro explicativo.
- **PDF corrompido:** capturar excecao da API e exibir mensagem clara.

---

## Modulo 2: Consulta Supabase (supabase_client.py)

### Responsabilidade

Buscar pacientes do Supabase cujo periodo de internacao intersecta o periodo do PDF.

### Query

```
SELECT pacientenome, dataprimeiraavaliacao, dataultimavisita
FROM patients
WHERE hospital = 'HSL'
  AND dataprimeiraavaliacao <= periodo_fim
  AND dataultimavisita >= periodo_inicio
```

Isso retorna todo paciente que esteve internado em algum momento dentro da janela do PDF — incluindo quem ja recebeu alta mas tinha dias dentro do periodo.

### Output

```python
[
    {
        "nome": "Edna Mouzinho Barreto",
        "data_inicio": "2025-12-29",
        "data_fim": "2026-01-01"
    }
]
```

### Variaveis de ambiente

- `SUPABASE_URL` — URL do projeto Supabase.
- `SUPABASE_KEY` — Chave de servico (service_role key para leitura sem RLS).

---

## Modulo 3: Cruzamento (matcher.py)

### Responsabilidade

Associar pacientes do PDF com pacientes do Supabase via fuzzy match, calcular a intersecao de datas, e classificar divergencias.

### Passo 1 — Fuzzy Match

Para cada paciente do PDF, usar `thefuzz.process.extractOne` contra a lista de nomes do Supabase.

- **Normalizacao pre-match:** converter ambos os nomes para CAIXA ALTA sem acentos.
- **Score >= 80:** match aceito.
- **Score < 80:** classificar como "Paciente Nao Encontrado".

### Passo 2 — Intersecao de datas

Para cada par (PDF <> Supabase) com match:

```
inicio_esperado = max(dataprimeiraavaliacao, periodo_inicio_pdf)
fim_esperado    = min(dataultimavisita, periodo_fim_pdf)
datas_esperadas = {cada dia de inicio_esperado a fim_esperado, inclusive}
datas_pagas     = {datas extraidas do PDF para esse paciente}
```

### Passo 3 — Classificacao

```
datas_nao_pagas = datas_esperadas - datas_pagas
datas_extras    = datas_pagas - datas_esperadas
```

| Situacao | Status |
|----------|--------|
| `datas_esperadas == datas_pagas` | Match Perfeito |
| `datas_nao_pagas` nao vazio | Glosa |
| `datas_extras` nao vazio | Pagamento a Maior |
| Score < 80 | Paciente Nao Encontrado |

### Passo 4 — Caminho inverso

Apos iterar todos os pacientes do PDF, verificar quais pacientes do Supabase nao foram pareados. Esses sao visitas feitas que o hospital sequer faturou.

Status: **Nao Faturado**

### Output

```python
[
    {
        "nome_pdf": "EDNA MOUZINHO BARRETO",
        "nome_supabase": "Edna Mouzinho Barreto",
        "score_match": 95,
        "datas_esperadas": ["29/12/2025", "30/12/2025", "31/12/2025", "01/01/2026"],
        "datas_pagas": ["29/12/2025", "30/12/2025", "31/12/2025", "01/01/2026"],
        "datas_nao_pagas": [],
        "datas_extras": [],
        "status": "Match Perfeito"
    },
    {
        "nome_pdf": null,
        "nome_supabase": "Fulano de Tal",
        "score_match": null,
        "datas_esperadas": ["20/01/2026", "21/01/2026", "22/01/2026"],
        "datas_pagas": [],
        "datas_nao_pagas": ["20/01/2026", "21/01/2026", "22/01/2026"],
        "datas_extras": [],
        "status": "Nao Faturado"
    }
]
```

---

## Modulo 4: Relatorio Excel (reporter.py)

### Responsabilidade

Gerar arquivo Excel formatado com o resultado da conciliacao.

### Colunas

| Coluna | Descricao |
|--------|-----------|
| Nome Faturamento | Nome como aparece no PDF (vazio se Nao Faturado) |
| Nome Supabase | Nome como aparece no banco |
| Score Match | Percentual do fuzzy match |
| Dias Esperados | Quantidade de dias na intersecao |
| Dias Pagos | Quantidade de datas no PDF |
| Datas Nao Pagas | Lista das datas faltantes, separadas por virgula |
| Datas Extras | Lista das datas pagas sem registro no Supabase |
| Status | Match Perfeito / Glosa / Pagamento a Maior / Nao Faturado / Nao Encontrado |

### Formatacao

- Cabecalho com fundo `#20515F` e texto branco (identidade visual do Dr. Igor Campana).
- Linhas Glosa / Nao Faturado: fundo vermelho claro.
- Linhas Match Perfeito: fundo verde claro.
- Linhas Pagamento a Maior: fundo amarelo claro.
- Auto-ajuste de largura das colunas.
- Nome do arquivo: `conciliacao_YYYY-MM.xlsx` (baseado no periodo do PDF).

### Resumo

Bloco ao final da planilha:

```
Total de pacientes no PDF: X
Total de pacientes no Supabase (periodo): Y
Match Perfeito: N
Glosas: N (total de Z dias nao pagos)
Nao Faturados: N
```

---

## Modulo CLI (main.py)

### Uso

```bash
python main.py caminho/para/analitico.pdf
```

### Fluxo

1. Carregar variaveis de ambiente do `.env` (via python-dotenv).
2. Validar que o arquivo PDF existe.
3. Chamar `extractor.extract(pdf_path)` → JSON com periodo + pacientes + datas.
4. Chamar `supabase_client.fetch_patients(periodo_inicio, periodo_fim)` → lista de pacientes do Supabase.
5. Chamar `matcher.reconcile(dados_pdf, dados_supabase)` → lista de divergencias.
6. Chamar `reporter.to_excel(divergencias, periodo)` → salvar Excel.
7. Imprimir resumo no terminal.

### Output no terminal

```
Conciliacao concluida!
Periodo: 16/01/2026 a 15/02/2026
Pacientes no PDF: 8 | Pacientes no Supabase: 10
Match Perfeito: 6 | Glosas: 2 | Nao Faturados: 2
Relatorio salvo em: conciliacao_2026-01.xlsx
```

---

## Dependencias (requirements.txt)

```
google-genai
supabase
thefuzz
python-Levenshtein
pandas
openpyxl
python-dotenv
```

---

## LGPD

- O script roda localmente, sem transmissao de dados para terceiros alem da API do Gemini (que recebe o PDF — dado ja emitido pelo hospital).
- Nenhum dado e persistido alem do Excel gerado localmente.
- O `.env` com chaves fica fora do controle de versao (listado no `.gitignore`).
- O PDF e o Excel devem ser armazenados em local seguro pelo usuario.

---

## Decisoes de design

1. **Gemini multimodal (Abordagem A):** Escolhida por simplicidade e robustez. Custo desprezivel (~centavos/mes). Parser deterministico (pdfplumber) seria fragil para esse layout.
2. **Fuzzy match com thefuzz:** Necessario porque nomes no PDF podem ter diferencas de acentuacao, abreviacao ou ordem vs. Supabase. Corte em 80%.
3. **Normalizacao pre-match:** Ambos os nomes convertidos para CAIXA ALTA sem acentos antes da comparacao.
4. **Intersecao de periodos:** O range esperado de visitas e a intersecao entre o periodo do PDF e o periodo de internacao do Supabase. Isso garante que nao cobramos dias fora da janela do repasse.
5. **Hospital fixo (HSL):** Filtro hardcoded por ora. Extensivel para parametro CLI no futuro.
6. **Caminho inverso:** Verificar pacientes no Supabase sem match no PDF para detectar visitas completamente nao faturadas.
7. **Todos os procedimentos contam:** Visita, consulta, parecer, PS — tudo e contado como visita paga.
