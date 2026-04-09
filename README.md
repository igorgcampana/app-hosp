# AppHosp - Censo Hospitalar

## O que é
É um sistema de gestão hospitalar desenvolvido exclusivamente para o Dr. Igor Campana. Hoje o núcleo produtivo cobre censo hospitalar, histórico de visitas, repasse mensal e conciliação de faturamento. O repositório também já contém a base inicial do módulo de ambulatório e a documentação do roadmap de cobrança e automações.

## Para que serve
Resolve a necessidade de organizar e centralizar as visitas hospitalares da equipe médica. Substitui planilhas manuais instáveis por um banco de dados relacional seguro. Facilita o controle de visitas diárias, faturamento mensal, conciliação de pagamentos e monitoramento do tempo de internação nos vários hospitais de atuação.

## Quem usa e como
1. **Admin (`admin`):** Tem acesso ao núcleo completo do sistema. Hoje é o perfil que enxerga Repasse, Conciliação e o link do módulo de Ambulatório.
2. **Médicos (`doctor`):** Fazem login com email e senha. Acessam o fluxo operacional do censo para registrar visitas, atualizar pacientes ativos, editar dados clínico-operacionais e trabalhar o calendário.
3. **Gestores e Secretárias (`manager`):** Fazem login e têm acesso *somente-leitura* ao núcleo do censo. Consultam a Ficha de Pacientes e a Visão Calendário. O banco bloqueia qualquer tentativa de escrita via API para este cargo, além do bloqueio de interface.

## Stack técnica
- **Frontend**: HTML5, CSS3 (Vanilla) e JavaScript puro (ES6+). Zero bundlers.
- **Dados**: Supabase (PostgreSQL) com núcleo em `patients`, `historico`, `profiles`, `relatorios` e tabelas de repasse.
- **Hospedagem**: Vercel.
- **Integrações**: Supabase Auth (Autenticação JWT), Row Level Security (RLS), Gemini para conciliação de PDFs e bibliotecas client-side para exportação PDF/Excel.

## Estrutura de arquivos
- `index.html`: Estrutura principal do painel da SPA. Todos os modais e telas estão aqui.
- `login.html`: Tela isolada para autenticação do usuário. Possui `noindex`.
- `styles.css`: CSS Global e Design System do app. Inclui classes utilitárias, CSS Variables de cor e responsividade.
- `script.js`: Toda a lógica de negócio do painel (operações CRUD, filtros, renderizações, event delegation, UX/Toasts).
- `login.js`: Lógica exclusiva da tela de login (Autenticação do Supabase).
- `repasse.js`: Módulo isolado do fechamento mensal e geração de PDFs de repasse.
- `conciliacao.js`: Módulo de conciliação de faturamento com extração via Gemini e exportação Excel.
- `ambulatorio.html`: Entrada standalone do módulo de consultas ambulatoriais.
- `ambulatorio.js`: Bootstrap inicial do módulo de ambulatório.
- `vercel.json`: Arquivo de configuração da Vercel para roteamento (fallback) adequado.
- `BROWNFIELD_MAPPING.md`: Mapeamento amplo da arquitetura, fluxos, regras de negócio e riscos do sistema.
- `.specs/codebase/`: Documentação brownfield fatiada por tema (`ARCHITECTURE`, `STRUCTURE`, `CONCERNS`, `TESTING`, etc.).
- `.specs/project/`: Estado, roadmap e visão executiva do projeto.
- `docs/plans/`: Planos operacionais e decisões recentes das próximas fases.
- `docs/fluxograma-funcionamento-apphosp.md`: Fluxo consolidado do produto separando atual, parcial e planejado.
- `docs/fluxograma-funcionamento-apphosp.html`: Versão visual do fluxograma para abrir no navegador.

## Variáveis de ambiente necessárias
As chaves públicas exigidas pelo frontend (Supabase) estão *hardcoded* em `script.js` e `login.js` propositalmente por ser um frontend estático estrito sem backend Node.
As variáveis envolvidas são:
- `SUPABASE_URL`: URL principal do banco.
- `SUPABASE_ANON_KEY`: Chave anônima para interações cliente-servidor (protegida via RLS da tabela).

## Como rodar localmente
1. Clone o repositório no seu computador.
2. Não há necessidade de `npm install`.
3. Sirva os arquivos estáticos com uma extensão como "Live Server" no VS Code ou com um servidor HTTP simples.
4. Abra `login.html` no navegador pelo endereço servido localmente.

## Como fazer deploy
O deploy é contínuo e automático via **Vercel**. 
1. Realize suas alterações localmente.
2. Faça `git commit` das suas mudanças.
3. Faça `git push origin main`.
4. A Vercel interceptará o push e atualizará o domínio oficial em poucos segundos.

## Decisões técnicas importantes
- **Segurança Dupla (RBAC + RLS):** O acesso é verificado no Frontend via classe de role no `body` E no Backend pelo Supabase RLS (Row Level Security), com decisões de interface e dados guiadas por `profiles.role`.
- **Prevenção XSS:** Todo dado injetado no DOM que vem do banco (`innerHTML`) passa por uma função utilitária local `esc(str)` que intercepta tags HTML e scripts maliciosos.
- **Edge Functions Hardened:** Todo tráfego de inteligência artificial ou APIs de terceiros está isolado no servidor (Gateway Protection). As funções incluem Middlewares de JWT Auth, CORS restrito à Vercel e mitigação contra sobrecarga (Payload limit). Leia a [documentação de Troublehsooting do Backend](docs/security_hardening_edge_function.md).
- **Sem frameworks/Bundlers:** Por uma escolha de arquitetura pautada na simplicidade máxima, não se usa React, Vue, Webpack ou Vite. 
- **Event Delegation:** Todos os eventos da SPA (cliques em botões, aberturas de modal, ações nas tabelas) estão acorrentados em um único `document.addEventListener` global usando `data-action` visando estrita performance de memória.
- **Init defensivo de UI:** O `body` inicia oculto até a sessão ser validada e um loader visual (`#app-loader`) protege contra flash de interface antes do auth check.

## Funcionalidades implementadas
- [x] Autenticação completa via Supabase (Login).
- [x] Painel de "Atalho Rápido" do dia anterior (calculado de D-1 a D-5 automaticamente).
- [x] Ficha completa de pacientes com pesquisa dinâmica dos Internados x Alta.
- [x] Lógica de reinternação (nova cobrança = novo paciente único e separado).
- [x] Calendário detalhado dia a dia e exportação CSV granular por Médico.
- [x] Relatório textual de internação com persistência em banco.
- [x] Repasse mensal com configuração, histórico, PDFs geral e por médico.
- [x] Conciliação de faturamento para HSL com extração de PDF via Gemini e exportação Excel.
- [x] UX unificado com Design System, Toasts animados e **Bottom Tab Bar mobile** (ícones + labels).
- [x] Cabeçalho mobile otimizado com botão Sair discreto e logo centralizado.
- [x] Bloqueador para evitar duplo clique em interações assíncronas (race condition).
- [x] Segurança em Banco de Dados (Policies RLS).

## Funcionalidades parciais / em implantação
- [~] Módulo de **Consultas Ambulatoriais** com página dedicada (`ambulatorio.html`) e bootstrap inicial.
- [~] Migration executável do ambulatório em `scripts/fase1-migration-execute.sql`.
- [~] Documentação operacional do rollout de auth, schema e RLS do ambulatório em `docs/plans/`.

## Próximos passos planejados
- Prioridade 1: concluir o go-live do módulo de **Consultas Ambulatoriais**.
- Prioridade 2: especificar e implementar **Cobrança de Particulares**.
- Prioridade 3: expandir a **Conciliação** para Hospital Vila Nova.
- Prioridade 4: estruturar **WhatsApp + Automações**, após definição de número comercial, API e templates.

## Estado atual do planejamento
- A trilha ativa continua sendo **Consultas Ambulatoriais**.
- A feature já possui `spec.md`, `tasks.md` e `design.md` em `.specs/features/consultas-ambulatoriais/`.
- A migration da feature está documentada em `.specs/features/consultas-ambulatoriais/migration.sql` e também existe uma versão executável local em `scripts/fase1-migration-execute.sql`.
- O desenho de banco dessa feature inclui:
  - nova tabela `ambulatorio_config`
  - nova tabela `consultas_ambulatoriais`
  - novo campo `doctor_name` em `profiles`
- As regras já fechadas para o ambulatório são:
  - `manager` cadastra e edita tudo
  - `doctor` cadastra/edita apenas consultas conjuntas nas quais ele é o médico responsável
  - status iniciais: `pendente`, `pago`, `parcial`
  - `valor_recebido` é único por consulta
  - em consulta conjunta, o médico sempre recebe `R$ 600,00` bruto
- O estado operacional detalhado dessa fase está em:
  - `docs/plans/2026-04-07-ambulatorio-operational-execution-plan.md`
  - `docs/plans/2026-04-07-ambulatorio-auth-rollout-temp-users.md`
  - `.specs/project/STATE.md`

---

## Para a IA que vai assumir este projeto

**Contexto:** Este projeto é CRÍTICO para o bolso e controle financeiro do Dr. Igor Campana.

**Padrões adotados:**
- **Identidade visual estrita:** Utilize as variáveis CSS localizadas no root de `styles.css`. Cor Primária `#20515F`. Fonte para Textos `Merriweather`, Fontes de Títulos `League Spartan`. Sem Tailwind.
- **Paradigma:** Código Vanilla JS com manipulação direta de DOM. Tudo no `script.js` dentro do wrapper `DOMContentLoaded`.
- **Datas:** Nunca use `Date.toISOString()` sem tratamento pois envia pro UTC (o que troca o dia 21h em Brasília para o dia seguinte). Sempre construa a data no formato legível `YYYY-MM-DD` lendo localmente a data do usuário (`getFullYear`, `getMonth`, etc).
- **Ponto de entrada da documentação:** Consulte primeiro `BROWNFIELD_MAPPING.md` e depois `.specs/codebase/README.md` para navegação rápida.

**Não alterar sem discussão:**
- O esquema de banco de dados (`patients`, `historico`, `profiles`).
- A lógica do Event Delegation baseada em `data-action`.
- A hierarquia de responsividade CSS nas tabelas (`tr` transformadas em mobile cards).

**Problemas conhecidos:**
- Nomes dos pacientes inseridos por médicos podem variar na digitação (ex: "Maria Silva" vs "Maria da Silva"). Por isso, o "Atalho Rápido" é fornecido para reuso dos itens correntes.

**Próxima feature prioritária:**
- A próxima feature prioritária é **Consultas Ambulatoriais**.
- Antes de implementar, consultar:
  - `.specs/features/consultas-ambulatoriais/spec.md`
  - `.specs/features/consultas-ambulatoriais/tasks.md`
  - `.specs/features/consultas-ambulatoriais/design.md`
  - `.specs/features/consultas-ambulatoriais/migration.sql`
- O próximo passo operacional do módulo é concluir migration, seed de `doctor_name` e seguir para a UI funcional completa.
