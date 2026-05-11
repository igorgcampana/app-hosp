# AppHosp - Guia de Desenvolvimento

Este documento serve como referência rápida para o desenvolvimento e manutenção do Censo Hospitalar do Dr. Igor Campana.

## Identidade Visual (Design System)
OBRIGATÓRIO seguir estritamente:
- **Cor Primária:** `#20515F` (Destaques, Cabeçalhos, Ações)
- **Cor Secundária:** `#DDD0C6` (Cards, Elementos de apoio)
- **Fundo:** `#E5EBEA` (Superfícies claras)
- **Texto:** `#737271`
- **Tipografia:**
    - Títulos: *League Spartan*
    - Corpo/Dados: *Merriweather*

## Comandos Úteis
- O projeto não utiliza bundlers (Vite/Webpack). É HTML/JS puro.
- Deploy: `git push origin main` (Gera deploy automático na Vercel).

## Arquitetura de Dados (Supabase)
### Tabela `patients`
- `id` (uuid, primary key)
- `pacientenome` (text)
- `hospital` (text: 'HVNS', 'HSL', 'H9J', 'Outro')
- `internacao` (text: 'Particular', 'Retaguarda')
- `statusmanual` (text: 'Internado', 'Alta')
- `dataprimeiraavaliacao` (date)
- `dataultimavisita` (date)
- `dataalta` (date, nullable — set when `statusmanual='Alta'`, null when Internado)

### Tabela `historico`
- `id` (int8, primary key)
- `patient_id` (uuid, references patients.id)
- `data` (date)
- `medico` (text: 'Beatriz', 'Eduardo', 'Felipe Reinaldo', 'Igor', 'Tamires')
- `visitas` (int4)

### Tabela `profiles`
- `id` (uuid, references auth.users)
- `role` (text: 'doctor', 'manager')

## Regras de Negócio Críticas
1. **Reinternações:** Se um paciente recebe alta e depois reinterna, DEVE ser criado um novo registro na tabela `patients`. Não reaproveite IDs de pacientes com alta para fins de faturamento.
2. **Controle de Acesso (RBAC):** 
    - Médicos (`doctor`): Acesso total.
    - Gestores (`manager`): Acesso apenas leitura (hiding via CSS `.role-manager` e lógica JS).
3. **Visibilidade:** O `body` começa com `visibility: hidden` e só é exibido após a verificação de sessão no `script.js`.
4. **Tabela de Atalho:** No registro diário, exibe pacientes visitados nos últimos 5 dias (em relação à data selecionada) que não estejam em alta.

## UX/UI Mobile (Bottom Tab Bar)
- **Área de Toque:** Mínimo de 44x44px. A bottom nav usa `64px` de altura fixa.
- **Estrutura:** Ícone SVG (`tab-icon`) acima de um label texto (`tab-label`).
- **Estados:** Ativo usa `--color-secondary` com opacidade total; Inativo usa opacidade de `0.65`.
- **Cabeçalho:** O botão "Sair" deve ser discreto (apenas texto/borda fina) para não deslocar o título `AppHosp`.

## Padrões de Código
- **Vanilla JS:** Evite frameworks. Mantenha a lógica centralizada no `script.js`.
- **Deduplicação:** Pacientes são deduplicados pelo nome apenas na exibição do `select` para evitar poluição visual.
- **Responsividade:** Use `@media (max-width: 768px)` para transformações em cards mobile.
