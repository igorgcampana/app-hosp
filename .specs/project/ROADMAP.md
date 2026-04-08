# ROADMAP — AppHosp v2

**Última atualização:** 2026-04-08

---

## Estratégia

Evolução incremental. Cada fase entrega valor isolado. Se precisar pausar, nada quebra.
Prioridade: features independentes primeiro, dependências externas depois.

---

## Fase 1 — Consultas Ambulatoriais
*UI completa deployada · Pendente: integração repasse + go-live*

Módulo standalone para registro de consultas ambulatoriais com cálculo automático de divisão financeira entre médico e Samira.

**Lógica financeira (implementada):**
- Consulta conjunta: Médico recebe R$600 (fixo), Samira recebe (total - 600)
- Ambos pagam imposto (% editável em `ambulatorio_config`)
- Só médico paga % administração (editável)
- Consulta só Samira: Samira recebe 100%, paga só imposto

**Status atual:**
- ✅ T00–T21 concluídos (banco, RLS, UI completa, CRUD, filtros, resumo mensal)
- ✅ Deployado em produção — `ambulatorio.html` standalone
- ✅ Acessível via link no header do censo (admin-only por ora)
- ⏳ T22–T24: integração com repasse mensal
- ⏳ T25–T27: go-live com médicos reais e checklist de produção

---

## Fase 2 — Cobrança de Particulares
*Independente da Fase 1*

Controle de cobranças a pacientes particulares (pagam diretamente à equipe, não via convênio). Secretária gerencia, chefe define valores caso a caso.

**Fluxo:**
1. Paciente particular recebe alta
2. Chefe (Samira) define valor da cobrança
3. Secretária cobra o paciente
4. Rastreamento de status: pendente → pago / parcial / inadimplente

**Escopo:** Nova tabela `cobrancas` + tela para secretária + status de pagamento + histórico.

**Pré-requisitos:** Nenhum (valores definidos manualmente, sem tabela de preços fixa).

---

## Fase 3 — Vila Nova na Conciliação
*Aguardando pré-requisito*

Expandir a conciliação de faturamento (hoje só Sírio/retaguarda) para incluir Hospital Vila Nova.

**Escopo:** Novo parser para formato do Vila Nova + ajustes na UI de conciliação.

**Pré-requisito:** Igor obter o formato do arquivo de faturamento do Vila Nova.

**Status:** ⏸️ Aguardando formato.

---

## Fase 4+ — WhatsApp + Automações
*Deferido*

Infraestrutura de comunicação via WhatsApp para:
- Cobrar médicos sobre relatórios pendentes
- Avisar pacientes sobre internação particular
- Enviar cobranças automaticamente
- Lista diária de pendências para secretária

**Pré-requisitos:**
- Número comercial WhatsApp
- Escolha da API (Evolution API ou Z-API)
- Templates de mensagem aprovados

**Status:** ⏸️ Aguardando decisões de infraestrutura.

---

## Removido Permanentemente do Plano

| Item | Motivo |
|------|--------|
| Tabela `medicos` | Desnecessária — dados de médicos já estão no `repasse_config` e no código |
| Tabela `tabela_precos` | Valores de cobrança particular são definidos caso a caso pela chefe |
| Campo `data_alta` em patients | Redundante — alta = última visita |
| Dashboards financeiros (Fase 6 original) | Futuro distante, sem prioridade |

---

## Decisões Pendentes

| # | Decisão | Impacta | Status |
|---|---------|---------|--------|
| 1 | API WhatsApp (Evolution vs Z-API) | Fase 4 | A definir |
| 2 | Número comercial WhatsApp | Fase 4 | A providenciar |
| 3 | Formato arquivo Vila Nova | Fase 3 | Igor vai pedir |
| 4 | Templates de mensagem WhatsApp | Fase 4 | A aprovar |
| 5 | Quem recebe lista diária (1 secretária ou mais?) | Fase 4 | A definir |

## Decisões Fechadas Recentes

| # | Decisão | Impacta |
|---|---------|---------|
| 1 | `manager` cadastra e edita todas as consultas do ambulatório | Fase 1 |
| 2 | `doctor` cadastra/edita apenas consultas conjuntas nas quais ele é o médico responsável | Fase 1 |
| 3 | Status iniciais do ambulatório: `pendente`, `pago`, `parcial` | Fase 1 |
| 4 | `valor_recebido` será campo único por consulta | Fase 1 |
| 5 | Em consulta conjunta, o médico sempre recebe `R$ 600,00` bruto | Fase 1 |
| 6 | Percentuais do ambulatório nascem editáveis; não precisam valor final no planejamento | Fase 1 |
| 7 | Role `admin` existe e deve concentrar o acesso inicial a novas funcionalidades | Fase 1 |
