// Atalhos para falar com o contato: WhatsApp, ligação, SMS e e-mail. Só montam links (o sistema
// não envia nada): quem decide qual app abre é o dispositivo de quem clica.

// Telefone guardado com DDD (10 ou 11 dígitos) → formato internacional E.164 do Brasil.
export const toE164 = (digits: string) => `+55${digits}`;

const isMobile = (digits: string) => digits.length === 11 && digits[2] === "9";

export type WhatsappAvailability = { available: boolean; reason: string };

// Não existe consulta oficial e gratuita para saber se um número tem WhatsApp (a API da Meta não oferece, e
// verificadores não oficiais violam os termos de uso). Regra: o que o cadastro informar vale; sem informação,
// celular é tratado como provável WhatsApp e fixo como sem WhatsApp.
export const whatsappAvailability = (digits: string, informed: boolean | null): WhatsappAvailability => {
  if (informed === true) return { available: true, reason: "Tem WhatsApp (informado no cadastro)" };
  if (informed === false) return { available: false, reason: "Sem WhatsApp (informado no cadastro)" };
  return isMobile(digits)
    ? { available: true, reason: "Celular: provável WhatsApp" }
    : { available: false, reason: "Número fixo: normalmente sem WhatsApp" };
};

export const whatsappLinks = (digits: string, message?: string) => {
  const phone = `55${digits}`;
  const text = message ? `&text=${encodeURIComponent(message)}` : "";
  return {
    // wa.me: abre o app no celular/computador, ou oferece o WhatsApp Web.
    app: `https://wa.me/${phone}${message ? `?text=${encodeURIComponent(message)}` : ""}`,
    web: `https://web.whatsapp.com/send?phone=${phone}${text}`,
  };
};

// tel:/sms: deixam o sistema escolher o app (discador, Teams, Skype, Link to Phone, FaceTime…).
export const phoneLinks = (digits: string) => ({ call: `tel:${toE164(digits)}`, sms: `sms:${toE164(digits)}` });

export const emailLinks = (email: string) => {
  const to = encodeURIComponent(email);
  return {
    default: `mailto:${email}`,
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${to}`,
    outlook: `https://outlook.office.com/mail/deeplink/compose?to=${to}`,
  };
};
