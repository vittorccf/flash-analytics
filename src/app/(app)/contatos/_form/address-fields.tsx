"use client";

// Endereço com preenchimento pelo CEP. A busca é só um atalho: os campos continuam editáveis e,
// se o serviço de CEP falhar, o formulário segue funcionando com preenchimento manual.
import { useRef, useState, useTransition } from "react";
import clsx from "clsx";
import { Field, Input, Select, fieldA11y } from "@/components/ui";
import { UFS } from "@/lib/labels";
import { formatZipCode, isValidZipCode, normalizeZipCode } from "@/lib/zip-code";
import { lookupZipCodeAction, type ZipCodeLookupState } from "./actions";

type Values = Record<string, string | undefined>;
type Errors = Record<string, string | undefined>;

const MESSAGES: Record<ZipCodeLookupState["status"] | "searching", { text: string; tone: "muted" | "success" | "warning" }> = {
  searching: { text: "Buscando endereço…", tone: "muted" },
  found: { text: "Endereço preenchido pelo CEP. Confira e complete o número.", tone: "success" },
  not_found: { text: "CEP não encontrado. Preencha o endereço manualmente.", tone: "warning" },
  unavailable: { text: "Busca de CEP indisponível agora. Preencha o endereço manualmente.", tone: "warning" },
  limited: { text: "Muitas buscas seguidas. Preencha o endereço manualmente.", tone: "warning" },
  invalid: { text: "O CEP tem 8 dígitos.", tone: "warning" },
};

const TONE_CLASS = { muted: "text-muted", success: "text-success-strong", warning: "text-warning-strong" } as const;

export const AddressFields = ({ values, errors }: { values: Values; errors: Errors }) => {
  const [zipCode, setZipCode] = useState(formatZipCode(values.zipCode ?? ""));
  const [status, setStatus] = useState<keyof typeof MESSAGES | null>(null);
  const [, startTransition] = useTransition();
  const lastLookup = useRef<string | null>(null);
  const streetRef = useRef<HTMLInputElement>(null);
  const numberRef = useRef<HTMLInputElement>(null);
  const districtRef = useRef<HTMLInputElement>(null);
  const cityRef = useRef<HTMLInputElement>(null);
  const stateRef = useRef<HTMLSelectElement>(null);

  const search = (digits: string) => {
    lastLookup.current = digits;
    setStatus("searching");
    startTransition(async () => {
      const result = await lookupZipCodeAction(digits).catch((): ZipCodeLookupState => ({ status: "unavailable" }));
      // O usuário pode ter digitado outro CEP enquanto esta busca rodava: resposta antiga é descartada.
      if (lastLookup.current !== digits) return;
      setStatus(result.status);
      if (result.status !== "found") return;
      const { street, district, city, state } = result.address;
      if (streetRef.current && street) streetRef.current.value = street;
      if (districtRef.current && district) districtRef.current.value = district;
      if (cityRef.current) cityRef.current.value = city;
      if (stateRef.current) stateRef.current.value = state;
      numberRef.current?.focus();
    });
  };

  const onZipChange = (raw: string) => {
    const formatted = formatZipCode(raw);
    setZipCode(formatted);
    const digits = normalizeZipCode(formatted);
    if (digits.length < 8) {
      lastLookup.current = null;
      setStatus(null);
      return;
    }
    if (digits !== lastLookup.current) {
      if (isValidZipCode(digits)) search(digits);
      else setStatus("invalid");
    }
  };

  const message = status ? MESSAGES[status] : null;

  return (
    <>
      <Field id="zipCode" label="CEP (opcional)" error={errors.zipCode}>
        <Input
          {...fieldA11y("zipCode", errors.zipCode)}
          aria-describedby={errors.zipCode ? "zipCode-error" : "zipCode-status"}
          value={zipCode}
          onChange={(e) => onZipChange(e.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          maxLength={9}
        />
      </Field>
      <p id="zipCode-status" role="status" aria-live="polite" className={clsx("self-end pb-2.5 text-sm", message && TONE_CLASS[message.tone])}>
        {message?.text ?? "Com o CEP, o endereço é preenchido automaticamente."}
      </p>
      <div className="sm:col-span-2 grid gap-5 sm:grid-cols-[1fr_8rem]">
        <Field id="street" label="Logradouro (opcional)" error={errors.street}>
          <Input {...fieldA11y("street", errors.street)} ref={streetRef} defaultValue={values.street} autoComplete="address-line1" maxLength={150} />
        </Field>
        <Field id="number" label="Número" error={errors.number}>
          <Input {...fieldA11y("number", errors.number)} ref={numberRef} defaultValue={values.number} maxLength={20} />
        </Field>
      </div>
      <Field id="district" label="Bairro (opcional)" error={errors.district}>
        <Input {...fieldA11y("district", errors.district)} ref={districtRef} defaultValue={values.district} maxLength={100} />
      </Field>
      <div className="grid gap-5 grid-cols-[1fr_6.5rem]">
        <Field id="city" label="Cidade" error={errors.city}>
          <Input {...fieldA11y("city", errors.city)} ref={cityRef} defaultValue={values.city} autoComplete="address-level2" required maxLength={80} />
        </Field>
        <Field id="state" label="UF" error={errors.state}>
          <Select {...fieldA11y("state", errors.state)} ref={stateRef} defaultValue={values.state ?? ""} autoComplete="address-level1" required>
            <option value="" disabled>
              UF
            </option>
            {UFS.map((uf) => (
              <option key={uf}>{uf}</option>
            ))}
          </Select>
        </Field>
      </div>
    </>
  );
};
