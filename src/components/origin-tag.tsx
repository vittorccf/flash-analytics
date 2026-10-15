// Origem do contato (grupo da agenda) em formato de etiqueta: quadrada, contornada e com o ícone de tag.
import type { ContactOrigin } from "@/generated/prisma/client";
import { Tag } from "lucide-react";
import { ORIGIN_LABELS } from "@/lib/labels";

export const OriginTag = ({ origin }: { origin: ContactOrigin }) => (
  <span className="inline-flex items-center gap-1 border border-border bg-subtle px-1.5 py-0.5 text-xs font-medium text-muted-strong">
    <Tag className="size-3 text-muted" aria-hidden />
    {ORIGIN_LABELS[origin]}
  </span>
);
