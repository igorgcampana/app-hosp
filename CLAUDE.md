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
- `role` (text: 'admin', 'doctor', 'manager')
- `doctor_name` (text — nome do médico, usado pelo módulo Ambulatório)

### Tabela `relatorios`
- Relatório textual de internação (CID-10 + texto), associado a `patient_id`. Usado no fluxo de alta.

### Tabelas de Repasse (faturamento mensal — somente `admin`)
- `repasse_config` (id=1): percentuais (impostos, administração, Samira), `descontos_sala`, dados dos médicos (`nome_completo`, `crm`).
- `repasse_fatura`: `mes`, `ano`, `valor_total_recebido`.
- `repasse_paciente`: linha por paciente do mês (`fatura_id`, `patient_id`, `status_pagamento`, `valor_visita`, `desconto_paciente`, `valor_recebido`, `valor_previsto`, `incluido`).

### Tabelas de Ambulatório (consultório — somente `admin`)
- `consultas_ambulatoriais`: consultas com rateio médico/Samira, impostos e `status_pagamento`.
- `ambulatorio_config` (id=1): percentuais de imposto e administração.

## Regras de Negócio Críticas
1. **Reinternações:** Se um paciente recebe alta e depois reinterna, DEVE ser criado um novo registro na tabela `patients`. Não reaproveite IDs de pacientes com alta para fins de faturamento.
2. **Controle de Acesso (RBAC):** 
    - **Admin (`admin`):** Acesso total — único papel que vê Repasse, Conciliação e o módulo Ambulatório.
    - **Médicos (`doctor`):** Escrita no censo (Registro, Pacientes, Calendário). NÃO vê Repasse/Conciliação/Ambulatório.
    - **Gestores (`manager`):** Apenas leitura; perde até a aba Registro e cai em Pacientes (hiding via CSS `.role-manager` + lógica JS — ver `applyRolePermissions` em `script.js`).
3. **Visibilidade:** O `body` começa com `visibility: hidden` e só é exibido após a verificação de sessão no `script.js`.
4. **Tabela de Atalho:** No registro diário, exibe pacientes visitados nos últimos 5 dias (em relação à data selecionada) que não estejam em alta.
5. **Contagem de visitas (ATENÇÃO — coexistem 3 regras conforme a tela):**
    - Relatório de alta: conta **1 visita por dia distinto** (`new Set(historico.data)`).
    - Calendário e rateio por médico no Repasse: contam as **visitas reais** de `historico.visitas`.
    - "Valor esperado" do Repasse e a Conciliação: contam **1 por dia de internação** (dias decorridos + 1).
    Ao mexer em qualquer uma, verifique as outras para não divergir números.

## Módulos & Navegação
O app é uma SPA (`index.html`) com **bottom tab bar de 5 abas** + páginas satélite. Entrada por `login.html`; `ambulatorio.html` é página separada (link só para `admin`).

- **Censo** (abas Registro / Pacientes / Calendário) — núcleo: registro diário de visitas, ficha de pacientes, status Internado↔Alta, calendário e exportação CSV. Tabelas `patients`, `historico`, `relatorios`.
- **Repasse** (aba, **admin**) — fechamento mensal: rateio por médico a partir de `historico.visitas`, configuração de percentuais/descontos, PDFs geral e por médico (jsPDF). Tabelas `repasse_*`. Lógica em `repasse.js`.
- **Conciliação** (aba, **admin**) — confronta o PDF "Analítico de Repasse" (extraído via **Edge Function + Gemini**) contra o censo de **HSL**; classifica glosas/pagamentos a maior e exporta Excel. Lógica em `conciliacao.js` + `supabase/functions/processa-conciliacao`.
- **Ambulatório** (página `ambulatorio.html`, **admin**) — financeiro do consultório: rateio médico/Samira por consulta. Tabelas `consultas_ambulatoriais`, `ambulatorio_config`. Alimenta uma seção do Repasse. Lógica em `ambulatorio.js`.

## UX/UI Mobile (Bottom Tab Bar)
- **Área de Toque:** Mínimo de 44x44px. A bottom nav usa `64px` de altura fixa.
- **Estrutura:** Ícone SVG (`tab-icon`) acima de um label texto (`tab-label`).
- **Estados:** Ativo usa `--color-secondary` com opacidade total; Inativo usa opacidade de `0.65`.
- **Cabeçalho:** O botão "Sair" deve ser discreto (apenas texto/borda fina) para não deslocar o título `AppHosp`.

## Padrões de Código
- **Vanilla JS:** Evite frameworks. Mantenha a lógica centralizada no `script.js`.
- **Deduplicação:** Pacientes são deduplicados pelo nome apenas na exibição do `select` para evitar poluição visual.
- **Responsividade:** Use `@media (max-width: 768px)` para transformações em cards mobile.
