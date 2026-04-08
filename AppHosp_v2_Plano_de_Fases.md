# AppHosp v2.0 — Plano de Evolucao em Fases

**Sistema de Gestao, Cobranca e Comunicacao Hospitalar**
Dr. Igor Campana | Abril 2026

---

Este documento detalha o plano de evolucao do AppHosp, partindo da infraestrutura atual (censo + repasse + conciliacao) e expandindo para automacao de cobranca, comunicacao com pacientes e medicos via WhatsApp, e gestao de consultas ambulatoriais.

A estrategia eh incremental: cada fase entrega valor imediato e serve de base para a proxima. Priorizamos a infraestrutura de dados primeiro, depois automacao, e por fim comunicacao externa.

---

## Visao Geral das Fases

| Fase | Nome | Foco Principal | Timeline |
|------|------|----------------|----------|
| 1 | Infraestrutura de Dados | Schema + tabela de precos + contatos | Semana 1 |
| 2 | Gestao de Cobrancas | Status pagamento + painel secretaria | Semana 2 |
| 3 | WhatsApp Bot (Base) | API + envio de msgs + templates | Semanas 3-4 |
| 4 | Automacoes de Cobranca | Triggers 48h alta + 24h medico | Semana 5 |
| 5 | Consultas Ambulatoriais | Nova tabela + interface + valores | Semana 6 |
| 6 | Refinamento + Escala | Vila Nova + dashboards + metricas | Semanas 7-8 |

**Premissas:** Supabase configurado, deploy automatico na Vercel, app rodando com 5 abas (Registro, Pacientes, Calendario, Repasse, Conciliacao). API WhatsApp nao-oficial (Evolution API ou Z-API). Numero comercial a providenciar.

---

## FASE 1 — Infraestrutura de Dados
*Semana 1 — Fundacao para tudo que vem depois*

Esta fase nao tem interface nova visivel, mas eh a base critica. Sem ela, nenhuma automacao funciona. Mexemos apenas no Supabase e preparamos o terreno.

### O que muda no banco de dados

| # | Tarefa | Esforco | Depende de |
|---|--------|---------|------------|
| 1 | Adicionar campo `telefone` na tabela patients | 10 min | - |
| 2 | Adicionar campo `email` na tabela patients | 10 min | - |
| 3 | Criar tabela `tabela_precos` (hospital, tipo_internacao, valor_visita, vigencia) | 30 min | - |
| 4 | Criar tabela `medicos` (nome, telefone, email, pct_repasse, chefe_id) | 30 min | - |
| 5 | Criar tabela `cobrancas` (patient_id, tipo, valor_total, status, data_envio, data_pagamento) | 45 min | 3, 4 |
| 6 | Criar tabela `mensagens_log` (destinatario, canal, template, status, erro, created_at) | 30 min | - |
| 7 | Adicionar campo `data_alta` na tabela patients | 10 min | - |
| 8 | Criar RLS policies para novas tabelas | 45 min | 3-6 |

### Schema: tabela_precos

Essa tabela resolve o problema de valor variavel por visita. Cada hospital/tipo de internacao tem seu preco, com vigencia para historico.

| Campo | Tipo | Exemplo | Descricao |
|-------|------|---------|-----------|
| id | uuid | auto | PK |
| hospital | text | HVNS | HVNS, HSL, H9J |
| tipo_internacao | text | Particular | Particular, Retaguarda |
| valor_visita | numeric | 350.00 | Valor em reais |
| vigencia_inicio | date | 2026-01-01 | Inicio da vigencia |
| vigencia_fim | date | null | Null = vigente |

### Schema: medicos

Centraliza dados dos medicos da equipe. O campo `chefe_id` permite modelar a relacao de consulta conjunta (Igor -> Samira, Tamires -> Samira). Se `chefe_id` eh null, o medico eh o proprio chefe (Samira).

| Campo | Tipo | Exemplo | Descricao |
|-------|------|---------|-----------|
| id | uuid | auto | PK |
| nome | text | Igor | Nome do medico |
| telefone | text | 5527999... | WhatsApp |
| email | text | igor@... | Email |
| pct_repasse | numeric | 50.00 | % do repasse |
| chefe_id | uuid | null | Referencia ao chefe (null = eh chefe) |

### Entregaveis da Fase 1

- Migrations SQL aplicadas no Supabase
- Tabela de precos populada com valores atuais de cada hospital
- Campo telefone/email adicionado e visivel no formulario de pacientes
- Tabela medicos populada (Beatriz, Eduardo, Felipe Reinaldo, Igor, Tamires, Samira)

---

## FASE 2 — Gestao de Cobrancas + Painel Secretaria
*Semana 2 — Primeira interface nova*

Aqui nasce o controle financeiro visivel. A secretaria ganha um painel dedicado com lista diaria de cobrancas pendentes, e o sistema passa a rastrear o ciclo de vida de cada cobranca.

### Fluxo de cobranca

1. Paciente recebe alta -> status muda para "Alta" -> sistema registra `data_alta`
2. Sistema calcula valor total (qtd visitas x valor_visita da `tabela_precos`)
3. Cobranca eh criada com status "pendente" na tabela `cobrancas`
4. Secretaria visualiza no painel e cobra o paciente
5. Secretaria marca como "pago", "parcial" ou "inadimplente"

### Tarefas

| # | Tarefa | Esforco | Depende de |
|---|--------|---------|------------|
| 1 | Criar aba "Cobrancas" no bottom nav (role: manager) | 1h | Fase 1 |
| 2 | Tela de lista de cobrancas pendentes com filtros | 3h | 1 |
| 3 | Auto-criar cobranca quando paciente recebe alta | 2h | Fase 1 |
| 4 | Calculo automatico de valor (visitas x preco vigente) | 2h | 3 |
| 5 | Botoes de acao: marcar pago, parcial, inadimplente | 1.5h | 2 |
| 6 | Historico de cobrancas por paciente | 1.5h | 2 |
| 7 | Indicador visual de cobrancas atrasadas (>7 dias) | 1h | 2 |

### Painel da Secretaria (Conceito)

O painel mostra cards com: nome do paciente, hospital, data da alta, total de visitas, valor total, e status da cobranca. Filtros por hospital e status. Ordenado por data de alta (mais antigo primeiro = mais urgente).

### Entregaveis da Fase 2

- Nova aba "Cobrancas" funcional para role manager
- Criacao automatica de cobranca na alta do paciente
- Calculo automatico de valores baseado na tabela de precos
- Controle de status de pagamento (pendente/pago/parcial/inadimplente)

---

## FASE 3 — WhatsApp Bot (Infraestrutura)
*Semanas 3-4 — Canal de comunicacao*

Esta fase configura a infraestrutura do WhatsApp. Nao envia nada automatico ainda — apenas garante que o sistema CONSEGUE enviar mensagens e que temos templates prontos.

### Arquitetura tecnica

A API nao-oficial (Evolution API ou Z-API) roda como servico externo. O AppHosp se comunica via Supabase Edge Functions, que servem como camada intermediaria segura. O fluxo eh: Trigger no banco -> Edge Function -> API WhatsApp -> mensagem entregue -> log salvo.

### Tarefas

| # | Tarefa | Esforco | Depende de |
|---|--------|---------|------------|
| 1 | Escolher e configurar API WhatsApp (Evolution/Z-API) | 2h | - |
| 2 | Criar Edge Function: enviar-mensagem | 3h | 1 |
| 3 | Criar Edge Function: verificar-status-mensagem | 1.5h | 2 |
| 4 | Template: aviso de internacao particular | 1h | - |
| 5 | Template: relatorio de alta + cobranca | 2h | - |
| 6 | Template: lembrete para medico (preencher relatorio) | 1h | - |
| 7 | Template: lista diaria para secretaria | 1h | - |
| 8 | Pagina de teste manual de envio (admin only) | 2h | 2 |
| 9 | Sistema de log de mensagens (mensagens_log) | 1.5h | 2 |

### Template de Mensagem — Internacao Particular (Rascunho)

> Ola, {nome_paciente}! Aqui eh a equipe do Dr. Igor Campana.
>
> Gostariamos de informar que seu acompanhamento durante a internacao no {hospital} sera realizado de forma particular pela nossa equipe de Geriatria.
>
> Nosso compromisso eh oferecer um cuidado proximo, humanizado e dedicado durante todo o periodo de internacao. Caso tenha qualquer duvida, estamos a disposicao.
>
> Com carinho, Equipe Dr. Igor Campana

### Entregaveis da Fase 3

- API WhatsApp configurada e testada
- Edge Functions no Supabase para envio de mensagens
- 4 templates de mensagem prontos e aprovados
- Pagina de teste de envio manual
- Sistema de log completo (sucesso/erro/entregue/lido)

---

## FASE 4 — Automacoes de Cobranca e Comunicacao
*Semana 5 — O sistema trabalha sozinho*

Agora conectamos tudo. Os triggers automaticos comecam a funcionar: paciente interna -> mensagem humanizada. Paciente recebe alta -> 48h depois, cobranca automatica. Medico da alta -> 24h depois, lembrete para preencher relatorio. Secretaria -> lista diaria de pendencias.

### Mapa de Automacoes

| Evento | Delay | Acao | Destinatario | Template |
|--------|-------|------|--------------|----------|
| Paciente interna | Imediato | Msg internacao particular | Paciente | #4 |
| Paciente alta | +48h | Relatorio + cobranca | Paciente | #5 |
| Paciente alta | +24h | Lembrete relatorio | Medico | #6 |
| Diario (8h) | Cron | Lista de pendencias | Secretaria | #7 |

### Tarefas

| # | Tarefa | Esforco | Depende de |
|---|--------|---------|------------|
| 1 | Trigger Supabase: nova internacao -> Edge Function msg | 2h | Fase 3 |
| 2 | Cron job: verificar altas com 48h -> enviar cobranca | 3h | Fase 2, 3 |
| 3 | Cron job: verificar altas com 24h -> lembrar medico | 2h | Fase 3 |
| 4 | Cron job diario 8h: lista pendencias -> secretaria | 2h | Fase 2, 3 |
| 5 | Gerar PDF do relatorio de alta automaticamente | 3h | 2 |
| 6 | Painel de monitoramento de automacoes (logs) | 2h | 1-4 |
| 7 | Mecanismo de retry para falhas de envio | 1.5h | 1-4 |

### Relatorio de alta (enviado ao paciente)

O PDF gerado automaticamente contem: nome do paciente, hospital, periodo de internacao, lista de visitas com datas e medico responsavel, valor unitario de cada visita, valor total, e instrucoes de pagamento. Esse PDF eh enviado junto com a mensagem de cobranca via WhatsApp.

### Entregaveis da Fase 4

- 4 automacoes funcionando (internacao, cobranca 48h, medico 24h, secretaria diaria)
- PDF de relatorio de alta gerado automaticamente
- Painel de monitoramento com logs de envio
- Sistema de retry para falhas

---

## FASE 5 — Consultas Ambulatoriais
*Semana 6 — Expandindo o escopo*

Nova funcionalidade independente: registro de consultas ambulatoriais com controle de valores e divisao de receita entre medicos.

### Schema: consultas_ambulatoriais

| Campo | Tipo | Exemplo | Descricao |
|-------|------|---------|-----------|
| id | uuid | auto | PK |
| paciente_nome | text | Joao Silva | Nome do paciente |
| data | date | 2026-04-06 | Data da consulta |
| medico | text | Igor | Medico que atendeu |
| conjunta | boolean | true | Se foi com chefe |
| chefe | text | Samira | Chefe na conjunta |
| valor_total | numeric | 500.00 | Valor cobrado |
| valor_medico | numeric | 250.00 | Parte do medico (auto) |
| valor_chefe | numeric | 250.00 | Parte da chefe (auto) |
| status_pgto | text | pendente | pendente/pago/parcial |
| observacoes | text | ... | Notas livres |

### Logica de divisao

- Se `conjunta = true`: valor_medico = valor_total / 2, valor_chefe = valor_total / 2
- Se `conjunta = false` (atendimento so da Samira): valor_chefe = valor_total, valor_medico = 0
- A divisao pode ser customizada futuramente (ex: 60/40), mas comecamos com 50/50

### Tarefas

| # | Tarefa | Esforco | Depende de |
|---|--------|---------|------------|
| 1 | Criar tabela consultas_ambulatoriais + RLS | 45 min | Fase 1 |
| 2 | Nova aba "Ambulatorio" no bottom nav | 1h | 1 |
| 3 | Formulario de registro de consulta | 2h | 2 |
| 4 | Calculo automatico de divisao de valores | 1h | 3 |
| 5 | Lista/historico de consultas com filtros | 2h | 3 |
| 6 | Relatorio mensal de consultas por medico | 2h | 5 |
| 7 | Integracao com aba Repasse (somar ambulatorio) | 2h | 6 |

### Entregaveis da Fase 5

- Nova aba Ambulatorio funcional
- Registro de consultas com calculo automatico de divisao
- Historico e relatorio mensal
- Integracao com sistema de repasse existente

---

## FASE 6 — Refinamento, Vila Nova e Dashboards
*Semanas 7-8 — Polimento e escala*

Fase final de consolidacao. Integramos o Hospital Vila Nova na conciliacao, criamos dashboards de metricas financeiras, e refinamos toda a experiencia baseado no uso real das fases anteriores.

### Tarefas

| # | Tarefa | Esforco | Depende de |
|---|--------|---------|------------|
| 1 | Adicionar Vila Nova na conciliacao (novo parser/formato) | 4h | Fase anterior |
| 2 | Dashboard financeiro: receita por hospital/mes | 3h | Fase 2, 5 |
| 3 | Dashboard: taxa de inadimplencia por hospital | 2h | Fase 2 |
| 4 | Dashboard: media de dias internacao por hospital | 1.5h | - |
| 5 | Metricas de WhatsApp: taxa entrega/leitura | 2h | Fase 4 |
| 6 | Ajustes de UX baseados em feedback real | 4h | Uso real |
| 7 | Documentacao tecnica atualizada (CLAUDE.md) | 2h | Todas |

### Entregaveis da Fase 6

- Vila Nova integrado na conciliacao
- 3 dashboards financeiros funcionais
- Metricas de comunicacao via WhatsApp
- Documentacao tecnica completa e atualizada

---

## Decisoes Pendentes

| # | Decisao | Impacta Fase | Status |
|---|---------|--------------|--------|
| 1 | Qual API WhatsApp usar? (Evolution vs Z-API) | 3 | A definir |
| 2 | Numero comercial WhatsApp — qual usar? | 3 | A providenciar |
| 3 | Valores por visita por hospital (tabela completa) | 1 | A preencher |
| 4 | % de divisao consulta conjunta (50/50 ou outro?) | 5 | A confirmar |
| 5 | Formato do relatorio do Vila Nova | 6 | A obter |
| 6 | Quem recebe lista diaria — so 1 secretaria ou mais? | 4 | A definir |
| 7 | Horario do cron diario para secretaria | 4 | Sugestao: 8h |
| 8 | Texto final dos templates de WhatsApp | 3 | A aprovar |

---

## Proximos Passos Imediatos

1. Revisar este documento e validar as fases propostas.
2. Preencher a tabela de precos por hospital/tipo de internacao.
3. Definir a API de WhatsApp e providenciar o numero comercial.
4. Aprovar o template da mensagem de internacao particular.
5. Comecar pela Fase 1 — infraestrutura de dados (pode ser feita em 1 dia).

**Recomendacao:** Vamos fase por fase. Comecamos pela Fase 1 hoje, validamos, e seguimos. Cada fase entrega valor isolado — se precisar pausar, nada quebra.
