"use client";

// Estrela de favorito. Responde na hora (otimista) e desfaz se o servidor recusar.
import { useState, useTransition } from "react";
import clsx from "clsx";
import { Star } from "lucide-react";
import { toggleFavoriteAction } from "@/app/(app)/contatos/actions";

export const FavoriteButton = ({ contactId, name, initial }: { contactId: string; name: string; initial: boolean }) => {
  const [favorite, setFavorite] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !favorite;
    setFavorite(next);
    startTransition(async () => {
      const result = await toggleFavoriteAction(contactId).catch(() => null);
      if (result === null) setFavorite(!next);
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={favorite}
      aria-label={favorite ? `Tirar ${name} dos favoritos` : `Adicionar ${name} aos favoritos`}
      title={favorite ? "Favorito" : "Adicionar aos favoritos"}
      className="inline-flex size-7 items-center justify-center rounded-md text-muted hover:bg-subtle hover:text-foreground"
    >
      <Star className={clsx("size-4", favorite && "fill-warning text-warning")} aria-hidden />
    </button>
  );
};
