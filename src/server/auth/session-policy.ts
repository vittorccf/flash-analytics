// Política de expiração da sessão, sem dependência do Next (o job de limpeza por linha de comando também usa).
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000; // vale no máximo 12 h, mesmo em uso
export const SESSION_IDLE_MS = 2 * 60 * 60 * 1000; // 2 h sem uso encerra
