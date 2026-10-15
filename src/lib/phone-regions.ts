// Análise geográfica dos telefones: a partir das contagens por (DDD, UF do endereço) que vêm do banco,
// monta UF/região de origem do número, ranking de DDDs e a comparação DDD × endereço. Puro e testável.
import { DDDS, REGIONS, type RegionKey } from "./ddd";

export type DddStateCount = { ddd: string; state: string; count: number };

export type PhoneRegions = {
  total: number;
  byUf: Record<string, number>; // UF do DDD
  byRegion: { key: RegionKey; label: string; count: number; share: number }[];
  topDdds: { ddd: string; uf: string; city: string; count: number }[];
  distinctDdds: number;
  regionsReached: number;
  // DDD de uma UF e endereço em outra: pessoa que mudou, número corporativo ou cadastro a conferir.
  mismatch: { count: number; share: number; top: { ddd: string; dddUf: string; addressUf: string; count: number }[] };
  unknownDdd: number; // dados antigos, de antes da validação de DDD
};

const share = (part: number, total: number) => (total === 0 ? 0 : part / total);

export const summarizePhoneRegions = (rows: DddStateCount[], topN = 10): PhoneRegions => {
  const byUf: Record<string, number> = {};
  const byDdd = new Map<string, number>();
  const mismatchPairs = new Map<string, { ddd: string; dddUf: string; addressUf: string; count: number }>();
  let total = 0;
  let unknownDdd = 0;
  let mismatchCount = 0;

  for (const row of rows) {
    total += row.count;
    const info = DDDS[row.ddd];
    if (!info) {
      unknownDdd += row.count;
      continue;
    }
    byUf[info.uf] = (byUf[info.uf] ?? 0) + row.count;
    byDdd.set(row.ddd, (byDdd.get(row.ddd) ?? 0) + row.count);
    if (info.uf !== row.state) {
      mismatchCount += row.count;
      const key = `${row.ddd}>${row.state}`;
      const pair = mismatchPairs.get(key) ?? { ddd: row.ddd, dddUf: info.uf, addressUf: row.state, count: 0 };
      pair.count += row.count;
      mismatchPairs.set(key, pair);
    }
  }

  const byRegion = REGIONS.map((r) => {
    const count = r.ufs.reduce((sum, uf) => sum + (byUf[uf] ?? 0), 0);
    return { key: r.key, label: r.label, count, share: share(count, total) };
  }).sort((a, b) => b.count - a.count);

  const topDdds = [...byDdd.entries()]
    .map(([ddd, count]) => ({ ddd, uf: DDDS[ddd]!.uf, city: DDDS[ddd]!.city, count }))
    .sort((a, b) => b.count - a.count || a.ddd.localeCompare(b.ddd))
    .slice(0, topN);

  return {
    total,
    byUf,
    byRegion,
    topDdds,
    distinctDdds: byDdd.size,
    regionsReached: byRegion.filter((r) => r.count > 0).length,
    mismatch: {
      count: mismatchCount,
      share: share(mismatchCount, total),
      top: [...mismatchPairs.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    },
    unknownDdd,
  };
};

// Escala do mapa em 5 faixas relativas ao maior valor (0 = sem contatos). Faixa por proporção, não por quantil:
// com poucos dados, quantis viram ruído.
export const intensityLevel = (count: number, max: number) => (count <= 0 || max <= 0 ? 0 : Math.max(1, Math.ceil((count / max) * 5)));
