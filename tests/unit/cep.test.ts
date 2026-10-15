import { describe, expect, it, vi } from "vitest";
import { formatZipCode, isValidZipCode, normalizeZipCode } from "@/lib/zip-code";
import { contactSchema } from "@/lib/validation";
import { brasilApi, createZipCodeLookup, viaCep } from "@/server/zip-code-lookup";

// fetch falso: nenhuma chamada sai para a rede. Cada URL devolve o que o teste mandar.
const fakeFetch = (routes: Record<string, () => Response | Promise<Response>>) =>
  vi.fn(async (url: string) => {
    const host = Object.keys(routes).find((h) => url.includes(h));
    if (!host) throw new Error(`URL inesperada: ${url}`);
    return routes[host]!();
  });

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const VIACEP_PAULISTA = { cep: "01310-100", logradouro: "Avenida Paulista", bairro: "Bela Vista", localidade: "São Paulo", uf: "SP" };
const BRASILAPI_PAULISTA = { cep: "01310100", street: "Avenida Paulista", neighborhood: "Bela Vista", city: "São Paulo", state: "SP" };
const PAULISTA = { zipCode: "01310100", street: "Avenida Paulista", district: "Bela Vista", city: "São Paulo", state: "SP" };

describe("formato do CEP", () => {
  it("normaliza, valida e aplica a máscara progressiva", () => {
    expect(normalizeZipCode("01310-100")).toBe("01310100");
    expect(normalizeZipCode("01.310-100 extra 999")).toBe("01310100");
    expect(isValidZipCode("01310100")).toBe(true);
    expect(isValidZipCode("0131010")).toBe(false);
    expect(isValidZipCode("00000000")).toBe(false);
    expect(formatZipCode("0131")).toBe("0131");
    expect(formatZipCode("013101")).toBe("01310-1");
    expect(formatZipCode("01310100")).toBe("01310-100");
  });

  it("no cadastro de contato, CEP é opcional mas, se vier, tem 8 dígitos", () => {
    const base = { name: "José da Silva", email: "", phone: "11912345678", company: "", street: "", number: "", district: "", city: "São Paulo", state: "SP", origin: "TRABALHO", notes: "" };
    expect(contactSchema.parse({ ...base, zipCode: "" }).zipCode).toBeNull();
    expect(contactSchema.parse({ ...base, zipCode: "01310-100" }).zipCode).toBe("01310100");
    expect(contactSchema.safeParse({ ...base, zipCode: "123" }).success).toBe(false);
  });
});

describe("fontes de CEP", () => {
  it("ViaCEP: endereço encontrado e CEP inexistente ({ erro: true } ou \"true\")", async () => {
    expect(await viaCep.lookup("01310100", fakeFetch({ viacep: () => json(VIACEP_PAULISTA) }))).toEqual({ status: "found", address: PAULISTA });
    expect(await viaCep.lookup("01310199", fakeFetch({ viacep: () => json({ erro: true }) }))).toEqual({ status: "not_found" });
    expect(await viaCep.lookup("01310199", fakeFetch({ viacep: () => json({ erro: "true" }) }))).toEqual({ status: "not_found" });
  });

  it("BrasilAPI: encontrado e 404", async () => {
    expect(await brasilApi.lookup("01310100", fakeFetch({ brasilapi: () => json(BRASILAPI_PAULISTA) }))).toEqual({ status: "found", address: PAULISTA });
    expect(await brasilApi.lookup("01310199", fakeFetch({ brasilapi: () => json({ message: "CEP não encontrado" }, 404) }))).toEqual({ status: "not_found" });
  });

  it("resposta fora do formato ou com UF inválida não chega ao formulário", async () => {
    expect(await viaCep.lookup("01310100", fakeFetch({ viacep: () => json({ ...VIACEP_PAULISTA, uf: "XX" }) }))).toEqual({ status: "unavailable" });
    expect(await viaCep.lookup("01310100", fakeFetch({ viacep: () => json("<html>") }))).toEqual({ status: "unavailable" });
    expect(await brasilApi.lookup("01310100", fakeFetch({ brasilapi: () => json({ city: 42 }) }))).toEqual({ status: "unavailable" });
  });
});

describe("busca com reserva e cache", () => {
  it("ViaCEP fora do ar: usa a BrasilAPI", async () => {
    const fetchFn = fakeFetch({ viacep: () => json({}, 503), brasilapi: () => json(BRASILAPI_PAULISTA) });
    const lookup = createZipCodeLookup([viaCep, brasilApi], fetchFn);
    expect(await lookup("01310-100")).toEqual({ status: "found", address: PAULISTA });
  });

  it("ViaCEP com erro de rede/tempo esgotado: usa a BrasilAPI", async () => {
    const fetchFn = fakeFetch({ viacep: () => Promise.reject(new DOMException("timeout", "TimeoutError")), brasilapi: () => json(BRASILAPI_PAULISTA) });
    expect(await createZipCodeLookup([viaCep, brasilApi], fetchFn)("01310100")).toEqual({ status: "found", address: PAULISTA });
  });

  it("ViaCEP não conhece o CEP, mas a reserva conhece (bases diferentes): vale o encontrado", async () => {
    const fetchFn = fakeFetch({ viacep: () => json({ erro: true }), brasilapi: () => json(BRASILAPI_PAULISTA) });
    expect(await createZipCodeLookup([viaCep, brasilApi], fetchFn)("01310100")).toEqual({ status: "found", address: PAULISTA });
  });

  it("ninguém conhece: não encontrado; todas fora do ar: indisponível", async () => {
    const notFound = fakeFetch({ viacep: () => json({ erro: true }), brasilapi: () => json({}, 404) });
    expect(await createZipCodeLookup([viaCep, brasilApi], notFound)("01310199")).toEqual({ status: "not_found" });
    const down = fakeFetch({ viacep: () => json({}, 500), brasilapi: () => Promise.reject(new Error("rede")) });
    expect(await createZipCodeLookup([viaCep, brasilApi], down)("01310100")).toEqual({ status: "unavailable" });
  });

  it("guarda acertos em cache, mas não guarda falha (a próxima tentativa pode dar certo)", async () => {
    let up = false;
    const fetchFn = fakeFetch({ viacep: () => (up ? json(VIACEP_PAULISTA) : json({}, 503)) });
    const lookup = createZipCodeLookup([viaCep], fetchFn);
    expect((await lookup("01310100")).status).toBe("unavailable");
    up = true;
    expect((await lookup("01310100")).status).toBe("found");
    expect((await lookup("01310100")).status).toBe("found");
    expect(fetchFn).toHaveBeenCalledTimes(2); // a terceira veio do cache
  });

  it("CEP inválido nem chega a sair para a rede", async () => {
    const fetchFn = fakeFetch({});
    expect(await createZipCodeLookup([viaCep, brasilApi], fetchFn)("123")).toEqual({ status: "not_found" });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
