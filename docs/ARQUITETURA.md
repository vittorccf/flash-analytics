# Arquitetura e UML

Os diagramas estão em Mermaid, que o GitHub renderiza direto. Cada um responde a uma pergunta: quem usa
(casos de uso), do que o sistema é feito (componentes e implantação), quais são os dados (classes e ER) e como os
fluxos críticos acontecem (sequências e estados).

## 1. Casos de uso

```mermaid
flowchart LR
  V(["👤 Visitante"])
  O(["👤 Operador"])
  A(["👤 Administrador"])
  S(["⚙️ Sistema"])

  subgraph SYS["Flash Contacts"]
    UC1((Entrar))
    UC2((Solicitar acesso))
    UC3((Aguardar decisão<br/>em tempo real))
    UC4((Cadastrar contato))
    UC5((Listar contatos<br/>paginado))
    UC6((Decidir solicitação))
    UC7((Gerenciar usuários))
    UC8((Ver painel<br/>ao vivo))
    UC9((Ver auditoria))
    UC10((Receber notificação<br/>de contato))
    UC11((Configurar 2FA /<br/>trocar senha))
  end

  V --- UC1
  V --- UC2
  UC2 -. include .-> UC3
  O --- UC1
  O --- UC4
  O --- UC5
  O --- UC11
  A --- UC1
  A --- UC4
  A --- UC5
  A --- UC6
  A --- UC7
  A --- UC8
  A --- UC9
  A --- UC10
  A --- UC11
  UC4 -. gera .-> UC10
  S --- UC10
  S --- UC3
```

## 2. Componentes

```mermaid
flowchart TB
  subgraph NAV["Navegador"]
    UI["Páginas React<br/>(Server Components renderizados)"]
    RT["RealtimeProvider<br/>EventSource /api/events"]
    WP["Tela de espera<br/>EventSource /api/signup-requests/stream"]
  end

  subgraph SRV["Servidor Next.js — N instâncias, sem estado"]
    PX["proxy.ts<br/>CSP com nonce · cabeçalhos · redirecionamento otimista"]
    SA["Server Actions<br/>(validação zod)"]
    DAL["DAL de autorização<br/>requireUser / requireAdmin / requireOperator"]
    UCs["Casos de uso (src/server)<br/>login · signup-requests · contacts · users · dashboard · audit"]
    SSE["Rotas SSE<br/>/api/events · /api/signup-requests/stream"]
    BUS["EventBus<br/>1 conexão LISTEN por instância"]
  end

  subgraph PG["PostgreSQL"]
    T[("Tabelas<br/>User · Session · SignupRequest · Contact<br/>Notification · AuditLog · RateLimitBucket")]
    AG[("ContactStat<br/>agregados do painel")]
    CH{{"Canal NOTIFY<br/>flash_events"}}
  end

  UI -->|POST Server Action| PX --> SA --> DAL --> UCs
  UCs -->|Prisma, transação| T
  UCs -->|"pg_notify (na mesma transação)"| CH
  T -->|"trigger (mesma transação)"| AG
  UCs -->|painel lê só os agregados| AG
  CH -->|LISTEN| BUS --> SSE
  SSE -->|text/event-stream| RT
  SSE -->|text/event-stream| WP
  RT -->|router.refresh| UI
```

**Camadas:** a tela só chama a Server Action, que valida a entrada (zod) e passa pela DAL. O caso de uso em `src/server`
aplica as regras de negócio e é o único que fala com o Prisma. Regras de visibilidade (ex.: operador só vê os próprios
contatos) ficam no caso de uso, não na tela, para nenhuma tela esquecer de aplicá-las.

## 3. Implantação

```mermaid
flowchart LR
  subgraph SAAS["Opção A — SaaS"]
    U1[Usuários] -->|HTTPS| V["Vercel<br/>Funções Node.js (Fluid Compute)"]
    V -->|pooled| N[("Neon Postgres")]
    V -->|"direct (LISTEN)"| N
  end

  subgraph ONP["Opção B — On-premises"]
    U2[Usuários] -->|HTTPS| P["Proxy TLS<br/>Nginx/Caddy"]
    P --> APP["Container app<br/>node server.js (sem root)"]
    MIG["Container migrate<br/>prisma migrate deploy"] --> DB[("Container Postgres 17<br/>volume persistente")]
    APP --> DB
  end
```

## 4. Modelo de domínio (classes)

```mermaid
classDiagram
  class User {
    +String id
    +String name
    +String email
    +Role role
    +UserStatus status
    +Boolean mustChangePassword
    +Int failedLoginAttempts
    +DateTime lockedUntil
    +String totpSecretCifrado
    +DateTime totpEnabledAt
    +Int totpLastStep
  }
  class Session {
    +String idSha256Token
    +DateTime expiresAt
    +DateTime lastSeenAt
    +String ipAddress
    +String userAgent
  }
  class LoginChallenge {
    +String idSha256Token
    +Int attempts
    +DateTime expiresAt
  }
  class SignupRequest {
    +String id
    +String name
    +String email
    +String passwordHashTemporario
    +SignupStatus status
    +String waitTokenHash
    +String decisionNote
  }
  class Contact {
    +String id
    +String name
    +String phone
    +String email
    +String company
    +String city
    +String state
    +ContactOrigin origin
  }
  class Notification {
    +String type
    +String title
    +String body
    +DateTime readAt
  }
  class AuditLog {
    +String action
    +String entity
    +Json metadata
    +String ipAddress
  }
  class RateLimitBucket {
    +String key
    +Int count
    +DateTime resetAt
  }

  User "1" --> "*" Session
  User "1" --> "*" LoginChallenge
  User "1" --> "*" Contact : cadastra
  User "1" --> "*" Notification : recebe
  User "1" --> "*" AuditLog : ator
  User "1" --> "*" SignupRequest : decide
  SignupRequest "0..1" --> "0..1" User : origina
```

## 5. Modelo de dados (ER)

```mermaid
erDiagram
  User ||--o{ Session : "tem"
  User ||--o{ LoginChallenge : "tem"
  User ||--o{ Contact : "cadastra"
  User ||--o{ Notification : "recebe"
  User |o--o{ AuditLog : "executa"
  User |o--o{ SignupRequest : "decide"
  SignupRequest |o--o| User : "origina"

  User {
    text id PK
    text email UK "minúsculo (CHECK)"
    text passwordHash "argon2id"
    enum role "ADMIN ou OPERATOR"
    enum status "ACTIVE ou DISABLED"
  }
  Session {
    text id PK "sha256(token)"
    text userId FK
    timestamp expiresAt
    timestamp lastSeenAt
  }
  SignupRequest {
    text id PK
    text email "único entre PENDING (índice parcial)"
    enum status
    text waitTokenHash UK
  }
  Contact {
    text id PK
    text phone "CHECK 10-11 dígitos"
    char state "CHECK UF"
    enum origin
    text createdById FK
    timestamp createdAt "índice (createdAt desc, id desc)"
  }
  Notification {
    text id PK
    text userId FK
    timestamp readAt
  }
  AuditLog {
    text id PK
    text actorId FK
    text action
    jsonb metadata
  }
  LoginChallenge {
    text id PK
    text userId FK
    int attempts
  }
  RateLimitBucket {
    text key PK
    int count
    timestamp resetAt
  }
  ContactStat {
    date day PK "dia em São Paulo"
    enum origin PK
    char state PK
    char ddd PK
    text createdById PK
    int count "mantido por trigger em Contact"
  }
```

## 6. Sequência: login (com bloqueio e 2FA)

```mermaid
sequenceDiagram
  autonumber
  actor U as Usuário
  participant B as Navegador
  participant SA as loginAction
  participant L as authenticate()
  participant DB as Postgres

  U->>B: e-mail + senha
  B->>SA: POST (Server Action, checagem de Origin)
  SA->>SA: zod (normaliza e-mail)
  SA->>L: authenticate(email, senha, ip)
  L->>DB: consume rate limit por IP + consulta falhas por e-mail
  alt limite excedido
    L-->>B: "Muitas tentativas…" (auditado)
  end
  L->>DB: busca usuário
  alt e-mail não existe
    L->>L: argon2 em hash fictício (mesmo tempo de resposta)
    L-->>B: mensagem genérica (auditado)
  else conta bloqueada ou 5 tentativas em curso
    L->>L: argon2 em hash fictício (mesmo tempo de resposta)
    L-->>B: mensagem genérica (reserva recusada: UPDATE … WHERE tentativas < 5)
  else senha errada
    L->>DB: tentativa já reservada; bloqueia em 5 (erros de 2FA somam aqui)
    L-->>B: mensagem genérica (auditado)
  else senha certa e 2FA ativo
    L->>DB: cria LoginChallenge (hash do token, 5 min)
    L-->>B: cookie __Host-flash_2fa → /login/verificar
    U->>B: código TOTP
    B->>DB: valida código e reserva o passo (não reutilizável)
  end
  L->>DB: cria Session (sha256 do token)
  L-->>B: Set-Cookie __Host-flash_session (HttpOnly, Secure, SameSite=Strict)
```

## 7. Sequência: solicitação de acesso e aprovação em tempo real

```mermaid
sequenceDiagram
  autonumber
  actor V as Visitante
  participant W as Tela de espera
  participant S as Servidor
  participant DB as Postgres
  actor A as Admin

  V->>S: ao sair do campo: o e-mail é real? (DNS MX, temporário, erro de digitação)
  S-->>V: ok ou "Você quis dizer …?"
  V->>S: signupAction(nome, e-mail, senha)
  S->>S: limite por IP + zod + e-mail real (de novo)
  S->>DB: BEGIN, INSERT SignupRequest (hash da senha, hash do token), notificações, auditoria, pg_notify, COMMIT
  S-->>V: cookie __Host-flash_signup (token de espera)
  DB-->>A: NOTIFY signup.requested → SSE → aviso na tela do admin
  W->>S: GET /api/signup-requests/stream (cookie)
  S->>S: assina o barramento ANTES de ler o estado
  S-->>W: status PENDING
  A->>S: decideSignupAction(aprovar)
  S->>DB: BEGIN, INSERT User, UPDATE … WHERE status=PENDING, auditoria, pg_notify, COMMIT
  DB-->>S: NOTIFY signup.decided
  S-->>W: status APPROVED (sem recarregar a página)
  W->>V: "Acesso aprovado! Entrar agora"
```

## 8. Sequência: contato cadastrado → notificação do admin

```mermaid
sequenceDiagram
  autonumber
  actor O as Operador
  participant S as Servidor (instância 1)
  participant DB as Postgres
  participant S2 as Servidor (instância 2)
  actor A as Admin

  Note over A,S2: o admin está conectado em /api/events numa outra instância
  O->>S: createContactAction(form)
  S->>S: requirePermission("contacts.create") + zod
  S->>DB: BEGIN, INSERT Contact, INSERT Notification (1 por admin), INSERT AuditLog, pg_notify(contact.created), COMMIT
  DB-->>S2: NOTIFY (só depois do COMMIT)
  S2->>S2: filtra por perfil (admin recebe; outro operador não)
  S2-->>A: event contact.created
  A->>A: aviso na tela + router.refresh()
  A->>S2: RSC refresh (painel, contadores)
```

## 9. Estados

```mermaid
stateDiagram-v2
  direction LR
  state "Solicitação de acesso" as SR {
    [*] --> PENDING : visitante envia
    PENDING --> APPROVED : admin aprova (cria User)
    PENDING --> REJECTED : admin recusa / admin cria conta com o mesmo e-mail
    APPROVED --> [*]
    REJECTED --> [*] : pode pedir de novo
  }
```

```mermaid
stateDiagram-v2
  direction LR
  state "Sessão" as SS {
    [*] --> Ativa : login (e 2FA)
    Ativa --> Ativa : uso (lastSeenAt a cada 5 min)
    Ativa --> Encerrada : logout
    Ativa --> Encerrada : 2 h sem uso / 12 h de vida
    Ativa --> Encerrada : usuário desativado / senha redefinida (push em tempo real)
    Encerrada --> [*]
  }
```

## 10. Tempo real em detalhe

- **Publicação transacional:** `pg_notify` roda dentro da mesma transação que grava o dado. Se a transação falha,
  nenhum evento sai. Também não há aviso de contato que depois "não existe".
- **Assinatura:** cada instância do servidor mantém **uma** conexão `LISTEN` (conexão direta, sem pooler) e distribui
  os eventos para os streams SSE abertos nela. Com N instâncias, cada uma escuta o Postgres, então não é preciso
  "sticky session" nem Redis.
- **Payload mínimo:** o evento leva só ids e nomes para o aviso. A tela recarrega os dados pelo caminho normal
  (`router.refresh()` → Server Components → DAL), então as regras de acesso valem também para o que chega em tempo real.
- **Filtro por perfil:** `/api/events` só repassa a cada usuário o que o perfil dele pode ver. O stream da tela de
  espera só fala da própria solicitação.
- **Falhas:** heartbeat a cada 20 s; o stream fecha antes do limite de duração da plataforma e o navegador reconecta.
  Numa reconexão (do navegador ou do `LISTEN`), quem assina recebe `resync` e recarrega, cobrindo eventos perdidos
  enquanto estava fora. Resposta de erro (ex.: deploy) → o cliente checa `/api/session`: sessão inválida volta ao
  login, válida reabre com espera crescente.
- **Revogação:** desativar um usuário publica `session.revoked`; o stream dele envia o evento e fecha, e o navegador
  vai para o login. Além disso, cada stream revalida a sessão a cada 60 s.

## 11. Escalabilidade: o que muda com o volume

| Gargalo | Quando aparece | Próximo passo |
| --- | --- | --- |
| ~~`OFFSET` em páginas profundas~~ | resolvido | contatos e atividade paginam por cursor (keyset) na ordem escolhida, `src/lib/cursor.ts` |
| ~~`COUNT(*)` da paginação~~ | resolvido em parte | o total de contatos vem de `ContactStat`; só busca por texto e favoritos contam na tabela. A atividade não mostra total |
| ~~Agregações do painel~~ | resolvido | `ContactStat` (dia/origem/UF/DDD/autor) mantida por trigger na mesma transação; `contact_stat_rebuild()` reconstrói |
| Ordenar por nome/cidade com milhões de linhas | busca + ordenação fora do índice | índices `(name, id)`/`(city, id)` ou busca dedicada (pg_trgm / motor de busca) |
| Conexões SSE | milhares de usuários simultâneos | serviço gerenciado (Ably/Pusher) ou WebSocket dedicado; a interface `subscribe()` do cliente fica igual |
| `NOTIFY` | milhares de eventos/s | Redis Pub/Sub ou fila; troca só `src/server/realtime/bus.ts` e `publish()` |
| Auditoria no banco principal | retenção longa | exportar para armazenamento imutável (S3 Object Lock) ou SIEM |
