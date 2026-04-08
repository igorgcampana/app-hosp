# STATE — AppHosp

**Última atualização:** 2026-04-08

---

## Status Atual

Módulo de ambulatório implementado e deployado (T00–T21). Integração ambulatório → repasse **concluída e validada** (T22–T24). Todas as correções de bugs aplicadas:
- RLS policies corrigidas para incluir `admin` role
- Coluna `consulta_conjunta` (era `conjunta`) — nomes sincronizados entre `ambulatorio.js` e `repasse.js`
- Auto-fill de `valor_recebido` quando status = SIM/RETAGUARDA (usa valor esperado: `valor_visita × dias − desconto`)
- `esc()` function movida localmente para `repasse.js` (acessibilidade de escopo)
- Relatório com discriminação de pacientes ambulatoriais: Pág. 1 mostra tabela de todas as consultas; Pág. 2 mostra por médico

Rodada T25 concluída:
- autenticação real confirmada para `igor@apphosp.com.br` (`doctor`) e `medicos@gmail.com`
- gap encontrado: o resumo mensal prometido em T21 nao existia no modulo; corrigido localmente em `ambulatorio.html` + `ambulatorio.js`
- gap encontrado: UI do `doctor` escondia edicao da propria consulta conjunta apesar de o RLS permitir; corrigido localmente
- configuracao real conferida no banco: fixo `R$ 600`, imposto medico `13%`, imposto Samira `13%`, administracao `10%`
- consultas ficticias atuais batem com a regra financeira esperada
- usuario confirmou a validacao manual dos cenarios restantes de escrita

**Trilha ativa:** Pós-go-live do ambulatório + expandir RBAC para `doctor` e `manager`.

---

## Próxima Ação

**Integração estável em main. Ambulatório T00–T27 concluído. Próximo: RBAC visível para `doctor`/`manager` e demais trilhas do roadmap.**

1. ~~Definir contrato de integração `ambulatorio.js` ↔ `repasse.js` (T22)~~ ✅ (2026-04-08)
2. ~~Incluir totais ambulatoriais no fechamento mensal sem regressão (T23–T24)~~ ✅ (2026-04-08)
3. ~~Merge branch `feat/repasse-ambulatorio` em `main` e deploy~~ ✅ (2026-04-08)
4. ~~T25 — Rodar bateria de testes manuais~~ ✅ (2026-04-08)
5. ~~T26 — Homologação com casos reais~~ ✅ (2026-04-08)
6. ~~T27 — Checklist de go-live~~ ✅ (2026-04-08)
7. Expandir acesso ao ambulatório para roles `doctor` e `manager` conforme RBAC
8. Só depois abrir a implementação de cobrança particular (Fase 2)

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
| 2026-04-08 | Integração ambulatório → repasse concluída (T22–T24) | `repasse.js` lê `consultas_ambulatoriais` direto do Supabase (constante `AMB_COLS`), agrega via `calcAmbulatorioResumo()`, renderiza seção condicional em Pág. 1 e Pág. 2; sem alterar `calcularRepasse()` nem `ambulatorio.js` |
| 2026-04-08 | Bugs de integração encontrados e corrigidos | (1) RLS policies estavam bloqueando write de `admin` (só permitiam `manager`); (2) constante `AMB_COLS` usava `conjunta` em vez de `consulta_conjunta`; (3) `esc()` estava inacessível no scope de `repasse.js`; (4) `valor_recebido` precisava auto-fill com valor esperado quando status = SIM/RETAGUARDA |
| 2026-04-08 | Relatório ambulatorial com discriminação de pacientes | Adicionada tabela de pacientes em Pág. 1 (todas as consultas) e Pág. 2 (por médico); uso de `calcAmbulatorioResumo()` com array `rows` para renderizar detalhes |
| 2026-04-08 | Auto-fill `valor_recebido` para status SIM/RETAGUARDA | Quando usuário marca paciente como pago (SIM) ou retaguarda (RETAGUARDA), `valor_recebido` é preenchido automaticamente com: `(valor_visita × dias) − desconto`; lógica centralizada em `calcValorEsperado()` |
| 2026-04-08 | T25 revelou gap entre task e implementacao do ambulatório | T21 constava como concluída, mas o resumo mensal nao existia no codigo; resumo por periodo foi adicionado ao topo da tela |
| 2026-04-08 | UI do doctor alinhada ao RLS do ambulatório | Historico voltou a exibir acao de editar apenas para consultas conjuntas do proprio medico; exclusao continua restrita a `admin`/`manager` |
| 2026-04-08 | T25 fechada | Testes manuais considerados aprovados; configuracao e consultas ficticias conferidas no banco, e usuario confirmou os cenarios restantes de escrita |
| 2026-04-08 | T26 fechada | Usuario confirmou que a homologacao com 3–5 consultas reais ja foi realizada e aceita por Igor/Samira |
| 2026-04-08 | T27 fechada | Schema, roles, dados iniciais e backup/export do ambulatório validados; checklist final registrado em `docs/ambulatorio-go-live-checklist-2026-04-08.md` |

---

## Bloqueadores Ativos

| Bloqueador | Impacta | Ação necessária |
|---|---|---|
| Acesso dos médicos ao ambulatório (hoje só admin no entrypoint principal) | Pós-go-live | Expandir RBAC para `doctor` e `manager` conforme regras; validar com usuários reais |
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
