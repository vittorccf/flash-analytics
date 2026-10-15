import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import localFont from "next/font/local";
import "./globals.css";

// Roboto (texto) e Geist Mono (códigos), variáveis e servidas pelo próprio app (licenças OFL em
// src/app/fonts): CSP `font-src 'self'` e build offline.
const roboto = localFont({ src: "./fonts/RobotoVF.ttf", variable: "--font-roboto", weight: "100 900", display: "swap" });
const geistMono = localFont({ src: "./fonts/GeistMonoVF.woff2", variable: "--font-geist-mono", weight: "100 900", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Flash Contacts", template: "%s · Flash Contacts" },
  applicationName: "Flash Contacts",
  description: "Cadastro de contatos com aprovação de operadores e painel em tempo real.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Lê os cabeçalhos para toda página ser renderizada por requisição: o nonce da CSP muda a cada uma.
  await headers();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="pt-BR" className={`${roboto.variable} ${geistMono.variable}`} data-theme={theme}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
