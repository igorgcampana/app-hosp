# AppHosp — Mapa Visual de Funcionamento

## Como ler

- `ATUAL` = ja implementado no projeto
- `PARCIAL` = existe base tecnica, mas nao esta completo
- `PLANEJADO` = esta no roadmap, ainda nao operacional

## Resumo executivo

Hoje o AppHosp funciona de verdade como:

- `Login + Censo hospitalar + Calendario + Repasse + Conciliacao`

As proximas camadas sao:

- `Ambulatorio`, que ja entrou no repositorio, mas ainda esta incompleto
- `Bots + WhatsApp + automacoes`, que estao planejados, mas ainda nao implementados

---

## 1. Visao geral do produto

```mermaid
flowchart LR
    classDef atual fill:#e8f7ee,stroke:#2e7d32,color:#1b4332,stroke-width:2px;
    classDef parcial fill:#fff7e6,stroke:#f39c12,color:#8a5700,stroke-width:2px;
    classDef planejado fill:#eef3ff,stroke:#4f6bed,color:#233876,stroke-width:2px;

    A[Login e controle de acesso] --> B[Censo Hospitalar]
    B --> C[Calendario e historico]
    B --> D[Repasse mensal]
    B --> E[Conciliacao de faturamento]
    B --> F[Ambulatorio]
    B --> G[Bots e automacoes]

    class A,B,C,D,E atual;
    class F parcial;
    class G planejado;
```

---

## 2. Fluxo operacional atual

```mermaid
flowchart TD
    classDef atual fill:#e8f7ee,stroke:#2e7d32,color:#1b4332,stroke-width:2px;

    A[Usuario faz login] --> B[Supabase Auth valida sessao]
    B --> C[App busca role em profiles]
    C --> D{Role}

    D -->|admin| E[Ve Censo + Repasse + Conciliacao + link Ambulatorio]
    D -->|doctor| F[Ve Censo operacional]
    D -->|manager| G[Ve Ficha em modo leitura]

    E --> H[index.html]
    F --> H
    G --> H

    H --> I[Registro Diario]
    H --> J[Ficha de Pacientes]
    H --> K[Calendario]
    H --> L[Repasse]
    H --> M[Conciliacao]

    I --> I1[Cria ou atualiza paciente]
    I1 --> I2[Grava visitas em historico]
    I2 --> I3[Recalcula datas do paciente]
    I3 --> I4{Alta?}
    I4 -->|sim| I5[Oferece relatorio textual manual]
    I4 -->|nao| I6[Atualiza atalhos e telas]

    J --> J1[Filtra, exporta CSV, edita paciente]
    J --> J2[Abre e salva relatorio]

    K --> K1[Consolida visitas por data e medico]
    K1 --> K2[Permite editar ou excluir visita]
    K1 --> K3[Exporta CSV]

    L --> L1[Pre-popula mes]
    L1 --> L2[Manager informa status e valores]
    L2 --> L3[Calcula divisao de repasse]
    L3 --> L4[Gera PDF geral e PDF por medico]

    M --> M1[Usuario sobe PDF]
    M1 --> M2[Gemini extrai dados]
    M2 --> M3[App cruza com Supabase]
    M3 --> M4[Mostra glosas e divergencias]
    M4 --> M5[Exporta Excel]

    class A,B,C,D,E,F,G,H,I,I1,I2,I3,I4,I5,I6,J,J1,J2,K,K1,K2,K3,L,L1,L2,L3,L4,M,M1,M2,M3,M4,M5 atual;
```

---

## 3. Ambulatorio: onde ele entra

```mermaid
flowchart TD
    classDef atual fill:#e8f7ee,stroke:#2e7d32,color:#1b4332,stroke-width:2px;
    classDef parcial fill:#fff7e6,stroke:#f39c12,color:#8a5700,stroke-width:2px;
    classDef planejado fill:#eef3ff,stroke:#4f6bed,color:#233876,stroke-width:2px;

    A[Link para ambulatorio] --> B[ambulatorio.html]
    B --> C[Valida sessao]
    C --> D[Busca role e doctor_name]
    D --> E{Quem entra hoje?}
    E -->|admin| F[Carrega ambulatorio_config]
    E -->|doctor ou manager| G[Redireciona para index]

    F --> H[Modulo sobe com estado inicial]
    H --> I[Schema e RLS ja desenhados]
    I --> J[Formulario de consulta]
    J --> K[Historico e filtros]
    K --> L[Resumo mensal]
    L --> M[Integracao com repasse]

    class A,B,C,D,E,F,G,H,I parcial;
    class J,K,L,M planejado;
```

---

## 4. Bots e automacoes: arquitetura planejada

```mermaid
flowchart TD
    classDef atual fill:#e8f7ee,stroke:#2e7d32,color:#1b4332,stroke-width:2px;
    classDef planejado fill:#eef3ff,stroke:#4f6bed,color:#233876,stroke-width:2px;

    A[Evento de negocio no AppHosp<br/>internacao ou alta] --> B[Tabelas de cobranca e log]
    B --> C[Supabase Edge Functions]
    C --> D[API WhatsApp externa]
    D --> E[Bot de mensagens]

    E --> F[Msg imediata de internacao]
    E --> G[Cobranca 48h apos alta]
    E --> H[Lembrete 24h para medico]
    E --> I[Lista diaria para secretaria]

    B --> J[PDF automatico de alta e cobranca]
    E --> K[Painel de monitoramento]
    K --> L[Retry em falhas]

    class A,B,C,D,E,F,G,H,I,J,K,L planejado;
```

---

## O que esta implementado x o que esta so no plano

### Implementado hoje

- login com Supabase
- RBAC por role
- registro diario de visitas
- ficha de pacientes
- calendario por medico e dia
- repasse mensal com PDFs
- conciliacao com PDF + Gemini + Excel

### Parcial

- pagina e bootstrap do ambulatorio
- migration executavel do schema do ambulatorio
- desenho de RLS e rollout de auth medico

### Ainda planejado

- cobrancas estruturadas
- Edge Functions para comunicacao
- integracao WhatsApp
- bots
- automacoes por delay e cron
- monitoramento e retry de envios

---

## Onde abrir o Mermaid

### Opcao 1: abrir a versao pronta no navegador

Abra este arquivo:

- [fluxograma-funcionamento-apphosp.html](/Users/igorcampana/projetos_programacao/AppHosp/docs/fluxograma-funcionamento-apphosp.html)

### Opcao 2: colocar num lugar que renderiza Mermaid

Funciona bem em:

- GitHub README ou arquivo `.md` dentro do repo
- Obsidian
- Notion com bloco Mermaid
- Mermaid Live Editor

### Opcao 3: colar no Mermaid Live Editor

Cole qualquer um dos blocos acima em:

- `https://mermaid.live`

---

## Fonte deste alinhamento

- `script.js`
- `login.js`
- `repasse.js`
- `conciliacao.js`
- `ambulatorio.js`
- `ambulatorio.html`
- `README.md`
- `AppHosp_v2_Plano_de_Fases.md`
- `scripts/fase1-migration-execute.sql`
