# Architecture

**Pattern:** SPA estática client-side com BaaS (Backend-as-a-Service)

## High-Level Structure

```
┌─────────────────────────────────────────┐
│  Browser (SPA)                          │
│  ┌───────────┐  ┌──────────────────┐   │
│  │ login.html│  │ index.html (SPA) │   │
│  │ login.js  │  │ script.js        │   │
│  └─────┬─────┘  └────────┬─────────┘   │
│        │                 │              │
│        └────────┬────────┘              │
│                 │ Supabase Client SDK   │
└─────────────────┼───────────────────────┘
                  │ HTTPS
┌─────────────────┼───────────────────────┐
│  Supabase       │                       │
│  ┌──────────────┴────────────────────┐  │
│  │ Auth (JWT)                        │  │
│  │ PostgreSQL (patients, historico,  │  │
│  │              profiles)            │  │
│  │ RLS Policies (RBAC enforcement)   │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

## Identified Patterns

### Event Delegation

**Location:** `script.js` (linhas 1300+)
**Purpose:** Roteamento centralizado de ações do usuário
**Implementation:** Um único `document.addEventListener('click')` usa `data-action` nos elementos HTML para despachar handlers via `switch/case`.
**Example:** `<button data-action="edit-patient">` → handler `editPatient()`

### Screen-Based SPA Navigation

**Location:** `index.html` (nav buttons) + `script.js` (toggle)
**Purpose:** Alternar entre 3 telas sem recarregar a página
**Implementation:** Botões com `data-target="screen-*"` controlam visibilidade via classe `.active`. Apenas uma screen visível por vez.
**Example:** `data-target="screen-registro"` → mostra seção de registro diário

### Dual-Layer RBAC

**Location:** `styles.css` (CSS hiding) + Supabase RLS policies
**Purpose:** Controle de acesso doctor vs manager
**Implementation:**
  - **Frontend (UX):** Classe `role-manager` no `<body>` esconde botões de edição via CSS `display: none !important`
  - **Backend (segurança):** Policies RLS bloqueiam INSERT/UPDATE/DELETE para role `manager`
**Example:** `body.role-manager [data-action="edit-patient"] { display: none !important; }`

### Fetch-All-Then-Filter

**Location:** `script.js` — `fetchAllData()` (linhas 315-347)
**Purpose:** Carregar todos os dados de uma vez e filtrar no client-side
**Implementation:** `fetchAllData()` carrega **todos** patients e historico do Supabase. Filtros e ordenação aplicados em memória via JS.
**Example:** `getFilteredPatients()` filtra o array `patients[]` localmente

## Data Flow

### Authentication Flow

```
login.html → signInWithPassword() → JWT → redirect index.html
  → getSession() → profiles.select(role) → applyRolePermissions()
  → body.classList.add('role-doctor' | 'role-manager')
  → document.body.style.visibility = 'visible'
```

### CRUD Flow (Registro de Visita)

```
Formulário preenchido → submit event
  → Validação (nome, hospital, data)
  → selectedPatientId existe?
    SIM → addVisitToExistingPatient() → INSERT historico
    NÃO → createPatientWithVisit() → INSERT patients + INSERT historico
  → fetchAllData() → re-render tabelas
  → showToast("Sucesso!")
```

### Calendar/Export Flow

```
Seleção de período → renderCalendar()
  → Itera patients + historico por data
  → Renderiza grid horizontal (1 coluna = 1 dia)
  → Badges coloridos por médico
  → Exportar CSV → Blob gerado no browser → download
```

## Code Organization

**Approach:** Monolito single-file (não modular)

**Structure:**
- `login.html` + `login.js` — autenticação isolada
- `index.html` — toda a estrutura DOM (3 screens + 4 modals)
- `script.js` — toda a lógica da aplicação (1520 linhas)
- `styles.css` — design system + responsivo (902 linhas)

**Module boundaries:** Não há módulos formais. O `script.js` é organizado por seções:
1. Inicialização (auth, DOM caching, state)
2. Utilidades (escape, toast, dates)
3. Data fetching
4. CRUD operations
5. UI rendering (tabelas, calendário, modais)
6. Event delegation (router central de ações)
7. Exportação CSV
