// Regras puras sobre o domínio do e-mail: endereços temporários e sugestão para erro de digitação.
// A checagem de que o domínio recebe e-mail (DNS) fica no servidor (src/server/email-check.ts).

export const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();

// Serviços de e-mail descartável mais comuns. Não é exaustivo: o admin ainda analisa cada pedido.
const DISPOSABLE = new Set([
  "mailinator.com",
  "yopmail.com",
  "yopmail.net",
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "temp-mail.org",
  "tempmail.com",
  "tempmail.net",
  "tempmailo.com",
  "throwawaymail.com",
  "trashmail.com",
  "getnada.com",
  "nada.email",
  "dispostable.com",
  "maildrop.cc",
  "mailnesia.com",
  "mintemail.com",
  "fakeinbox.com",
  "emailondeck.com",
  "mohmal.com",
  "tempr.email",
  "discard.email",
  "spamgourmet.com",
  "burnermail.io",
  "mail.tm",
  "emailfake.com",
  "moakt.com",
]);

export const isDisposableDomain = (domain: string) => DISPOSABLE.has(domain) || [...DISPOSABLE].some((d) => domain.endsWith(`.${d}`));

// Provedores comuns no Brasil. Domínio exatamente igual a um destes nunca recebe sugestão.
const KNOWN = [
  "gmail.com",
  "hotmail.com",
  "hotmail.com.br",
  "outlook.com",
  "outlook.com.br",
  "live.com",
  "msn.com",
  "yahoo.com",
  "yahoo.com.br",
  "icloud.com",
  "me.com",
  "uol.com.br",
  "bol.com.br",
  "terra.com.br",
  "ig.com.br",
  "globo.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
  "mail.com",
  "gmx.com",
  "zoho.com",
];

// Distância de edição com transposição (gmial → gmail conta 1).
const distance = (a: string, b: string) => {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i]![j] = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
    }
  }
  return d[a.length]![b.length]!;
};

// "fulano@gmial.con" → "fulano@gmail.com". Só sugere a 1 edição de distância (letra trocada, faltando, sobrando
// ou invertida): com 2, domínios legítimos parecidos (hotmart.com) virariam "hotmail.com".
export const suggestEmail = (email: string): string | null => {
  const domain = domainOf(email);
  if (!domain || KNOWN.includes(domain)) return null;
  let best: { known: string; d: number } | null = null; // primeiro da lista em caso de empate
  for (const known of KNOWN) {
    const d = distance(domain, known);
    if (d === 1 && !best) best = { known, d };
  }
  return best ? `${email.slice(0, email.lastIndexOf("@"))}@${best.known}` : null;
};
