# Checklist de Go-Live — Ambulatório

**Data:** 2026-04-08
**Status:** Concluído

## Evidências

- Schema validado por leitura direta no ambiente real:
  - `ambulatorio_config` responde com `valor_fixo_medico_conjunta`, `pct_imposto_medico`, `pct_imposto_samira`, `pct_administracao_medico`, `updated_at`
  - `consultas_ambulatoriais` responde com colunas operacionais e financeiras completas, incluindo `consulta_conjunta`, líquidos, status, auditoria e `created_by`
- Perfis validados no ambiente real:
  - `admin`: `0e19f090-944c-4b5b-abea-959bc0351826`
  - `manager`: `d8ac7ac4-3fd8-483f-9784-d252308841f2`
  - `doctor_name` preenchido para os 5 médicos individuais
- Dados iniciais validados:
  - `valor_fixo_medico_conjunta = 600`
  - `pct_imposto_medico = 13`
  - `pct_imposto_samira = 13`
  - `pct_administracao_medico = 10`
- Backup/export local gerado em:
  - [ambulatorio_config.json](/Users/igorcampana/projetos_programacao/AppHosp/backups/ambulatorio-go-live-2026-04-08/ambulatorio_config.json)
  - [consultas_ambulatoriais.json](/Users/igorcampana/projetos_programacao/AppHosp/backups/ambulatorio-go-live-2026-04-08/consultas_ambulatoriais.json)
  - [profiles_ambulatorio_roles.json](/Users/igorcampana/projetos_programacao/AppHosp/backups/ambulatorio-go-live-2026-04-08/profiles_ambulatorio_roles.json)

## Checklist

- [x] Schema do ambulatório acessível em produção
- [x] Campos financeiros e de auditoria presentes em `consultas_ambulatoriais`
- [x] Configuração inicial homologada em `ambulatorio_config`
- [x] `admin` e `manager` presentes
- [x] `doctor_name` preenchido para os médicos individuais
- [x] T25 concluída
- [x] T26 concluída
- [x] Backup/export local validado

## Observações

- A revisão de policies foi sustentada por:
  - leitura do SQL real em [fase1-migration-execute.sql](/Users/igorcampana/projetos_programacao/AppHosp/scripts/fase1-migration-execute.sql)
  - correções aplicadas em T22–T24
  - validação manual/homologação já confirmada pelo usuário em T25 e T26
- Próxima trilha fora do go-live:
  - expandir RBAC visível do ambulatório para `doctor` e `manager` no fluxo principal conforme roadmap
