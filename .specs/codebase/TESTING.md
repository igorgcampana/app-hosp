# Testing Infrastructure

## Test Frameworks

**Unit/Integration:** Nenhum
**E2E:** Nenhum
**Coverage:** Nenhum

## Test Organization

**Location:** Não há diretório de testes
**Naming:** N/A
**Structure:** N/A

## Current QA Approach

**Método:** Testes manuais pelo Dr. Igor
**Processo:**
1. Alteração local
2. Teste manual no browser, com foco em fluxos desktop e mobile
3. Commit + push → Vercel deploy automático
4. Validação no ambiente publicado

## Testing Patterns

### Unit Tests
Não implementados. Candidatos naturais para testes unitários:
- `esc(str)` / `escAttr(str)` — XSS prevention
- `parseDate(dateStr)` — timezone-safe date parsing
- `diffEmDias(date1, date2)` — cálculo de dias
- `diasDeInternacao(dataInicio, dataFim)` — duração de internação
- `formatDateBR(dateStr)` — formatação DD/MM/YYYY
- `isPatientActive(patient, referenceDate)` — lógica de atividade
- `getFilteredPatients()` — filtros combinados

### Integration Tests
Não implementados. Candidatos:
- Auth flow (login → sessão → role → permissões)
- CRUD completo (criar paciente → registrar visita → dar alta)
- RLS enforcement (manager tentando INSERT → bloqueio)

### E2E Tests
Não implementados. Candidatos:
- Fluxo diário completo (login → registro → calendário → exportar CSV)
- Fluxo mobile (bottom tab bar, card layout, touch targets)

## Test Execution

**Commands:** N/A (sem framework de teste configurado)
**Configuration:** N/A

## Coverage Targets

**Current:** 0% (sem testes automatizados)
**Goals:** Não definidos
**Enforcement:** Não há CI com validação de testes

## Notes

O projeto é um app de produção crítico (faturamento hospitalar) sem cobertura de testes automatizados. A lógica de datas e cálculos financeiros são áreas de maior risco.
O conjunto de documentos em `.specs/codebase/` existe justamente para reduzir o risco de mudanças sem contexto.
