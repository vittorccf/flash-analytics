import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build de verificação/e2e em outro diretório sem derrubar o dev server.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Imagem Docker enxuta (on-premises); a Vercel ignora.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  // Sem o indicador flutuante do Next no modo de desenvolvimento (só existe no npm run dev).
  devIndicators: false,
  // Módulos nativos/servidor: nunca entram no bundle.
  serverExternalPackages: ["@node-rs/argon2", "pg"],
  experimental: {
    // 3 MB: importação de planilha (o arquivo é limitado a 2 MB na action; o resto é margem do multipart).
    serverActions: { bodySizeLimit: "3mb" },
  },
};

export default nextConfig;
