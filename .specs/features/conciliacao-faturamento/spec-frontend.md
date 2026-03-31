# Conciliacao de Faturamento — Frontend Spec

> Migrar a conciliacao de faturamento do script Python CLI para uma nova aba no AppHosp, rodando 100% no browser.

## Contexto

O script Python (`conciliacao/`) ja implementa o pipeline: PDF → Gemini → Supabase → fuzzy match → Excel. Esta spec descreve a versao frontend equivalente, integrada ao app como 5a aba do bottom nav.

## Fluxo do Usuario

1. Abre a aba "Conciliacao" no bottom nav
2. Faz upload de um PDF (analitico de repasse a terceiros)
3. Clica "Processar"
4. Loading enquanto Gemini extrai dados do PDF
5. App consulta pacientes HSL no Supabase para o periodo extraido
6. Fuzzy match entre nomes do PDF e nomes do Supabase
7. Resultados aparecem numa tabela colorida por status
8. Resumo com totais em cards acima da tabela
9. Botao "Exportar Excel" gera `.xlsx` formatado para download

## Arquitetura

### Principio
Tudo roda no browser. Sem backend adicional. Consistente com o padrao do projeto (chaves no frontend).

### Dependencias externas (CDN)
- **Google Generative AI SDK** (`@google/generative-ai`) — chamadas ao Gemini 2.5 Flash
- **fuzzball** — fuzzy string matching (equivalente JS do `thefuzz` Python)
- **SheetJS (xlsx)** — geracao de Excel no browser

### Integracao existente
- `supabaseClient` global (ja inicializado em `script.js`)
- Design system CSS (variaveis de cor, tipografia, padroes de card/tabela)
- Sistema de tabs (`.nav-btn[data-target]` + `.screen.active`)
- RBAC (`doctor`/`manager` via CSS `.role-manager`)

## Componentes da UI

### 1. Bottom Nav — Nova aba
- 5o botao no navbar: icone de documento/check + label "Conciliacao"
- `data-target="screen-conciliacao"`
- Segue padrao dos outros botoes (SVG 22x22, `.tab-icon` + `.tab-label`)

### 2. Tela de Upload (estado inicial)
- Card centralizado com:
  - Input file (`accept=".pdf"`) estilizado
  - Nome do arquivo selecionado exibido
  - Botao "Processar" (estilo primario `#20515F`)
- Input para a Gemini API key (campo texto, salva no `localStorage` para reuso)
  - Label: "Chave Gemini API"
  - Valor persiste entre sessoes via `localStorage`
  - Nao fica hardcoded no codigo-fonte

### 3. Loading State
- Substitui o card de upload durante processamento
- Texto indicando etapa atual:
  - "Extraindo dados do PDF via Gemini..."
  - "Consultando pacientes no Supabase..."
  - "Cruzando dados..."
- Spinner ou barra de progresso indeterminada

### 4. Cards de Resumo
- Linha de cards acima da tabela com:
  - **Pacientes PDF**: total extraido do PDF
  - **Match Perfeito**: count (verde)
  - **Glosas**: count + total dias (vermelho)
  - **Nao Faturados**: count (vermelho)
  - **Nao Encontrados**: count (laranja)
- Cores seguem `STATUS_FILLS` do reporter.py

### 5. Tabela de Resultados
- Colunas:
  - Nome Faturamento
  - Nome Supabase
  - Score Match
  - Dias Esperados
  - Dias Pagos
  - Datas Nao Pagas (lista de datas)
  - Datas Extras (lista de datas)
  - Status
- Linhas coloridas por status:
  - `Match Perfeito` → verde claro (`#D5F5E3`)
  - `Glosa` / `Glosa + Pagamento a Maior` / `Nao Faturado` → vermelho claro (`#FADBD8`)
  - `Pagamento a Maior` → amarelo claro (`#FEF9E7`)
  - `Nao Encontrado` → laranja claro (`#F6DDCC`)
- Header com fundo `#20515F` e texto branco
- Responsivo: em mobile, transforma em cards (padrao existente do app)

### 6. Botao Exportar Excel
- Posicionado acima da tabela, ao lado dos cards de resumo
- Gera `.xlsx` com mesma formatacao do `reporter.py`:
  - Header colorido
  - Linhas por status
  - Bloco de resumo ao final
  - Nome: `conciliacao_YYYY-MM.xlsx`

### 7. Botao "Nova Conciliacao"
- Aparece junto com os resultados
- Reseta o estado para a tela de upload

## Logica de Negocio

### Extracao PDF (Gemini)
- Usa Google Generative AI SDK via CDN
- Modelo: `gemini-2.5-flash`
- Converte PDF para base64, envia como inline_data
- Prompt identico ao `EXTRACTION_PROMPT` do `extractor.py`
- Response schema forcando JSON estruturado
- Retry com backoff exponencial (3 tentativas)
- Retorna: `{ periodo_inicio, periodo_fim, pacientes: [{ nome, datas }] }`

### Consulta Supabase
- Usa `supabaseClient` global
- Query: `patients` table, `hospital = 'HSL'`
- Filtro de intersecao de periodo (mesmo do `supabase_client.py`):
  - `dataprimeiraavaliacao <= periodo_fim`
  - `dataultimavisita >= periodo_inicio`
- Retorna: `[{ nome, data_inicio, data_fim }]`

### Fuzzy Matching e Reconciliacao
- Logica identica ao `matcher.py`:
  - `normalize()` — remove acentos, uppercase
  - `date_range()` — gera set de datas entre inicio e fim
  - `reconcile()` — fuzzy match com threshold 80, classifica por status
- Usa `fuzzball` (CDN) para `extractOne` equivalente
- Intersecao de periodos (clamp ao periodo do PDF)
- Classificacao: Match Perfeito, Glosa, Pagamento a Maior, Glosa + Pagamento a Maior, Nao Encontrado, Nao Faturado

### Geracao Excel
- Usa SheetJS (`xlsx`) via CDN
- Mesma estrutura de colunas e resumo do `reporter.py`
- Formatacao: header `#20515F`, linhas por status, auto-width
- Download automatico via blob URL

## Filtro fixo
- Hospital: `HSL` (hardcoded, nao selecionavel)

## RBAC
- `doctor`: acesso total (upload, processar, exportar)
- `manager`: somente visualizacao (hide botao processar e exportar via `.role-manager`)

## Estrutura de Arquivos

| Arquivo | Mudanca |
|---------|---------|
| `index.html` | Adicionar: CDN scripts (genai, fuzzball, xlsx), botao nav, section `screen-conciliacao` |
| `conciliacao.js` | Criar: modulo completo (upload, gemini, supabase query, matcher, render, excel export) |
| `styles.css` | Adicionar: estilos da aba conciliacao (cards resumo, tabela colorida, upload area, loading) |

## Armazenamento local
- `localStorage.geminiApiKey` — persiste a chave Gemini entre sessoes

## Tratamento de Erros
- PDF invalido ou vazio → mensagem "PDF nao reconhecido. Verifique se e um Analitico de Repasse."
- Gemini falha apos retries → mensagem "Falha na extracao. Tente novamente."
- Supabase sem pacientes no periodo → exibe resultados normalmente (todos "Nao Encontrado")
- Chave Gemini nao preenchida → mensagem "Insira sua chave Gemini API"
