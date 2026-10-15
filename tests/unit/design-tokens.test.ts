import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Guarda do design system: mudar um token não pode derrubar o contraste mínimo (WCAG 2.2 AA) dos pares usados nas telas.
const css = readFileSync(path.resolve(__dirname, "../../src/app/globals.css"), "utf8");
// Só o bloco @theme: redefinições por contexto (ex.: [data-surface="dark"]) são testadas como pares próprios.
const theme = /@theme[^{]*\{([\s\S]*?)\n\}/.exec(css)![1]!;
const tokens = new Map([...theme.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]));

const resolve = (name: string, depth = 0): string => {
  const value = tokens.get(name);
  if (!value) throw new Error(`Token --color-${name} não existe`);
  const ref = /^var\(--color-([\w-]+)\)$/.exec(value);
  if (!ref) return value;
  if (depth > 5) throw new Error(`Referência circular em --color-${name}`);
  return resolve(ref[1]!, depth + 1);
};

const luminance = (hex: string) => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Cor não é hex de 6 dígitos: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1]!.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};

const contrast = (fg: string, bg: string) => {
  const [a, b] = [luminance(resolve(fg)), luminance(resolve(bg))].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
};

// [texto, fundo, mínimo]: 4.5 para texto comum; 3 para elementos não textuais (bordas de foco, barras de gráfico).
const PAIRS: [string, string, number][] = [
  ["foreground", "background", 4.5],
  ["foreground", "surface", 4.5],
  ["muted", "surface", 4.5],
  ["muted", "background", 4.5],
  ["muted-strong", "subtle", 4.5],
  ["primary-foreground", "primary", 4.5],
  ["primary-foreground", "primary-hover", 4.5],
  ["primary", "surface", 4.5],
  ["primary-strong", "primary-soft", 4.5],
  ["surface", "foreground", 4.5],
  ["danger-strong", "surface", 4.5],
  ["danger-strong", "danger-soft", 4.5],
  ["success-strong", "success-soft", 4.5],
  ["warning-strong", "warning-soft", 4.5],
  ["sidebar-foreground", "sidebar", 4.5],
  ["sidebar-foreground", "sidebar-accent", 4.5],
  ["sidebar-muted", "sidebar", 4.5],
  ["brand-400", "sidebar", 4.5],
  ["ring", "surface", 3],
  ["sidebar-foreground", "sidebar", 3], // anel de foco em superfície escura
  ["danger", "surface", 3],
  ["chart-1", "surface", 3],
  ["chart-2", "surface", 3],
  ["chart-3", "surface", 3],
  ["chart-4", "surface", 3],
  ["whatsapp", "surface", 3], // ícone (elemento não textual)
  // Texto sobre o degradê forte da marca: confere nas duas pontas.
  ["on-brand", "brand-700", 4.5],
  ["on-brand", "brand-950", 4.5],
  // Mapa de intensidade: rótulo da UF e número dentro de cada faixa.
  ["muted-strong", "map-0", 4.5],
  ["foreground", "map-1", 4.5],
  ["foreground", "map-2", 4.5],
  ["foreground", "map-3", 4.5],
  ["primary-foreground", "map-4", 4.5],
  ["primary-foreground", "map-5", 4.5],
];

describe("tokens do design system", () => {
  it.each(PAIRS)("%s sobre %s atinge %s:1", (fg, bg, min) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("componentes não usam cor fixa fora dos tokens", async () => {
    const { globSync } = await import("node:fs");
    const files = globSync("src/**/*.tsx", { cwd: path.resolve(__dirname, "../..") });
    expect(files.length).toBeGreaterThan(20);
    const offenders = files.filter((f) => {
      const src = readFileSync(path.resolve(__dirname, "../..", f), "utf8");
      return /#[0-9a-f]{6}\b|\b(?:bg|text|border|fill|stroke)-(?:white|black|(?:red|indigo|blue|slate|gray|zinc|green|amber)-\d{2,3})\b/i.test(src);
    });
    expect(offenders).toEqual([]);
  });
});

// --- Tema escuro: os mesmos pares, com os tokens redefinidos em :root[data-theme="dark"] por cima dos claros ---
const darkBlock = /:root\[data-theme="dark"\]\s*\{([\s\S]*?)\n\}/.exec(css)![1]!;
const systemBlock = /:root\[data-theme="system"\]\s*\{([\s\S]*?)\n\s*\}/.exec(css)![1]!;
const declarations = (block: string) => [...block.matchAll(/--color-([\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()] as const);

const darkTokens = new Map([...tokens, ...declarations(darkBlock)]);
const resolveDark = (name: string, depth = 0): string => {
  const value = darkTokens.get(name);
  if (!value) throw new Error(`Token --color-${name} não existe`);
  const ref = /^var\(--color-([\w-]+)\)$/.exec(value);
  if (!ref) return value;
  if (depth > 5) throw new Error(`Referência circular em --color-${name}`);
  return resolveDark(ref[1]!, depth + 1);
};
const contrastDark = (fg: string, bg: string) => {
  const [a, b] = [luminance(resolveDark(fg)), luminance(resolveDark(bg))].sort((x, y) => y - x);
  return (a! + 0.05) / (b! + 0.05);
};

describe("tema escuro", () => {
  it.each(PAIRS)("%s sobre %s atinge %s:1 no escuro", (fg, bg, min) => {
    expect(contrastDark(fg, bg)).toBeGreaterThanOrEqual(min);
  });

  it("o bloco do tema escuro e o do \"sistema\" são idênticos (um não pode ficar para trás)", () => {
    expect(declarations(systemBlock)).toEqual(declarations(darkBlock));
  });
});
