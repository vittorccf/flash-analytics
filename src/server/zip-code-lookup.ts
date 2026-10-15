// Busca de endereço por CEP: ViaCEP como principal, BrasilAPI (v2) como reserva. Só no servidor:
// a CSP do app continua `connect-src 'self'`, e aqui temos tempo limite, cache e limite de uso.
// Tudo que vem de fora é validado (zod) antes de chegar ao formulário. A troca de fornecedor fica neste arquivo.
import { z } from "zod";
import { UFS } from "@/lib/labels";
import { isValidZipCode, normalizeZipCode } from "@/lib/zip-code";

export type ZipCodeAddress = { zipCode: string; street: string; district: string; city: string; state: string };
export type ZipCodeResult =
  | { status: "found"; address: ZipCodeAddress }
  | { status: "not_found" }
  | { status: "unavailable" };

type FetchFn = (url: string, init: RequestInit) => Promise<Response>;
type Source = { name: string; lookup: (zipCode: string, fetchFn: FetchFn) => Promise<ZipCodeResult> };

const TIMEOUT_MS = 3500;
const FOUND_TTL_MS = 24 * 60 * 60 * 1000; // CEP quase nunca muda
const NOT_FOUND_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 5000;

const text = (max: number) => z.string().trim().max(max).catch("");

// Monta o endereço só com UF da lista oficial e cidade presente; qualquer coisa fora disso é tratada como falha da fonte.
const toAddress = (zipCode: string, raw: { street: string; district: string; city: string; state: string }): ZipCodeResult => {
  const state = raw.state.toUpperCase();
  if (!raw.city || !(UFS as readonly string[]).includes(state)) return { status: "unavailable" };
  return { status: "found", address: { zipCode, street: raw.street, district: raw.district, city: raw.city, state } };
};

const getJson = async (url: string, fetchFn: FetchFn) => {
  const response = await fetchFn(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "error",
    cache: "no-store",
  });
  return { status: response.status, body: response.ok ? ((await response.json()) as unknown) : null };
};

const viaCepFound = z.object({
  logradouro: text(150),
  bairro: text(100),
  localidade: text(100),
  uf: text(2),
});

export const viaCep: Source = {
  name: "ViaCEP",
  lookup: async (zipCode, fetchFn) => {
    const { body } = await getJson(`https://viacep.com.br/ws/${zipCode}/json/`, fetchFn);
    if (!body || typeof body !== "object") return { status: "unavailable" };
    // CEP inexistente: { "erro": true } (ou "true" em versões antigas).
    if ("erro" in body) return { status: "not_found" };
    const parsed = viaCepFound.safeParse(body);
    if (!parsed.success) return { status: "unavailable" };
    const d = parsed.data;
    return toAddress(zipCode, { street: d.logradouro, district: d.bairro, city: d.localidade, state: d.uf });
  },
};

const brasilApiFound = z.object({
  street: text(150).optional().default(""),
  neighborhood: text(100).optional().default(""),
  city: text(100),
  state: text(2),
});

export const brasilApi: Source = {
  name: "BrasilAPI",
  lookup: async (zipCode, fetchFn) => {
    const { status, body } = await getJson(`https://brasilapi.com.br/api/cep/v2/${zipCode}`, fetchFn);
    if (status === 404) return { status: "not_found" };
    const parsed = brasilApiFound.safeParse(body);
    if (!parsed.success) return { status: "unavailable" };
    const d = parsed.data;
    return toAddress(zipCode, { street: d.street, district: d.neighborhood, city: d.city, state: d.state });
  },
};

// Fornecedor simulado (testes e ambientes sem internet): CEPs fixos, sem rede.
const MOCK_ADDRESSES: Record<string, Omit<ZipCodeAddress, "zipCode">> = {
  "01310100": { street: "Avenida Paulista", district: "Bela Vista", city: "São Paulo", state: "SP" },
  "30140071": { street: "Avenida Afonso Pena", district: "Funcionários", city: "Belo Horizonte", state: "MG" },
};

export const mockSource: Source = {
  name: "mock",
  lookup: async (zipCode) => {
    if (zipCode === "99999000") return { status: "unavailable" };
    const found = MOCK_ADDRESSES[zipCode];
    return found ? { status: "found", address: { zipCode, ...found } } : { status: "not_found" };
  },
};

// Tenta as fontes em ordem. A primeira que achar ganha. "Não encontrado" só vale se nenhuma achou e ao menos
// uma respondeu de fato (a reserva também é consultada, porque bases diferentes cobrem CEPs novos de forma diferente).
export const createZipCodeLookup = (sources: Source[], fetchFn: FetchFn = fetch) => {
  const cache = new Map<string, { result: ZipCodeResult; expiresAt: number }>();

  const remember = (zipCode: string, result: ZipCodeResult) => {
    if (result.status === "unavailable") return; // falha não fica em cache: a próxima tentativa pode dar certo
    if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!);
    cache.set(zipCode, { result, expiresAt: Date.now() + (result.status === "found" ? FOUND_TTL_MS : NOT_FOUND_TTL_MS) });
  };

  return async (input: string): Promise<ZipCodeResult> => {
    const zipCode = normalizeZipCode(input);
    if (!isValidZipCode(zipCode)) return { status: "not_found" };

    const cached = cache.get(zipCode);
    if (cached && cached.expiresAt > Date.now()) return cached.result;

    let answeredNotFound = false;
    for (const source of sources) {
      try {
        const result = await source.lookup(zipCode, fetchFn);
        if (result.status === "found") {
          remember(zipCode, result);
          return result;
        }
        if (result.status === "not_found") answeredNotFound = true;
      } catch {
        // tempo esgotado, rede ou JSON inválido: tenta a próxima fonte
      }
    }
    const result: ZipCodeResult = answeredNotFound ? { status: "not_found" } : { status: "unavailable" };
    remember(zipCode, result);
    return result;
  };
};

// CEP_PROVIDER: "remote" (padrão: ViaCEP → BrasilAPI), "mock" (testes) ou "off" (sem saída de rede).
const provider = process.env.CEP_PROVIDER ?? "remote";
const sources = provider === "mock" ? [mockSource] : provider === "off" ? [] : [viaCep, brasilApi];

const globalForLookup = globalThis as unknown as { flashZipCodeLookup?: ReturnType<typeof createZipCodeLookup> };
export const lookupZipCode = (globalForLookup.flashZipCodeLookup ??= createZipCodeLookup(sources));

