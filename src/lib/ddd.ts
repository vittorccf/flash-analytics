// DDDs brasileiros (Anatel): cada código pertence a uma UF; a cidade é o polo de referência da área.
// A UF do DDD indica de onde é o número, não onde a pessoa está hoje (portabilidade e mudança mantêm o número).
// Observação: o DDD 61 cobre o DF e parte do entorno em GO; aqui conta como DF.

export type RegionKey = "norte" | "nordeste" | "centro-oeste" | "sudeste" | "sul";

export const REGIONS: { key: RegionKey; label: string; ufs: readonly string[] }[] = [
  { key: "norte", label: "Norte", ufs: ["AC", "AP", "AM", "PA", "RO", "RR", "TO"] },
  { key: "nordeste", label: "Nordeste", ufs: ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"] },
  { key: "centro-oeste", label: "Centro-Oeste", ufs: ["DF", "GO", "MT", "MS"] },
  { key: "sudeste", label: "Sudeste", ufs: ["ES", "MG", "RJ", "SP"] },
  { key: "sul", label: "Sul", ufs: ["PR", "RS", "SC"] },
];

export const UF_NAMES: Record<string, string> = {
  AC: "Acre", AL: "Alagoas", AP: "Amapá", AM: "Amazonas", BA: "Bahia", CE: "Ceará", DF: "Distrito Federal",
  ES: "Espírito Santo", GO: "Goiás", MA: "Maranhão", MT: "Mato Grosso", MS: "Mato Grosso do Sul", MG: "Minas Gerais",
  PA: "Pará", PB: "Paraíba", PR: "Paraná", PE: "Pernambuco", PI: "Piauí", RJ: "Rio de Janeiro", RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul", RO: "Rondônia", RR: "Roraima", SC: "Santa Catarina", SP: "São Paulo", SE: "Sergipe", TO: "Tocantins",
};

export const DDDS: Record<string, { uf: string; city: string }> = {
  "11": { uf: "SP", city: "São Paulo" },
  "12": { uf: "SP", city: "São José dos Campos" },
  "13": { uf: "SP", city: "Santos" },
  "14": { uf: "SP", city: "Bauru" },
  "15": { uf: "SP", city: "Sorocaba" },
  "16": { uf: "SP", city: "Ribeirão Preto" },
  "17": { uf: "SP", city: "São José do Rio Preto" },
  "18": { uf: "SP", city: "Presidente Prudente" },
  "19": { uf: "SP", city: "Campinas" },
  "21": { uf: "RJ", city: "Rio de Janeiro" },
  "22": { uf: "RJ", city: "Campos dos Goytacazes" },
  "24": { uf: "RJ", city: "Volta Redonda" },
  "27": { uf: "ES", city: "Vitória" },
  "28": { uf: "ES", city: "Cachoeiro de Itapemirim" },
  "31": { uf: "MG", city: "Belo Horizonte" },
  "32": { uf: "MG", city: "Juiz de Fora" },
  "33": { uf: "MG", city: "Governador Valadares" },
  "34": { uf: "MG", city: "Uberlândia" },
  "35": { uf: "MG", city: "Poços de Caldas" },
  "37": { uf: "MG", city: "Divinópolis" },
  "38": { uf: "MG", city: "Montes Claros" },
  "41": { uf: "PR", city: "Curitiba" },
  "42": { uf: "PR", city: "Ponta Grossa" },
  "43": { uf: "PR", city: "Londrina" },
  "44": { uf: "PR", city: "Maringá" },
  "45": { uf: "PR", city: "Cascavel" },
  "46": { uf: "PR", city: "Francisco Beltrão" },
  "47": { uf: "SC", city: "Joinville" },
  "48": { uf: "SC", city: "Florianópolis" },
  "49": { uf: "SC", city: "Chapecó" },
  "51": { uf: "RS", city: "Porto Alegre" },
  "53": { uf: "RS", city: "Pelotas" },
  "54": { uf: "RS", city: "Caxias do Sul" },
  "55": { uf: "RS", city: "Santa Maria" },
  "61": { uf: "DF", city: "Brasília" },
  "62": { uf: "GO", city: "Goiânia" },
  "63": { uf: "TO", city: "Palmas" },
  "64": { uf: "GO", city: "Rio Verde" },
  "65": { uf: "MT", city: "Cuiabá" },
  "66": { uf: "MT", city: "Rondonópolis" },
  "67": { uf: "MS", city: "Campo Grande" },
  "68": { uf: "AC", city: "Rio Branco" },
  "69": { uf: "RO", city: "Porto Velho" },
  "71": { uf: "BA", city: "Salvador" },
  "73": { uf: "BA", city: "Ilhéus" },
  "74": { uf: "BA", city: "Juazeiro" },
  "75": { uf: "BA", city: "Feira de Santana" },
  "77": { uf: "BA", city: "Vitória da Conquista" },
  "79": { uf: "SE", city: "Aracaju" },
  "81": { uf: "PE", city: "Recife" },
  "82": { uf: "AL", city: "Maceió" },
  "83": { uf: "PB", city: "João Pessoa" },
  "84": { uf: "RN", city: "Natal" },
  "85": { uf: "CE", city: "Fortaleza" },
  "86": { uf: "PI", city: "Teresina" },
  "87": { uf: "PE", city: "Petrolina" },
  "88": { uf: "CE", city: "Juazeiro do Norte" },
  "89": { uf: "PI", city: "Picos" },
  "91": { uf: "PA", city: "Belém" },
  "92": { uf: "AM", city: "Manaus" },
  "93": { uf: "PA", city: "Santarém" },
  "94": { uf: "PA", city: "Marabá" },
  "95": { uf: "RR", city: "Boa Vista" },
  "96": { uf: "AP", city: "Macapá" },
  "97": { uf: "AM", city: "Tefé" },
  "98": { uf: "MA", city: "São Luís" },
  "99": { uf: "MA", city: "Imperatriz" },
};

export const isKnownDdd = (ddd: string) => ddd in DDDS;

export const regionOfUf = (uf: string) => REGIONS.find((r) => r.ufs.includes(uf)) ?? null;

export const dddsOfUf = (uf: string) => Object.keys(DDDS).filter((ddd) => DDDS[ddd]!.uf === uf);

export const dddsOfRegion = (key: RegionKey) => {
  const ufs = REGIONS.find((r) => r.key === key)?.ufs ?? [];
  return Object.keys(DDDS).filter((ddd) => ufs.includes(DDDS[ddd]!.uf));
};

export const isRegionKey = (value: unknown): value is RegionKey => REGIONS.some((r) => r.key === value);

// "11987654321" → { ddd: "11", uf: "SP", city: "São Paulo", region: "sudeste" } (ou null para DDD inexistente).
export const locatePhone = (digits: string) => {
  const ddd = digits.slice(0, 2);
  const info = DDDS[ddd];
  if (!info) return null;
  return { ddd, ...info, region: regionOfUf(info.uf)!.key };
};
