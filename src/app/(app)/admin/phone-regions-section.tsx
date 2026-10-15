// Seção "Origem dos números (DDD)" do painel: mapa e gráfico por UF, regiões, DDDs mais frequentes
// e a comparação DDD × UF do endereço. Os links levam à lista de contatos já filtrada.
import Link from "next/link";
import { UF_NAMES } from "@/lib/ddd";
import { formatNumber } from "@/lib/format";
import type { PhoneRegions } from "@/lib/phone-regions";
import { Card, CardHeader, EmptyState } from "@/components/ui";
import { BrazilTileMap } from "./brazil-tile-map";
import { HorizontalBars } from "./charts";
import { ViewTabs } from "./view-tabs";

const percent = (share: number) => `${Math.round(share * 100)}%`;

const MiniKpi = ({ label, value, detail }: { label: string; value: string; detail?: string }) => (
  <div className="rounded-lg border border-border bg-surface px-4 py-3">
    <p className="text-xs text-muted">{label}</p>
    <p className="mt-0.5 text-xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
    {detail ? <p className="text-xs text-muted">{detail}</p> : null}
  </div>
);

export const PhoneRegionsSection = ({ data }: { data: PhoneRegions }) => {
  const ufBars = Object.entries(data.byUf)
    .sort((a, b) => b[1] - a[1])
    .map(([uf, count]) => ({ label: `${uf} · ${UF_NAMES[uf]}`, count }));

  return (
    <section aria-labelledby="ddd-title" className="mt-8">
      <div className="mb-4">
        <h2 id="ddd-title" className="text-lg font-semibold tracking-tight">
          Origem dos números (DDD)
        </h2>
        <p className="mt-0.5 text-sm text-muted">
          De onde é o telefone de cada contato, pelo DDD. Indica a origem do número, não necessariamente onde a pessoa está.
        </p>
      </div>

      {data.total === 0 ? (
        <Card>
          <EmptyState title="Sem contatos ainda" description="O mapa aparece assim que o primeiro contato for cadastrado." />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniKpi label="Regiões alcançadas" value={`${data.regionsReached} de 5`} />
            <MiniKpi label="DDDs diferentes" value={formatNumber(data.distinctDdds)} detail="de 67 existentes" />
            <MiniKpi
              label="Número de outra UF"
              value={percent(data.mismatch.share)}
              detail={`${formatNumber(data.mismatch.count)} com DDD diferente da UF do endereço`}
            />
            <MiniKpi
              label="Região com mais contatos"
              value={data.byRegion[0]!.label}
              detail={`${percent(data.byRegion[0]!.share)} dos números`}
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <CardHeader title="Por UF do DDD" description="Clique em um estado para ver os contatos com números de lá" />
              <div className="p-5">
                <ViewTabs
                  label="Visualização por UF"
                  tabs={[
                    { key: "mapa", label: "Mapa", content: <BrazilTileMap byUf={data.byUf} /> },
                    { key: "grafico", label: "Gráfico", content: <HorizontalBars data={ufBars} labelWidth={170} /> },
                  ]}
                />
              </div>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader title="Por região" description="Regiões do IBGE" />
              <div className="p-4">
                <HorizontalBars data={data.byRegion.map((r) => ({ label: r.label, count: r.count }))} labelWidth={100} />
              </div>
              <ul className="divide-y divide-border border-t border-border text-sm">
                {data.byRegion.map((r) => (
                  <li key={r.key} className="flex items-center justify-between px-5 py-2">
                    {r.count ? (
                      <Link href={`/contatos?regiao=${r.key}`} className="font-medium text-primary hover:underline">
                        {r.label}
                      </Link>
                    ) : (
                      <span className="text-muted">{r.label}</span>
                    )}
                    <span className="tabular-nums text-muted-strong">
                      {formatNumber(r.count)} · {percent(r.share)}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title="DDDs com mais contatos" description="Cidade-polo de cada código" />
              <div className="p-4">
                <HorizontalBars data={data.topDdds.map((d) => ({ label: `${d.ddd} · ${d.city}`, count: d.count }))} labelWidth={170} />
              </div>
            </Card>

            <Card>
              <CardHeader
                title="DDD × UF do endereço"
                description="Números de um estado cadastrados com endereço em outro: mudança, número corporativo ou cadastro a conferir"
              />
              {data.mismatch.top.length === 0 ? (
                <EmptyState title="Tudo coerente" description="Todo número tem DDD da mesma UF do endereço." />
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {data.mismatch.top.map((m) => (
                    <li key={`${m.ddd}-${m.addressUf}`} className="flex items-center justify-between gap-3 px-5 py-3">
                      <Link href={`/contatos?ddduf=${m.dddUf}&uf=${m.addressUf}`} className="text-foreground hover:underline">
                        DDD <strong className="font-semibold">{m.ddd}</strong> ({m.dddUf}) com endereço em{" "}
                        <strong className="font-semibold">{m.addressUf}</strong>
                      </Link>
                      <span className="tabular-nums text-muted-strong">{formatNumber(m.count)}</span>
                    </li>
                  ))}
                </ul>
              )}
              {data.unknownDdd > 0 ? (
                <p className="border-t border-border px-5 py-3 text-xs text-warning-strong">
                  {formatNumber(data.unknownDdd)} contato(s) antigo(s) com DDD inexistente, de antes da validação de DDD.
                </p>
              ) : null}
            </Card>
          </div>
        </>
      )}
    </section>
  );
};
