// Política de senha no estilo NIST SP 800-63B: comprimento mínimo alto, sem regras de composição
// (que só geram "Senha@123"), bloqueio de senhas óbvias e de senhas que contêm o próprio nome/e-mail.
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;

const COMMON = new Set([
  "123456789012", "1234567890ab", "senha1234567", "senhasenha12", "password1234", "passwordpassword",
  "qwertyuiop12", "qwertyuiopas", "abcdefghijkl", "aaaaaaaaaaaa", "admin1234567", "administrador",
  "iloveyou1234", "brasil123456", "mudar1234567", "trocar123456", "flashanalytics",
]);

export type PasswordContext = { email?: string; name?: string };

export const passwordProblem = (password: string, ctx: PasswordContext = {}): string | null => {
  if (password.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (password.length > PASSWORD_MAX) return `A senha pode ter no máximo ${PASSWORD_MAX} caracteres.`;
  const lower = password.toLowerCase();
  if (COMMON.has(lower) || /^(.)\1+$/.test(password)) return "Essa senha é muito comum. Escolha outra.";
  const emailUser = ctx.email?.split("@")[0]?.toLowerCase();
  if (emailUser && emailUser.length >= 4 && lower.includes(emailUser)) return "A senha não pode conter o seu e-mail.";
  const nameParts = (ctx.name ?? "").toLowerCase().split(/\s+/).filter((p) => p.length >= 4);
  if (nameParts.some((p) => lower.includes(p))) return "A senha não pode conter o seu nome.";
  return null;
};
