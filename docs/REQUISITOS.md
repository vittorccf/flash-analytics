# Análise de requisitos

## 1. Briefing

Uma aplicação com dois perfis:

- **Administrador**: cadastra usuários, recebe e decide solicitações de acesso e acompanha o que acontece na aplicação
  (painel, notificações, auditoria).
- **Operador**: pede acesso pela tela de login e espera a decisão sem recarregar a página. Depois de aprovado,
  cadastra contatos e consulta a lista dos contatos que cadastrou.

Critérios destacados pelo avaliador: **segurança (sobretudo no login)**, manutenibilidade, processos e escalabilidade,
tratando o teste como produto.

## 2. Atores

| Ator | Descrição |
| --- | --- |
| Visitante | Ainda sem conta. Só acessa a tela de login, onde pode entrar ou solicitar acesso. |
| Operador | Conta aprovada com perfil `OPERATOR`. |
| Administrador | Conta com perfil `ADMIN`. O primeiro é criado pela linha de comando; os demais, por outro admin. |
| Sistema | Publica eventos em tempo real e grava a auditoria. |

## 3. Requisitos funcionais

| ID | Requisito | Ator | Origem |
| --- | --- | --- | --- |
| RF01 | Entrar com e-mail e senha | Todos | Enunciado |
| RF02 | Solicitar acesso na tela de login (nome, e-mail, senha) | Visitante | Enunciado |
| RF03 | Ver a decisão da solicitação **em tempo real, sem recarregar** a tela | Visitante | Enunciado |
| RF04 | Listar solicitações pendentes e o histórico; aprovar ou recusar (com motivo opcional) | Admin | Enunciado |
| RF05 | Cadastrar usuário (admin ou operador) | Admin | Enunciado |
| RF06 | Desativar/reativar usuário, redefinir senha, remover 2FA | Admin | Derivado (gestão de acesso) |
| RF07 | Cadastrar contato | Operador, Admin | Enunciado (operador); admin, pedido do negócio |
| RF08 | Notificar **em tempo real** todos os admins a cada contato cadastrado | Sistema | Enunciado |
| RF09 | Listar contatos com **paginação no backend** (operador: os seus; admin: todos, com filtros) | Operador, Admin | Enunciado |
| RF10 | Acompanhar o que acontece na aplicação (trilha de auditoria) | Admin | Enunciado |
| RF11 | Painel com métricas de contatos por dimensão, atualizado em tempo real | Admin | Extra |
| RF12 | Trocar a própria senha; senha provisória obriga a troca | Todos | Derivado (segurança) |
| RF13 | Ativar/desativar 2FA (TOTP); ver e encerrar as próprias sessões | Todos | Derivado (segurança) |
| RF14 | Notificações persistidas (lidas/não lidas) | Admin | Derivado (quem estava offline não perde aviso) |
| RF15 | Preencher o endereço do contato pelo CEP (opcional; campos continuam editáveis e o cadastro funciona sem o serviço) | Operador, Admin | Pedido do negócio |
| RF16 | Painel com a origem dos números pelo DDD: mapa e gráfico por UF, regiões, DDDs mais frequentes e DDD × UF do endereço, com atalho para a lista filtrada | Admin | Pedido do negócio |
| RF17 | Recusar telefone com DDD inexistente | Operador, Admin | Derivado (qualidade do dado do RF16) |
| RF18 | CRUD de contatos: ver detalhe, editar e excluir (operador só os próprios; admin todos) | Operador, Admin | Pedido do negócio |
| RF19 | Exportar contatos em Excel (.xlsx) e CSV, respeitando visibilidade e filtros | Operador, Admin | Pedido do negócio |
| RF20 | Importar contatos de Excel (.xlsx) ou CSV, com a mesma validação do cadastro e relatório por linha | Operador, Admin | Pedido do negócio |
| RF21 | Atalhos de contato: WhatsApp (app/Web), ligar, SMS e e-mail (app padrão, Gmail, Outlook); WhatsApp opaco quando o número não deve ter | Operador, Admin | Pedido do negócio |
| RF22 | CRUD de usuários pelo admin: editar nome, e-mail e perfil; excluir quem não tem contatos | Admin | Pedido do negócio |
| RF23 | Permissões por usuário: ver a equipe, criar, editar, apagar, exportar; perfis prontos Leitor, Editor, Operador padrão, Completo | Admin | Pedido do negócio |
| RF24 | Aviso de contato duplicado (mesmo telefone ou e-mail) ao cadastrar/editar, com confirmação | Operador, Admin | Pedido do negócio |
| RF25 | Ordenar a lista clicando na coluna; favoritos por usuário e filtro "Só favoritos" | Operador, Admin | Pedido do negócio |
| RF26 | Detalhe do contato com notas de acompanhamento, histórico de auditoria (quem criou/alterou, quais campos) e compartilhar (link interno, WhatsApp, e-mail, cartão .vcf) | Operador, Admin | Pedido do negócio |
| RF27 | Busca de contatos no topo (Ctrl+K) e discador em modal | Operador, Admin | Pedido do negócio |
| RF28 | Foto de perfil | Todos | Pedido do negócio |
| RF29 | Tema escuro (claro, escuro ou do sistema) | Todos | Pedido do negócio |
| RF30 | Job diário de limpeza; gerar dados de teste; limpar a base | Sistema, Admin | Pedido do negócio |

## 4. Requisitos não funcionais

| ID | Requisito | Como foi atendido |
| --- | --- | --- |
| RNF01 | Segurança de autenticação | argon2id, sessões opacas revogáveis, cookie `__Host-`/HttpOnly/Secure/SameSite=Strict, bloqueio por tentativas, rate limit por IP e por e-mail, resposta e tempo iguais para conta inexistente, 2FA TOTP com proteção contra reuso. Ver [SEGURANCA.md](SEGURANCA.md) |
| RNF02 | Autorização no servidor | DAL (`requireAdmin`/`requireOperator`) em toda página, Server Action e rota; filtro de visibilidade dentro do caso de uso |
| RNF03 | Tempo real | Postgres `LISTEN/NOTIFY` → SSE. Latência sub-segundo, reconexão automática com ressincronização |
| RNF04 | Escalabilidade horizontal | App sem estado em memória (sessão, rate limit e eventos no Postgres); qualquer instância atende qualquer usuário |
| RNF05 | Paginação | Por cursor (keyset) no banco para contatos e atividade, offset nas listas pequenas; índices compostos `(createdAt desc, id desc)`; tamanho de página só de uma lista fechada |
| RNF06 | Rastreabilidade | Auditoria de todas as ações de acesso e de negócio, com IP e navegador |
| RNF07 | Manutenibilidade | Camadas (UI → Server Action → caso de uso em `src/server` → Prisma), validação única com zod, tipos do Prisma, lint e tipos no CI |
| RNF08 | Qualidade verificável | 19 testes unitários e 13 ponta a ponta contra o build de produção; CI no GitHub Actions |
| RNF09 | Acessibilidade | Rótulos ligados aos campos, `aria-invalid`/`aria-describedby`, foco visível, avisos em região `aria-live` |
| RNF10 | Implantação | Vercel + Neon ou Docker Compose; migrations versionadas; health check |
| RNF11 | Privacidade (LGPD) | Operador só vê os próprios contatos (mínimo privilégio); a solicitação de acesso guarda só o hash da senha, apagado na decisão |

## 5. Regras de negócio

| ID | Regra |
| --- | --- |
| RN01 | Só existe **uma solicitação pendente por e-mail** (índice único parcial no banco). Recusada, a pessoa pode pedir de novo. |
| RN02 | E-mail que já é de um usuário não pode solicitar acesso. |
| RN03 | Aprovar cria um usuário `OPERATOR` com a senha escolhida na solicitação. Dois admins aprovando ao mesmo tempo geram uma decisão só. |
| RN04 | O usuário criado pelo admin recebe uma senha provisória (exibida uma vez) e precisa trocá-la antes de usar o sistema. |
| RN05 | O admin não desativa a própria conta, e sempre resta ao menos um admin ativo. |
| RN06 | Desativar ou redefinir a senha encerra todas as sessões do usuário **na hora**, inclusive as abertas no navegador. |
| RN07 | Após 5 senhas erradas, a conta fica bloqueada por 15 minutos. A mensagem é a mesma de "senha errada". |
| RN08 | Operador vê só os contatos que ele cadastrou; admin vê todos. |
| RN09 | Contato: nome, telefone com DDD (obrigatório), cidade, UF e origem obrigatórios; e-mail, empresa e observações opcionais. |
| RN10 | Senha: mínimo de 12 caracteres, sem regras de composição, sem senhas óbvias, sem conter o próprio nome ou e-mail (NIST SP 800-63B). |

## 6. Premissas e pontos que eu negociaria

O enunciado deixa algumas lacunas. Decidi como abaixo e registrei aqui para validar com o time:

| # | Ponto em aberto | Decisão tomada | Alternativa, se o negócio preferir |
| --- | --- | --- | --- |
| 1 | O operador escolhe a senha na solicitação ou recebe depois? | Escolhe na solicitação. Guardamos só o hash, que vira a senha da conta na aprovação. | Aprovação envia um convite por e-mail para definir a senha (exige provedor de e-mail). |
| 2 | Após a aprovação, o operador entra automaticamente? | Não. Ele vê "Acesso aprovado" e entra com a senha. O token da tela de espera **não** vira credencial. | Login automático: mais fluido, mas transforma o token de espera numa credencial de longa duração. |
| 3 | O operador vê os contatos de todos ou só os seus? | Só os seus (mínimo privilégio, LGPD). | É uma linha em `src/server/contacts.ts` (`visibleTo`). |
| 4 | Admin também cadastra contatos? | **Sim** (decidido com o negócio). Os outros admins são notificados em tempo real; quem cadastrou não recebe aviso do próprio contato. O operador continua vendo só os seus. | Restringir de novo ao operador: `requireUser` → `requireOperator` em `contatos/novo`. |
| 5 | Quais campos tem um contato? | Os necessários para métricas com sentido: UF, cidade, origem do contato e operador. | Campos novos entram no schema zod e numa migration. |
| 6 | "Analisar o que está acontecendo" | Auditoria ao vivo + painel com bloco de segurança (logins, falhas e bloqueios em 24 h). | Exportar para um SIEM (Datadog, Elastic). |
| 7 | Revelar se um e-mail já existe ao solicitar acesso? | A solicitação recusa com uma mensagem neutra ("se você já tem acesso, entre…"), mitigada por rate limit. | Aceitar sempre e avisar por e-mail. Esconde totalmente, mas exige e-mail. |
| 8 | 2FA obrigatório para admin? | Opcional para todos, com orientação na tela. | Tornar obrigatório para `ADMIN` é uma checagem em `authenticate` (`src/server/auth/login.ts`). |
| 9 | Como saber se o número tem WhatsApp? | Não há consulta oficial gratuita (a API da Meta não oferece; verificadores não oficiais violam os termos e arriscam bloqueio). O cadastro tem "Tem WhatsApp?" (Sim/Não/Não sei); sem informação, celular conta como sim e fixo como não. | Integrar um provedor oficial de WhatsApp Business, se surgir um que ofereça a consulta. |
| 10 | Importação: uma notificação por contato? | Uma notificação resumindo a importação ("Fulano importou 120 contatos"), para não inundar os admins. Cadastro individual continua notificando um a um. | Notificar por linha é um laço em `contact-import.ts`. |
| 11 | Excluir contato apaga de vez? | Sim (LGPD: dado pessoal sem motivo para ficar). A auditoria guarda só o id. | Exclusão lógica (`deletedAt`) se o negócio precisar de lixeira. |
| 12 | Permissões: por papel fixo ou por usuário? | Por usuário, com perfis prontos. O admin continua com tudo; o "Operador padrão" é o comportamento original (CRUD dos próprios). | Perfis nomeados reutilizáveis (tabela de papéis) se a equipe crescer. |
| 13 | Limpar a base em produção? | Desligado por padrão em produção (ALLOW_DATA_RESET); exige senha do admin e digitar LIMPAR; usuários e auditoria nunca são apagados. | — |

## 7. Fora do escopo (e por quê)

- **Recuperação de senha por e-mail**: exige um provedor de e-mail. Hoje o admin redefine com uma senha provisória.
- **Edição e exclusão de contatos**: não pedidas. O modelo e a auditoria já comportam.
- **Códigos de recuperação do 2FA**: o admin remove o 2FA de quem perdeu o celular (ação auditada).
- **Internacionalização**: interface só em pt-BR.

## 8. Rastreabilidade (requisito → código → teste)

| Req. | Código principal | Teste |
| --- | --- | --- |
| RF01, RNF01 | `src/server/auth/login.ts`, `session.ts`, `password.ts` | e2e `seguranca.spec.ts` (cookie, bloqueio, mensagem neutra); unit `cripto.test.ts` |
| RF02, RF03 | `src/app/login/*`, `src/server/signup-requests.ts`, `api/signup-requests/stream` | e2e "operador pede acesso e vê a aprovação em tempo real, sem recarregar a tela" |
| RF04 | `src/app/(app)/admin/solicitacoes/*` | e2e aprovação e recusa |
| RF05, RF06, RN06 | `src/server/users.ts`, `admin/usuarios/*` | e2e "desativar um usuário derruba a sessão aberta dele em tempo real" |
| RF07, RF08 | `src/server/contacts.ts`, `components/realtime/*`, `api/events` | e2e "contato cadastrado… notifica o admin em tempo real e atualiza o painel"; e2e "admin também cadastra contato…" (escrito, ainda não executado) |
| RF09, RNF05 | `src/server/contacts.ts`, `src/lib/cursor.ts`, `src/lib/contact-sort.ts` | e2e `paginacao.spec.ts`; unit `cursor.test.ts` |
| RN08, RNF02 | `visibleTo` em `contacts.ts`, `src/server/auth/dal.ts` | e2e "operador só vê os próprios contatos", "operador não acessa telas… de administrador" |
| RF10 | `src/server/audit.ts`, `admin/atividade` | e2e (auditoria do bloqueio) |
| RF11 | `src/server/dashboard.ts`, `admin/page.tsx` | e2e (contador do painel muda sem recarregar) |
| RF13 | `src/server/auth/totp.ts`, `conta/*`, `login/verificar` | e2e 2FA; unit vetor de teste da RFC 6238 |
| RN10 | `src/lib/password-policy.ts` | unit política de senha |
