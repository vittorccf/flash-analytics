// Foto (quando há) ou as iniciais do nome. Usuários do sistema não têm foto: sempre iniciais.
// Contatos podem ter foto (ContactAvatar), servida pela API com a versão na URL (trocar a foto muda o endereço).
import clsx from "clsx";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

// Tamanhos fechados (classes literais) em vez de style=: a CSP não aceita estilo inline.
const SIZE_CLASS = {
  28: "size-7 text-[11px]",
  32: "size-8 text-xs",
  40: "size-10 text-[15px]",
  56: "size-14 text-xl",
  64: "size-16 text-2xl",
} as const;
export type AvatarSize = keyof typeof SIZE_CLASS;

export const Avatar = ({ name, src, size = 32, className }: { name: string; src?: string | null; size?: AvatarSize; className?: string }) =>
  src ? (
    // eslint-disable-next-line @next/next/no-img-element -- imagem servida pela própria API (com autorização), não otimizável
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      className={clsx("shrink-0 rounded-full object-cover ring-1 ring-border", SIZE_CLASS[size], className)}
    />
  ) : (
    <span
      aria-hidden
      className={clsx("inline-flex shrink-0 items-center justify-center rounded-full bg-subtle font-semibold text-muted-strong ring-1 ring-border", SIZE_CLASS[size], className)}
    >
      {initials(name)}
    </span>
  );

export const contactPhotoUrl = (contactId: string, version?: Date | null) =>
  version ? `/api/contatos/${contactId}/foto?v=${new Date(version).getTime()}` : null;

export const ContactAvatar = ({ id, name, photoVersion, size, className }: { id: string; name: string; photoVersion?: Date | null; size?: AvatarSize; className?: string }) => (
  <Avatar name={name} src={contactPhotoUrl(id, photoVersion)} size={size} className={className} />
);
