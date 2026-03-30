# Project Structure

**Root:** `/Users/igorcampana/projetos_programacao/AppHosp`

## Directory Tree

```
AppHosp/
├── .claude/              # Claude Code config
├── .git/                 # Git repository
├── .gitignore            # Ignora .DS_Store
├── .worktrees/           # Git worktrees auxiliares
├── .specs/               # Documentação brownfield fatiada por tema
│   └── codebase/
├── CLAUDE.md             # Instruções para Claude Code
├── BROWNFIELD_MAPPING.md # Mapeamento amplo do sistema
├── README.md             # Documentação do projeto
├── index.html            # SPA principal (3 telas + 4 modais)
├── login.html            # Página de login isolada
├── script.js             # Lógica completa da aplicação (1520 linhas)
├── login.js              # Lógica de autenticação (65 linhas)
├── styles.css            # Design system + responsivo (902 linhas)
├── manifest.json         # PWA metadata
├── robots.txt            # SEO (noindex login)
└── vercel.json           # Config deploy (redirect root → login)
```

## Module Organization

### Autenticação

**Purpose:** Login, sessão JWT, controle de acesso
**Location:** `login.html` + `login.js` (página isolada), `script.js` linhas 8-34 (verificação de sessão)
**Key files:**
- `login.html` — formulário email/password
- `login.js` — `signInWithPassword()`, redirect, error handling
- `script.js` — `getSession()`, `applyRolePermissions()`

### Aplicação Principal (SPA)

**Purpose:** Censo hospitalar — registro, fichas, calendário, relatórios
**Location:** `index.html` + `script.js`
**Key files:**
- `index.html` — toda a estrutura DOM (367 linhas)
- `script.js` — toda a lógica (1520 linhas)

### Design System

**Purpose:** Identidade visual, responsividade, componentes CSS
**Location:** `styles.css`
**Key files:**
- `styles.css` — variáveis, componentes, mobile breakpoint (902 linhas)

### Brownfield Docs

**Purpose:** Acelerar onboarding, manutenção e análise de risco
**Location:** `BROWNFIELD_MAPPING.md` + `.specs/codebase/`
**Key files:**
- `BROWNFIELD_MAPPING.md` — visão ampla do sistema
- `.specs/codebase/README.md` — índice dos documentos
- `.specs/codebase/CONCERNS.md` — dívidas, riscos e fragilidades

### Deploy & Config

**Purpose:** Hosting, PWA, SEO
**Location:** Raiz do projeto
**Key files:**
- `vercel.json` — redirect root → login
- `manifest.json` — PWA standalone, tema #20515F
- `robots.txt` — noindex

## Where Things Live

**Autenticação:**
- UI: `login.html`
- Lógica: `login.js`
- Verificação de sessão: `script.js` (topo)

**Loader de inicialização:**
- UI: `index.html` → `#app-loader`
- Lógica: `script.js` → hide após o primeiro carregamento dos dados

**Registro de Visitas:**
- UI: `index.html` → `#screen-registro`
- Lógica: `script.js` → `setupForm()`, `createPatientWithVisit()`, `addVisitToExistingPatient()`

**Fichas de Pacientes:**
- UI: `index.html` → `#screen-ficha`
- Lógica: `script.js` → `setupFichaFilters()`, `getFilteredPatients()`, `renderPatientsTable()`

**Calendário:**
- UI: `index.html` → `#screen-calendario`
- Lógica: `script.js` → `renderCalendar()`, `exportCalendarCSV()`

**Relatórios:**
- UI: `index.html` → `#relatorio-modal`
- Lógica: `script.js` → handlers no event delegation

**Exportação CSV:**
- Lógica: `script.js` → `exportCSV()`

**Modais (edição):**
- UI: `index.html` → `#relatorio-modal`, `#edit-patient-modal`, `#edit-visit-modal`, `#confirm-modal`
- Lógica: `script.js` → handlers centralizados + `showConfirm()` para confirmações globais
