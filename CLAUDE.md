# CLAUDE.md — Flash Analytics

Guia rápido para sessões futuras neste repositório.

## Leitura obrigatória antes de mexer no código

1. `README.md`: setup, roteiro de avaliação e mapa requisito → tela.
2. `docs/ARQUITETURA.md`: camadas, tempo real e UML. `docs/SEGURANCA.md`: controles que não podem regredir.
3. `STATUS.md`: estado atual e pendências. **Atualize ao fim de cada sessão relevante.**

## Comandos

```bash
npm run db:local      # Postgres embutido em localhost:5433 (.pgdata) + migrations
npm run db:admin -- --email x@y.com --name "Nome"   # cria/promove admin (senha provisória exibida uma vez)
SEED_DEMO=1 npm run db:seed                          # 2 operadores + 25 contatos
npm run dev
npm run lint && npm run typecheck && npm test        # antes de todo commit
npm run test:e2e      # Playwright: Postgres descartável na 5434 + build de produção na 3300
npm run db:migrate -- --name <descricao>             # nova migration (nunca `db push`)
```

Sem rede para baixar o navegador do Playwright: `PW_CHROMIUM_PATH=<chrome.exe já instalado>`.

## Convenções (seguir, não reinventar)

- **Camadas:** tela (Server Component) → Server Action (`actions.ts` ao lado da tela, valida com zod de
  `src/lib/validation.ts`) → caso de uso em `src/server/*` → Prisma. Tela nunca importa `db`.
- **Autorização:** toda página, action e rota chama `requireUser`/`requireAdmin`/`requireOperator`
  (`src/server/auth/dal.ts`). O `proxy.ts` NÃO é barreira de acesso.
- **Visibilidade de dados** mora no caso de uso (`visibleTo` em `contacts.ts`), nunca só na tela.
- **Permissões** (`src/lib/permissions.ts`): ação nova sobre contatos usa `requirePermission` na action/página e
  `assertCan` no caso de uso; a tela só esconde. Admin tem todas.
- **Toda mutação sensível** grava `recordAudit` e, se outra tela precisa reagir, `publish()` **dentro da mesma
  transação** (`src/server/realtime/events.ts`). Evento novo: adicionar ao tipo `AppEvent`, ao filtro `visibleTo` de
  `api/events/route.ts` e a `EVENT_TYPES` do `realtime-provider.tsx`.
  Eventos de contato levam `createdById` (o operador só recebe os seus).
- **Telas que reagem a eventos** usam `<LiveRefresh events={[...]} />`; o dado vem do servidor pelo caminho autorizado.
- Cookies via `cookieOptions()`/`clearCookie()` de `session.ts` (`cookies().delete()` não funciona com `__Host-`).
- **Tema escuro:** cor nova precisa de valor no bloco `[data-theme="dark"]` E no bloco `"system"` de `globals.css`
  (idênticos; o teste confere).
- **Design system** (`docs/DESIGN-SYSTEM.md`): telas usam só tokens semânticos de `globals.css` e componentes de
  `src/components/ui.tsx`/`brand.tsx`; cor fixa reprova no `npm test`. Vermelho = marca/ação principal; seleção, foco e
  destaque informativo em grafite; perigo é botão contornado com ícone. Componente novo ganha exemplo em `/design-system`.
- **Formulário com `<select>` e `useActionState`:** use `countAttempts` + `key={state.attempt}` (`src/lib/form-attempt.ts`),
  senão a lista volta ao vazio depois de um erro do servidor.
- **Validação ao vivo:** formulário novo usa `useLiveValidation(schemaDaAction, state.errors)`
  (`src/components/live-validation.ts`): `{...live.formProps}` no `<form>` e `live.errors` nos campos. O schema é o mesmo da
  Server Action; checagem que só o servidor faz entra com `live.setFieldError`.
- Datas exibidas por `src/lib/format.ts` (fuso de São Paulo); agregações por dia no SQL com `AT TIME ZONE`.
- Tipos vêm do Prisma; nomes por domínio (sem `utils.ts`); comentários só onde a intenção não é óbvia.

## Armadilhas conhecidas

- O banco precisa estar em **UTC** (`scripts/pg-embedded.mjs` força isso no embutido; Neon e a imagem Docker já são).
  SQL manual compara com `now() AT TIME ZONE 'UTC'`.
- `LISTEN` exige conexão direta: `DATABASE_URL_UNPOOLED` (Neon "direct").
- Secrets (`ENCRYPTION_KEY`) são lidos no primeiro uso, não no import: o build roda sem eles.
- A política de senha recusa senhas com o nome/e-mail da pessoa, inclusive em testes.
- Busca de CEP (`src/server/zip-code-lookup.ts`) é a única chamada externa em tempo de execução. Testes usam
  `CEP_PROVIDER=mock` (CEPs 01310100 e 30140071 existem; 99999000 simula serviço fora do ar); nunca chame as APIs reais em teste.
- `ENCRYPTION_KEY` precisa ser a mesma entre execuções (o segredo do 2FA é cifrado com ela).
- Menus fixos (`ActionMenu`) não podem ficar dentro de elemento com `backdrop-filter`/`transform` (vira a referência
  de posição e o menu some).
- Prisma 7: o cliente é gerado em `src/generated/prisma` (fora do git; `postinstall`/`build` geram). Importe tipos e enums
  de `@/generated/prisma/client`, nunca de `@prisma/client`. URLs do CLI ficam em `prisma.config.ts`; o app conecta pelo
  `@prisma/adapter-pg` em `src/server/db.ts`. O Prisma 7 não lê `.env` sozinho (scripts chamam `process.loadEnvFile`).
- `prisma migrate diff` no 7 usa `--from-config-datasource` (não existe mais `--from-url`).
- Se o e2e acusar "shared memory block is still in use", sobrou um `postgres.exe` órfão da porta 5434 (o
  `global-teardown` normalmente evita isso).
