import type { ContactOrigin, Role, SignupStatus, UserStatus } from "@/generated/prisma/client";

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA",
  "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;

export const ORIGIN_LABELS: Record<ContactOrigin, string> = {
  FAMILIA: "Família",
  AMIGOS: "Amigos",
  TRABALHO: "Trabalho",
  ESTUDOS: "Estudos",
  SERVICOS: "Serviços",
  OUTRO: "Outro",
};

export const ORIGINS = Object.keys(ORIGIN_LABELS) as ContactOrigin[];

export const ROLE_LABELS: Record<Role, string> = { ADMIN: "Administrador", OPERATOR: "Operador" };
export const USER_STATUS_LABELS: Record<UserStatus, string> = { ACTIVE: "Ativo", DISABLED: "Desativado" };
export const SIGNUP_STATUS_LABELS: Record<SignupStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovada",
  REJECTED: "Recusada",
};

// Ações da auditoria em linguagem de gente (o que não estiver aqui aparece com o código).
export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "auth.login": "Entrou no sistema",
  "auth.login_failed": "Errou a senha",
  "auth.login_locked": "Conta bloqueada por tentativas",
  "auth.login_blocked": "Tentativa em conta bloqueada/desativada",
  "auth.rate_limited": "Excesso de tentativas (IP)",
  "auth.2fa_failed": "Errou o código 2FA",
  "auth.logout": "Saiu do sistema",
  "auth.password_changed": "Trocou a senha",
  "auth.2fa_enabled": "Ativou 2FA",
  "auth.2fa_disabled": "Desativou 2FA",
  "auth.sessions_revoked": "Encerrou outras sessões",
  "signup.requested": "Solicitou acesso",
  "signup.approved": "Aprovou solicitação",
  "signup.rejected": "Recusou solicitação",
  "user.created": "Criou usuário",
  "user.disabled": "Desativou usuário",
  "user.enabled": "Reativou usuário",
  "user.password_reset": "Redefiniu senha de usuário",
  "user.2fa_reset": "Removeu 2FA de usuário",
  "contact.created": "Cadastrou contato",
  "contact.updated": "Editou contato",
  "contact.deleted": "Excluiu contato",
  "contact.imported": "Importou contatos",
  "contact.exported": "Exportou contatos",
  "contact.note_added": "Escreveu nota",
  "contact.note_deleted": "Apagou nota",
  "contact.vcard_exported": "Baixou o cartão (.vcf)",
  "contact.photo_changed": "Trocou a foto do contato",
  "contact.photo_removed": "Removeu a foto do contato",
  "system.cleanup": "Limpeza automática",
  "support.ticket_created": "Abriu chamado de suporte",
  "support.ticket_resolved": "Resolveu chamado de suporte",
  "system.data_reset": "Limpou a base",
  "system.demo_seeded": "Gerou dados de teste",
  "user.updated": "Editou usuário",
  "user.deleted": "Excluiu usuário",
};

// Campos do contato (auditoria de edição mostra quais mudaram).
export const CONTACT_FIELD_LABELS: Record<string, string> = {
  name: "Nome", phone: "Telefone", whatsapp: "WhatsApp", email: "E-mail", company: "Empresa", zipCode: "CEP",
  street: "Logradouro", number: "Número", district: "Bairro", city: "Cidade", state: "UF", origin: "Origem", notes: "Observações",
};

export const auditLabel = (action: string) => AUDIT_ACTION_LABELS[action] ?? action;
