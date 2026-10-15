// Gerador de contatos de demonstração: nomes, cidades e DDDs coerentes (a cidade define o DDD), datas nos
// últimos 30 dias e ~1 em cada 6 com DDD de outra UF (gente que mudou e manteve o número), para o painel
// ter o que mostrar. Determinístico pela semente: o mesmo `seed` gera os mesmos dados.
import type { ContactOrigin } from "@/generated/prisma/client";

const FIRST = ["Ana", "Bruno", "Carla", "Diego", "Eduarda", "Fábio", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Paulo", "Rafaela", "Samuel", "Tatiane", "Vinícius", "Yasmin", "Lúcia", "Marcos", "Beatriz", "Caio", "Débora", "Felipe", "Helena", "Igor", "Júlia"];
const LAST = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas"];
const COMPANIES = ["Alfa Logística", "Beta Comércio", "Gama Tech", "Delta Saúde", "Ômega Engenharia", "Sigma Educação", "Prisma Agro", "Vértice Consultoria", null, null, null, null];

// [cidade, UF, DDD, peso]: capitais e polos, com peso aproximando a população.
const CITIES: [string, string, string, number][] = [
  ["São Paulo", "SP", "11", 10], ["Campinas", "SP", "19", 3], ["Santos", "SP", "13", 2], ["Ribeirão Preto", "SP", "16", 2],
  ["Rio de Janeiro", "RJ", "21", 7], ["Niterói", "RJ", "21", 2], ["Belo Horizonte", "MG", "31", 5], ["Uberlândia", "MG", "34", 2],
  ["Juiz de Fora", "MG", "32", 1], ["Curitiba", "PR", "41", 4], ["Londrina", "PR", "43", 1], ["Maringá", "PR", "44", 1],
  ["Florianópolis", "SC", "48", 2], ["Joinville", "SC", "47", 2], ["Porto Alegre", "RS", "51", 4], ["Caxias do Sul", "RS", "54", 1],
  ["Brasília", "DF", "61", 4], ["Goiânia", "GO", "62", 3], ["Cuiabá", "MT", "65", 1], ["Campo Grande", "MS", "67", 1],
  ["Salvador", "BA", "71", 4], ["Feira de Santana", "BA", "75", 1], ["Recife", "PE", "81", 3], ["Petrolina", "PE", "87", 1],
  ["Fortaleza", "CE", "85", 3], ["Natal", "RN", "84", 1], ["João Pessoa", "PB", "83", 1], ["Maceió", "AL", "82", 1],
  ["Aracaju", "SE", "79", 1], ["Teresina", "PI", "86", 1], ["São Luís", "MA", "98", 1], ["Belém", "PA", "91", 2],
  ["Manaus", "AM", "92", 2], ["Palmas", "TO", "63", 1], ["Porto Velho", "RO", "69", 1], ["Rio Branco", "AC", "68", 1],
  ["Macapá", "AP", "96", 1], ["Boa Vista", "RR", "95", 1], ["Vitória", "ES", "27", 2],
];
const ORIGIN_WEIGHTS: [ContactOrigin, number][] = [["AMIGOS", 5], ["TRABALHO", 5], ["FAMILIA", 4], ["SERVICOS", 3], ["ESTUDOS", 2], ["OUTRO", 1]];

// PRNG simples (mulberry32): rápido, sem dependência, reproduzível.
const prng = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const weighted = <T>(rand: () => number, items: [T, number][]) => {
  let r = rand() * items.reduce((s, [, w]) => s + w, 0);
  for (const [item, w] of items) if ((r -= w) < 0) return item;
  return items[0]![0];
};

const pick = <T>(rand: () => number, list: readonly T[]) => list[Math.floor(rand() * list.length)]!;

const slug = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export type DemoContact = {
  name: string;
  phone: string;
  whatsapp: boolean | null;
  email: string | null;
  company: string | null;
  city: string;
  state: string;
  origin: ContactOrigin;
  createdAt: Date;
};

export const generateDemoContacts = (count: number, seed = Date.now(), now = Date.now(), days = 30): DemoContact[] => {
  const rand = prng(seed);
  const cities = CITIES.map((c) => [c, c[3]] as [typeof c, number]);
  return Array.from({ length: count }, (_, i) => {
    const first = pick(rand, FIRST);
    const last = pick(rand, LAST);
    const [city, state, cityDdd] = weighted(rand, cities);
    // ~1 em 6 com DDD de outra UF (SP ou RJ): mudança com número antigo.
    const ddd = rand() < 1 / 6 ? (state === "SP" ? "21" : "11") : cityDdd;
    const mobile = rand() < 0.85;
    const number = mobile ? `9${String(Math.floor(rand() * 1e8)).padStart(8, "0")}` : `3${String(Math.floor(rand() * 1e7)).padStart(7, "0")}`;
    return {
      name: `${first} ${last}`,
      phone: `${ddd}${number}`,
      // Maioria sem informação (a tela deduz); alguns marcados para mostrar os dois casos.
      whatsapp: rand() < 0.15 ? !mobile || rand() < 0.5 : null,
      email: rand() < 0.75 ? `${slug(first)}.${slug(last)}${i}@exemplo.com.br` : null,
      company: pick(rand, COMPANIES),
      city,
      state,
      origin: weighted(rand, ORIGIN_WEIGHTS),
      createdAt: new Date(now - Math.floor(rand() * days * 24 * 60 * 60 * 1000)),
    };
  });
};
