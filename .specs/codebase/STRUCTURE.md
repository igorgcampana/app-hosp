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
│   ├── codebase/
│   ├── features/
│   └── project/
├── CLAUDE.md             # Instruções para Claude Code
├── BROWNFIELD_MAPPING.md # Mapeamento amplo do sistema
├── README.md             # Documentação do projeto
├── index.html            # SPA principal do núcleo operacional
├── login.html            # Página de login isolada
├── script.js             # Núcleo do censo hospitalar
├── repasse.js            # Módulo de repasse mensal
├── conciliacao.js        # Módulo de conciliação de faturamento
├── ambulatorio.html      # Entrada standalone do ambulatório
├── ambulatorio.js        # Bootstrap atual do ambulatório
├── login.js              # Lógica de autenticação (65 linhas)
├── styles.css            # Design system + responsivo (902 linhas)
├── docs/                 # Planos operacionais e fluxogramas
├── scripts/              # SQL e scripts auxiliares
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

**Purpose:** Núcleo operacional do produto
**Location:** `index.html` + `script.js` + módulos acoplados
**Key files:**
- `index.html` — estrutura DOM do núcleo
- `script.js` — autenticação em runtime, registro, fichas, calendário, relatórios
- `repasse.js` — fechamento mensal e PDFs
- `conciliacao.js` — conciliação com PDF + Gemini + Excel

### Ambulatório

**Purpose:** Módulo standalone completo para registro e gestão financeira de consultas ambulatoriais
**Location:** `ambulatorio.html` + `ambulatorio.js`
**Key files:**
- `ambulatorio.html` — UI completa: formulário, painel de configuração financeira, histórico com filtros, resumo mensal, modal de exclusão (655 linhas)
- `ambulatorio.js` — auth guard, RBAC (admin/manager/doctor), CRUD em `consultas_ambulatoriais`, `calcConsulta()` helper financeiro, `loadConsultas()`, `renderHistorico()`, filtros, persistência de config (608 linhas)

### Design System

**Purpose:** Identidade visual, responsividade, componentes CSS
**Location:** `styles.css`
**Key files:**
- `styles.css` — variáveis, componentes, mobile breakpoint (902 linhas)

### Brownfield Docs

**Purpose:** Acelerar onboarding, manutenção e análise de risco
**Location:** `BROWNFIELD_MAPPING.md` + `.specs/codebase/` + `.specs/project/` + `docs/`
**Key files:**
- `BROWNFIELD_MAPPING.md` — visão ampla do sistema
- `.specs/codebase/README.md` — índice dos documentos
- `.specs/codebase/CONCERNS.md` — dívidas, riscos e fragilidades
- `.specs/project/PROJECT.md` — visão executiva de produto e roadmap
- `.specs/project/STATE.md` — estado corrente e próxima ação
- `docs/fluxograma-funcionamento-apphosp.md` — mapa atual/parcial/planejado

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

**Repasse:**
- UI: `index.html` → `#screen-repasse`
- Lógica: `repasse.js`

**Conciliação:**
- UI: `index.html` → `#screen-conciliacao`
- Lógica: `conciliacao.js`

**Ambulatório:**
- UI: `ambulatorio.html` (acessado via link no header do censo, visível para admin)
- Lógica: `ambulatorio.js` (CRUD, cálculo financeiro, filtros, resumo)

**Relatórios:**
- UI: `index.html` → `#relatorio-modal`
- Lógica: `script.js` → handlers no event delegation

**Exportação CSV:**
- Lógica: `script.js` → `exportCSV()`

**Modais (edição):**
- UI: `index.html` → `#relatorio-modal`, `#edit-patient-modal`, `#edit-visit-modal`, `#confirm-modal`
- Lógica: `script.js` → handlers centralizados + `showConfirm()` para confirmações globais
