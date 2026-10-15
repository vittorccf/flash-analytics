// Mapa do Brasil em grade (tile grid cartogram): cada UF é um bloco do mesmo tamanho, na posição aproximada
// do mapa. Para contagens por estado é mais justo que o mapa geográfico (o Amazonas não "pesa" mais só por
// ser grande), dispensa arquivos de geometria e funciona sem nenhum recurso externo.
import Link from "next/link";
import clsx from "clsx";
import { dddsOfUf, UF_NAMES } from "@/lib/ddd";
import { formatNumber } from "@/lib/format";
import { intensityLevel } from "@/lib/phone-regions";

// [coluna, linha] de cada UF na grade 6 × 9 (norte em cima, litoral à direita).
const TILES: Record<string, [number, number]> = {
  RR: [1, 0], AP: [3, 0],
  AM: [1, 1], PA: [2, 1], MA: [3, 1], CE: [4, 1], RN: [5, 1],
  AC: [0, 2], RO: [1, 2], TO: [2, 2], PI: [3, 2], PE: [4, 2], PB: [5, 2],
  MT: [1, 3], GO: [2, 3], BA: [3, 3], SE: [4, 3], AL: [5, 3],
  MS: [1, 4], DF: [2, 4], MG: [3, 4], ES: [4, 4],
  SP: [2, 5], RJ: [3, 5],
  PR: [2, 6],
  SC: [2, 7],
  RS: [2, 8],
};

// Classes literais (o Tailwind só gera o que aparece escrito no código).
const LEVEL_CLASS = [
  "bg-map-0 text-muted-strong",
  "bg-map-1 text-foreground",
  "bg-map-2 text-foreground",
  "bg-map-3 text-foreground",
  "bg-map-4 text-primary-foreground",
  "bg-map-5 text-primary-foreground",
] as const;

const COL_CLASS = ["col-start-1", "col-start-2", "col-start-3", "col-start-4", "col-start-5", "col-start-6"] as const;
const ROW_CLASS = ["row-start-1", "row-start-2", "row-start-3", "row-start-4", "row-start-5", "row-start-6", "row-start-7", "row-start-8", "row-start-9"] as const;

const contactsLabel = (n: number) => (n === 1 ? "1 contato" : `${formatNumber(n)} contatos`);

export const BrazilTileMap = ({ byUf }: { byUf: Record<string, number> }) => {
  const max = Math.max(0, ...Object.values(byUf));

  return (
    <figure className="mx-auto w-full max-w-sm">
      <div className="grid grid-cols-6 gap-1.5" role="list" aria-label="Contatos por UF do DDD">
        {Object.entries(TILES).map(([uf, [col, row]]) => {
          const count = byUf[uf] ?? 0;
          const level = intensityLevel(count, max);
          const label = `${UF_NAMES[uf]}: ${contactsLabel(count)} (DDD ${dddsOfUf(uf).join(", ")})`;
          const tile = (
            <>
              <span className="text-xs font-semibold">{uf}</span>
              <span className="text-[0.65rem] tabular-nums">{count ? formatNumber(count) : "–"}</span>
            </>
          );
          const base = clsx("flex aspect-square flex-col items-center justify-center rounded-md leading-tight", LEVEL_CLASS[level]);
          return (
            <div key={uf} role="listitem" className={clsx(COL_CLASS[col], ROW_CLASS[row])}>
              {count ? (
                <Link
                  href={`/contatos?ddduf=${uf}`}
                  title={`${label}. Clique para ver os contatos.`}
                  aria-label={`${label}. Ver contatos`}
                  className={clsx(base, "transition hover:ring-2 hover:ring-ring hover:ring-offset-1")}
                >
                  {tile}
                </Link>
              ) : (
                <span title={label} aria-label={label} className={base}>
                  {tile}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-4 flex items-center justify-center gap-2 text-xs text-muted">
        <span>Menos</span>
        {LEVEL_CLASS.slice(1).map((cls) => (
          <span key={cls} className={clsx("size-3.5 rounded-sm", cls)} aria-hidden />
        ))}
        <span>Mais</span>
        <span className="ml-3 inline-flex items-center gap-1">
          <span className={clsx("size-3.5 rounded-sm", LEVEL_CLASS[0])} aria-hidden /> Sem contatos
        </span>
      </figcaption>
    </figure>
  );
};
