import type { Metadata } from "next";
import { requireUser } from "@/server/auth/dal";
import { BrandMark, Logo } from "@/components/brand";
import { Avatar } from "@/components/avatar";
import { FavoriteButton } from "@/components/favorite-button";
import { EmailChannels, PhoneChannels } from "@/components/contact-channels";
import { BrazilTileMap } from "../admin/brazil-tile-map";
import { OriginTag } from "@/components/origin-tag";
import { TokenFill } from "@/components/token-fill";
import { CursorPagination } from "@/components/cursor-pagination";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardHeader,
  chipClass,
  EmptyState,
  Field,
  fieldA11y,
  Input,
  PageHeader,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";

export const metadata: Metadata = { title: "Design system" };

// Catálogo vivo: renderiza os componentes reais de src/components, então nunca fica desatualizado. Regras em docs/DESIGN-SYSTEM.md.
const SCALE = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

const SEMANTIC: [string, string][] = [
  ["primary", "Ação principal, links, seleção"],
  ["foreground", "Texto"],
  ["muted", "Texto secundário"],
  ["border", "Divisórias e contornos"],
  ["background", "Fundo da aplicação"],
  ["sidebar", "Navegação e superfícies de marca"],
  ["success", "Concluído, conectado"],
  ["warning", "Atenção, pendente"],
  ["danger", "Erro, ação destrutiva"],
];

const Swatch = ({ token, label, hint }: { token: string; label: string; hint?: string }) => (
  <div className="min-w-0">
    <TokenFill token={token} className="h-12 border border-border" />
    <p className="mt-1.5 truncate text-xs font-medium text-foreground">{label}</p>
    {hint ? <p className="truncate text-xs text-muted">{hint}</p> : null}
  </div>
);

const Section = ({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader title={title} description={description} />
    <div className="space-y-6 p-5">{children}</div>
  </Card>
);

export default async function DesignSystemPage() {
  await requireUser();

  return (
    <>
      <PageHeader title="Design system" description="Fundamentos e componentes do Flash Contacts, renderizados a partir do código de produção." />
      <div className="space-y-4">
        <Section title="Marca" description="Chevrons crescentes: velocidade e avanço. O vermelho é assinatura, não decoração.">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="grid place-items-center rounded-lg border border-border bg-surface p-6">
              <Logo endorsed />
            </div>
            <div className="grid place-items-center rounded-lg bg-sidebar p-6">
              <Logo tone="dark" endorsed />
            </div>
            <div className="grid place-items-center rounded-lg p-6 [background:var(--gradient-brand)]">
              <BrandMark className="h-12 w-auto [&_path]:fill-primary-foreground" title="Flash Analytics" />
            </div>
          </div>
        </Section>

        <Section title="Cores" description="Telas usam só os tokens semânticos; os primitivos existem para compor os semânticos.">
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Semânticos</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
              {SEMANTIC.map(([token, hint]) => (
                <Swatch key={token} token={token} label={token} hint={hint} />
              ))}
            </div>
          </div>
          {(["brand", "ink"] as const).map((scale) => (
            <div key={scale}>
              <p className="mb-2 text-sm font-medium text-foreground">Primitivos · {scale}</p>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-11">
                {SCALE.map((step) => (
                  <Swatch key={step} token={`${scale}-${step}`} label={String(step)} />
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-2 text-sm font-medium text-foreground">Gráficos (nesta ordem)</p>
            <div className="grid grid-cols-6 gap-2">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <Swatch key={n} token={`chart-${n}`} label={`chart-${n}`} />
              ))}
            </div>
          </div>
        </Section>

        <Section title="Tipografia" description="Roboto no texto e Geist Mono em códigos. Títulos com sombra mínima (text-depth); números em tabelas usam tabular-nums.">
          <div className="space-y-3">
            <h2 className="text-4xl font-semibold tracking-tight">Display · 36/600</h2>
            <h2 className="text-[1.75rem] font-semibold leading-tight">Título de página · 28/600</h2>
            <p className="text-[0.95rem] font-semibold tracking-[-0.01em]">Título de card · 15/600</p>
            <p className="text-sm">Corpo · 14/400. Interfaces densas pedem texto de 14 px com bom contraste.</p>
            <p className="text-xs text-muted">Legenda · 12/400</p>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted-strong">Rótulo de marca · caixa alta espaçada</p>
            <p className="font-mono text-sm text-muted-strong">Código · Geist Mono · 123 456</p>
          </div>
        </Section>

        <Section title="Profundidade" description="Cantos retos. Quatro níveis de elevação e, nos modais, borda preta translúcida em degradê (modal-depth).">
          <div className="grid gap-4 sm:grid-cols-4">
            {(["elevation-1", "elevation-2", "elevation-3", "elevation-4"] as const).map((e, i) => (
              <div key={e} className={`rounded-2xl border border-border/80 bg-surface p-4 text-sm ${e}`}>
                <p className="font-medium text-foreground">{e}</p>
                <p className="text-xs text-muted">{["Cards e botões", "Card em destaque", "Menus e avisos", "Painéis flutuantes"][i]}</p>
              </div>
            ))}
            <div className="modal-depth p-4 text-sm sm:col-span-4">
              <p className="font-medium text-foreground">modal-depth</p>
              <p className="text-xs text-muted">Modais (discador, suporte): a borda escurece de cima para baixo e vira sombra.</p>
            </div>
          </div>
        </Section>

        <Section title="Botões" description="Uma ação primária por área. Perigo é contornado para não competir com a primária vermelha.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Salvar contato</Button>
            <Button variant="secondary">Cancelar</Button>
            <Button variant="ghost">Limpar filtros</Button>
            <Button variant="danger">Recusar solicitação</Button>
            <Button disabled>Desabilitado</Button>
            <Button size="sm">Pequeno</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sidebar p-4">
            <Button variant="inverse" size="sm">
              Inverso (superfície escura)
            </Button>
          </div>
        </Section>

        <Section title="Formulários" description="Field liga rótulo, ajuda e erro ao controle por id (leitores de tela).">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="ds-nome" label="Nome" hint="Como aparece na lista.">
              <Input {...fieldA11y("ds-nome", undefined, "Como aparece na lista.")} placeholder="Maria Souza" />
            </Field>
            <Field id="ds-email" label="E-mail" error="Informe um e-mail válido.">
              <Input {...fieldA11y("ds-email", "Informe um e-mail válido.")} defaultValue="maria@" />
            </Field>
            <Field id="ds-canal" label="Canal">
              <Select {...fieldA11y("ds-canal")}>
                <option>WhatsApp</option>
                <option>E-mail</option>
              </Select>
            </Field>
          </div>
        </Section>

        <Section title="Feedback" description="Cor nunca é o único sinal: alertas têm ícone e texto explícito.">
          <div className="flex flex-wrap gap-2">
            <Badge>Neutro</Badge>
            <Badge tone="primary">Novo</Badge>
            <Badge tone="success">Aprovado</Badge>
            <Badge tone="warning">Pendente</Badge>
            <Badge tone="danger">Bloqueado</Badge>
            <OriginTag origin="AMIGOS" />
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <Alert tone="success">Contato salvo.</Alert>
            <Alert tone="warning">E-mail ainda não verificado.</Alert>
            <Alert tone="danger">Código inválido ou expirado.</Alert>
          </div>
          <nav aria-label="Exemplo de filtros" className="flex flex-wrap gap-2">
            <span className={chipClass(true)}>Tudo</span>
            <span className={chipClass(false)}>Acesso</span>
            <span className={chipClass(false)}>Contatos</span>
          </nav>
        </Section>

        <Section title="Paginação por cursor" description="Listas grandes (contatos, atividade): Anterior/Próxima, custo igual em qualquer página. O total vem dos agregados.">
          <Card>
            <CursorPagination page={{ items: [], pageSize: 10, next: "exemplo", prev: null, total: 1234 }} basePath="/design-system" params={{}} noun={["contato", "contatos"]} />
          </Card>
        </Section>

        <Section title="Avatar, favorito e tema" description="Sem foto, as iniciais. Favorito é pessoal. Tema claro/escuro/sistema no topo; os tokens trocam, as telas não mudam.">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Avatar name="Ana Souza" size={40} />
            <Avatar name="Bruno Lima" size={32} />
            <span className="inline-flex items-center gap-1"><FavoriteButton contactId="exemplo" name="Exemplo" initial /> favorito</span>
            <span className="inline-flex items-center gap-1"><FavoriteButton contactId="exemplo" name="Exemplo" initial={false} /> não favorito</span>
          </div>
        </Section>

        <Section
          title="Canais de contato"
          description="Menu ao lado do número e do e-mail. WhatsApp fica opaco (desabilitado) quando o número não deve ter WhatsApp."
        >
          <div className="space-y-2 text-sm">
            <p><PhoneChannels phone="11987654321" whatsapp={null} name="Celular Exemplo" /> <span className="text-muted">celular: WhatsApp disponível</span></p>
            <p><PhoneChannels phone="1133334444" whatsapp={null} name="Fixo Exemplo" /> <span className="text-muted">fixo: WhatsApp opaco</span></p>
            <p><EmailChannels email="contato@exemplo.com" name="Exemplo" /></p>
          </div>
        </Section>

        <Section
          title="Mapa de intensidade"
          description="Cartograma em grade: cada UF é um bloco igual. Escala sequencial map-0…5, número sempre visível além da cor."
        >
          <BrazilTileMap byUf={{ SP: 40, RJ: 18, MG: 14, PR: 9, RS: 6, BA: 7, CE: 5, DF: 4, PE: 3, AM: 1 }} />
        </Section>

        <Card>
          <CardHeader title="Tabela e estado vazio" description="Cabeçalho discreto; números alinhados à direita." />
          <Table label="Exemplo de tabela">
            <thead>
              <tr>
                <Th>Operador</Th>
                <Th>Situação</Th>
                <Th className="text-right">Contatos</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td className="font-medium">Ana Lima</Td>
                <Td>
                  <Badge tone="success">Ativo</Badge>
                </Td>
                <Td className="text-right tabular-nums">128</Td>
              </tr>
            </tbody>
          </Table>
          <EmptyState title="Nenhum contato ainda" description="Os contatos cadastrados pelos operadores aparecem aqui, em tempo real." />
        </Card>
      </div>
    </>
  );
}
