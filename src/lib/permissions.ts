// Permissões sobre contatos. O admin tem todas; o operador tem as da sua lista (User.permissions).
// A checagem que vale é a do servidor (casos de uso em src/server); a tela só esconde o que não pode ser usado.

export const PERMISSIONS = {
  "contacts.view_all": { label: "Ver contatos da equipe", description: "Sem isto, vê só os contatos que cadastrou." },
  "contacts.create": { label: "Criar", description: "Cadastrar e importar contatos." },
  "contacts.edit": { label: "Editar", description: "Alterar contatos e escrever notas." },
  "contacts.delete": { label: "Apagar", description: "Excluir contatos de vez." },
  "contacts.export": { label: "Exportar", description: "Baixar em Excel/CSV e o cartão (.vcf)." },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

// Atalhos de perfil. "Operador padrão" é o comportamento original do sistema.
export const PRESETS: { key: string; label: string; description: string; permissions: Permission[] }[] = [
  { key: "leitor", label: "Leitor", description: "Só consulta os contatos da equipe.", permissions: ["contacts.view_all"] },
  {
    key: "editor",
    label: "Editor",
    description: "Consulta, cria, edita e exporta; não apaga.",
    permissions: ["contacts.view_all", "contacts.create", "contacts.edit", "contacts.export"],
  },
  {
    key: "operador",
    label: "Operador padrão",
    description: "Cria, edita, apaga e exporta os próprios contatos.",
    permissions: ["contacts.create", "contacts.edit", "contacts.delete", "contacts.export"],
  },
  { key: "completo", label: "Completo", description: "Tudo, nos contatos da equipe.", permissions: ALL_PERMISSIONS },
];

export type PermissionHolder = { role: "ADMIN" | "OPERATOR"; permissions: string[] };

export const can = (user: PermissionHolder, permission: Permission) => user.role === "ADMIN" || user.permissions.includes(permission);

// Lista vinda do formulário: só passa o que existe, sem repetição e na ordem canônica.
export const sanitizePermissions = (values: unknown[]): Permission[] =>
  ALL_PERMISSIONS.filter((p) => values.includes(p));

export const presetOf = (permissions: string[]) =>
  PRESETS.find((p) => p.permissions.length === permissions.length && p.permissions.every((x) => permissions.includes(x))) ?? null;

export class ForbiddenError extends Error {
  constructor(permission: Permission) {
    super(`Sem permissão: ${permission}`);
  }
}

// Defesa em profundidade: o caso de uso confere de novo, mesmo que a action já tenha conferido.
export const assertCan = (user: PermissionHolder, permission: Permission) => {
  if (!can(user, permission)) throw new ForbiddenError(permission);
};
