# AppHosp - Brownfield Mapping Documentation

**Project**: Censo Hospitalar (Hospital Census Management System)  
**Stack**: Vanilla HTML5 + CSS3 + ES6+ JavaScript + Supabase + Vercel  
**Date**: 2026-04-08  
**Status**: Production (Critical Financial System)

---

## 1. PROJECT OVERVIEW

### Purpose
Hospital management application for Dr. Igor Campana. The current production core replaces manual spreadsheets with a secure relational database for:
- Daily visit registration
- Patient record management across multiple hospitals
- Historical visit tracking
- Monthly repasse calculation
- Billing reconciliation
- Real-time active patient monitoring

The repository also contains:
- a partial standalone module for ambulatory consultations
- active planning for private billing, WhatsApp and automations

### Users & Access Roles
0. **admin**
   - Full access to the current operational core
   - Access to Repasse and Conciliação
   - Full access to Ambulatorio module (link visible in census header)

1. **doctor** (Medical Staff)
   - Operational access to the census flow
   - CRUD on patient records and visits
   - Daily registration shortcuts
   - Autocomplete patient suggestions
   - Report generation (CID-10)
   - Calendar usage and operational edits

2. **manager** (Manager/Secretary)
   - Read-only access to the census core
   - View patient records and calendar
   - No UI write buttons (CSS hidden + RLS backend)
   - Cannot modify data at database level

---

## 2. PROJECT STRUCTURE

### File Organization
```
AppHosp/
├── index.html          # Main SPA (all modals, screens, DOM structure)
├── login.html          # Authentication page (isolated)
├── script.js           # Core logic (1520 lines, ~57KB)
├── repasse.js          # Monthly repasse module
├── conciliacao.js      # Billing reconciliation module
├── ambulatorio.html    # Standalone ambulatory module (655 lines, complete)
├── ambulatorio.js      # Ambulatory logic: CRUD, financial calc, filters, summary (608 lines)
├── login.js            # Auth logic (64 lines, minimal)
├── styles.css          # Design system + responsive (902 lines)
├── vercel.json         # Deployment config (routing redirect)
├── manifest.json       # PWA metadata
├── robots.txt          # SEO (noindex for login)
├── README.md           # Project documentation
├── BROWNFIELD_MAPPING.md
├── .specs/             # Brownfield docs by concern
├── docs/               # Operational plans and visual maps
├── scripts/            # SQL and operational helper scripts
├── .gitignore          # Git exclusions
└── .worktrees/         # Git worktree for feature-melhorias branch
```

### Technology Stack
| Layer | Technology | Notes |
|-------|-----------|-------|
| **Frontend** | HTML5, CSS3, ES6+ JS | No frameworks, no bundlers |
| **Database** | Supabase (PostgreSQL) | Hosted backend-as-a-service |
| **Auth** | Supabase Auth + JWT | Email/password login |
| **Security** | Row-Level Security (RLS) | PostgreSQL policies |
| **Hosting** | Vercel | CI/CD via git push |
| **CDN** | jsDelivr | Supabase JS SDK |

---

## 3. CONFIGURATION & DEPLOYMENT

### Environment Variables (Hardcoded in Frontend)
**Files**: `script.js` e `login.js` (lines 1-2)
```javascript
const SUPABASE_URL = 'https://gbcnmuppylwznhrticfv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGc...Ko0'; // Public anon key (safe for frontend)
```
**Rationale**: No backend server; static frontend with client-side Supabase calls protected by RLS policies.

### Vercel Configuration
**File**: `vercel.json`
```json
{
  "redirects": [
    {"source": "/", "destination": "/login.html", "permanent": false}
  ]
}
```
**Purpose**: Root path redirects to login; enables SPA routing fallback.

### PWA Configuration
**File**: `manifest.json`
- App name: "Censo Hospitalar" / "AppHosp"
- Theme color: #20515F (dark teal)
- Start URL: ./index.html
- Display: standalone (mobile app experience)
- Icons: SVG embedded (medical cross symbol)

### Deployment Flow
1. Local: Edit files → `git commit` → `git push origin main`
2. Vercel: Webhook detects push → Auto-deploys → Live in ~30 seconds

---

## 4. SECURITY & ACCESS CONTROL

### Dual-Layer RBAC Implementation

#### Layer 1: Frontend (UX Control)
**File**: `styles.css` (lines 142-162)
```css
body.role-manager [data-action="edit-patient"],
body.role-manager #btn-salvar-relatorio {
  display: none !important;
}
```
**Method**: CSS class `role-manager` applied to `<body>` hides edit buttons/forms.

#### Layer 2: Backend (Data Protection)
**Supabase Row-Level Security Policies** (PostgreSQL):
- `INSERT/UPDATE/DELETE` blocked for `manager` role at database level
- `SELECT` permitted for all authenticated users (filtered by data ownership)
- Enforced via `auth.users.role` lookup in `profiles` table

#### Layer 3: Edge Functions (API Gateway Protection)
- **File**: `supabase/functions/processa-conciliacao/index.ts`
- Intercepts all AI PDF extraction workflows securely.
- **Defenses**: JWT Authorization via Supabase SDK intercept, restrictive CORS (`.vercel.app`), and 6MB memory-limit payload filtering to mitigate "Vibe Coding" API vulnerabilities (Unauthenticated routes, CORS *, and DDoS payload).
- 👉 **Documentação de Manutenção Completa:** Leia `docs/security_hardening_edge_function.md`.

**Script Implementation** (lines 14-24):
```javascript
const { data: profile } = await supabaseClient
  .from('profiles')
  .select('role')
  .eq('id', session.user.id)
  .single();

const userRole = profile?.role || 'doctor';
applyRolePermissions(userRole);  // Apply CSS class
```

### XSS Prevention
**File**: `script.js` (lines 154-165)
```javascript
function esc(str) {
  // Escapes HTML entities to prevent XSS
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
```
**Applied to**: All database-sourced content injected via `innerHTML`.

### JWT & Session Management
- Supabase handles JWT token generation
- Auto-refresh via SDK
- Logout clears session + redirects to login
- Session checked on app load (line 8)

---

## 5. DATA FLOW & ARCHITECTURE

### Core Data Structures
Located in `script.js` (lines 55-59):
```javascript
let patients = [];           // Array of patient objects
let relatoriosSet = Set();   // Track saved reports
let currentSort = {...};     // Sorting state
let isProcessing = false;    // Double-click prevention
```

### Database Tables (Supabase)
1. **patients**
   - Core columns used by the app: `id, patientenome, hospital, internacao, statusmanual, dataprimeiraavaliacao, dataultimavisita`
   - Primary Key: `id` (UUID)
   - Source of truth for active/inactive patient state in the census flow

2. **historico**
   - Core columns used by the app: `id, patient_id, data, medico, visitas`
   - Foreign Key: `patient_id → patients.id`
   - Stores the visit-by-day history used by Registro, Calendário and Repasse

3. **profiles**
   - Core columns used by the app/planning: `id, role`
   - Foreign Key: `id → auth.users.id`
   - Used for role checks; `doctor_name` is part of the ambulatory planning

4. **relatorios**
   - Core columns used by the app: `patient_id, cid10, texto, updated_at`
   - Stores the textual hospitalization report linked to a patient

5. **repasse_config / repasse_fatura / repasse_paciente**
   - Support the monthly repasse workflow
   - `repasse_config` stores percentages, doctor metadata and room discounts
   - `repasse_fatura` stores the monthly closing header
   - `repasse_paciente` stores the per-patient financial input for each month

6. **ambulatorio_config / consultas_ambulatoriais**
   - Active in production; used by `ambulatorio.js` for financial config (single-row) and consultation records
   - Standalone module fully integrated; accessible via header link from census (admin-only in current rollout)

### Data Flow Diagram (User Action → UI Update)

```
User fills form
    ↓
Form submission event (data-action="add-visit")
    ↓
JavaScript handler (createPatientWithVisit or addVisitToExistingPatient)
    ↓
Supabase INSERT/UPDATE calls
    ↓
RLS policy checks user.id & role
    ↓
If allowed:
  ├─ Database updated
  ├─ fetchAllData() reloads patients & historico
  ├─ renderPrevDayTable() / renderPatientsTable() rerenders DOM
  └─ showToast("Sucesso!") displays confirmation
↓ If denied:
  ├─ Error caught in catch block
  ├─ handleSupabaseError() logs & displays error toast
  └─ isProcessing reset to false
```

---

## 6. JAVASCRIPT FILES ANALYSIS

### login.js (64 lines)
**Responsibility**: Authentication only
**Key Functions**:
- `DOMContentLoaded` event listener (line 6)
- Session check redirect (line 12)
- Email/password login via `supabaseClient.auth.signInWithPassword()` (line 28)
- Error messaging with Portuguese UX fallback (lines 34-59)

**Naming Convention**: camelCase for variables/functions  
**Comment Style**: Sparse; inline comments for clarity  
**Error Handling**: Try/catch with user-friendly Portuguese error messages

**Key Code Pattern** (lines 31-35):
```javascript
const { data, error } = await supabaseClient.auth.signInWithPassword({
  email: email,
  password: password,
});
if (error) { /* handle error */ }
else if (data?.user) { window.location.href = 'index.html'; }
```

### script.js (1520 lines, ~57KB)
**Responsibility**: Core application logic, CRUD, UI rendering, filtering, exports

#### Initialization Phase (lines 6-150)
1. Auth check & role assignment (lines 8-34)
2. Initial loader hide after first successful data load (`#app-loader`)
3. DOM element caching (lines 61-132)
4. Constants definition (lines 49-53)
5. State initialization (lines 55-59)
6. Default date setup (lines 139-150)

#### Utility Functions (lines 154-230)
| Function | Purpose | Signature |
|----------|---------|-----------|
| `esc(str)` | HTML entity escaping (XSS prevention) | `String → String` |
| `escAttr(str)` | Attribute escaping | `String → String` |
| `showToast(message)` | Animated toast notification | `String → void` |
| `showConfirm(message, title)` | Modal confirmation dialog | `(String, String?) → Promise<boolean>` |
| `handleSupabaseError(error, context)` | Error logging & formatting | `(Error, String?) → void` |

#### Date Utility Functions (lines 231-263)
| Function | Purpose |
|----------|---------|
| `parseDate(dateStr)` | Convert YYYY-MM-DD to Date object (safe local timezone) |
| `diffEmDias(date1, date2)` | Calculate days between dates |
| `diasDeInternacao(dataInicio, dataFim)` | Calculate hospitalization duration |
| `formatDateBR(dateStr)` | Format date as DD/MM/YYYY |
| `isPatientActive(patient, referenceDate)` | Check if patient is active (within threshold) |

#### Data Fetching (lines 315-347)
**Function**: `fetchAllData()`
```javascript
async function fetchAllData() {
  // Fetch all patients
  const { data: patsData, error: patsError } = await supabaseClient
    .from('patients')
    .select('*');
  
  // Fetch all visit history
  const { data: histData, error: histError } = await supabaseClient
    .from('historico')
    .select('*');
  
  patients = patsData || [];
  // Process & store historico
  // Recalculate derived fields
}
```
**Called**: Every init + after each insert/update  
**Processing**: Enriches patient data with calculated fields (days of hospitalization, status)

#### Patient Operations (lines 439-505)
**Create Patient with Initial Visit**:
```javascript
async function createPatientWithVisit({ 
  nome, hospital, internacao, ehAlta, data, doctor, numeroVisitas 
}) {
  // Insert patient + initial visit record
  // Recalculate patient dates
  // Refresh UI
}
```

**Add Visit to Existing Patient**:
```javascript
async function addVisitToExistingPatient({ 
  selectedId, hospital, internacao, ehAlta, ...
}) {
  // Check for reinternacao (new admission)
  // Insert visit record
  // Mark patient as alta if applicable
  // Refresh data
}
```

#### UI Rendering Functions

| Function | Purpose | Renders |
|----------|---------|---------|
| `setupForm()` (506) | Form submission handler | Input validation, CRUD dispatch |
| `setupAutocomplete()` (574) | Patient name autocomplete | Suggestions box, selection |
| `renderPrevDayTable()` (650) | Active patients quick-access | Daily shortcut table |
| `setupFichaFilters()` (726) | Patient card filters | Search, internacao, hospital, dates |
| `getFilteredPatients()` (736) | Apply filters to patients | Returns filtered array |
| `setupSorting()` (774) | Click header to sort | Updates currentSort state |
| `renderCalendar()` (1330+) | Render calendar grid | Day-by-day visit view |
| `setupModalListeners()` (970+) | Modal open/close handlers | Edit patient, visit, report |
| `exportCSV()` (1188) | CSV export | Download file generation |

#### Global Event Delegation (lines 1300+)
```javascript
document.addEventListener('click', async (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  
  switch(action) {
    case 'edit-patient':
      // Open edit modal
      break;
    case 'delete-visit':
      // Confirm & delete
      break;
    // ... 20+ actions
  }
});
```
**Pattern**: Single event listener on document; uses `data-action` attribute for routing.

#### Error Handling Pattern (lines 205-229)
```javascript
function handleSupabaseError(error, context = '') {
  console.error(`[${context}]`, error);
  
  if (error.message.includes('violates row level security')) {
    showToast('Acesso negado: permissões insuficientes');
  } else if (error.message.includes('duplicate key')) {
    showToast('Paciente duplicado no período');
  } else {
    showToast(`Erro: ${error.message}`);
  }
}
```
**Applied**: Every async operation wrapped in try/catch

---

## 7. HTML FILES ANALYSIS

### login.html (85 lines)
**Structure**:
- Simple centered login form
- Email & password inputs (with autocomplete hints)
- Submit button + error message display
- Minimal CSS (inline styles + stylesheet reference)

**Security Features**:
- `robots.txt` noindex (line 7)
- No sensitive data in HTML
- Form handled via `login.js`

### index.html (367 lines)
**Architecture**: Single Page Application (SPA) structure

#### Navigation (lines 53-103)
```html
<nav class="navbar">
  <div class="navbar-brand"><h1>AppHosp</h1></div>
  <ul class="nav-links">
    <li><button class="nav-btn active" data-target="screen-registro">
      <svg>...</svg>
      <span>Registro</span>
    </button></li>
    <li><button class="nav-btn" data-target="screen-ficha">...</button></li>
    <li><button class="nav-btn" data-target="screen-calendario">...</button></li>
  </ul>
  <span id="user-display">
    <small id="user-email"></small>
    <button id="btn-logout">Sair</button>
  </span>
</nav>
```
**Pattern**: `data-target` links buttons to screens; JavaScript switches visibility via `.active` class.

#### Screen 1: Daily Registration (lines 107-183)
```html
<section id="screen-registro" class="screen active">
  <form id="registro-form">
    <div class="form-group autocomplete-container">
      <input id="pacienteInput" type="text" placeholder="Digite o nome...">
      <div id="suggestions-box"></div>
      <input id="selectedPatientId" type="hidden">
    </div>
    <select id="hospital" id="internacao" id="dataVisita"></select>
    <input type="number" id="numeroVisitas" min="1" max="3">
    <details id="alta-section">
      <summary>Dar alta ao paciente?</summary>
      <input type="checkbox" id="marcarAlta">
    </details>
    <button type="submit">Registrar Visita</button>
  </form>
  <table id="prev-day-table"><!-- JS injects rows --></table>
</section>
```
**Features**:
- Autocomplete for patient names
- Hospital & internacao type selectors
- Visit count input (1-3 visits/day max)
- Discharge checkbox (collapsible section)
- Quick-access table for yesterday's patients

#### Screen 2: Patient Records (lines 186-227)
```html
<section id="screen-ficha" class="screen">
  <div class="filters">
    <input id="filter-search" type="search" placeholder="Buscar por nome...">
    <select id="filter-internacao"></select>
    <select id="filter-hospital"></select>
    <select id="filter-status"></select>
    <input id="filter-start-date" type="date">
    <input id="filter-end-date" type="date">
    <button id="btn-export">Exportar CSV</button>
  </div>
  <table id="patients-table">
    <thead>
      <tr>
        <th data-sort="pacienteNome">Nome ↔</th>
        <th data-sort="internacao">Internação ↔</th>
        <!-- ... more columns ... -->
      </tr>
    </thead>
    <tbody><!-- JS injects rows --></tbody>
  </table>
</section>
```
**Sortable Columns**: Click header to toggle sort (ascending/descending)  
**Responsive**: On mobile, table converts to card layout (CSS)

#### Screen 3: Calendar View (lines 230-266)
```html
<section id="screen-calendario" class="screen">
  <div class="filters">
    <input id="filter-cal-start-date" type="date">
    <input id="filter-cal-end-date" type="date">
    <button id="btn-export-calendar">Exportar CSV</button>
  </div>
  <div id="calendar-grid"></div><!-- JS renders dense grid -->
  <table id="summary-table">
    <tr><th>Médico</th><th>Total Visitas no Mês</th></tr>
  </table>
</section>
```
**Calendar Grid**: Horizontal scrollable day-by-day view with doctor badges by color

#### Modals (lines 269-361)
1. **Relatório Modal** (lines 269-294)
   - CID-10 input
   - Report textarea (read-only for managers)
   - Generate, Copy, Save, Delete, Close buttons

2. **Edit Patient Modal** (lines 297-326)
   - Name, internacao, hospital, discharge fields
   - Save/Cancel buttons

3. **Edit Visit Modal** (lines 329-347)
   - Doctor selector
   - Visit count input
   - Save/Cancel buttons

4. **Generic Confirm Modal** (lines 350-361)
   - Title & message (dynamic)
   - Confirm/Cancel buttons

**Styling**: Fixed overlay with centered card; `modal.active` shows via flexbox

---

## 8. CSS ANALYSIS (902 lines)

### Design System (lines 1-21)
**CSS Variables** (root scope):
```css
--color-primary: #20515F (dark teal)
--color-secondary: #DDD0C6 (beige)
--color-background: #E5EBEA (light gray-blue)
--color-text-main: #333333
--color-text-secondary: #737271 (gray)
--color-white: #FFFFFF
--color-border: #ccd6d5
--color-hover: #19404b (darker teal)
--color-accent: #e28e5a (orange)

--font-title: 'League Spartan', sans-serif (headings)
--font-body: 'Merriweather', serif (body text)

--shadow-sm: 0 2px 4px rgba(32, 81, 95, 0.05)
--shadow-md: 0 4px 6px rgba(32, 81, 95, 0.1)
--shadow-lg: 0 10px 15px rgba(32, 81, 95, 0.1)
--radius-md: 8px
--radius-lg: 12px
--transition: all 0.3s ease
```

### Naming Conventions
| Convention | Usage | Example |
|-----------|-------|---------|
| kebab-case | CSS classes & IDs | `.nav-btn`, `#user-email` |
| hyphenated | BEM modifiers | `.btn-primary`, `.card-header` |
| snake_case | Data attributes | `data-target`, `data-action` |
| UPPER_SNAKE_CASE | CSS variables | `--color-primary` |

### Component Classes
| Class | Purpose | Styling |
|-------|---------|---------|
| `.navbar` | Top navigation bar | Fixed, primary bg, z-index 100 |
| `.nav-btn` | Tab buttons | Transparent, hover effect, active highlight |
| `.container` | Main content wrapper | Max-width 1200px, auto margins |
| `.screen` | Tab content sections | Display none by default, fade-in animation |
| `.card` | Content boxes | White bg, shadow, rounded, hover lift |
| `.form-group` | Form input wrapper | Flex column, label above input |
| `.btn-primary` | Primary action | Dark teal bg, white text, hover darkens |
| `.btn-secondary` | Secondary action | Beige bg, teal text |
| `.table-container` | Responsive tables | Overflow-x auto on mobile |
| `.status-badge` | Status indicator | Small rounded pill, color-coded |
| `.modal-overlay` | Backdrop & modal | Fixed full-screen, semi-transparent overlay |
| `.toast` | Notification | Fixed bottom, animated in/out |

### Responsive Design (lines 632-873)
**Breakpoint**: max-width 768px (mobile)

**Key Mobile Changes**:
1. **Navbar** (lines 635-701)
   - Flexbox row with absolute brand positioning
   - Compact logout button (2px padding, 0.6rem font)
   - Email display stacked below

2. **Bottom Navigation** (lines 703-786)
   - Fixed bottom bar, 64px height
   - Flexbox tabs with icons above labels
   - Active state: lighter background + icon opacity change

3. **Layout** (lines 788-873)
   - Single column layout
   - Padding bottom: 5.5rem (tab bar space)
   - Forms: flex-direction column
   - Filters: 100% width stacked

4. **Patient Table** (lines 831-868)
   - Desktop: Traditional table
   - Mobile: Card layout (display: block per row)
   - `::before` pseudo-element shows label via `data-label` attribute

### Animations
| Animation | Purpose | Duration |
|-----------|---------|----------|
| `fadeIn` (169-178) | Screen transition | 0.4s ease-out |
| `toastIn` (607-616) | Toast appear | 0.3s ease |
| `toastOut` (619-626) | Toast disappear | 0.3s ease 2.5s |

---

## 9. EXTERNAL INTEGRATIONS

### Supabase Client Setup (script.js, lines 1-4)
```javascript
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```
**CDN Source**: `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`  
**Versioning**: major `@2` fixado na URL do CDN

### Authentication Flow
```
1. User visits app → index.html
2. DOMContentLoaded event fires
3. supabaseClient.auth.getSession() checks JWT
   ├─ If valid → Fetch user role from profiles table
   ├─ If invalid → Redirect to login.html
   └─ Display user email in navbar
4. applyRolePermissions(role) → Adds CSS class to <body>
5. Logout → supabaseClient.auth.signOut() → Redirect login.html
```

### Database Operations
**Pattern**: Supabase `.from(table).select/insert/update/delete()`

**Example - Add Visit**:
```javascript
const { error } = await supabaseClient
  .from('historico')
  .insert({
    patient_id: selectedId,
    medico: doctor,
    data: data,
    numeroVisitas: numeroVisitas
  });

if (error) handleSupabaseError(error, 'INSERT historico');
else {
  showToast('Visita registrada com sucesso!');
  await fetchAllData();
}
```

### Google Fonts Integration (index.html, login.html)
```html
<link href="https://fonts.googleapis.com/css2?family=League+Spartan:wght@400;500;600;700&family=Merriweather:ital,wght@0,300;0,400;0,700;1,300;1,400&display=swap">
```
**Preconnect**: DNS-prefetch + preconnect directives for performance

---

## 10. TESTING & QUALITY ASSURANCE

### Current Testing Status
**Test Files**: None  
**Test Framework**: None  
**QA Approach**: Manual testing

### Recommended Testing Strategy (For Brownfield Improvement)
1. **Unit Tests**: Utility functions (date parsing, filtering, XSS escape)
2. **Integration Tests**: Auth flow, CRUD operations with mocked Supabase
3. **E2E Tests**: User workflows (login → register visit → export)
4. **Performance**: Load testing with concurrent users
5. **Security**: Penetration testing for RLS bypass attempts

---

## 11. DEPLOYMENT & HOSTING

### Vercel Deployment
**Flow**:
```
git push origin main
    ↓
Vercel webhook triggers
    ↓
Build: No build step (static site)
    ↓
Deploy: Files copied to CDN edge locations
    ↓
Live: ~30 seconds to production
```

**Configuration**: `vercel.json` (root redirect)  
**Domain**: Custom domain configured in Vercel dashboard  
**SSL**: Auto-provisioned (Let's Encrypt)

### Performance Optimizations
- **Static site**: No server processing overhead
- **CDN**: Vercel's global edge network
- **Caching**: HTTP headers optimized for static assets
- **Compression**: Gzip/Brotli by default

### Monitoring & Logs
- **Vercel Analytics**: Real User Monitoring (RUM)
- **Error Tracking**: Browser console logs
- **Database Logs**: Supabase dashboard (slow queries, RLS policy violations)

---

## 12. KEY ARCHITECTURAL DECISIONS

### 1. No Frameworks / No Bundlers
**Decision**: Vanilla JS + HTML + CSS (Zero dependencies except Supabase SDK)  
**Rationale**:
- Simplicity for lone developer
- Fast load times (no bundle overhead)
- Direct DOM manipulation = predictable behavior
- Lower hosting costs

**Trade-offs**:
- Manual state management (no Redux/Context)
- Larger script.js file (1520 lines)
- No built-in testing framework

### 2. Event Delegation on Document
**Decision**: Single `document.addEventListener('click')` handler  
**Pattern**: Routing via `data-action` attribute
```html
<button data-action="edit-patient">Edit</button>
```
```javascript
document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'edit-patient') { /* handle */ }
});
```
**Rationale**: Memory efficient; scales to 100+ interactive elements  
**Trade-offs**: Less granular event control; harder to debug (no handler per element)

### 3. Hardcoded Supabase Keys
**Decision**: Public keys embedded in `script.js`  
**Rationale**: Frontend-only SPA; no backend server to securely store keys  
**Security**: Protected by RLS policies (backend validates every query)  
**Alternative**: Would require Node.js backend (adds cost/complexity)

### 4. Dual-Layer Security (Frontend + RLS)
**Decision**: CSS role-based hiding + PostgreSQL policies  
**Why Two Layers**:
- Frontend = UX (hide buttons for managers)
- RLS = Data Protection (database enforces permissions)

### 5. CSV Export in Browser
**Decision**: No backend endpoint; JavaScript generates blob + downloads  
**Method**:
```javascript
const csv = "header1,header2\nval1,val2";
const blob = new Blob([csv], { type: 'text/csv' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'export.csv';
a.click();
```
**Rationale**: Stateless; works offline; privacy (file never sent to server)

### 6. Recalculation of Patient Dates
**Function**: `recalcPatientDates()` (line 264)  
**Purpose**: After each visit, update `diasEntre`, `status`, etc.  
**Why Necessary**: Derived fields not stored in DB; calculated on load

---

## 13. KNOWN ISSUES & TECHNICAL DEBT

### Known Problems (From README.md)
1. **Patient Name Variation**
   - Issue: Users type "Maria Silva" vs "Maria da Silva"
   - Impact: Duplicates in database
   - Mitigation: Autocomplete + "Quick Access" table reduces retyping

2. **Date Timezone Handling**
   - Issue: JavaScript `Date.toISOString()` converts to UTC; shifts date
   - Example: 21:00 in Brasília (UTC-3) → next day UTC
   - Solution: Manually construct YYYY-MM-DD from local `getFullYear()`, etc. (line 141)

### Technical Debt
1. **Large script.js File**
   - 1520 lines in single file
   - Suggested refactor: Modularize into separate files (auth.js, render.js, api.js)
   - Impact on change management: High risk; hard to isolate changes

2. **No Input Validation Framework**
   - Form validation = inline HTML5 + JavaScript checks
   - Missing: Centralized validation rules

3. **No Error Boundary**
   - If JS crashes, app goes blank
   - Suggested: Try/catch wrapper around init; fallback UI

4. **Hardcoded Constants**
   - Doctors, hospitals, internacao types = in script.js (lines 49-53)
   - Better: Fetch from database or config file

5. **No Caching Strategy**
   - Every action refetches all patients + historico
   - Better: Cache + invalidate on mutations

---

## 14. DATA FLOW MAPS

### Daily Registration Flow
```
User clicks "Registro" tab
    ↓
Screen 1 displays: Form + Previous Day's Patients
    ↓
User types patient name → autocomplete fires (setupAutocomplete)
    ↓
suggestions-box renders matching patients (filtered from this.patients)
    ↓
User clicks suggestion → selectedPatientId populated + form fields filled
    ↓
User selects hospital, internacao, date, visit count
    ↓
User clicks "Registrar Visita" → form submit event
    ↓
setupForm handler detects submit (line 506)
    ├─ Validates: selectedPatientId required
    ├─ Calls: isPatientActive() to check if reinternacao needed
    ├─ Calls: createPatientWithVisit() OR addVisitToExistingPatient()
    └─ isProcessing flag prevents double-click
    ↓
Supabase INSERT patients + historico (respects RLS)
    ↓
fetchAllData() reloads all data
    ↓
renderPrevDayTable() refreshes UI
    ↓
showToast("Sucesso!") feedback
    ↓
Form resets; ready for next entry
```

### Patient Card Flow (Ficha de Pacientes)
```
User clicks "Pacientes" tab
    ↓
setupFichaFilters() sets up event listeners on filters
    ↓
User changes search/filter → applies getFilteredPatients()
    ↓
getFilteredPatients() returns filtered array
    ↓
Render table rows for each patient
    ├─ Name, internacao, hospital, status, dates, days between visits
    └─ Action buttons: Edit, Delete, Report
    ↓
User clicks "Relatório" → Opens relatorio-modal
    ├─ CID-10 input
    ├─ Report textarea
    └─ Save/Delete/Generate buttons
    ↓
User clicks "Editar" → Opens edit-patient-modal
    ├─ Pre-filled with current data
    └─ Save/Cancel buttons
```

### Calendar View Flow
```
User clicks "Calendário" tab
    ↓
renderCalendar() renders dense grid
    ├─ One column per day (min-width: 180px)
    ├─ Header: date, day of week
    └─ Body: patient cards grouped by doctor
    ↓
Doctor badges by color:
    ├─ Beatriz: Blue (#3b82f6)
    ├─ Eduardo: Green (#10b981)
    ├─ Felipe: Purple (#8b5cf6)
    ├─ Igor: Orange (#f59e0b)
    └─ Tamires: Pink (#ec4899)
    ↓
User scrolls horizontally (overflow-x: auto)
    ↓
User clicks patient card → Opens edit-visit-modal
    ├─ Medico selector
    ├─ Visit count input
    └─ Save/Cancel buttons
    ↓
User clicks "Exportar CSV" → exportCSV() generates download
    ├─ Filters data by date range
    ├─ Formats columns: Date, Doctor, Patient, Visits, Hospital
    └─ Creates blob + triggers browser download
```

---

## 15. MAINTENANCE NOTES FOR FUTURE DEVELOPERS

### Code Style
- **Language**: Portuguese comments/variable names (for Dr. Igor)
- **ES6+**: Modern JS (async/await, arrow functions, destructuring)
- **No semicolons**: Semicolons omitted (ASIR style)
- **Indentation**: 2 spaces

### Critical Do's
- Always check RLS policies when adding new tables
- Use `esc()` for any HTML injection from database
- Test on mobile (bottom tab bar changes UX significantly)
- Never change doctor/hospital/internacao type constants without syncing database

### Critical Don'ts
- Don't remove `data-action` event delegation (core pattern)
- Don't add frameworks without explicit approval
- Don't hardcode dates without timezone handling
- Don't bypass RLS policies via direct SQL

### Common Tasks

**Add New Doctor**:
1. Add name to `DOCTORS` array (line 49)
2. Add `.cal-doctor.{firstname}` CSS class (styles.css)
3. Update database profiles table

**Add New Hospital**:
1. Add to `HOSPITALS` array (line 50)
2. Re-deploy

**Fix Patient Name Duplicate**:
1. Manually merge in Supabase dashboard
2. Update patient ID in historico records
3. Reload app

**Debug Event Handler Not Firing**:
1. Check `data-action` attribute on element
2. Verify attribute value matches switch case in event listener
3. Check if element is dynamically created (may need event delegation)

---

## 16. APPENDIX: FILE SIZES & PERFORMANCE

| File | Size | Lines | Load Impact |
|------|------|-------|-------------|
| script.js | ~57 KB | 1521 | Main bottleneck (no minification) |
| styles.css | ~28 KB | 903 | Inlined in HTML + external |
| index.html | ~12 KB | 368 | Structure only |
| login.html | ~2.5 KB | 85 | Minimal |
| login.js | ~2 KB | 65 | Minimal |

**Optimization Opportunities**:
1. Minify JavaScript (57 KB → ~18 KB)
2. Minify CSS (28 KB → ~10 KB)
3. Lazy-load Supabase SDK (only if needed)
4. Implement pagination for large patient lists

---

## 17. CONTACT & OWNERSHIP

**Project Owner**: Dr. Igor Campana  
**Developed by**: Claude Code (AI Assistant)  
**Last Updated**: 2026-04-08  
**Version**: 1.0 (Production)

**For Questions**: Refer to README.md or review code comments in script.js

---

**END OF BROWNFIELD MAPPING DOCUMENTATION**
