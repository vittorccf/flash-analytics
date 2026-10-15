import { describe, expect, it } from "vitest";
import { domainOf, isDisposableDomain, suggestEmail } from "@/lib/email-domain";

describe("domínio do e-mail", () => {
  it("extrai o domínio em minúsculas", () => {
    expect(domainOf("Ana.Souza@Gmail.COM")).toBe("gmail.com");
  });

  it("recusa e-mail temporário, inclusive em subdomínio", () => {
    expect(isDisposableDomain("mailinator.com")).toBe(true);
    expect(isDisposableDomain("abc.yopmail.com")).toBe(true);
    expect(isDisposableDomain("gmail.com")).toBe(false);
    expect(isDisposableDomain("empresa.com.br")).toBe(false);
  });

  it("sugere o provedor certo em erro de digitação", () => {
    expect(suggestEmail("ana@gmial.com")).toBe("ana@gmail.com");
    expect(suggestEmail("ana@gmail.con")).toBe("ana@gmail.com");
    expect(suggestEmail("ana@hotmial.com")).toBe("ana@hotmail.com");
    expect(suggestEmail("ana@outlok.com")).toBe("ana@outlook.com");
    expect(suggestEmail("ana@yahoo.com.bt")).toBe("ana@yahoo.com.br");
  });

  it("não sugere nada para provedor certo nem para domínio sem parecença", () => {
    expect(suggestEmail("ana@gmail.com")).toBeNull();
    expect(suggestEmail("ana@uol.com.br")).toBeNull();
    expect(suggestEmail("ana@bol.com.br")).toBeNull();
    expect(suggestEmail("ana@mail.com")).toBeNull();
    expect(suggestEmail("ana@montreal.com.br")).toBeNull();
    expect(suggestEmail("ana@hotmart.com")).toBeNull();
  });
});
