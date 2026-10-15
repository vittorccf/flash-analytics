// Tema da interface, guardado num cookie (não é credencial). O servidor lê e já renderiza com o tema certo.
export const THEME_COOKIE = "flash_theme";
export const THEMES = ["light", "dark", "system"] as const;
export type Theme = (typeof THEMES)[number];

export const parseTheme = (value: unknown): Theme => (THEMES as readonly unknown[]).includes(value) ? (value as Theme) : "system";

export const THEME_LABELS: Record<Theme, string> = { light: "Claro", dark: "Escuro", system: "Do sistema" };
