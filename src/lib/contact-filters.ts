// Filtros da lista de contatos vindos da URL (tela e exportação usam os mesmos). A URL é dado do cliente:
// só passa o que está na lista de valores válidos.
import type { ContactOrigin } from "@/generated/prisma/client";
import { isRegionKey, type RegionKey } from "./ddd";
import { ORIGINS, UFS } from "./labels";

// dddUf/region: filtram pela origem do NÚMERO (DDD), não pelo endereço.
export type ContactFilters = { q?: string; state?: string; origin?: ContactOrigin; operatorId?: string; dddUf?: string; region?: RegionKey; favorites?: boolean };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const isUf = (v: string | undefined): v is string => Boolean(v && (UFS as readonly string[]).includes(v));

export const parseContactFilters = (sp: Params): ContactFilters => {
  const state = one(sp.uf)?.toUpperCase();
  const origin = one(sp.origem);
  const dddUf = one(sp.ddduf)?.toUpperCase();
  const region = one(sp.regiao);
  return {
    q: one(sp.q)?.slice(0, 100),
    state: isUf(state) ? state : undefined,
    origin: origin && (ORIGINS as string[]).includes(origin) ? (origin as ContactOrigin) : undefined,
    operatorId: one(sp.operador)?.slice(0, 40),
    dddUf: isUf(dddUf) ? dddUf : undefined,
    region: isRegionKey(region) ? region : undefined,
    favorites: one(sp.favoritos) === "1" || undefined,
  };
};

// Filtros → parâmetros de URL (paginação, link de exportação).
export const filtersToParams = (f: ContactFilters): Record<string, string | undefined> => ({
  q: f.q,
  uf: f.state,
  origem: f.origin,
  operador: f.operatorId,
  ddduf: f.dddUf,
  regiao: f.region,
  favoritos: f.favorites ? "1" : undefined,
});
