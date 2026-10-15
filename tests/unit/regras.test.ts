import { describe, expect, it } from "vitest";
import { passwordProblem } from "@/lib/password-policy";
import { formatPhone, isValidBrPhone, normalizePhone } from "@/lib/phone";
import { clampPage, offsetOf, parsePageRequest, toPage } from "@/lib/pagination";
import { contactSchema, loginSchema, signupSchema } from "@/lib/validation";

describe("política de senha", () => {
  it("exige comprimento mínimo e máximo", () => {
    expect(passwordProblem("curta")).toMatch(/12 caracteres/);
    expect(passwordProblem("a".repeat(129))).toMatch(/no máximo/);
    expect(passwordProblem("uma frase longa qualquer")).toBeNull();
  });

  it("recusa senhas óbvias e repetidas", () => {
    expect(passwordProblem("123456789012")).toMatch(/comum/);
    expect(passwordProblem("zzzzzzzzzzzzzz")).toMatch(/comum/);
  });

  it("recusa senha com o próprio e-mail ou nome", () => {
    expect(passwordProblem("joaosilva-2026!", { email: "joaosilva@x.com" })).toMatch(/e-mail/);
    expect(passwordProblem("souamariana123", { name: "Mariana Souza" })).toMatch(/nome/);
  });
});

describe("telefone", () => {
  it("normaliza máscara e +55", () => {
    expect(normalizePhone("+55 (11) 98765-4321")).toBe("11987654321");
    expect(normalizePhone("(21) 3333-4444")).toBe("2133334444");
  });

  it("valida DDD e celular com 9", () => {
    expect(isValidBrPhone("11987654321")).toBe(true);
    expect(isValidBrPhone("2133334444")).toBe(true);
    expect(isValidBrPhone("11887654321")).toBe(false); // 11 dígitos sem o 9
    expect(isValidBrPhone("01987654321")).toBe(false); // DDD inválido
    expect(isValidBrPhone("123")).toBe(false);
  });

  it("formata para exibição", () => {
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(formatPhone("2133334444")).toBe("(21) 3333-4444");
  });
});

describe("paginação", () => {
  it("usa padrões seguros para entrada inválida", () => {
    expect(parsePageRequest({})).toEqual({ page: 1, pageSize: 10 });
    expect(parsePageRequest({ page: "-3", por: "100000" })).toEqual({ page: 1, pageSize: 10 });
    expect(parsePageRequest({ page: "abc", por: "abc" })).toEqual({ page: 1, pageSize: 10 });
    expect(parsePageRequest({ page: "3", por: "20" })).toEqual({ page: 3, pageSize: 20 });
  });

  it("calcula offset e total de páginas", () => {
    expect(offsetOf({ page: 3, pageSize: 10 })).toBe(20);
    expect(toPage([], 23, { page: 1, pageSize: 10 }).totalPages).toBe(3);
    expect(toPage([], 0, { page: 1, pageSize: 10 }).totalPages).toBe(1);
  });

  it("página além da última vira a última", () => {
    expect(clampPage({ page: 99, pageSize: 10 }, 23)).toEqual({ page: 3, pageSize: 10 });
    expect(clampPage({ page: 2, pageSize: 10 }, 23)).toEqual({ page: 2, pageSize: 10 });
    expect(clampPage({ page: 5, pageSize: 10 }, 0)).toEqual({ page: 1, pageSize: 10 });
  });
});

describe("validação de entrada", () => {
  it("normaliza e-mail no login", () => {
    const parsed = loginSchema.parse({ email: "  Admin@Empresa.COM ", password: "x" });
    expect(parsed.email).toBe("admin@empresa.com");
  });

  it("aplica a política de senha e a confirmação no cadastro", () => {
    const result = signupSchema.safeParse({ name: "Ana Souza", email: "ana@x.com", password: "uma frase longa", confirm: "outra" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path[0])).toContain("confirm");
  });

  it("contato: normaliza telefone, opcionais vazios viram null e UF/origem só da lista", () => {
    const ok = contactSchema.parse({
      name: "José da Silva",
      email: "",
      phone: "(11) 91234-5678",
      company: "",
      city: "São Paulo",
      state: "SP",
      origin: "TRABALHO",
      notes: "",
    });
    expect(ok).toMatchObject({ phone: "11912345678", email: null, company: null, notes: null });

    const bad = contactSchema.safeParse({ name: "<script>", email: "x", phone: "1", company: "", city: "", state: "XX", origin: "HACK", notes: "" });
    expect(bad.success).toBe(false);
    expect(new Set(bad.error?.issues.map((i) => i.path[0]))).toEqual(new Set(["name", "email", "phone", "city", "state", "origin"]));
  });
});
