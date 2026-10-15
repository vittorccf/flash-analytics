import { describe, expect, it } from "vitest";
import { DDDS, REGIONS, UF_NAMES, dddsOfRegion, dddsOfUf, isKnownDdd, locatePhone } from "@/lib/ddd";
import { UFS } from "@/lib/labels";
import { isValidBrPhone } from "@/lib/phone";
import { intensityLevel, summarizePhoneRegions } from "@/lib/phone-regions";

describe("tabela de DDDs", () => {
  it("tem os 67 DDDs, todos de UFs válidas, e toda UF tem ao menos um", () => {
    expect(Object.keys(DDDS)).toHaveLength(67);
    for (const { uf } of Object.values(DDDS)) expect(UFS).toContain(uf);
    for (const uf of UFS) expect(dddsOfUf(uf).length).toBeGreaterThan(0);
  });

  it("as 5 regiões cobrem as 27 UFs sem repetir, e toda UF tem nome", () => {
    const ufs = REGIONS.flatMap((r) => r.ufs);
    expect(ufs).toHaveLength(27);
    expect(new Set(ufs).size).toBe(27);
    for (const uf of UFS) expect(UF_NAMES[uf]).toBeTruthy();
  });

  it("localiza o número pelo DDD", () => {
    expect(locatePhone("11987654321")).toEqual({ ddd: "11", uf: "SP", city: "São Paulo", region: "sudeste" });
    expect(locatePhone("8533334444")).toMatchObject({ uf: "CE", region: "nordeste" });
    expect(locatePhone("61987654321")).toMatchObject({ uf: "DF", region: "centro-oeste" });
    expect(locatePhone("2098765432")).toBeNull();
  });

  it("DDD por UF e por região", () => {
    expect(dddsOfUf("SP")).toEqual(["11", "12", "13", "14", "15", "16", "17", "18", "19"]);
    expect(dddsOfRegion("sul")).toEqual(["41", "42", "43", "44", "45", "46", "47", "48", "49", "51", "53", "54", "55"]);
  });

  it("telefone com DDD inexistente é recusado no cadastro", () => {
    expect(isKnownDdd("23")).toBe(false);
    expect(isValidBrPhone("23987654321")).toBe(false);
    expect(isValidBrPhone("50987654321")).toBe(false);
    expect(isValidBrPhone("47987654321")).toBe(true);
  });
});

describe("análise por DDD", () => {
  const rows = [
    { ddd: "11", state: "SP", count: 5 },
    { ddd: "11", state: "RJ", count: 2 }, // número de SP, endereço no RJ
    { ddd: "21", state: "RJ", count: 3 },
    { ddd: "85", state: "CE", count: 1 },
    { ddd: "20", state: "SP", count: 1 }, // DDD inexistente (dado antigo)
  ];
  const s = summarizePhoneRegions(rows);

  it("conta por UF do DDD, por região e por DDD", () => {
    expect(s.total).toBe(12);
    expect(s.byUf).toEqual({ SP: 7, RJ: 3, CE: 1 });
    expect(s.byRegion[0]).toMatchObject({ key: "sudeste", count: 10 });
    expect(s.byRegion.find((r) => r.key === "nordeste")!.count).toBe(1);
    expect(s.regionsReached).toBe(2);
    expect(s.topDdds.map((d) => d.ddd)).toEqual(["11", "21", "85"]);
    expect(s.distinctDdds).toBe(3);
    expect(s.unknownDdd).toBe(1);
  });

  it("compara DDD com a UF do endereço", () => {
    expect(s.mismatch.count).toBe(2);
    expect(s.mismatch.share).toBeCloseTo(2 / 12);
    expect(s.mismatch.top).toEqual([{ ddd: "11", dddUf: "SP", addressUf: "RJ", count: 2 }]);
  });

  it("sem contatos: tudo zerado, sem divisão por zero", () => {
    const empty = summarizePhoneRegions([]);
    expect(empty.total).toBe(0);
    expect(empty.mismatch.share).toBe(0);
    expect(empty.byRegion.every((r) => r.share === 0)).toBe(true);
  });

  it("escala do mapa em 5 faixas relativas ao maior valor", () => {
    expect(intensityLevel(0, 10)).toBe(0);
    expect(intensityLevel(1, 10)).toBe(1);
    expect(intensityLevel(5, 10)).toBe(3);
    expect(intensityLevel(10, 10)).toBe(5);
  });
});
