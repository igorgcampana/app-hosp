# Report Full Doctor Names Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Exibir nomes completos dos medicos apenas no texto gerado do relatorio de internacao.

**Architecture:** A mudanca fica isolada na funcao `generateReportText()` em `script.js`, usando um mapa dedicado para converter os nomes curtos vindos do historico em nomes completos apenas no momento da renderizacao do texto. Nenhum valor persistido no banco nem outros fluxos da UI devem ser alterados.

**Tech Stack:** HTML, CSS, JavaScript vanilla, Supabase client-side

---

### Task 1: Registrar mapeamento local de nomes completos no relatorio

**Files:**
- Modify: `script.js`
- Reference: `.specs/features/report-full-doctor-names/spec.md`

**Step 1: Localizar a geracao do texto do relatorio**

Procurar a funcao `generateReportText()` e o mapa `DOCTOR_TITLES`.

**Step 2: Substituir o mapa atual pelo mapeamento aprovado**

Atualizar o mapeamento para:
- `Igor` -> `Dr. Igor Campana`
- `Beatriz` -> `Dra. Beatriz Carneiro`
- `Eduardo` -> `Dr. Eduardo Tieppo`
- `Tamires` -> `Dra. Tamires Figueiredo`
- `Felipe Reinaldo` -> `Dr. Felipe Reinaldo de Deus`

**Step 3: Preservar fallback seguro**

Manter a logica `DOCTOR_TITLES[m] || m` para medicos sem mapeamento.

**Step 4: Verificar leitura do diff**

Conferir que a mudanca ficou restrita ao trecho de relatorio em `script.js`.

**Step 5: Commit**

```bash
git add script.js .specs/features/report-full-doctor-names/spec.md docs/plans/2026-03-29-report-full-doctor-names.md
git commit -m "feat: use full doctor names in reports"
```

### Task 2: Verificacao manual focada no relatorio

**Files:**
- Reference: `script.js`
- Reference: `.specs/features/report-full-doctor-names/spec.md`

**Step 1: Revisar a linha final do relatorio**

Confirmar que a frase `Recebeu visitas de Dra Samira Apostolos e equipe medica - ...` continua com a mesma estrutura, alterando apenas os nomes listados depois do hifen.

**Step 2: Validar criterios de aceite**

Checar se a implementacao cobre:
- medico unico mapeado
- varios medicos mapeados
- fallback para medico nao mapeado

**Step 3: Validar nao-escopo**

Conferir no diff que calendario, CSVs e selects nao foram alterados.

**Step 4: Registrar resultado**

Se tudo estiver correto, marcar a feature como pronta para validacao manual no navegador.
