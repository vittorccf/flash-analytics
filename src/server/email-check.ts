// O e-mail digitado é de verdade? Sem mandar mensagem (não prova que a pessoa é dona do endereço), confere:
// endereço temporário e se o domínio recebe e-mail (DNS: registro MX ou, na falta dele, o endereço do domínio,
// como manda a RFC 5321). DNS fora do ar ou lento não bloqueia: o admin ainda analisa cada pedido.
// EMAIL_DOMAIN_CHECK=off desliga a consulta ao DNS (testes, servidor sem saída de internet).
import "server-only";
import { Resolver } from "node:dns/promises";
import { domainOf, isDisposableDomain, suggestEmail } from "@/lib/email-domain";

const resolver = new Resolver({ timeout: 2500, tries: 2 });

// Respostas definitivas de "não existe"; o resto (timeout, SERVFAIL, rede) é dúvida e não bloqueia.
const NOT_FOUND = new Set(["ENOTFOUND", "ENODATA", "NXDOMAIN"]);

type Lookup = "yes" | "no" | "unknown";

const errorCode = (error: unknown) => (error as { code?: string } | null)?.code ?? "";

const hasAddress = async (domain: string): Promise<Lookup> => {
  const results = await Promise.allSettled([resolver.resolve4(domain), resolver.resolve6(domain)]);
  if (results.some((r) => r.status === "fulfilled" && r.value.length > 0)) return "yes";
  return results.every((r) => r.status === "rejected" && NOT_FOUND.has(errorCode(r.reason))) ? "no" : "unknown";
};

const acceptsMail = async (domain: string): Promise<Lookup> => {
  try {
    const mx = await resolver.resolveMx(domain);
    if (mx.length === 0) return hasAddress(domain);
    // "Null MX" (RFC 7505): o domínio declara que não recebe e-mail.
    return mx.every((r) => r.exchange === "" || r.exchange === ".") ? "no" : "yes";
  } catch (error) {
    const code = errorCode(error);
    if (code === "ENODATA") return hasAddress(domain); // domínio existe, mas sem MX
    return NOT_FOUND.has(code) ? "no" : "unknown";
  }
};

// Devolve a mensagem para a pessoa, ou null se o e-mail pode seguir.
export const emailProblem = async (email: string): Promise<string | null> => {
  const domain = domainOf(email);
  if (isDisposableDomain(domain)) return "Use um e-mail permanente: endereços temporários não são aceitos.";
  if (process.env.EMAIL_DOMAIN_CHECK === "off") return null;
  if ((await acceptsMail(domain)) !== "no") return null;
  const suggestion = suggestEmail(email);
  return suggestion
    ? `O domínio "${domain}" não recebe e-mails. Você quis dizer ${suggestion}?`
    : `O domínio "${domain}" não recebe e-mails. Confira o endereço.`;
};
