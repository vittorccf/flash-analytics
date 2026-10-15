import { describe, expect, it } from "vitest";
import { DDDS } from "@/lib/ddd";
import { generateDemoContacts } from "@/lib/demo-data";
import { DEFAULT_SORT, nextSort, parseSort, sortParam, toOrderBy } from "@/lib/contact-sort";
import { detectImageType } from "@/lib/image-type";
import { ALL_PERMISSIONS, assertCan, can, ForbiddenError, presetOf, PRESETS, sanitizePermissions } from "@/lib/permissions";
import { parseTheme } from "@/lib/theme";
import { contactSchema } from "@/lib/validation";

describe("permissões", () => {
  const leitor = { role: "OPERATOR" as const, permissions: ["contacts.view_all"] };
  const admin = { role: "ADMIN" as const, permissions: [] };

  it("admin pode tudo; operador só o que está na lista", () => {
    for (const p of ALL_PERMISSIONS) expect(can(admin, p)).toBe(true);
    expect(can(leitor, "contacts.view_all")).toBe(true);
    expect(can(leitor, "contacts.create")).toBe(false);
    expect(() => assertCan(leitor, "contacts.delete")).toThrow(ForbiddenError);
  });

  it("lista vinda do formulário só aceita permissões conhecidas, sem repetir", () => {
    expect(sanitizePermissions(["contacts.edit", "admin.tudo", "contacts.edit", "contacts.create"])).toEqual(["contacts.create", "contacts.edit"]);
  });

  it("reconhece os perfis prontos em qualquer ordem e cai em personalizado fora deles", () => {
    expect(presetOf(["contacts.view_all"])?.label).toBe("Leitor");
    expect(presetOf(["contacts.export", "contacts.edit", "contacts.create", "contacts.view_all"])?.label).toBe("Editor");
    expect(presetOf(["contacts.create"])).toBeNull();
    expect(PRESETS.find((p) => p.key === "operador")!.permissions).not.toContain("contacts.view_all");
  });
});

describe("ordenação da lista", () => {
  it("lê só campos conhecidos e cai no padrão (mais recentes primeiro)", () => {
    expect(parseSort("nome")).toEqual({ key: "nome", dir: "asc" });
    expect(parseSort("-cidade")).toEqual({ key: "cidade", dir: "desc" });
    expect(parseSort("passwordHash")).toEqual(DEFAULT_SORT);
    expect(parseSort(undefined)).toEqual(DEFAULT_SORT);
  });

  it("clicar inverte a coluna atual; coluna nova começa A→Z (data: mais recente)", () => {
    expect(nextSort({ key: "nome", dir: "asc" }, "nome")).toEqual({ key: "nome", dir: "desc" });
    expect(nextSort(DEFAULT_SORT, "cidade")).toEqual({ key: "cidade", dir: "asc" });
    expect(nextSort({ key: "nome", dir: "asc" }, "cadastro")).toEqual({ key: "cadastro", dir: "desc" });
    expect(sortParam(DEFAULT_SORT)).toBeUndefined();
    expect(toOrderBy({ key: "nome", dir: "asc" })).toEqual([{ name: "asc" }, { id: "asc" }]);
  });
});

describe("dados de teste", () => {
  const contacts = generateDemoContacts(200, 7, Date.UTC(2026, 9, 15));

  it("é reproduzível pela semente", () => {
    expect(generateDemoContacts(5, 7, Date.UTC(2026, 9, 15))).toEqual(contacts.slice(0, 5));
  });

  it("todo contato passa na mesma validação do formulário (DDD real, UF válida…)", () => {
    for (const c of contacts) {
      const parsed = contactSchema.safeParse({
        ...c,
        whatsapp: c.whatsapp === null ? "" : String(c.whatsapp),
        email: c.email ?? "",
        company: c.company ?? "",
      });
      expect(parsed.success, `${c.name} ${c.phone}`).toBe(true);
    }
  });

  it("a maioria tem DDD da própria UF; algumas (mudança de cidade) não", () => {
    const sameUf = contacts.filter((c) => DDDS[c.phone.slice(0, 2)]!.uf === c.state).length;
    expect(sameUf / contacts.length).toBeGreaterThan(0.7);
    expect(sameUf).toBeLessThan(contacts.length);
  });
});

describe("foto de perfil: tipo pelos bytes", () => {
  it("aceita PNG, JPEG e WebP; recusa SVG, HTML e GIF", () => {
    expect(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(detectImageType(new TextEncoder().encode("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).toBe("image/webp");
    expect(detectImageType(new TextEncoder().encode('<svg onload="alert(1)">'))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("<html>"))).toBeNull();
    expect(detectImageType(new TextEncoder().encode("GIF89a"))).toBeNull();
  });
});

describe("tema", () => {
  it("cookie desconhecido cai em \"do sistema\"", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("<script>")).toBe("system");
    expect(parseTheme(undefined)).toBe("system");
  });
});
