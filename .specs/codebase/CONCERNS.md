# Concerns

**Analyzed:** 2026-03-29

## Tech Debt

### TD-1: Monolito script.js (1521 linhas)

**Severity:** Medium
**Location:** `script.js`
**Evidence:** Arquivo único com toda a lógica — auth, CRUD, rendering, filtros, export, event delegation
**Impact:** Difícil de manter, testar e debugar. Alto risco de regressão em mudanças.
**Fix approach:** Modularizar em arquivos separados (auth.js, api.js, render.js, utils.js) usando ES modules
**Effort:** Medium

### TD-2: Constantes hardcoded no JS

**Severity:** Low
**Location:** `script.js` linhas 49-53
**Evidence:** Arrays DOCTORS, HOSPITALS, tipos de internação definidos como constantes no código
**Impact:** Adicionar médico/hospital requer deploy. Não sincronizado automaticamente com o banco.
**Fix approach:** Buscar constantes do Supabase em tabela de configuração
**Effort:** Low

### TD-3: Sem estratégia de cache

**Severity:** Low
**Location:** `script.js` — `fetchAllData()`
**Evidence:** Toda operação CRUD chama `fetchAllData()` que recarrega **todos** patients + historico
**Impact:** Latência crescente conforme volume de dados aumenta. Operações desnecessárias de rede.
**Fix approach:** Cache local com invalidação seletiva (invalidar apenas entidades alteradas)
**Effort:** Medium

## Security

### SEC-1: Chaves Supabase no código-fonte

**Severity:** Low (mitigado por RLS)
**Location:** `script.js` linhas 1-2
**Evidence:** `SUPABASE_URL` e `SUPABASE_ANON_KEY` em plain text
**Impact:** Chave anon é pública por design. RLS policies protegem dados. Risco real é baixo.
**Mitigation:** Aceito como trade-off de arquitetura serverless frontend-only
**Note:** Padrão recomendado pelo Supabase para SPAs sem backend

### SEC-2: Frontend-only RBAC hiding

**Severity:** Low (mitigado por RLS)
**Location:** `styles.css` linhas 142-162
**Evidence:** Botões de edição escondidos via CSS `display: none` para managers
**Impact:** CSS é bypassável via DevTools. Porém RLS bloqueia no banco de dados.
**Mitigation:** Camada dupla — CSS = UX, RLS = segurança real

## Performance

### PERF-1: Sem minificação

**Severity:** Low
**Location:** Todos os assets estáticos
**Evidence:** script.js (57KB), styles.css (28KB) servidos sem minificação
**Impact:** ~40KB extras transferidos por carregamento. Compressão Vercel atenua parcialmente.
**Fix approach:** Adicionar step de minificação (terser + csso) ou usar Vercel edge functions
**Effort:** Low

### PERF-2: Fetch-all sem paginação

**Severity:** Low (atualmente), Medium (futuro)
**Location:** `script.js` — `fetchAllData()`
**Evidence:** `SELECT *` em patients e historico sem LIMIT
**Impact:** Aceitável com ~50-100 pacientes. Degradação com centenas+.
**Fix approach:** Paginação server-side ou lazy loading conforme volume crescer
**Effort:** Medium

## Missing Features

### MF-1: Sem testes automatizados

**Severity:** High
**Location:** Projeto inteiro
**Evidence:** Zero test files, zero test config, zero CI test step
**Impact:** Sistema financeiro (faturamento) sem rede de segurança contra regressões. Mudanças em cálculos de datas/visitas são alto risco.
**Fix approach:** Implementar testes unitários para funções de cálculo (datas, filtros), testes de integração para CRUD
**Effort:** Medium

### MF-2: Sem error boundary global

**Severity:** Medium
**Location:** `script.js`
**Evidence:** Se JS crashar durante init, body permanece `visibility: hidden` (tela branca)
**Impact:** Usuário vê tela em branco sem feedback
**Fix approach:** Try/catch global no init com fallback UI mostrando mensagem de erro
**Effort:** Low

## Fragile Areas

### FA-1: Lógica de datas e timezone

**Location:** `script.js` — `parseDate()`, construção manual de YYYY-MM-DD
**Evidence:** Comentários no código mencionam bug de timezone com `toISOString()`. Solução manual com `getFullYear()/getMonth()/getDate()`.
**Risk:** Qualquer uso inadvertido de `.toISOString()` ou `new Date(string)` pode causar shift de 1 dia (UTC-3 → UTC)
**Guidance:** Sempre usar `parseDate()` e construção manual. Nunca `.toISOString()` para datas.

### FA-2: Duplicatas de pacientes por nome

**Location:** `script.js` — autocomplete, `createPatientWithVisit()`
**Evidence:** README documenta que variações de nome ("Maria Silva" vs "Maria da Silva") criam duplicatas
**Risk:** Impacto no faturamento — visitas divididas entre registros duplicados
**Guidance:** Autocomplete mitiga parcialmente. Merge manual via Supabase dashboard quando detectado.
