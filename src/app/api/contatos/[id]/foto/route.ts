// Foto do contato: só para quem pode ver o contato. O tipo enviado é o detectado pelos bytes no upload, com
// nosniff. A URL leva a versão (?v=), então pode ficar em cache privado do navegador.
import { requireUser } from "@/server/auth/dal";
import { getContactPhoto } from "@/server/contact-photos";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const photo = await getContactPhoto(user, id.slice(0, 40));
  if (!photo) return new Response("Não encontrado", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
