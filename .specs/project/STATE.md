# STATE — AppHosp

**Última atualização:** 2026-04-08

---

## Status Atual

Módulo de ambulatório totalmente implementado e deployado em produção (2026-04-08). O CRUD completo (cadastro, edição, exclusão, filtros, resumo mensal, configuração financeira) está funcional em `ambulatorio.html` — módulo standalone acessível via link no header do censo, visível apenas para `admin`.

**Trilha ativa:** integrar ambulatório no fechamento mensal do repasse (T22–T24) e executar go-live com médicos reais (T25–T27).

---

## Próxima Ação

**Fase 1 do ambulatório concluída. Próximo: integração com repasse + go-live.**

1. Definir contrato de integração `ambulatorio.js` ↔ `repasse.js` (T22)
2. Incluir totais ambulatoriais no fechamento mensal sem regressão (T23–T24)
3. Expandir acesso ao ambulatório para roles `doctor` e `manager` conforme regras de RBAC definidas
4. Homologar com 3–5 consultas reais da equipe (T25–T26)
5. Checklist de go-live (T27)
6. Só depois abrir a implementação de cobrança particular (Fase 2)

---

## Decisões Registradas

| Data | Decisão | Contexto |
|------|---------|---------|
| 2026-03-30 | `repasse.js` separado de `script.js` | script.js já tem 1520 linhas; lógica de repasse é independente |
| 2026-03-30 | RBAC: médico edita configurações (%, sala, CRM); gestor edita dados financeiros | Médicos precisam ajustar suas próprias configurações sem depender do gestor |
| 2026-03-30 | `repasse_config` usa JSONB para `medicos` e `descontos_sala` | Flexibilidade para adicionar médicos sem migrations |
| 2026-03-30 | Paciente com `patient_id = NULL` permitido em `repasse_paciente` | Gestor pode adicionar pacientes externos não cadastrados no censo |
| 2026-03-30 | CRM coletado na 1ª geração de relatório, salvo para próximas | Evita cadastro inicial burocrático; sistema aprende progressivamente |
| 2026-04-06 | Tabela `medicos` removida permanentemente do plano | Dados já existem no `repasse_config` e código; duplicação desnecessária |
| 2026-04-06 | Tabela `tabela_precos` removida do plano | Valores de cobrança particular são caso a caso, definidos pela chefe |
| 2026-04-06 | Campo `data_alta` desnecessário | Alta = última visita, não divergem |
| 2026-04-06 | Ambulatório: Médico R$600 fixo, Samira = total - 600, ambos pagam imposto, só médico paga adm | Lógica real da divisão financeira das consultas ambulatoriais |
| 2026-04-06 | Conciliação: mudança é só incluir Vila Nova (hoje só Sírio) | Não é feature nova, é expansão da existente |
| 2026-04-06 | Cobrança = pacientes particulares pagam à equipe, secretária cobra, chefe define valor | Diferente da conciliação (retaguarda/convênio) |
| 2026-04-06 | Repasse de médicos não será alterado | Feature completa e estável |
| 2026-04-07 | Spec `consultas-ambulatoriais` criada | Arquivo `.specs/features/consultas-ambulatoriais/spec.md` aberto com requisitos, tabela e critérios de aceite |
| 2026-04-07 | Tasks `consultas-ambulatoriais` criada | Arquivo `.specs/features/consultas-ambulatoriais/tasks.md` aberto com fases, dependencias e verificacoes |
| 2026-04-07 | Regras do ambulatório consolidadas | `manager` cadastra tudo, `doctor` atua apenas em consultas conjuntas, status mantidos, `valor_recebido` unico por consulta, percentuais mantidos, conjunta sempre paga `R$ 600` ao medico |
| 2026-04-07 | Design `consultas-ambulatoriais` criado | Arquivo `.specs/features/consultas-ambulatoriais/design.md` aberto com schema planejado, constraints, RLS e estrategia de integracao |
| 2026-04-07 | Planejamento de seeds e roles fechado | Percentuais podem iniciar neutros/editaveis; role `admin` existe e deve concentrar acesso inicial a funcionalidades novas |
| 2026-04-07 | Auth atual do Supabase confirmado | Existem 3 profiles reais: 1 `doctor`, 1 `manager`, 1 `admin`; o `doctor` atual e um login compartilhado (`medicos@gmail.com`) |
| 2026-04-07 | Seed real de `profiles.doctor_name` bloqueado | Nao ha um profile por medico; com o auth atual nao e possivel mapear ownership de Igor, Beatriz, Eduardo, Tamires e Felipe Reinaldo via RLS |
| 2026-04-07 | Ambulatório seguira a Opcao A de auth | Antes da implementacao, o projeto criara 1 usuario/profile por medico e mantera o RLS baseado em `profiles.doctor_name` |
| 2026-04-08 | Fluxograma mestre e faxina documental adicionados | `docs/fluxograma-funcionamento-apphosp.*`, `README`, `BROWNFIELD_MAPPING.md` e `STATE.md` agora separam melhor o que e atual, parcial e planejado |
| 2026-04-08 | Ambulatório implementado como standalone HTML | `ambulatorio.html` + `ambulatorio.js` — CRUD completo, configuração financeira, filtros e resumo mensal; acessível via link no header do censo (admin-only por ora) |
| 2026-04-08 | Cabeçalho da tabela do ambulatório corrigido | `color: var(--color-text-secondary)` sobrescrevia o branco herdado do `styles.css`; corrigido para `color: var(--color-white)` |

---

## Bloqueadores Ativos

| Bloqueador | Impacta | Ação necessária |
|---|---|---|
| Acesso dos médicos ao ambulatório (hoje só admin) | Go-live Fase 1 | Expandir RBAC para `doctor` e `manager` conforme regras; validar com usuários reais |
| Formato do arquivo de faturamento do Vila Nova | Fase 3 (conciliação) | Igor vai solicitar ao hospital |
| Número comercial WhatsApp | Fase 4 (automações) | Igor providencia |
| Escolha da API WhatsApp | Fase 4 (automações) | Decidir entre Evolution API e Z-API |

---

## Deferred / Ideias Futuras

- WhatsApp: cobrança automática a médicos sobre relatórios pendentes
- WhatsApp: aviso de internação particular ao paciente
- WhatsApp: lista diária de pendências para secretária
- Dashboard de produtividade mensal por médico
- Histórico de repasses anteriores com comparativo
- Dashboards financeiros (receita por hospital, inadimplência)

---

## Lições Aprendidas

- O relatório de referência (PDF) usa nome curto dos pacientes na Pág. 2 — o sistema deve usar `pacientenome` da tabela `patients`
- O "Desconto Locação de Sala" é aplicado por médico, não globalmente
- Pacientes de meses anteriores podem aparecer em faturas futuras (pagamentos atrasados) — o gestor controla isso manualmente via inclusão/exclusão
- Planos escritos por terceiros/IA precisam de revisão profunda — premissas erradas (tabela médicos, cobrança = billing pacientes, 50/50 ambulatório) se propagam se não forem questionadas cedo
