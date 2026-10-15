# Segurança

O enunciado diz que a forma de fazer o login terá atenção especial. Este documento explica **o que** foi feito,
**contra o quê** e **o que ainda não foi feito**. Cada controle aponta para o código e, quando há, para o teste que o prova.

## 1. Autenticação

| Controle | Detalhe | Onde |
| --- | --- | --- |
| Hash de senha **argon2id** | Parâmetros mínimos da OWASP (19 MiB, t=2, p=1), resistente a GPU/ASIC. Hash nativo (Rust) via `@node-rs/argon2`. | `src/server/auth/password.ts` |
| Política de senha (NIST SP 800-63B) | Mínimo de 12 e máximo de 128 caracteres, sem regras de composição, bloqueia senhas óbvias, repetições e senhas que contêm o próprio nome ou e-mail. Validada no servidor. | `src/lib/password-policy.ts` |
| **Sessão opaca no banco** (não JWT) | O cookie leva 256 bits aleatórios e o banco guarda só o **SHA-256**: um vazamento do banco não entrega sessões. Revogar é apagar a linha, com efeito imediato. | `src/server/auth/session.ts` |
| Expiração | 2 h sem uso (idle) e 12 h de vida no máximo (absoluta). Atualizações automáticas da tela (tempo real) e reconexões planejadas do stream **não** contam como uso: aba esquecida aberta expira normalmente. | idem; `live-refresh.tsx` |
| Cookie endurecido | Prefixo `__Host-` (só HTTPS, sem `Domain`, `Path=/`), `HttpOnly`, `Secure`, `SameSite=Strict`. A remoção do cookie usa os mesmos atributos (senão o navegador a ignora). | idem; e2e "cookie de sessão protegido" |
| Nova sessão a cada login | Token novo a cada autenticação (sem fixação de sessão); a sessão anterior do mesmo navegador é apagada. | `createSession` |
| **Mensagem e tempo iguais** | E-mail inexistente, senha errada, conta bloqueada e conta desativada dão a mesma resposta. O e-mail inexistente roda argon2 num hash fictício para o tempo de resposta não revelar quais contas existem. Conta desativada só é avaliada depois da senha certa. | `src/server/auth/login.ts`; e2e "mensagem de erro não revela…" |
| **Bloqueio por tentativas** | 5 erros → 15 min bloqueada. Erros de **senha e de código 2FA somam** no mesmo contador: saber a senha não dá tentativas ilimitadas de código. A tentativa é **reservada no banco antes** de verificar (`UPDATE … WHERE tentativas < 5`), então 100 requisições paralelas não viram 100 tentativas. | `reserveAttempt`/`settleFailure` em `login.ts`; e2e "2FA: saber a senha não dá tentativas ilimitadas…" |
| **Rate limit** | Por IP: 30 tentativas/15 min (contra *password spraying*). Por e-mail: 10 **falhas**/15 min, inclusive para e-mails inexistentes, onde o bloqueio de conta não alcança. Solicitação de acesso: 5/h por IP. Sem IP confiável, o limite não some: vira um balde compartilhado 10× mais folgado. Fica no Postgres (`INSERT … ON CONFLICT` atômico), então vale para todas as instâncias. | `src/server/auth/rate-limit.ts` |
| **2FA TOTP** (RFC 6238) | Compatível com Google/Microsoft Authenticator e 1Password. Segredo **cifrado** (AES-256-GCM, chave fora do banco). Etapa intermediária com token próprio, 5 min e 5 tentativas. O mesmo código **não vale duas vezes** (reserva atômica do passo). | `src/server/auth/totp.ts`, `login.ts`; e2e 2FA; unit vetor da RFC |
| Senha provisória | Usuário criado pelo admin recebe 96 bits aleatórios, exibidos uma vez, e é **obrigado** a trocar antes de usar o sistema. | `users.ts`, `dal.ts` |
| Reautenticação na conta | Trocar senha, **ativar** ou desativar 2FA exigem a senha atual, com limite próprio (5/15 min por usuário): uma sessão roubada não vira força bruta de senha nem amarra a conta ao celular do atacante. | `checkOwnPassword` em `users.ts`; e2e 2FA |
| Troca de senha | Encerra as outras sessões e derruba na hora as outras abas abertas (evento em tempo real). | `changeOwnPassword` |
| Sem credencial padrão | Não existe `admin/admin`. O primeiro admin é criado pela linha de comando com senha gerada (ou informada e validada pela política). | `scripts/create-admin.ts` |

### Por que não JWT?

JWT sem estado não pode ser revogado antes de expirar. Desativar um operador ou redefinir uma senha precisa ter
efeito **agora**, e o enunciado quer que o admin controle quem entra. Uma consulta indexada por requisição é barata;
`React.cache` garante uma só por renderização.

## 2. Autorização

- **DAL**: toda página, Server Action e rota chama `requireUser`/`requireAdmin`/`requireOperator`
  (`src/server/auth/dal.ts`). O `proxy.ts` só faz um redirecionamento otimista e **não** é a barreira (é o que a
  documentação do Next recomenda, depois de falhas como a CVE-2025-29927).
- **Server Actions são endpoints públicos**: cada uma refaz a autorização, mesmo que a tela já tenha feito.
- **Visibilidade no caso de uso**: o filtro "operador só vê os próprios contatos" está em `src/server/contacts.ts`,
  inclusive contra um `?operador=<id de outro>` forjado na URL (e2e "operador só vê os próprios contatos").
- **Tempo real filtrado por perfil**: `/api/events` só repassa a cada usuário o que ele pode ver. O payload é mínimo e
  a tela recarrega os dados pelo caminho autorizado normal.
- **Revogação imediata**: desativar ou redefinir a senha apaga as sessões e derruba o stream aberto (e2e "desativar um
  usuário derruba a sessão aberta dele em tempo real"). Cada stream também revalida a sessão a cada 60 s.
- Guardas de negócio: o admin não se desativa, e sempre sobra ao menos um admin ativo (transação **serializável**: dois admins desativando um ao outro ao mesmo tempo não zeram os admins).
- Senha provisória ainda não trocada: só a tela de troca de senha. O stream de tempo real é recusado até a troca.

## 3. Entrada, saída e navegador

| Ameaça | Controle |
| --- | --- |
| Injeção de SQL | Prisma parametriza tudo. O SQL manual usa *tagged templates* (`$queryRaw`…${x}``), também parametrizados. |
| Entrada maliciosa ou inesperada | zod em toda Server Action (tipos, tamanhos, listas fechadas de UF, origem e perfil). CHECKs no banco como segunda barreira (telefone, UF, e-mail minúsculo). Corpo de Server Action limitado a 64 KB. |
| XSS | React escapa toda saída. **CSP com nonce por requisição** e `strict-dynamic`: só roda script emitido pelo próprio servidor naquela resposta. Sem `dangerouslySetInnerHTML`. |
| CSRF | `SameSite=Strict` + checagem de `Origin` nativa das Server Actions + mutações só por POST. |
| Clickjacking | `frame-ancestors 'none'` e `X-Frame-Options: DENY`. |
| Outros cabeçalhos | HSTS (2 anos), `nosniff`, `Referrer-Policy: same-origin`, `Permissions-Policy` restritiva, COOP/CORP `same-origin`, sem `X-Powered-By`. |
| Redirecionamento aberto | Destinos pós-login vêm do perfil do servidor, nunca de parâmetro da URL. |
| Paginação abusiva | Tamanho de página só de uma lista fechada (10/20/50). Cursor opaco, limitado em tamanho e validado (tipos, coluna da ordenação, data, enum); inválido vira a 1ª página. Nas listas com offset, página inválida cai na 1ª e além da última cai na última. |
| Chamada externa (CEP) | Só pelo servidor, para dois hosts fixos (ViaCEP e BrasilAPI); o CEP é validado como 8 dígitos antes de montar a URL (sem SSRF); `redirect: "error"`, tempo limite de 3,5 s, resposta validada com zod (UF só da lista oficial), limite de 60 buscas/15 min por usuário e só operador autenticado consulta. Nenhum dado pessoal sai: só o CEP. |
| Planilha enviada (importação) | Até 2 MB e 2.000 contatos; .xlsx lido com limite de arquivos internos, de tamanho descompactado (30 MB, contra zip bomb, mesmo se o tamanho declarado mentir), de linhas (20 mil) e de colunas; XML lido por padrões fixos, sem parser genérico (sem entidades externas/XXE); .xls antigo recusado. Cada linha passa pela mesma validação zod do formulário; 10 importações/15 min por usuário. |
| Chamado de suporte | Aceito também sem login (tela de login), com limite por IP; logado, 5 por hora por usuário. Mensagem validada (10 a 2.000 caracteres, CHECK no banco). A tela de origem só é aceita como caminho interno. |
| Segredo do 2FA com chave trocada | Se a `ENCRYPTION_KEY` mudar, o segredo pendente é regenerado e o ativo vira "código inválido" (admin remove o 2FA), em vez de derrubar a página. **Mantenha a `ENCRYPTION_KEY` estável entre deploys.** |
| Injeção de fórmula (CSV) | Toda célula exportada em CSV que começa com `= + - @` ganha apóstrofo (o Excel trata como texto); o .xlsx grava tudo como texto. A importação remove o apóstrofo de volta. |
| Exportação de dados pessoais | Só o que o perfil vê (operador: os seus), com os filtros da tela; auditada (quem, quando, quantos, formato); `Cache-Control: no-store`; 20 exportações/15 min por usuário; teto de 10 mil linhas. |
| Edição/exclusão por id | Contato de outro operador responde 404 (igual a inexistente); a action revalida a visibilidade mesmo com o id vindo amarrado do servidor. |
| Atalhos externos (WhatsApp, Gmail, Outlook) | Só links que o navegador abre (`noopener noreferrer`); o sistema não envia nada nem fala com essas APIs. |
| Permissões por usuário | Conferidas no caso de uso (`assertCan`) além da tela e da action: um botão escondido não é a barreira. Visibilidade "ver equipe" vale também no tempo real (o stream filtra) e na busca do topo. Mudar o perfil de alguém reconecta o stream dessa pessoa com o perfil novo. |
| Foto de perfil | PNG/JPEG/WebP até 1 MB, tipo conferido pelos bytes (assinatura), SVG recusado (pode ter script); CHECK de tamanho e tipo também no banco; servida com o tipo detectado, `nosniff` e só para quem está logado. |
| Compartilhar contato | O link é interno (só abre para quem tem acesso). O cartão .vcf é exportação: exige "Exportar" e fica na auditoria. |
| Job de limpeza (cron) | Rota exige `Authorization: Bearer $CRON_SECRET` (comparação em tempo constante); sem segredo, desligada. |
| Limpar a base | Desligado em produção salvo `ALLOW_DATA_RESET=true`; exige senha (com limite de tentativas) e digitar LIMPAR; nunca apaga usuários nem auditoria; fica registrado. |
| Retenção (LGPD) | O job apaga sessões vencidas, notificações lidas há 90 dias e solicitações de acesso decididas há 180 dias (nome/e-mail sem uso). |
| Vazamento por erro | Página de erro genérica com `digest`; detalhes só no log do servidor. |
| IP forjado | O IP só vem de `X-Forwarded-For` quando `TRUSTED_IP_HEADER` está configurado (proxy confiável na frente), e usa o **último** item, o que o proxy acrescentou; os anteriores são forjáveis pelo cliente. |

## 4. Dados e segredos

- Banco guarda **hashes** de senha (argon2id), de tokens de sessão, de etapa 2FA e de espera (SHA-256).
- O hash da senha da solicitação de acesso é **apagado** na decisão (aprovação copia para o usuário; recusa descarta).
- Segredo TOTP cifrado com AES-256-GCM e **`ENCRYPTION_KEY` fora do banco**. O formato é versionado (`v1:`) para
  permitir rotação de chave.
- Em produção, faltar `ENCRYPTION_KEY` derruba a operação em vez de usar um padrão. Segredos nunca vão para o código
  nem para logs (`.env` no `.gitignore`).
- Mínimo privilégio de dados (LGPD): operador só acessa os próprios contatos.

### Dependências

O CI roda `npm audit --omit=dev --audit-level=high` e falha com vulnerabilidade alta. O Prisma 7.10 trazia duas, ambas
no CLI (não no app): `deepmerge-ts` < 8 (estouro de pilha com objetos recursivos) e `mysql2` ≤ 3.23 (vazamento de
credencial e DoS no protocolo MySQL). Em vez de voltar para o Prisma 6 ou afrouxar o CI, o `package.json` força as
versões corrigidas por `overrides` (`deepmerge-ts` ^8.0.2, `mysql2` ^3.24.6). O CLI só usa `deepmerge` (mesma API no 8)
e o `mysql2` fica na mesma major. Ao subir o Prisma, conferir se os `overrides` ainda são necessários e removê-los.

## 5. Auditoria e monitoramento

`AuditLog` append-only registra login, falha, bloqueio, rate limit, falha de 2FA, logout, troca de senha, 2FA
ativado/desativado, solicitação, aprovação/recusa, criação/desativação/reativação de usuário, redefinição de senha,
remoção de 2FA e cadastro de contato, sempre com ator, IP e navegador. O admin vê a trilha **ao vivo** em
`/admin/atividade`, e o painel tem um bloco "Segurança (24 h)" com logins, falhas e bloqueios.

## 6. Modelo de ameaças (STRIDE resumido)

| Categoria | Cenário | Mitigação |
| --- | --- | --- |
| **S**poofing | Força bruta / credential stuffing | argon2id, bloqueio por conta, rate limit por IP e por e-mail, 2FA |
| **S**poofing | Roubo de cookie | HttpOnly (XSS não lê), Secure, `__Host-`, CSP, expiração idle/absoluta, revogação |
| **T**ampering | Operador forja `operadorId`/`userId` em formulário ou URL | Ids de autoria vêm da sessão; filtros de visibilidade no servidor; zod |
| **R**epudiation | "Não fui eu que aprovei" | Auditoria com ator, IP e navegador em toda ação sensível |
| **I**nformation disclosure | Descobrir quais e-mails têm conta | Mensagem e tempo iguais no login; mensagem neutra na solicitação + rate limit (ver limitação abaixo) |
| **I**nformation disclosure | Operador ver contatos de outro / eventos de admin | Filtro no caso de uso e no stream SSE |
| **D**enial of service | Trancar a conta de alguém errando a senha | Bloqueio só temporário (15 min); o limite por e-mail conta só falhas; o admin vê o bloqueio na tela de usuários |
| **D**enial of service | Abrir milhares de streams | Streams exigem sessão (ou token de espera); fecham em ~5 min. Em produção: WAF/rate limit de borda |
| **E**levation of privilege | Operador chamar Server Action de admin direto | `requireAdmin` dentro de cada action (e2e "operador não acessa telas nem ações de administrador") |

## 7. Limitações conhecidas e próximos passos

Sendo honesto sobre o que **não** está feito, em ordem de prioridade.

> **Recomendação para produção:** os itens 1 a 3 vêm prontos num provedor de identidade (Keycloak, Entra ID) ou numa
> biblioteca mantida (Better Auth). Por isso, num produto, a recomendação é migrar a autenticação para um deles
> e manter aqui só a aprovação de operadores e a sessão revogável. Detalhes e caminho de migração em
> [DECISOES.md](DECISOES.md), seção 5.


1. **Recuperação de senha self-service** (exige provedor de e-mail). Hoje passa pelo admin.
2. **Passkeys/WebAuthn** como alternativa ou segundo fator mais forte que TOTP (resiste a phishing).
3. **Códigos de recuperação do 2FA** e **2FA obrigatório para admins** (hoje opcional).
4. **Senhas vazadas (HIBP, k-anonymity)**: a lista de senhas comuns é pequena. Uma checagem online exige saída de
   rede, que evitei neste teste.
5. **CAPTCHA/BotID** na solicitação de acesso, se aparecer abuso automatizado.
6. ~~**`style-src 'unsafe-inline'`** na CSP~~ **resolvido**: `style-src 'self' 'nonce-…'` em produção. Nenhum `style=` sai do
   servidor (avatar, mapa e degradês usam classes; gráficos e amostras de cor são aplicados no navegador via CSSOM, que a
   CSP permite). Um e2e falha se o navegador acusar estilo bloqueado.
7. **E-mail da solicitação não é verificado**: alguém pode pedir acesso com o e-mail de outra pessoa (e um pedido falso
   pendente bloqueia o legítimo até ser recusado). A tela de aprovação avisa o admin para confirmar quem é. A mensagem
   também ainda diferencia "não foi possível" de "enviado". Resolver por completo exige confirmação por e-mail.
8. Auditoria no mesmo banco: em produção, replicar para armazenamento imutável (S3 Object Lock) ou SIEM.
9. ~~Limpeza periódica de registros expirados~~ — feito: job diário (`/api/cron/limpeza`, `npm run job:limpeza`).
