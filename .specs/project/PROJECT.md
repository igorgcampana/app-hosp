# AppHosp — Gestão Hospitalar

**Projeto:** Sistema de gestão, cobrança e comunicação hospitalar do Dr. Igor Campana
**Stack:** Vanilla JS + Supabase + Vercel
**Deploy:** Push para `main` → deploy automático na Vercel

---

## Visão

Centralizar o controle de pacientes internados, visitas, repasses financeiros, cobranças particulares e consultas ambulatoriais. O sistema atende três perfis: admin (controle total), médicos (registro e consulta) e gestor (supervisão e faturamento).

## Telas Atuais

| Tela | Descrição |
|------|-----------|
| Registro | Registro diário de visitas por médico e paciente |
| Fichas | Lista completa de pacientes com filtros, edição e relatório |
| Calendário | Visualização mensal de visitas com exportação CSV |
| Repasse | Calculadora de repasse mensal com demonstrativo por médico |
| Conciliação | Conciliação de faturamento hospitalar (retaguarda/convênio) |
| Ambulatório | Módulo standalone completo (`ambulatorio.html`); CRUD, filtros, resumo mensal e config financeira funcionais; acesso via link no header (admin-only por ora) |

## Features Implementadas

| Feature | Status |
|---------|--------|
| Calculadora de Repasse (`calculadora-repasse`) | Completa e deployada (2026-03-30) |
| Conciliação de Faturamento (`conciliacao-faturamento`) | Implementada (Sírio apenas) |
| RBAC 3 níveis (admin/doctor/manager) | Implementado |
| Fluxograma consolidado do produto | Documentado em `docs/fluxograma-funcionamento-apphosp.*` |

## Features Planejadas

| Feature | Status |
|---------|--------|
| Consultas Ambulatoriais | UI completa deployada (T00–T21 concluídos); pendente: integração com repasse (T22–T24) e go-live com médicos reais (T25–T27) |
| Cobrança de Particulares | Pronta para especificar (Fase 2) |
| Vila Nova na Conciliação | Aguardando formato do arquivo (Fase 3) |
| WhatsApp + Automações | Deferido — sem número/API (Fase 4+) |
| Nomes completos no relatório (`report-full-doctor-names`) | Spec aprovada, não implementada |

## Planejamento Ativo

**Feature em foco:** integração ambulatório ↔ repasse + go-live com médicos reais

**Estado atual do módulo ambulatório:**
- UI completa deployada em produção (`apphosp.drigorcampana.com.br/ambulatorio.html`)
- CRUD completo: cadastro, edição, exclusão com confirmação
- Configuração financeira editável (valor fixo médico, impostos, adm)
- Histórico com filtros por período, médico e status
- Resumo mensal com cards de totais
- RBAC: admin acessa tudo; doctor e manager com restrições implementadas

**Próximos passos:**
- Definir e implementar integração com `repasse.js` (T22–T24)
- Expandir visibilidade para roles `doctor` e `manager`
- Homologar com consultas reais (T25–T27)

## Equipe Médica

Médicos cadastrados no sistema: Igor, Beatriz, Eduardo, Tamires, Felipe Reinaldo
Chefe da equipe: Samira (recebe parte dos repasses e consultas ambulatoriais)

## Hospitais

HVNS, HSL, H9J, Outro
