# Architecture

**Pattern:** SPA estática client-side com BaaS (Backend-as-a-Service)

## High-Level Structure

```
┌─────────────────────────────────────────┐
│  Browser (SPA)                          │
│  ┌───────────┐  ┌──────────────────┐   │
│  │ login.html│  │ index.html (SPA) │   │
│  │ login.js  │  │ script.js        │   │
│  └─────┬─────┘  │ repasse.js       │   │
│        │        │ conciliacao.js   │   │
│        │        └────────┬─────────┘   │
│        │                 │              │
│        │        ┌──────────────────┐   │
│        └────────│ ambulatorio.html │   │
│                 │ ambulatorio.js   │   │
│                 └────────┬─────────┘   │
│                          │ Supabase    │
│                          │ Client SDK  │
└─────────────────┼───────────────────────┘
                  │ HTTPS
┌─────────────────┼───────────────────────┐
│  Supabase       │                       │
│  ┌──────────────┴────────────────────┐  │
│  │ Auth (JWT)                        │  │
│  │ PostgreSQL (patients, historico,  │  │
│  │ profiles, relatorios, repasse_*)  │  │
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
**Purpose:** Alternar entre as telas do núcleo sem recarregar a página
**Implementation:** Botões com `data-target="screen-*"` controlam visibilidade via classe `.active`. Apenas uma screen visível por vez.
**Example:** `data-target="screen-registro"` → mostra seção de registro diário

### Dual-Layer RBAC

**Location:** `styles.css` (CSS hiding) + Supabase RLS policies
**Purpose:** Controle de acesso por role no núcleo atual
**Implementation:**
  - **Frontend (UX):** Classes de role no `<body>` escondem ou removem áreas conforme `admin`, `doctor` e `manager`
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
  → body.classList.add('role-admin' | 'role-doctor' | 'role-manager')
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

**Approach:** Núcleo ainda centralizado em `script.js`, com extração parcial para módulos dedicados

**Structure:**
- `login.html` + `login.js` — autenticação isolada
- `index.html` — estrutura DOM do núcleo
- `script.js` — lógica principal do censo
- `repasse.js` — cálculo financeiro e geração de PDFs
- `conciliacao.js` — reconciliação de faturamento
- `ambulatorio.html` + `ambulatorio.js` — módulo standalone completo (655 + 608 linhas)
- `styles.css` — design system + responsivo (902 linhas)

**Module boundaries:** O projeto está em transição de um monolito para um núcleo com módulos por domínio:
1. Inicialização (auth, DOM caching, state)
2. Utilidades (escape, toast, dates)
3. Data fetching
4. CRUD operations
5. UI rendering (tabelas, calendário, modais)
6. Event delegation (router central de ações)
7. Exportação CSV
8. Repasse (`repasse.js`)
9. Conciliação (`conciliacao.js`)
10. Ambulatório (`ambulatorio.js` — módulo standalone completo com CRUD, configuração financeira, filtros e resumo mensal)
