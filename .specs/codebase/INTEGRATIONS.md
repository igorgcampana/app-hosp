# External Integrations

## Supabase (BaaS)

**Service:** Supabase (PostgreSQL + Auth + Realtime)
**Purpose:** Backend completo — database, autenticação, autorização via RLS
**Implementation:** Client SDK carregado via CDN, chamadas diretas do browser
**Configuration:** Chaves hardcoded no `script.js` (linhas 1-2)
```
SUPABASE_URL = 'https://gbcnmuppylwznhrticfv.supabase.co'
SUPABASE_ANON_KEY = 'eyJhbGc...' (chave pública anon — segura para frontend)
```
**Authentication:** Email/password via `supabase.auth.signInWithPassword()`

### Tabelas Utilizadas

| Tabela | Operações | RLS |
|--------|-----------|-----|
| `patients` | SELECT, INSERT, UPDATE, DELETE | doctor: full; manager: SELECT only |
| `historico` | SELECT, INSERT, UPDATE, DELETE | doctor: full; manager: SELECT only |
| `profiles` | SELECT | Todos autenticados |
| `ambulatorio_config` | SELECT, UPDATE | leitura autenticada; escrita `admin`/`manager` |
| `consultas_ambulatoriais` | SELECT, INSERT, UPDATE, DELETE | `admin`/`manager`: controle total; `doctor`: consultas conjuntas proprias |
| `repasse_fatura` | SELECT, INSERT, UPDATE, DELETE | `admin`/`manager` |
| `repasse_paciente` | SELECT, INSERT, UPDATE, DELETE | `admin`/`manager` |

### Endpoints Supabase Consumidos

- `supabaseClient.auth.signInWithPassword()` — login
- `supabaseClient.auth.getSession()` — verificar sessão
- `supabaseClient.auth.signOut()` — logout
- `supabaseClient.from('patients').select('*')` — listar pacientes
- `supabaseClient.from('patients').insert()` — criar paciente
- `supabaseClient.from('patients').update().eq('id', id)` — atualizar paciente
- `supabaseClient.from('patients').delete().eq('id', id)` — remover paciente
- `supabaseClient.from('historico').select('*')` — listar histórico
- `supabaseClient.from('historico').insert()` — registrar visita
- `supabaseClient.from('historico').update().eq('id', id)` — editar visita
- `supabaseClient.from('historico').delete().eq('id', id)` — remover visita
- `supabaseClient.from('profiles').select('role').eq('id', userId)` — buscar role
- `supabaseClient.from('ambulatorio_config').select('*').single()` — carregar configuração financeira do ambulatório
- `supabaseClient.from('ambulatorio_config').update()` — salvar percentuais do ambulatório
- `supabaseClient.from('consultas_ambulatoriais').select('*')` — listar histórico do ambulatório
- `supabaseClient.from('consultas_ambulatoriais').insert()` — registrar consulta ambulatorial
- `supabaseClient.from('consultas_ambulatoriais').update().eq('id', id)` — editar consulta ambulatorial
- `supabaseClient.from('consultas_ambulatoriais').delete().eq('id', id)` — excluir consulta ambulatorial

### Operação de Go-Live

Durante o fechamento do go-live do ambulatório em 2026-04-08, houve leitura segura com `service_role` apenas para auditoria operacional e export local de evidências.

**Artefatos gerados:**
- `backups/ambulatorio-go-live-2026-04-08/ambulatorio_config.json`
- `backups/ambulatorio-go-live-2026-04-08/consultas_ambulatoriais.json`
- `backups/ambulatorio-go-live-2026-04-08/profiles_ambulatorio_roles.json`

## Supabase SDK (CDN)

**Service:** jsDelivr CDN
**Purpose:** Distribuição do Supabase JS SDK
**Implementation:** Tag `<script>` no HTML
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
```
**Versioning:** major `@2` fixado na URL do CDN

## Google Fonts

**Service:** Google Fonts CDN
**Purpose:** Tipografia do design system
**Implementation:** `<link>` no `<head>` de `index.html` e `login.html`
**Fonts:**
- League Spartan (wght 400-700) — títulos
- Merriweather (wght 300-700, italic) — corpo

**Performance:** Preconnect + dns-prefetch configurados
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

## Vercel (Hosting)

**Service:** Vercel
**Purpose:** Hosting estático + CI/CD automático
**Implementation:** Deploy automático via webhook no `git push origin main`
**Configuration:** `vercel.json` — redirect root → `login.html`
**SSL:** Auto-provisioned (Let's Encrypt)
**CDN:** Edge network global

## Webhooks

Não há webhooks customizados no repositório. O deploy automático ocorre pela integração padrão do Git com a Vercel.

## Background Jobs

Nenhum job em background. Todas as operações são síncronas client-side.
