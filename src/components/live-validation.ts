"use client";

// Validação ao vivo com o MESMO schema zod da Server Action: o campo é conferido quando a pessoa sai dele e,
// depois disso, a cada mudança (o erro some assim que o valor fica válido). O servidor continua validando tudo;
// isto só antecipa a mensagem. Uso: const live = useLiveValidation(schema, state.errors); <form {...live.formProps}>
// e live.errors no lugar de state.errors.
import { useEffect, useRef, useState, type FocusEvent, type FormEvent } from "react";
import type { z } from "zod";
import { fieldErrors, type FieldErrors } from "@/lib/validation";

// Mesmo formato que as actions montam: nome do campo → texto, "" quando o campo não vem (checkbox desmarcado).
const readForm = (form: HTMLFormElement, extra?: Record<string, string>) => {
  const raw: Record<string, string> = {};
  for (const [key, value] of new FormData(form)) if (typeof value === "string") raw[key] ??= value;
  for (const element of Array.from(form.elements)) {
    const name = (element as HTMLInputElement).name;
    if (name) raw[name] ??= "";
  }
  return { ...raw, ...extra };
};

export const useLiveValidation = (schema: z.ZodType, serverErrors?: FieldErrors, extra?: Record<string, string>) => {
  const [errors, setErrors] = useState<FieldErrors>(serverErrors ?? {});
  // Resposta nova do servidor (novo envio): os erros dela valem até a pessoa mexer nos campos.
  const [lastServer, setLastServer] = useState(serverErrors);
  if (lastServer !== serverErrors) {
    setLastServer(serverErrors);
    setErrors(serverErrors ?? {});
  }
  // Campos já visitados (ou com erro do servidor): só eles são revalidados enquanto a pessoa digita.
  const touched = useRef(new Set<string>());
  // Erros que só o servidor conhece (e-mail já cadastrado, domínio inexistente): ficam até o campo mudar, e não
  // somem só porque a regra do navegador passou.
  const sticky = useRef(new Map<string, string>());
  useEffect(() => {
    sticky.current = new Map(Object.entries(serverErrors ?? {}));
  }, [serverErrors]);

  const validate = (form: HTMLFormElement) => {
    const result = schema.safeParse(readForm(form, extra));
    const found = result.success ? {} : fieldErrors(result.error);
    setErrors((previous) => {
      const next = { ...previous };
      for (const name of touched.current) {
        const message = found[name] ?? sticky.current.get(name);
        if (message) next[name] = message;
        else delete next[name];
      }
      return next;
    });
  };

  const fieldName = (target: EventTarget) => (target as HTMLInputElement).name || "";

  const formProps = {
    onBlur: (event: FocusEvent<HTMLFormElement>) => {
      const name = fieldName(event.target);
      if (!name) return;
      touched.current.add(name);
      validate(event.currentTarget);
    },
    onChange: (event: FormEvent<HTMLFormElement>) => {
      const name = fieldName(event.target);
      if (!name) return;
      sticky.current.delete(name);
      if (errors[name]) touched.current.add(name);
      if (touched.current.has(name)) validate(event.currentTarget);
    },
  };

  // Para checagens que só o servidor faz (ex.: domínio do e-mail no DNS).
  const setFieldError = (name: string, message: string | null) => {
    if (message) sticky.current.set(name, message);
    else sticky.current.delete(name);
    setErrors((previous) => {
      const next = { ...previous };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  };

  return { errors, formProps, setFieldError };
};
