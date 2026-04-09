# Documentação de Segurança e Troubleshooting: Edge Functions (Supabase)

**Data de Implementação:** Abril de 2026
**Responsável:** Antigravity AI / Igor Campana
**Branch Fonte:** `fix/edge-security`
**Contexto:** Ocorreu a migração da extração de PDFs via IA (Google Gemini) do frontend para uma  Edge Function no backend (Supabase), visando esconder a API Key. Em seguida, foi feito um Hardening Nível 2 (Blindagem) para tapar as falhas comuns observadas no manifesto Vibe Coding.

---

## 1. Barreiras de Segurança Aplicadas

A função `processa-conciliacao` agora intercepta e valida os dados através de 4 barreiras sequenciais invisíveis (Middlewares) aplicadas diretamente em `index.ts`.

### A) Validação de Origem (CORS Direcionado)
- **O Problema Antigo:** O `Access-Control-Allow-Origin: '*'` permitia que qualquer website do planeta usasse nossa função hospedada.
- **Como Funciona Hoje:** O código inspeciona `req.headers.get('Origin')`. Se a string vier terminando com `.vercel.app` e contiver `app-hosp`, ou se for ambiente de testes local (`http://localhost:5500`), ele devolve os dados. A qualquer outro site é negado acesso pelo próprio navegador.

### B) Autenticação Mandatória (JWT via Supabase)
- **O Problema Antigo:** As URLs de Edge Functions são públicas por padrão. Qualquer script POST não-autenticado batendo na função ativaria a chave do Gemini e geraria cobranças.
- **Como Funciona Hoje:** 
  1. No `conciliacao.js`, o SDK do JavaScript injeta o crachá do usuário logado via header HTTP (`Authorization: Bearer <TOKEN>`).
  2. Na `Edge Function`, criamos uma instância administrativa paralela do Supabase repassando esse mesmo Header.
  3. Nós executamos `supabaseAdmin.auth.getUser()`.
  4. Se o usuário estiver banido, sessão expirada, ou for um hacker chamando direto do Insomnia/Postman sem token, a função rejeita a chamada imediatamente com um **Erro 401/403** (Forbidden).

### C) Defesa contra Saturação (Anti-DoS Limits)
- **O Problema Antigo:** Usuários/Hackers poderiam enviar strings Base64 do tamanho de gigabytes, estourando a memória RAM da Edge Function da Supabase e derrubando a infraestrutura temporariamente.
- **Como Funciona Hoje:** Foram inseridas travas de tamanho (Payload Size Limit) travadas em `MAX_PAYLOAD_SIZE = 6000000` (~6 Megabytes de texto) medidos primeiramente pelo cabeçalho `content-length` ou pelo tamanho real em bytes. Nativas do HTTP Code `413 Payload Too Large`.

### D) Filtros JSON (Type Sanitization)
- **O Problema Antigo:** Baseávamos o request esperando propriedades específicas e submetíamos ao SDK sem checagem de tipos (perigoso com injeção de protótipos de objeto em JS).
- **Como Funciona Hoje:** O Typescript na nuvem confirma explicitamente que `typeof base64Pdf === 'string'`.

---

## 2. Guia de Troubleshooting Rápido (Se algo quebrar no futuro)

Se o recurso de Conciliação parar de funcionar na clínica repentinamente, investigue nesta ordem utilizando os `Console Logs` nativos da interface web do **Supabase Dashboard > Edge Functions > Logs**.

| Sintoma (Erro Aparente no Console Web) | Possível Causa Técnica (O que investigar / resolver) |
| :--- | :--- |
| **Erro CORS** (Access-Control-Allow-Origin Missing) | A URL da Vercel em produção mudou e não bate mais com a regra `.endsWith('.vercel.app') && .includes('app-hosp')` programada na função. Você precisará ajustar os `ALLOWED_ORIGINS` no `index.ts`. |
| **Erro 401 ou 403** (Nao Autorizado) | O Token JWT expirou no meio do caminho ou a sessão do pacote Supabase JS no Frontend se corrompeu. Ação: Pedir pro usuário deslogar e logar de novo para limpar o Storage. |
| **Erro 413** (Payload Muito Grande) | A clínica enviou um PDF absurdo que passou do tamanho máximo estabelecido (6MB Base64). Ação: Peça para dividirem o relatório e subirem meses separados (janeiro / fevereiro separados). |
| **Erro 500** (Internal Server Error Gateway Keys) | Alguém deletou ou renomeou a variável `GEMINI_API_KEY` do Dashboard do Supabase Cloud "Vault". Precisará recriá-la via `supabase secrets set`. |
| **Erro 502** (Erro na API do Gemini) | Instabilidade nos servidores do Google Bard/Gemini, ou a cota de uso free do cartão de crédito estourou, ou formato do PDF é impossível da IA compreender (tabela corrompida). |
| **Erro 422** (IA Retornou Lista Vazia) | O prompt no Backend não encontrou compatibilidade no PDF enviado (ou as regras não conseguiram fazer match nos Nomes/Datas fornecidos no arquivo daquela clínica específica). O prompt de regras pode precisar de reajuste fino. |

---

## 3. Comandos Importantes para Deploy Local
Se você precisar alterar a função, as regras de CORS ou tamanho após os alertas acima, faça isso no arquivo local: `supabase/functions/processa-conciliacao/index.ts` e rode no seu VS Code:

1. Atualizar Função na nuvem: `npx supabase functions deploy processa-conciliacao`
2. Atualizar Senhas de API na nuvem: `npx supabase secrets set NOME_DA_KEY="SUA_CHAVE"`
