# Decisões técnicas: prós e contras

O enunciado deixa a ferramenta livre e pede que eu mostre os prós e contras da escolha. Cada decisão abaixo tem a
alternativa considerada e o que me faria mudar de ideia.

## Resumo: o que escolhi para o teste × o que recomendo para produção

Algumas escolhas servem tanto ao teste quanto a um produto real. Outras foram feitas **porque** é um teste (para
mostrar o controle que está sendo avaliado), e eu as trocaria num produto. Deixo essa diferença explícita:

| Tema | No teste | Em produção | Por quê |
| --- | --- | --- | --- |
| Linguagem/framework | Next.js + TypeScript | **Mantém**, ou a stack que o time já opera (seção 12) | Um time pequeno entrega e mantém rápido; se o time for Java/.NET, a manutenibilidade pesa mais |
| Banco | PostgreSQL | **Mantém** | Domínio relacional, regras garantidas no banco, `LISTEN/NOTIFY` |
| Autenticação | Própria (argon2id, sessão no banco, 2FA) | **Provedor de identidade** (Keycloak/Entra ID) ou biblioteca mantida (Better Auth) | Código de auth próprio é o maior passivo de risco; provedor traz SSO, passkeys e recuperação de senha |
| Tempo real | Postgres + SSE | **Mantém** até milhares de conexões simultâneas | Sem infraestrutura extra; troca isolada em `src/server/realtime/` |
| Plataforma alternativa | Supabase descartado (seção 2) | Reavaliar se o time não quiser manter backend | Entregaria com menos código, mas com outros riscos |
| ORM | Prisma 7 + `@prisma/adapter-pg` | Feito | Cliente em TypeScript, sem engine nativo; conexão pelo driver `pg` |
| CEP automático | ViaCEP → BrasilAPI, pelo servidor (seção 12) | **Mantém** | Grátis, sem cadastro, com reserva; pago só se o CEP virar parte crítica |
| Mapa por DDD | Cartograma em grade, sem biblioteca (seção 13) | **Mantém**; mapa geográfico só se precisar de cidade | Mais justo para contagem por UF, leve e sem dado externo |
| Planilhas | .xlsx e CSV sem biblioteca (seção 14) | Reavaliar se precisar de fórmulas/estilos | Sem dependência nova; o formato usado é pequeno e estável |
| WhatsApp disponível? | Regra por tipo de número + campo no cadastro (seção 15) | **Mantém** até existir consulta oficial | Única forma legítima e sem custo |
| Permissões | Lista por usuário + perfis prontos (seção 16) | **Mantém**; papéis nomeados se crescer | Simples de auditar; cobre Leitor/Editor/Criar/Apagar |
| Tema escuro | Tokens redefinidos por `data-theme`, cookie lido no servidor (seção 17) | **Mantém** | Sem piscar e sem script inline (CSP) |
| Foto do contato | No Postgres (bytea), tabela própria (seção 18) | Object storage (Vercel Blob/S3) com muitos usuários | Sem serviço externo; backup junto com a base |

## 1. Código (Next.js full-stack) em vez de low-code/no-code

| Prós | Contras |
| --- | --- |
| Controle total do login, da sessão e dos cabeçalhos, que são o critério principal da avaliação | Mais código para manter do que um Bubble/FlutterFlow/Retool |
| Testável de ponta a ponta e versionável (CI, code review, migrations) | Exige time de desenvolvimento para evoluir |
| Sem custo por usuário nem dependência de fornecedor | Tempo de entrega maior para telas simples |

**Mudaria se:** o produto fosse um back-office interno descartável. Aí um Retool + Supabase entregaria em horas.

## 2. Por que não Supabase (o concorrente mais forte para este enunciado)

O Supabase cobre quase tudo que o teste pede numa plataforma só: Postgres, login pronto (com confirmação de e-mail e
recuperação de senha), tempo real nativo e regras de acesso por linha no banco (Row Level Security). Com ele, o
mesmo escopo sairia com bem menos código. Considerei e descartei, pelos motivos abaixo.

| Prós do Supabase | Contras do Supabase (para este caso) |
| --- | --- |
| Auth gerenciada: e-mail verificado, recuperação de senha, OAuth, MFA | **Esconde justamente o que o teste avalia**: a forma de fazer o login vira configuração, não decisão de engenharia |
| Realtime pronto, sem escrever o barramento | O fluxo "pedir acesso → esperar aprovação" não é nativo: continuaria precisando de tabela, regras e código próprios |
| RLS: a regra "operador só vê os seus" fica no banco | **RLS mal configurada é uma fonte clássica de vazamento de dados** (o cliente fala direto com o banco); cada tabela nova exige política correta |
| Menos backend para manter | Dependência de fornecedor; auto-hospedar o Supabase on-premises é bem mais pesado que um Postgres |
| | A lógica fica espalhada entre políticas SQL, funções e o front, mais difícil de testar ponta a ponta |

**Mudaria se:** a prioridade fosse prazo e o time não quisesse manter backend. Nesse caso, Supabase + RLS revisada
seria uma escolha legítima. O fluxo de aprovação seria uma tabela `signup_requests` com política de inserção anônima
e um gatilho para criar o usuário.

## 3. Next.js App Router (front e back juntos) em vez de SPA + API separada

| Prós | Contras |
| --- | --- |
| Uma base, um deploy, tipos compartilhados de ponta a ponta | Acoplamento: um app mobile futuro precisaria de uma API pública (as funções em `src/server` já estão prontas para isso) |
| Server Components: dados e regras ficam no servidor, e o navegador recebe HTML | Modelo mental novo (Server × Client Components, Server Actions) |
| Server Actions com checagem de Origin nativa (CSRF) | Server Actions são endpoints públicos implícitos: exigem disciplina (resolvida pela DAL em toda action) |
| | Framework com mudanças frequentes entre versões (ex.: `middleware` virou `proxy` no 16) e histórico de falhas de segurança no middleware, por isso a autorização não depende dele |

## 4. PostgreSQL + Prisma

| Prós | Contras |
| --- | --- |
| Relacional combina com o domínio (usuários, solicitações, contatos, auditoria) | Prisma esconde parte do SQL; agregações do painel e o rate limit usam SQL manual parametrizado |
| Índice parcial, CHECKs e `LISTEN/NOTIFY` no próprio banco | `LISTEN` precisa de conexão direta (sem pooler em modo transação) |
| Migrations versionadas e revisáveis | O 7 exige adapter de driver e `prisma.config.ts` (configuração em dois lugares) |

**Prisma 7 (feito):** gerador `prisma-client` em `src/generated/prisma`, conexão pelo `@prisma/adapter-pg` e URLs do
CLI em `prisma.config.ts`. Sem o engine nativo, o build fica menor e o Windows não trava mais a DLL no `generate`.
Os testes unitários e ponta a ponta passaram na versão nova sem mudança de comportamento.
**Alternativa considerada:** Drizzle, que fica mais perto do SQL. Mas o Prisma tem migrations mais maduras e é o
padrão de outro projeto meu, o que reduz o custo de manutenção.

## 5. Autenticação própria — e a recomendação para produção

A regra geral é **não reinventar auth**. No teste fiz diferente, por dois motivos: o enunciado avalia justamente
**como** o login foi feito, e o fluxo "solicitar acesso → esperar aprovação em tempo real" não é padrão em nenhum
provedor. Implementar os controles mostra que sei **quais** controles importam e por quê
(seção 1 de [SEGURANCA.md](SEGURANCA.md)).

| Prós | Contras |
| --- | --- |
| Cada controle é visível e testado | Responsabilidade de manter em dia: código de auth é o maior passivo de risco |
| Sem custo nem dependência externa; funciona on-premises e sem internet | Não traz de graça SSO, passkeys nem recuperação por e-mail |
| Sessão revogável na hora, sob nosso controle | Uma falha de implementação aqui compromete tudo |

**Recomendação para produção: não manter auth própria.** Em ordem de preferência:

1. **O provedor de identidade que a empresa já usa** (Entra ID, Google Workspace) ou **Keycloak** auto-hospedado
   (OIDC). Traz SSO, MFA/passkeys, recuperação de senha e política de senha centralizada, além de auditoria de acesso
   num lugar só. A aprovação de operadores continua sendo nossa: o usuário se autentica no provedor e só entra no
   sistema depois que um admin aprova o vínculo.
2. **Better Auth** (biblioteca TypeScript mantida pela comunidade), se não houver provedor corporativo. Roda no nosso
   Postgres, sem SaaS, com 2FA, passkeys e rate limit prontos. Mantemos o controle sem manter a criptografia.

**Caminho de migração** (as telas e os casos de uso dependem só de `requireUser()`/`requireAdmin()`):
- trocar `src/server/auth/session.ts` e `login.ts` pela integração escolhida;
- manter `dal.ts` como fachada (mesmas funções, nova implementação);
- manter `SignupRequest` e a aprovação: no fluxo OIDC, o pedido de acesso nasce no primeiro login pelo provedor;
- os e2e de segurança (acesso negado, operador × admin, revogação em tempo real) continuam valendo como contrato.

## 6. Sessão opaca no banco em vez de JWT

| Prós | Contras |
| --- | --- |
| Revogação imediata (desativar usuário, trocar senha) | Uma consulta ao banco por requisição (indexada, uma por renderização graças ao `React.cache`) |
| Token não carrega dados; vazamento do banco não gera sessões (só hash) | Não serve para autenticar serviços terceiros sem estado (não é o caso aqui) |

Essa decisão vale **também** com um provedor de identidade: o token do provedor só autentica a entrada, e a sessão da
aplicação continua no banco, revogável.

## 7. Tempo real: Postgres LISTEN/NOTIFY + Server-Sent Events

Alternativas consideradas: WebSocket (Socket.IO), serviço gerenciado (Pusher/Ably), Supabase Realtime e polling.

| Prós | Contras |
| --- | --- |
| **Zero infraestrutura extra**: o banco que já existe é o barramento | `NOTIFY` não é fila: evento perdido durante uma queda de conexão não é reenviado (resolvido com `resync`) |
| Publicação **transacional**: evento só sai se o dado foi gravado | Limite de payload de 8 KB (usamos só ids e nomes) |
| Funciona com N instâncias sem sticky session nem Redis | Uma conexão `LISTEN` por instância |
| SSE é HTTP comum: passa por proxy, reconecta sozinho, sem biblioteca | Comunicação só servidor → cliente (suficiente: as ações vão por Server Action) |
| Mesma solução na Vercel e on-premises | Na Vercel cada conexão dura ~5 min e reconecta (transparente para o usuário) |

**Por que não polling:** o enunciado proíbe recarregar a tela na espera. Polling a cada poucos segundos atenderia, mas
custa requisições constantes e atrasa a notificação.

**Mudaria se:** passasse de alguns milhares de conexões simultâneas ou de centenas de eventos por segundo. A troca para
Ably/Pusher ou Redis fica isolada em `src/server/realtime/` (ver ARQUITETURA.md, seção 11).

## 8. Dashboard atualizado por evento, lendo agregados mantidos por trigger

O painel escuta os eventos e recarrega os Server Components (com debounce). Os números vêm de `ContactStat`
(contatos por dia de São Paulo, origem, UF, DDD e autor), que um trigger no Postgres atualiza na mesma transação de
cada inserção, edição ou exclusão em `Contact`. Cada atualização do painel lê poucas linhas, com qualquer volume.

**Por que trigger e não job:** o job deixaria o painel atrasado até a próxima execução, e o painel é em tempo real.
O trigger é transacional: o agregado nunca diverge do dado (se a escrita desfaz, o agregado também).
`SELECT contact_stat_rebuild()` reconstrói tudo, se um dia for preciso.

Histórico: a primeira versão rodava as agregações direto em `Contact`:

| Prós | Contras |
| --- | --- |
| Sempre exato e em tempo real, sem tabela extra | Custo por atualização cresce com o volume de contatos |
| Simples de manter | Muitos admins com o painel aberto multiplicam as consultas |

**Custo do trigger:** uma escrita a mais (upsert de uma linha) por contato gravado; contatos do mesmo dia, origem, UF,
DDD e autor disputam a mesma linha. Importações grandes continuam numa transação só.

## 9. Paginação por cursor nas listas grandes, offset nas pequenas

Contatos e atividade (auditoria) paginam por cursor: a próxima página começa depois da última linha vista, na ordem
escolhida (coluna + id para desempate). Usuários, solicitações e notificações continuam com páginas numeradas.

| Prós (cursor) | Contras (cursor) |
| --- | --- |
| Custo igual em qualquer página; sem `OFFSET` | Sem "ir para a página 7": só Anterior/Próxima |
| Inserções durante a navegação não duplicam nem escondem linhas | O cursor depende da ordenação (trocar a ordem volta ao início) |

O cursor é opaco (base64url de JSON) e validado na volta; cursor inválido vale como primeira página. O total
"N contatos" vem dos agregados de `ContactStat`.

## 10. Deploy: Vercel + Neon e Docker Compose

| Opção | Prós | Contras |
| --- | --- | --- |
| Vercel + Neon | Sem servidor para administrar, HTTPS e CDN prontos, preview por PR, escala automática | Custo por uso; conexões SSE contam como execução de função |
| Docker Compose | Roda em qualquer VM ou on-premises, dados sob controle da empresa | Backup, TLS, atualizações e monitoramento ficam por nossa conta |

## 11. Desenvolvimento sem Docker

O Postgres de desenvolvimento e de teste é **embutido** (binários oficiais via npm), seguindo o padrão de outro
projeto meu. Assim, quem avalia roda tudo com `npm install`. O CI usa o serviço oficial `postgres:17`.

## 12. Busca de CEP: ViaCEP com BrasilAPI de reserva, chamadas pelo servidor

O cadastro de contato preenche logradouro, bairro, cidade e UF a partir do CEP. Alternativas consideradas: ViaCEP,
BrasilAPI, OpenCEP, CEP Aberto e opções pagas (licença da base dos Correios, APIs comerciais com SLA).

| Escolha | Por quê |
| --- | --- |
| **ViaCEP** como principal | A mais usada e estável, sem cadastro, devolve exatamente os campos do formulário |
| **BrasilAPI (v2)** como reserva | Independente do ViaCEP e agrega várias fontes; cobre queda ou CEP que uma base ainda não tem |
| Não OpenCEP | Projeto menor: para produto, pesa mais a chance de o serviço continuar existindo do que milissegundos |
| Não CEP Aberto | Exige cadastro/token; o diferencial (latitude/longitude) só vale se o painel ganhar mapa |
| Não pagas | O CEP é atalho de preenchimento, não parte crítica; o formulário funciona sem ele |
| **Pelo servidor**, nunca pelo navegador | Mantém a CSP `connect-src 'self'`; dá tempo limite, cache e limite por usuário |

| Prós | Contras |
| --- | --- |
| Sem custo e sem chave para guardar | Primeira dependência externa em tempo de execução (on-premises precisa de saída de rede) |
| Reserva automática e cache (24 h por CEP) | Sem SLA: se as duas caírem, o preenchimento fica manual (por desenho) |
| Fornecedor isolado em `src/server/zip-code-lookup.ts`; trocar é mexer só nele | |
| Testes sem rede: `CEP_PROVIDER=mock` (e `off` para ambientes sem internet) | |

## 13. Mapa por DDD: cartograma em grade, sem biblioteca de mapas

O painel mostra de onde são os números (UF e região pelo DDD) em duas visões: **mapa** e **gráfico**. A tabela dos 67
DDDs (Anatel) está em `src/lib/ddd.ts`; o banco agrega por (DDD, UF do endereço) e a análise é uma função pura
(`src/lib/phone-regions.ts`).

| Opção | Prós | Contras |
| --- | --- | --- |
| **Cartograma em grade** (escolhido): cada UF é um bloco igual, na posição aproximada | Justo para contagens (o AM não domina só por ser grande); cabe num card; rótulo e número legíveis em todas as UFs, inclusive DF e SE; zero dependência e zero arquivo de geometria; funciona offline e com a CSP | Não é a forma real do país: exige legenda e um olhar de adaptação |
| Mapa geográfico (GeoJSON/TopoJSON + d3-geo ou Leaflet) | Forma real, familiar | Arquivo de geometria de centenas de KB, nova dependência; estados pequenos (DF, SE, AL) ficam quase invisíveis; mapa com tiles (Leaflet) faria chamadas externas e exigiria abrir a CSP |
| Só gráfico de barras | Mais preciso para comparar valores | Perde a leitura espacial (Norte × Sul, litoral × interior) |

Por isso há as duas visões: **mapa** para a leitura espacial e **gráfico** para comparar com precisão, mais um
card por região com links para a lista filtrada.

**Limite do dado:** o DDD diz de onde é o número, não onde a pessoa está (portabilidade e mudança mantêm o número).
Por isso o painel mostra também **DDD × UF do endereço**: divergência aponta mudança, número corporativo ou cadastro a
conferir.

**Mudaria se:** o negócio precisasse de cidade/bairro. Aí o dado certo é o CEP (geolocalizado), com um mapa
geográfico real.

## 14. Excel e CSV sem biblioteca

Exportar/importar em .xlsx e CSV foi feito sobre o `zlib` do Node (um .xlsx é um zip de XMLs), sem instalar nada.

| Prós | Contras |
| --- | --- |
| Zero dependência nova (nada para auditar ou atualizar); funciona offline | Código próprio de formato: ~250 linhas para manter |
| Controle dos limites de segurança (zip bomb, linhas, colunas, XXE) | Só o essencial: uma aba, texto; sem fórmulas, datas nativas ou estilos além do cabeçalho em negrito |
| Exporta tudo como texto: CEP e telefone não perdem zero, nada vira fórmula | .xls antigo (binário) não é lido |

**Mudaria se:** o produto precisasse de planilhas ricas (várias abas, fórmulas, gráficos). Aí uma biblioteca madura
(ExcelJS ou SheetJS) entra no lugar de `src/server/spreadsheet/`, com a mesma interface.

## 15. "Tem WhatsApp?" sem consulta externa

Não existe consulta oficial e gratuita: a API do WhatsApp Business (Meta) não oferece verificação de número, e os
verificadores não oficiais violam os termos de uso (risco de bloqueio da conta e de questionamento pela LGPD).

Regra adotada: o cadastro informa (Sim/Não/Não sei); sem informação, **celular** (11 dígitos começando com 9) conta
como provável WhatsApp e **fixo** como sem WhatsApp, com o botão opaco e o motivo na dica. O botão abre o WhatsApp
pelo `wa.me` (app no celular/computador ou WhatsApp Web); se o número não tiver conta, o próprio WhatsApp avisa.

## 16. Permissões: lista por usuário com perfis prontos

Cada usuário tem uma lista (`ver equipe`, `criar`, `editar`, `apagar`, `exportar`); a tela oferece atalhos (Leitor,
Editor, Operador padrão, Completo). O admin tem tudo. A checagem que vale é no caso de uso (`assertCan`).

| Prós | Contras |
| --- | --- |
| Ajuste fino sem criar papel novo; fácil de auditar (a auditoria registra a mudança) | Com muitos usuários, mudar "todos os editores" exige editar um a um |
| O comportamento antigo vira o "Operador padrão" (migração sem quebrar ninguém) | Não há permissão por contato individual (não foi pedido) |

**Mudaria se:** a equipe crescesse: tabela de papéis nomeados (RBAC) com permissões, e o usuário aponta para o papel.

## 17. Tema escuro sem piscar

Os tokens semânticos são redefinidos em `:root[data-theme="dark"]` (e em `"system"` dentro de
`prefers-color-scheme: dark`). A escolha fica num cookie que o servidor lê para renderizar já com o tema: nada de
script inline (a CSP com nonce continua estrita) e nada de "piscar" claro. O teste de tokens verifica o contraste
de todos os pares também no escuro e que os dois blocos são idênticos.

## 18. Foto do contato no banco

Só contatos têm foto; usuários do sistema aparecem com as iniciais.

| Prós | Contras |
| --- | --- |
| Sem serviço externo; backup e LGPD junto com o resto (excluir o contato apaga a foto) | Banco cresce (limite de 1 MB por foto); sem CDN |
| Autorização simples (a mesma visibilidade da ficha do contato) | Com milhares de contatos com foto, object storage é mais barato |

## 19. Suporte: chamado gravado + WhatsApp "clique para conversar"

Mandar mensagem de WhatsApp sozinho exigiria a API do WhatsApp Business (conta paga na Meta, número aprovado). Sem
isso, o sistema grava o chamado (nada se perde, os admins são avisados em tempo real) e abre o WhatsApp do suporte
com a mensagem e o protocolo prontos: a pessoa só confirma o envio. Com a API contratada, o envio passa a ser
automático em `src/server/support.ts`, sem mudar a tela.

## 20. E se a stack do time for Java ou .NET?

Escolhi TypeScript porque é onde entrego mais rápido e com mais qualidade sozinho. Se o time que vai manter o produto
trabalha com Java ou .NET, a stack dele é a escolha mais sustentável: **manutenibilidade depende de quem mantém**. A
arquitetura não depende do framework e se traduz direto:

| Peça | Neste projeto | Spring Boot (Java) | ASP.NET Core (.NET) |
| --- | --- | --- | --- |
| Telas | Next.js (Server Components) | Thymeleaf, ou SPA React separada | Razor Pages/Blazor, ou SPA React separada |
| Validação | zod | Bean Validation | FluentValidation / DataAnnotations |
| Acesso a dados e migrations | Prisma | JPA/Hibernate + Flyway | EF Core + migrations |
| Hash de senha | argon2id | `Argon2PasswordEncoder` (Spring Security) | Identity (PBKDF2) ou biblioteca argon2 |
| Sessão revogável | Tabela `Session` | Spring Session JDBC | Identity + cookie com security stamp |
| Autorização | DAL (`requireAdmin`) | `@PreAuthorize` / filtros do Spring Security | `[Authorize(Roles=…)]` / policies |
| Tempo real | `LISTEN/NOTIFY` + SSE | `LISTEN` via driver pgjdbc + `SseEmitter` | Npgsql `LISTEN` + SignalR |
| Provedor de identidade | Recomendado (seção 5) | Spring Security OAuth2/OIDC + Keycloak | `Microsoft.Identity.Web` + Entra ID |

O que se mantém em qualquer stack: Postgres como fonte da verdade e do barramento, sessão revogável, autorização no
servidor perto do dado, publicação de eventos na mesma transação e testes ponta a ponta como contrato.
