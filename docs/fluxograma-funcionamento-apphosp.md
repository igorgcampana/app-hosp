# AppHosp — Mapa Visual de Escopo

## Como ler

- `FEITO` = pronto para apresentacao
- `PLANEJADO` = entra no roadmap das proximas etapas

## Resumo executivo

Para apresentacao comercial, o AppHosp esta organizado em:

- `Calendario + historico` como entrega ja pronta

As proximas camadas sao:

- `Login + Censo hospitalar + Repasse + Conciliacao + Ambulatorio`
- `Bots + WhatsApp + automacoes`

---

## 1. Visao geral do produto

```mermaid
flowchart LR
    classDef atual fill:#e8f7ee,stroke:#2e7d32,color:#1b4332,stroke-width:2px;
    classDef planejado fill:#eef3ff,stroke:#4f6bed,color:#233876,stroke-width:2px;

    A[Login e controle de acesso] --> B[Censo Hospitalar]
    B --> C[Calendario e historico]
    B --> D[Repasse mensal]
    B --> E[Conciliacao de faturamento]
    B --> F[Ambulatorio]
    B --> G[Bots e automacoes]

    class C atual;
    class A,B,D,E,F,G planejado;
```

---

## 2. Fluxo operacional

```mermaid
flowchart TD
    classDef atual fill:#e8f7ee,stroke:#2e7d32,color:#1b4332,stroke-width:2px;

    A[Usuario faz login] --> B[Supabase Auth valida sessao]
    B --> C[App busca role em profiles]
    C --> D{Role}

    D -->|doctor| E[Ve Censo operacional]
    D -->|manager| F[Ve Ficha em modo leitura]

    E --> H[index.html]
    F --> H

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

    class A,B,C,D,E,F,H,I,I1,I2,I3,I4,I5,I6,J,J1,J2,K,K1,K2,K3,L,L1,L2,L3,L4,M,M1,M2,M3,M4,M5 atual;
```

---

## 3. Ambulatorio: onde ele entra

```mermaid
flowchart TD
    classDef atual fill:#e8f7ee,stroke:#2e7d32,color:#1b4332,stroke-width:2px;
    classDef planejado fill:#eef3ff,stroke:#4f6bed,color:#233876,stroke-width:2px;

    A[Link para ambulatorio] --> B[ambulatorio.html]
    B --> C[Valida sessao]
    C --> D[Busca role e doctor_name]
    D --> E{Role}
    E -->|doctor| F[Acesso medico]
    E -->|manager| G[Acompanhamento gerencial]

    F --> H[Formulario de consulta]
    G --> I[Historico e filtros]
    H --> J[Resumo mensal]
    I --> J
    J --> K[Integracao com repasse]

    class A,B,C,D,E,F,G,H,I,J,K planejado;
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

## O que esta feito x o que esta no plano

### Feito

- calendario por medico e dia
- historico operacional

### Planejado

- login com Supabase
- RBAC por role doctor e manager
- registro diario de visitas
- ficha de pacientes
- repasse mensal com PDFs
- conciliacao com PDF + Gemini + Excel
- ambulatorio
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
