# AppHosp - Censo Hospitalar

## O que é
É um sistema de gestão de censo hospitalar desenvolvido exclusivamente para o Dr. Igor Campana. Uma aplicação em Single Page Application (SPA) pura (sem frameworks) que permite o acompanhamento diário de pacientes internados, registros de visitas médicas e visualização histórica de atendimentos.

## Para que serve
Resolve a necessidade de organizar e centralizar as visitas hospitalares da equipe médica. Substitui planilhas manuais instáveis por um banco de dados relacional seguro. Facilita o controle de visitas diárias, faturamento mensal, e monitoramento do tempo de internação dos pacientes nos vários hospitais de atuação.

## Quem usa e como
1. **Médicos (`doctor`):** Fazem login com email e senha. Acessam a tela inicial para registrar rapidamente as visitas do dia, adicionar novos pacientes ou atualizar pacientes ativos. Também editam dados e excluem registros caso necessário.
2. **Gestores e Secretárias (`manager`):** Fazem login e têm acesso *somente-leitura*. Consultam a Ficha de Pacientes, a Visão Calendário e exportam faturamentos em CSV. O banco bloqueia qualquer tentativa de escrita via API para este cargo, além do bloqueio de interface (botões escondidos).

## Stack técnica
- **Frontend**: HTML5, CSS3 (Vanilla) e JavaScript puro (ES6+). Zero bundlers.
- **Dados**: Supabase (PostgreSQL) com tabelas `patients`, `historico` e `profiles`.
- **Hospedagem**: Vercel.
- **Integrações**: Supabase Auth (Autenticação JWT) e Row Level Security (RLS) para proteção pesada dos dados no Back-end.

## Estrutura de arquivos
- `index.html`: Estrutura principal do painel da SPA. Todos os modais e telas estão aqui.
- `login.html`: Tela isolada para autenticação do usuário. Possui `noindex`.
- `styles.css`: CSS Global e Design System do app. Inclui classes utilitárias, CSS Variables de cor e responsividade.
- `script.js`: Toda a lógica de negócio do painel (operações CRUD, filtros, renderizações, event delegation, UX/Toasts).
- `login.js`: Lógica exclusiva da tela de login (Autenticação do Supabase).
- `vercel.json`: Arquivo de configuração da Vercel para roteamento (fallback) adequado.

## Variáveis de ambiente necessárias
As chaves públicas exigidas pelo frontend (Supabase) estão *hardcoded* nos arquivos `.js` propositalmente por ser um frontend estático estrito sem backend Node. 
As variáveis envolvidas são:
- `SUPABASE_URL`: URL principal do banco.
- `SUPABASE_ANON_KEY`: Chave anônima para interações cliente-servidor (protegida via RLS da tabela).

## Como rodar localmente
1. Clone o repositório no seu computador.
2. Não há necessidade de `npm install`. Basta usar a extensão "Live Server" no VS Code.
3. Clique com o botão direito em `login.html` e escolha "Open with Live Server".
4. O app iniciará no seu navegador padrão (`localhost:5500/login.html`).

## Como fazer deploy
O deploy é contínuo e automático via **Vercel**. 
1. Realize suas alterações localmente.
2. Faça `git commit` das suas mudanças.
3. Faça `git push origin main`.
4. A Vercel interceptará o push e atualizará o domínio oficial em poucos segundos.

## Decisões técnicas importantes
- **Segurança Dupla (RBAC + RLS):** O acesso é verificado no Frontend via atributo `role-manager` no `body` (para sumir com a UI de edição de quem apenas lê) E no Backend pelo Supabase RLS (Row Level Security), com policies que checam o `role` do `auth.users` via `profiles`.
- **Prevenção XSS:** Todo dado injetado no DOM que vem do banco (`innerHTML`) passa por uma função utilitária local `esc(str)` que intercepta tags HTML e scripts maliciosos.
- **Sem frameworks/Bundlers:** Por uma escolha de arquitetura pautada na simplicidade máxima, não se usa React, Vue, Webpack ou Vite. 
- **Event Delegation:** Todos os eventos da SPA (cliques em botões, aberturas de modal, ações nas tabelas) estão acorrentados em um único `document.addEventListener` global usando `data-action` visando estrita performance de memória.

## Funcionalidades implementadas
- [x] Autenticação completa via Supabase (Login).
- [x] Painel de "Atalho Rápido" do dia anterior (calculado de D-1 a D-5 automaticamente).
- [x] Ficha completa de pacientes com pesquisa dinâmica dos Internados x Alta.
- [x] Lógica de reinternação (nova cobrança = novo paciente único e separado).
- [x] Calendário detalhado dia a dia e exportação CSV granular por Médico.
- [x] UX unificado com Design System, Toasts animados (substituindo `alert()`), modais centralizados.
- [x] Bloqueador para evitar duplo clique em interações assíncronas (race condition).
- [x] Segurança em Banco de Dados (Policies RLS).

## Próximos passos planejados
- Configurar envio automatizado do CSV mensalmente para e-mail da secretária.
- Adicionar dashboard visual (Gráficos) com totais do Mês por Hospital.

---

## Para a IA que vai assumir este projeto

**Contexto:** Este projeto é CRÍTICO para o bolso e controle financeiro do Dr. Igor Campana.

**Padrões adotados:**
- **Identidade visual estrita:** Utilize as variáveis CSS localizadas no root de `styles.css`. Cor Primária `#20515F`. Fonte para Textos `Merriweather`, Fontes de Títulos `League Spartan`. Sem Tailwind.
- **Paradigma:** Código Vanilla JS com manipulação direta de DOM. Tudo no `script.js` dentro do wrapper `DOMContentLoaded`.
- **Datas:** Nunca use `Date.toISOString()` sem tratamento pois envia pro UTC (o que troca o dia 21h em Brasília para o dia seguinte). Sempre construa a data no formato legível `YYYY-MM-DD` lendo localmente a data do usuário (`getFullYear`, `getMonth`, etc).

**Não alterar sem discussão:**
- O esquema de banco de dados (`patients`, `historico`, `profiles`).
- A lógica do Event Delegation baseada em `data-action`.
- A hierarquia de responsividade CSS nas tabelas (`tr` transformadas em mobile cards).

**Problemas conhecidos:**
- Nomes dos pacientes inseridos por médicos podem variar na digitação (ex: "Maria Silva" vs "Maria da Silva"). Por isso, o "Atalho Rápido" é fornecido para reuso dos itens correntes.

**Próxima feature prioritária:**
- O desenvolvimento deverá focar em manter as integrações e fluxos estáveis. Caso requisitado modificações, adicione constantes no JS e altere lá (nunca `<option>` hardcoded).
