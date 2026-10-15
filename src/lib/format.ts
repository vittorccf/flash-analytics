// Datas sempre exibidas no fuso de São Paulo, independentemente do fuso do servidor (a Vercel roda em UTC).
const TZ = "America/Sao_Paulo";

const dateTime = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, dateStyle: "short", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, day: "2-digit", month: "2-digit" });
const number = new Intl.NumberFormat("pt-BR");

export const formatDateTime = (d: Date | string | null | undefined) => (d ? dateTime.format(new Date(d)) : "—");

// "2026-10-13" (dia já calculado no fuso certo pelo banco) → "13/10"
export const formatDayKey = (day: string) => {
  const [, m, d] = day.split("-");
  return `${d}/${m}`;
};

export const formatShortDate = (d: Date) => dateOnly.format(d);

export const formatNumber = (n: number) => number.format(n);

export const formatRelative = (d: Date | string, now = Date.now()) => {
  const seconds = Math.round((now - new Date(d).getTime()) / 1000);
  if (seconds < 60) return "agora há pouco";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return formatDateTime(d);
};

// Navegador resumido para a lista de sessões ("Chrome no Windows").
export const describeUserAgent = (ua: string | null) => {
  if (!ua) return "Dispositivo desconhecido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} no ${os}` : browser;
};
