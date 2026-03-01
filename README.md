# AppHosp - Censo Hospitalar

## O que é
O AppHosp é um sistema de gestão de censo hospitalar desenvolvido para o Dr. Igor Campana. Ele permite o acompanhamento diário de pacientes internados, registros de visitas médicas e visualização histórica de atendimentos.

## Para que serve
O aplicativo resolve a necessidade de organizar e centralizar as visitas hospitalares da equipe médica, facilitando a contagem de visitas mensais para faturamento e o acompanhamento de altas e intercorrências. Ele substitui planilhas manuais por um banco de dados relacional seguro.

## Quem usa e como
1. **Médicos:** Realizam o login, acessam o "Registro Diário" para cadastrar novas visitas ou dar alta a pacientes, e consultam a "Ficha de Pacientes" e o "Calendário".
2. **Gestores e Secretárias:** Realizam o login e têm acesso restrito apenas à visualização dos dados e à exportação de relatórios em CSV. Não possuem permissão para criar, editar ou excluir registros.

## Stack técnica
- **Frontend:** HTML5, CSS3 (Vanilla) e JavaScript.
- **Banco de Dados:** Supabase (PostgreSQL).
- **Autenticação:** Supabase Auth.
- **Hospedagem:** Vercel (conectado via GitHub).
- **Design System:** Baseado no manual de marca do Dr. Igor Campana (Cores: #20515F, #E5EBEA; Fontes: League Spartan e Merriweather).

## Estrutura de arquivos
- `index.html`: Estrutura principal do painel (single-page application).
- `login.html`: Tela de login.
- `script.js`: Toda a lógica de negócio, integração com Supabase e controle de permissões.
- `styles.css`: Estilização completa seguindo a identidade visual.
- `login.js`: Lógica específica da tela de login.
- `vercel.json`: Configurações de redirecionamento para o deploy.

## Variáveis de ambiente necessárias
- `SUPABASE_URL`: URL do projeto no Supabase.
- `SUPABASE_ANON_KEY`: Chave anônima para acesso ao cliente Supabase.
*(As chaves estão configuradas diretamente nos arquivos JS por conveniência de hospedagem estática, mas recomenda-se cautela em projetos públicos).*

## Como rodar localmente
1. Clone o repositório.
2. Abra o arquivo `login.html` ou `index.html` em um servidor local (como Live Server do VS Code).
3. Certifique-se de que as chaves do Supabase no topo de `script.js` e `login.js` estão corretas.

## Como fazer deploy
O deploy é automático via **Vercel**. Qualquer `git push` para a branch `main` disparará uma nova versão no endereço oficial: `apphosp.drigorcampana.com.br`.

## Decisões técnicas importantes
- **Controle de Acesso (RBAC):** Implementado via tabela `profiles` no Supabase. O papel do usuário (`doctor` ou `manager`) é verificado no login e aplicado via JavaScript (escondendo elementos) e CSS (bloqueando botões pela classe `.role-manager`).
- **Layout Responsivo:** O container principal é limitado a 1200px para garantir legibilidade em desktops, com ajustes específicos para mobile via Media Queries.
- **Identificação de Usuário:** O e-mail do usuário logado é exibido na navbar para facilitar a alternância entre contas de teste e produção.

## Funcionalidades implementadas
- [x] Autenticação via Supabase.
- [x] Registro diário de visitas com busca de pacientes ativos.
- [x] Ficha completa de pacientes com filtros e ordenação.
- [x] Visão Calendário com totais mensais por médico.
- [x] Exportação de todos os dados em CSV (Censo e Calendário).
- [x] Controle de permissões (Médico vs. Gestor).
- [x] Identidade visual personalizada.

## Próximos passos planejados
- [ ] Implementar notificações de "pendência" para pacientes não visitados há mais de 24h.
- [ ] Criar dashboard gráfico de estatísticas mensais.

## Para a IA que vai assumir este projeto
**Contexto:** Este projeto é crítico para a rotina do Dr. Igor Campana.
**Padrões adotados:**
- Identidade visual estrita: Primária `#20515F`.
- Não remova a classe `.container` do CSS (limita a largura da tela).
- Ao alterar o `script.js`, certifique-se de não apagar a linha `document.body.style.visibility = 'visible';` que é necessária para renderizar após a autenticação.
- O controle de permissões para gestores (`role === 'manager'`) deve ser mantido em todas as novas features de escrita.
