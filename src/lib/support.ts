// Contato do suporte. Um lugar só: botão flutuante, tela de login e documentação usam daqui.
import { formatPhone } from "./phone";

export const SUPPORT = {
  name: "Vittor (suporte Flash Contacts)",
  whatsapp: "64999368321", // DDD + número, sem máscara
  email: "vittorccf@gmail.com",
} as const;

export const SUPPORT_PHONE_LABEL = formatPhone(SUPPORT.whatsapp);

export const SUPPORT_TYPES = {
  acesso: "Não consigo entrar",
  erro: "Erro ou algo travou",
  duvida: "Dúvida de uso",
  sugestao: "Sugestão de melhoria",
  outro: "Outro assunto",
} as const;

export type SupportType = keyof typeof SUPPORT_TYPES;

// Texto pronto para o WhatsApp/e-mail do suporte (o sistema não envia sozinho: a pessoa confirma o envio).
export const supportMessage = (t: { protocol: string; type: SupportType; message: string; from: string; page?: string | null }) =>
  [
    `[Flash Contacts] Suporte: ${SUPPORT_TYPES[t.type]}`,
    `Protocolo: ${t.protocol}`,
    `De: ${t.from}`,
    t.page ? `Tela: ${t.page}` : null,
    "",
    t.message,
  ]
    .filter((l) => l !== null)
    .join("\n");

export const supportLinks = (text: string) => ({
  whatsapp: `https://wa.me/55${SUPPORT.whatsapp}?text=${encodeURIComponent(text)}`,
  email: `mailto:${SUPPORT.email}?subject=${encodeURIComponent("Suporte Flash Contacts")}&body=${encodeURIComponent(text)}`,
});
