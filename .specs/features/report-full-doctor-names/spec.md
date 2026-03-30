# Feature Spec: Full Doctor Names in Report Text

**Date:** 2026-03-29  
**Status:** Approved  
**Scope:** Medium  
**Area:** Relatorio de Internacao

## Summary

Padronizar os nomes dos medicos exibidos no texto gerado do relatorio de internacao, substituindo as formas curtas atuais por nomes completos com tratamento profissional.

## Problem

Hoje o texto gerado do relatorio mostra apenas o primeiro nome dos medicos, o que reduz o padrao formal esperado no documento final.

## Goal

Quando o sistema gerar o texto do relatorio de internacao, os medicos envolvidos devem aparecer com nome completo e tratamento adequado.

## Requirements

- `RPT-NAME-001`: O sistema deve alterar apenas o texto gerado do relatorio de internacao.
- `RPT-NAME-002`: O sistema nao deve alterar nomes de medicos em calendario, selects, filtros ou exportacoes CSV.
- `RPT-NAME-003`: O mapeamento no texto do relatorio deve ser:
  - `Igor` -> `Dr. Igor Campana`
  - `Beatriz` -> `Dra. Beatriz Carneiro`
  - `Eduardo` -> `Dr. Eduardo Tieppo`
  - `Tamires` -> `Dra. Tamires Figueiredo`
  - `Felipe Reinaldo` -> `Dr. Felipe Reinaldo de Deus`
- `RPT-NAME-004`: Se surgir um medico sem mapeamento explicito, o relatorio deve manter o valor original em vez de falhar.
- `RPT-NAME-005`: A estrutura atual do texto do relatorio deve ser preservada, mudando apenas os nomes exibidos na linha `Recebeu visitas de ...`.

## Non-Goals

- Alterar labels ou opcoes de formularios
- Alterar o calendario
- Alterar CSVs
- Renomear valores persistidos no banco

## Design

Aplicar um mapa dedicado de nomes completos apenas no fluxo de `generateReportText()` em `script.js`. A conversao deve acontecer no momento de montar a lista de medicos para a frase final do relatorio.

## Acceptance Criteria

1. Ao gerar um relatorio com visita de `Igor`, o texto deve exibir `Dr. Igor Campana`.
2. Ao gerar um relatorio com visita de `Beatriz`, o texto deve exibir `Dra. Beatriz Carneiro`.
3. Ao gerar um relatorio com visitas de varios medicos, todos os nomes mapeados devem aparecer completos.
4. Se existir um medico nao previsto no mapa, o texto deve continuar exibindo esse valor sem erro.
5. Nenhuma outra tela do sistema deve mudar como efeito colateral desta feature.

## Risks

- Baixo risco tecnico por estar isolado em uma unica funcao.
- Risco principal: mudar acidentalmente nomes fora do relatorio se a alteracao for feita em constantes globais compartilhadas.

## Verification

- Inspecionar `generateReportText()` para confirmar que o mapeamento ficou restrito ao relatorio.
- Gerar manualmente um relatorio com medico conhecido e validar a linha `Recebeu visitas de ...`.
- Confirmar visualmente que calendario e selects continuam com os nomes curtos.
