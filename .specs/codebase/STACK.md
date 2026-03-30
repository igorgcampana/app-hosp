# Tech Stack

**Analyzed:** 2026-03-29

## Core

- Framework: Nenhum (Vanilla JS puro)
- Language: JavaScript ES6+ (async/await, destructuring, arrow functions)
- Runtime: Browser (sem server-side)
- Package manager: Nenhum (sem node_modules, sem bundlers)
- Build tool: Nenhum (HTML/CSS/JS estáticos servidos diretamente)

## Frontend

- UI Framework: Nenhum — DOM manipulation manual
- Styling: CSS3 puro com CSS Custom Properties (design system completo)
- State Management: Variáveis globais no `script.js` (`patients[]`, `relatoriosSet`, `currentSort`)
- Form Handling: HTML5 validation nativa + validação JS inline

## Backend (BaaS)

- API Style: Supabase Client SDK v2 (REST under the hood)
- Database: PostgreSQL (Supabase hosted)
- Authentication: Supabase Auth (email/password + JWT)
- Authorization: Row-Level Security (RLS) policies no PostgreSQL

## Testing

- Unit: Nenhum
- Integration: Nenhum
- E2E: Nenhum
- Coverage: Nenhum
- QA: Testes manuais

## External Services

- BaaS/Database: Supabase (PostgreSQL + Auth + RLS)
- CDN (SDK): jsDelivr (`@supabase/supabase-js@2`)
- Fonts: Google Fonts (League Spartan + Merriweather)
- Hosting: Vercel (auto-deploy via git push)

## Development Tools

- Version Control: Git
- Deploy: Vercel CI/CD (webhook no push → deploy automático ~30s)
- Editor: Sem configuração específica (.editorconfig ausente)
