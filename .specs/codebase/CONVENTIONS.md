# Code Conventions

## Naming Conventions

**Files:**
Predominantemente nomes simples em minúsculas; HTML/CSS seguem padrão próximo de kebab-case e JS usa nomes curtos sem módulos.
Examples: `login.html`, `index.html`, `script.js`, `login.js`, `styles.css`

**Functions/Methods:**
camelCase, descritivos em inglês
Examples: `fetchAllData()`, `createPatientWithVisit()`, `addVisitToExistingPatient()`, `renderPrevDayTable()`, `setupAutocomplete()`, `getFilteredPatients()`, `handleSupabaseError()`, `showToast()`, `isPatientActive()`

**Variables:**
camelCase para variáveis locais e globais
Examples: `patients`, `relatoriosSet`, `currentSort`, `isProcessing`, `selectedId`, `numeroVisitas`

**Constants:**
UPPER_SNAKE_CASE para arrays/objetos de configuração
Examples: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `DOCTORS`, `HOSPITALS`

**CSS Classes/IDs:**
kebab-case
Examples: `.nav-btn`, `.btn-primary`, `.form-group`, `#user-email`, `#prev-day-table`, `#screen-registro`

**Data Attributes:**
kebab-case
Examples: `data-action="edit-patient"`, `data-target="screen-ficha"`, `data-sort="pacienteNome"`, `data-label`

**CSS Variables:**
`--kebab-case` com prefixo semântico
Examples: `--color-primary`, `--font-title`, `--shadow-md`, `--radius-lg`, `--transition`

## Code Organization

**Import/Dependency Declaration:**
SDK Supabase carregado via CDN no HTML `<script>` antes do `script.js`.
Não há imports ES6 — tudo global.
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="script.js"></script>
```

**File Structure (script.js):**
Organizado por seções sequenciais, sem separação formal:
1. Constantes e config (SUPABASE_URL, DOCTORS, HOSPITALS)
2. State global (patients, relatoriosSet, currentSort)
3. DOM element caching (document.getElementById em bloco)
4. Utility functions (esc, showToast, dates)
5. Data fetching (fetchAllData)
6. CRUD operations (create, update, delete)
7. UI rendering (tabelas, calendário)
8. Setup functions (setupForm, setupAutocomplete, setupFichaFilters)
9. Exportação CSV / calendário
10. Event delegation (document click handler)
11. Init (DOMContentLoaded)

## Language & Comments

**Language:** Mistura de inglês (funções, variáveis) e português (strings UI, labels, mensagens de erro)
**Comment Style:** Esparso — comentários inline curtos quando necessário. Sem JSDoc.
**Indentation:** 2 espaços no `script.js`; `login.js` usa 4 espaços
**Semicolons:** Presente (estilo consistente com `;`)

## Error Handling

**Pattern:** try/catch envolvendo toda operação async. Erros Supabase tratados por `handleSupabaseError()` que:
1. Loga no console com contexto: `console.error('[contexto]', error)`
2. Exibe toast amigável em português
3. Trata erros específicos (RLS violation, duplicate key) com mensagens customizadas

```javascript
try {
  const { error } = await supabaseClient.from('historico').insert({...});
  if (error) handleSupabaseError(error, 'INSERT historico');
  else showToast('Sucesso!');
} catch (err) {
  handleSupabaseError(err, 'catch INSERT');
}
```

## Date Handling

**Pattern:** Datas sempre manipuladas como strings `YYYY-MM-DD` ou via componentes locais (`getFullYear()`, `getMonth()`, `getDate()`). Nunca usar `.toISOString()` para evitar shift de timezone UTC vs Brasília (UTC-3).

```javascript
function parseDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d); // timezone-safe
}
```

## UI Feedback

**Pattern:** Toda ação do usuário recebe feedback via `showToast()` (notificação animada no rodapé). Ações destrutivas precedidas por `showConfirm()` (modal de confirmação).

## Double-Click Prevention

**Pattern:** Flag `isProcessing` setada antes de operações async, resetada no finally. Previne submissões duplicadas.
