# STATUS

_Atualizado em 14/10/2026._

## Entregue

- Todos os requisitos obrigatórios do enunciado e os dois extras (dashboard em tempo real, deploy Vercel/Docker).
- Design system da marca (produto **Flash Contacts** by Flash Analytics): tokens em camadas, Roboto e Geist Mono, perfil no canto superior direito, origem como grupo de agenda (sem CRM) em etiqueta quadrada, cantos retos, profundidade minimalista (elevation-1…4, modal-depth com borda em degradê, sombra mínima nos títulos),
  logo de chevrons em SVG + favicon, sidebar escura, catálogo vivo em `/design-system`, `docs/DESIGN-SYSTEM.md` e
  teste de contraste WCAG AA + proibição de cor fixa (`tests/unit/design-tokens.test.ts`). Capturas refeitas.
- Documentação: `README.md`, `docs/REQUISITOS.md`, `docs/ARQUITETURA.md` (UML em Mermaid), `docs/SEGURANCA.md`,
  `docs/DECISOES.md`, capturas em `docs/screenshots/`.
- Qualidade: lint e tipos limpos; 45 testes unitários (26 deles guardam o design system); 13 testes ponta a ponta passando contra o build de produção.
- Revisão independente de segurança (só leitura) feita ao fim: 1 bloqueante, 4 importantes e 6 menores encontrados,
  corrigidos e cobertos por teste quando aplicável (força bruta no 2FA, corridas no bloqueio, IP do
  X-Forwarded-For, expiração ociosa com aba aberta, ativação de 2FA sem senha, entre outros). Exceção: o e-mail
  da solicitação não verificado foi só **mitigado** (aviso na tela de aprovação); resolver exige confirmação por e-mail.

- Busca de CEP no cadastro de contato (ViaCEP → BrasilAPI pelo servidor, cache, limite por usuário, fornecedor
  simulado para testes). Lint, tipos e 56 testes unitários passando; **e2e novo escrito, ainda não executado**.

- Admin também cadastra contatos (os outros admins são notificados; quem cadastrou não). Tipos e lint limpos;
  **e2e novo escrito, ainda não executado**.

- Painel: origem dos números pelo DDD (mapa em grade do Brasil + gráfico, regiões, DDDs mais frequentes,
  DDD × endereço, atalhos para a lista filtrada) e recusa de DDD inexistente no cadastro. Tipos e lint limpos;
  **testes unitários novos escritos, ainda não executados; tela ainda não conferida no navegador**.

- CRUD de contatos (detalhe, edição, exclusão), exportação Excel/CSV, importação .xlsx/CSV (sem biblioteca),
  atalhos de WhatsApp/ligação/SMS/e-mail e CRUD de usuários pelo admin. Tipos e lint limpos;
  **testes unitários e e2e novos escritos, ainda não executados; telas ainda não conferidas no navegador**.

- Permissões por usuário (Leitor/Editor/Criar/Apagar/Exportar), aviso de duplicado, ordenação por coluna, favoritos,
  notas e histórico de auditoria no contato, compartilhar (link/WhatsApp/e-mail/.vcf), foto do contato (usuários não têm foto), tema escuro,
  busca no topo (Ctrl+K), discador, job diário de limpeza (cron), dados de teste e limpar a base. Tipos e lint
  limpos; **testes unitários e e2e novos escritos, ainda não executados; telas ainda não conferidas no navegador**.

- Discador maior e com sugestão em tempo real (número ou nome); "Minha conta" corrigida (segredo de 2FA com chave
  trocada derrubava a página); indicador do Next removido; suporte (botão flutuante, chamados em /admin/suporte,
  WhatsApp/e-mail do suporte); polimento visual com o degradê da marca.
- **Demonstração em produção:** `ALLOW_DEMO_DATA` e `ALLOW_DATA_RESET` estão **ligados de propósito** em
  flash.vittorccf.com.br, para quem avaliar poder gerar e limpar dados. Num produto, ficam desligados (padrão).
- **Testes executados:** 141 unitários e 30 ponta a ponta passando contra o build de produção. Eles acharam e
  corrigimos bugs reais: listas (UF/origem) apagadas depois de um erro do servidor, menu do topo quebrado pelo
  `backdrop-blur`, menu/tempo real presos no modo "senha provisória" após a troca, e usuário desativado sumindo da
  lista. `scripts/look.mjs` gera capturas de revisão visual contra o servidor de teste.

## Verificado × não verificado

| Item | Situação |
| --- | --- |
| Fluxos e controles de segurança | Verificados por e2e (Chromium local, build de produção, Postgres embutido) |
| Build `standalone` levando argon2 nativo e o runtime do Prisma 7 (driver `pg`) | Verificado localmente (`/api/health` consultando o banco) |
| `Dockerfile` / `docker-compose.yml` | **Não executados** (sem Docker na máquina de desenvolvimento) |
| Deploy na Vercel + Neon | **Executado** em https://flash.vittorccf.com.br (Vercel `gru1` + Neon `sa-east-1`); `/api/health` ok |
| Pipeline do GitHub Actions | **Não executado** (repositório ainda não publicado) |
| Diagramas Mermaid | Escritos à mão, sem renderização local; conferir no GitHub |
| Busca de CEP contra as APIs reais | **Não executada** (testes usam fornecedor simulado, sem rede); e2e do CEP ainda não rodado |

## Próximos passos (priorizados)

1. Deixar o CI verde no GitHub (falharam o teste de revogação de sessão e o do discador, este já corrigido) e o primeiro `docker compose up`.
2. Migrar a autenticação para um provedor de identidade (Keycloak/Entra ID) ou para o Better Auth, mantendo a
   aprovação de operadores e a sessão revogável (`docs/DECISOES.md`, seção 5). Isso resolve de uma vez a recuperação
   de senha, passkeys, códigos de recuperação e o 2FA obrigatório para admins.
3. Rodar o job de limpeza (`/api/cron/limpeza`, já implementado) num cron real e acompanhar o volume.
4. Índices/busca dedicada se a ordenação por nome/cidade ficar lenta com milhões de contatos (ARQUITETURA, seção 11).
