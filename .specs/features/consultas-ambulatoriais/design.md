# Design: Consultas Ambulatoriais

**Date:** 2026-04-07
**Status:** Draft
**Refs:** spec.md, tasks.md

---

## 1. Decisoes Arquiteturais

### 1.1 Novo modulo `ambulatorio.js`

O modulo ambulatorial deve nascer em arquivo proprio, e nao dentro de [script.js](/Users/igorcampana/projetos_programacao/AppHosp/script.js), porque:

- o `script.js` ja concentra auth, CRUD, filtros, calendario e relatorios
- o ambulatorio tem estado e regras financeiras proprias
- a integracao com `repasse.js` pode ser mantida por contrato simples entre modulos

**Decisao:** criar `ambulatorio.js` separado e inicializar via `initAmbulatorio()` no bootstrap principal.

### 1.2 Persistir calculos fechados por consulta

As consultas devem salvar os percentuais usados e os valores calculados no momento do cadastro/edicao, em vez de recalcular retroativamente com base na configuracao atual.

**Motivo:**
- evita mudanca retroativa em fechamento antigo
- preserva auditabilidade
- simplifica a integracao com repasse

**Decisao:** `consultas_ambulatoriais` guardara percentuais, valores brutos, impostos, administracao e liquidos.

### 1.3 Separar configuracao global da consulta

O modulo precisa de valores padrao editaveis, mas sem acoplar essas configuracoes a cada tela.

**Decisao:** criar tabela unica `ambulatorio_config`, com 1 linha global.

### 1.4 RBAC baseado em `profiles.doctor_name`

Para permitir que `doctor` edite apenas as proprias consultas conjuntas, a policy precisa saber qual medico ele representa.

**Decisao:** adicionar `doctor_name` em `profiles`.

**Motivo:**
- deixa o RLS simples e legivel
- evita depender de e-mail, nome exibido ou metadados menos estaveis
- facilita futuras regras por medico

---

## 2. Planejamento do Banco de Dados

### 2.1 Alteracao em `profiles`

Adicionar coluna:

```sql
ALTER TABLE profiles
ADD COLUMN doctor_name text;
```

**Uso esperado**
- `doctor`: nome curto do medico no sistema (`Igor`, `Beatriz`, etc.)
- `manager`: `NULL`
- `admin`: pode ser `NULL` ou nome valido, sem impacto nas policies administrativas

**Seed planejado**

Atualizar os usuarios medicos existentes com:
- `Igor`
- `Beatriz`
- `Eduardo`
- `Tamires`
- `Felipe Reinaldo`

---

### 2.2 Tabela `ambulatorio_config`

```sql
CREATE TABLE ambulatorio_config (
  id                         int8 PRIMARY KEY DEFAULT 1,
  valor_fixo_medico_conjunta numeric(12,2) NOT NULL DEFAULT 600.00,
  pct_imposto_medico         numeric(5,2)  NOT NULL,
  pct_imposto_samira         numeric(5,2)  NOT NULL,
  pct_administracao_medico   numeric(5,2)  NOT NULL,
  updated_at                 timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT ambulatorio_config_single_row CHECK (id = 1),
  CONSTRAINT ambulatorio_config_valor_fixo_ck CHECK (valor_fixo_medico_conjunta = 600.00),
  CONSTRAINT ambulatorio_config_pct_imposto_medico_ck CHECK (pct_imposto_medico >= 0),
  CONSTRAINT ambulatorio_config_pct_imposto_samira_ck CHECK (pct_imposto_samira >= 0),
  CONSTRAINT ambulatorio_config_pct_adm_medico_ck CHECK (pct_administracao_medico >= 0)
);
```

**Observacoes**
- o valor fixo da consulta conjunta fica travado em `600` por regra de negocio atual
- percentuais podem ser alterados para novos registros
- consultas antigas nao devem ser recalculadas

**Seed inicial planejado**

```sql
INSERT INTO ambulatorio_config (
  id,
  valor_fixo_medico_conjunta,
  pct_imposto_medico,
  pct_imposto_samira,
  pct_administracao_medico
) VALUES (
  1,
  600.00,
  -- manter editavel; valor inicial pode ficar neutro ate configuracao manual
  0,
  0,
  0
);
```

**Nota:** os percentuais reais nao precisam ser definidos no planejamento. O modulo deve nascer com campos editaveis e configuracao inicial neutra, para ajuste manual posterior.

---

### 2.3 Tabela `consultas_ambulatoriais`

```sql
CREATE TABLE consultas_ambulatoriais (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_nome             text           NOT NULL,
  data_consulta             date           NOT NULL,
  medico                    text,
  consulta_conjunta         boolean        NOT NULL,
  valor_total               numeric(12,2)  NOT NULL,
  valor_medico              numeric(12,2)  NOT NULL,
  valor_samira              numeric(12,2)  NOT NULL,
  pct_imposto_medico        numeric(5,2)   NOT NULL,
  pct_imposto_samira        numeric(5,2)   NOT NULL,
  pct_administracao_medico  numeric(5,2)   NOT NULL,
  imposto_medico            numeric(12,2)  NOT NULL,
  imposto_samira            numeric(12,2)  NOT NULL,
  administracao_medico      numeric(12,2)  NOT NULL,
  valor_liquido_medico      numeric(12,2)  NOT NULL,
  valor_liquido_samira      numeric(12,2)  NOT NULL,
  status_pagamento          text           NOT NULL,
  valor_recebido            numeric(12,2)  NOT NULL DEFAULT 0,
  observacoes               text,
  created_by                uuid           NOT NULL REFERENCES auth.users(id),
  created_at                timestamptz    NOT NULL DEFAULT now(),
  updated_at                timestamptz    NOT NULL DEFAULT now(),

  CONSTRAINT amb_paciente_nome_ck CHECK (length(trim(paciente_nome)) > 0),
  CONSTRAINT amb_status_ck CHECK (status_pagamento IN ('pendente', 'pago', 'parcial')),
  CONSTRAINT amb_valor_total_ck CHECK (valor_total >= 0),
  CONSTRAINT amb_valor_medico_ck CHECK (valor_medico >= 0),
  CONSTRAINT amb_valor_samira_ck CHECK (valor_samira >= 0),
  CONSTRAINT amb_imposto_medico_ck CHECK (imposto_medico >= 0),
  CONSTRAINT amb_imposto_samira_ck CHECK (imposto_samira >= 0),
  CONSTRAINT amb_adm_medico_ck CHECK (administracao_medico >= 0),
  CONSTRAINT amb_liquido_medico_ck CHECK (valor_liquido_medico >= 0),
  CONSTRAINT amb_liquido_samira_ck CHECK (valor_liquido_samira >= 0),
  CONSTRAINT amb_valor_recebido_ck CHECK (valor_recebido >= 0),
  CONSTRAINT amb_conjunta_regra_ck CHECK (
    (
      consulta_conjunta = true
      AND medico IS NOT NULL
      AND btrim(medico) <> ''
      AND valor_medico = 600.00
      AND valor_total >= 600.00
    )
    OR
    (
      consulta_conjunta = false
      AND valor_medico = 0
      AND administracao_medico = 0
    )
  )
);
```

**Observacoes**
- consultas exclusivas da Dra. Samira podem ter `medico = NULL`
- `valor_recebido` e unico por consulta
- `status_pagamento` foi mantido simples para nao antecipar complexidade do modulo de cobranca

---

## 3. Planejamento de RLS

### 3.1 Funcoes auxiliares recomendadas

Para deixar as policies legiveis, o ideal e usar consultas a `profiles` por `auth.uid()`.

Padrao conceitual:

```sql
EXISTS (
  SELECT 1
  FROM profiles
  WHERE id = auth.uid()
    AND role = 'manager'
)
```

e

```sql
EXISTS (
  SELECT 1
  FROM profiles
  WHERE id = auth.uid()
    AND role = 'doctor'
    AND doctor_name = consultas_ambulatoriais.medico
)
```

### 3.2 `ambulatorio_config`

```sql
ALTER TABLE ambulatorio_config ENABLE ROW LEVEL SECURITY;
```

**Policy de leitura**

```sql
CREATE POLICY "ambulatorio_config_select_authenticated"
ON ambulatorio_config
FOR SELECT
USING (auth.role() = 'authenticated');
```

**Policy de update**

```sql
CREATE POLICY "ambulatorio_config_update_finance"
ON ambulatorio_config
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  )
);
```

**Decisao:** nao abrir `INSERT` nem `DELETE` para a aplicacao. A linha inicial sera criada por migration.

### 3.3 `consultas_ambulatoriais`

```sql
ALTER TABLE consultas_ambulatoriais ENABLE ROW LEVEL SECURITY;
```

**Policy de leitura**

```sql
CREATE POLICY "consultas_ambulatoriais_select_authenticated"
ON consultas_ambulatoriais
FOR SELECT
USING (auth.role() = 'authenticated');
```

**Policy de insert para `admin`/`manager`**

```sql
CREATE POLICY "consultas_ambulatoriais_insert_admin_manager"
ON consultas_ambulatoriais
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  )
);
```

**Policy de insert para `doctor`**

```sql
CREATE POLICY "consultas_ambulatoriais_insert_doctor_own_conjunta"
ON consultas_ambulatoriais
FOR INSERT
WITH CHECK (
  consulta_conjunta = true
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'doctor'
      AND doctor_name = consultas_ambulatoriais.medico
  )
);
```

**Policy de update para `admin`/`manager`**

```sql
CREATE POLICY "consultas_ambulatoriais_update_admin_manager"
ON consultas_ambulatoriais
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  )
);
```

**Policy de update para `doctor`**

```sql
CREATE POLICY "consultas_ambulatoriais_update_doctor_own_conjunta"
ON consultas_ambulatoriais
FOR UPDATE
USING (
  consulta_conjunta = true
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'doctor'
      AND doctor_name = consultas_ambulatoriais.medico
  )
)
WITH CHECK (
  consulta_conjunta = true
  AND created_by = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role = 'doctor'
      AND doctor_name = consultas_ambulatoriais.medico
  )
);
```

**Policy de delete**

```sql
CREATE POLICY "consultas_ambulatoriais_delete_admin_manager"
ON consultas_ambulatoriais
FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'manager')
  )
);
```

**Decisao:** `doctor` nao deleta no MVP.

---

## 4. Fluxo de Calculo

### 4.1 Consulta conjunta

```text
valor_medico = 600
valor_samira = valor_total - 600
imposto_medico = valor_medico * pct_imposto_medico
imposto_samira = valor_samira * pct_imposto_samira
administracao_medico = valor_medico * pct_administracao_medico
valor_liquido_medico = valor_medico - imposto_medico - administracao_medico
valor_liquido_samira = valor_samira - imposto_samira
```

**Regra:** se `valor_total < 600`, a consulta conjunta nao pode ser salva.

### 4.2 Consulta exclusiva da Dra. Samira

```text
valor_medico = 0
valor_samira = valor_total
imposto_medico = 0
imposto_samira = valor_samira * pct_imposto_samira
administracao_medico = 0
valor_liquido_medico = 0
valor_liquido_samira = valor_samira - imposto_samira
```

### 4.3 Override manual

O frontend permitira ajuste manual de valores calculados antes de salvar, mas:

- a regra estrutural da consulta conjunta continua exigindo `valor_medico = 600`
- ajustes manuais servem para impostos, liquidos, valor recebido e observacoes

**Decisao:** nao permitir override manual da parte bruta do medico em consulta conjunta.

---

## 5. Integracao com Repasse

### 5.1 Contrato entre modulos

O `repasse.js` nao deve recalcular regras do ambulatorio. Ele deve consumir:

- `valor_liquido_medico`
- `valor_liquido_samira`
- periodo mensal filtrado
- medico responsavel

### 5.2 Estrategia

No fechamento do repasse:
- visitas hospitalares continuam no fluxo atual
- ambulatorio entra como bloco adicional separado
- o relatorio mensal deve diferenciar claramente origem hospitalar vs ambulatorial

**Decisao:** o ambulatorio entra no repasse por soma de liquidos ja persistidos.

---

## 6. Seeds e Checklist de Planejamento

Antes de escrever a migration real, confirmar:

1. percentuais padrao corretos para `ambulatorio_config`
2. usuarios medicos que receberao `doctor_name`
3. existencia de role `admin` real no projeto
4. se `manager` inclui a chefe e/ou secretaria no contexto atual

**Status atual das decisoes**
- percentuais padrao podem nascer neutros/editaveis
- role `admin` existe e deve concentrar acesso inicial a funcionalidades novas
- role `admin` foi confirmada em leitura real do Supabase em 2026-04-07
- existe apenas 1 `profile` com role `doctor`, ligado ao login compartilhado `medicos@gmail.com`
- a decisao de produto/planejamento agora esta fechada em favor da separacao de logins medicos
- portanto, o proximo passo nao e redesenhar RLS, e sim criar 1 auth user/profile por medico para viabilizar o seed definitivo de `doctor_name`

Seed alvo apos separar logins medicos:

```sql
UPDATE profiles SET doctor_name = 'Igor' WHERE role = 'doctor' AND ...;
UPDATE profiles SET doctor_name = 'Beatriz' WHERE role = 'doctor' AND ...;
UPDATE profiles SET doctor_name = 'Eduardo' WHERE role = 'doctor' AND ...;
UPDATE profiles SET doctor_name = 'Tamires' WHERE role = 'doctor' AND ...;
UPDATE profiles SET doctor_name = 'Felipe Reinaldo' WHERE role = 'doctor' AND ...;
```

**Snapshot real lido em 2026-04-07**

```text
3fa5986f-d1c8-4fd7-a719-b615fc5f0ea0 | doctor  | medicos@gmail.com
d8ac7ac4-3fd8-483f-9784-d252308841f2 | manager | gestor@gmail.com
0e19f090-944c-4b5b-abea-959bc0351826 | admin   | admin@apphosp.com.br
```

**Conclusao de planejamento**
- com apenas 1 login medico compartilhado, `profiles.doctor_name` nao consegue representar ownership individual por medico
- como a Opcao A foi escolhida, sera necessario criar um auth user/profile por medico antes da implementacao
- com isso, o desenho atual de RLS permanece valido como direcao arquitetural

---

## 7. Riscos

- Se `profiles.doctor_name` nao for preenchido corretamente, o `doctor` perde permissao de escrita.
- Se o login medico continuar compartilhado, o RLS por medico responsavel nao e implementavel de forma confiavel.
- Se o projeto nao tiver role `admin` de fato, as policies devem ser ajustadas para `manager` como perfil maximo.
- O nome curto do medico passa a ser identificador funcional em parte do modulo; precisa permanecer consistente com o restante do app.
- Como o frontend atual nao tem testes automatizados, qualquer divergencia entre calculo visual e persistencia deve ser validada com casos reais antes do go-live.
