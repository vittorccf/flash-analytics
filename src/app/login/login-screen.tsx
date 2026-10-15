"use client";

import { useActionState, useState } from "react";
import clsx from "clsx";
import { Alert, Button, Field, Input, fieldA11y } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/password-policy";
import { loginAction, signupAction, type LoginState, type SignupState } from "./actions";
import { WaitingPanel } from "./waiting-panel";

type Waiting = { name: string; email: string } | null;
type Tab = "login" | "signup";

export const LoginScreen = ({ waiting: initialWaiting }: { waiting: Waiting }) => {
  const [tab, setTab] = useState<Tab>("login");
  const [waiting, setWaiting] = useState<Waiting>(initialWaiting);
  const [prefillEmail, setPrefillEmail] = useState("");

  if (waiting) {
    return (
      <WaitingPanel
        name={waiting.name}
        onDone={(goToLogin) => {
          setWaiting(null);
          setTab(goToLogin ? "login" : "signup");
          setPrefillEmail(goToLogin ? waiting.email : "");
        }}
      />
    );
  }

  return (
    <div>
      <div role="tablist" aria-label="Acesso" className="mb-6 grid grid-cols-2 rounded-lg bg-subtle p-1 text-sm font-medium">
        {(
          [
            ["login", "Entrar"],
            ["signup", "Solicitar acesso"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            onClick={() => setTab(key)}
            className={clsx("rounded-md py-2 transition-colors", tab === key ? "bg-surface text-foreground elevation-1" : "text-muted hover:text-foreground")}
          >
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "login" ? (
          <LoginForm key={prefillEmail} defaultEmail={prefillEmail} />
        ) : (
          <SignupForm onSubmitted={(s) => setWaiting(s)} />
        )}
      </div>
    </div>
  );
};

const LoginForm = ({ defaultEmail }: { defaultEmail: string }) => {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, { email: defaultEmail });
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Use o e-mail e a senha da sua conta.</p>
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field id="email" label="E-mail">
        <Input {...fieldA11y("email")} type="email" autoComplete="username" defaultValue={state.email} required autoFocus />
      </Field>
      <Field id="password" label="Senha">
        <Input {...fieldA11y("password")} type="password" autoComplete="current-password" required />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
};

const SignupForm = ({ onSubmitted }: { onSubmitted: (s: { name: string; email: string }) => void }) => {
  const [state, action, pending] = useActionState<SignupState, FormData>(async (prev, formData) => {
    const next = await signupAction(prev, formData);
    if (next.submitted) onSubmitted(next.submitted);
    return next;
  }, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="space-y-4" noValidate>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Solicitar acesso</h1>
        <p className="mt-1 text-sm text-muted">
          Para operadores. Um administrador analisa o pedido; esta tela avisa assim que ele decidir.
        </p>
      </div>
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field id="name" label="Nome completo" error={e.name}>
        <Input {...fieldA11y("name", e.name)} defaultValue={state.values?.name} autoComplete="name" required maxLength={120} />
      </Field>
      <Field id="email" label="E-mail" error={e.email}>
        <Input {...fieldA11y("email", e.email)} defaultValue={state.values?.email} type="email" autoComplete="email" required maxLength={254} />
      </Field>
      <Field id="password" label="Senha" error={e.password} hint={`Mínimo de ${PASSWORD_MIN} caracteres. Uma frase é mais fácil de lembrar.`}>
        <Input {...fieldA11y("password", e.password, "hint")} type="password" autoComplete="new-password" required minLength={PASSWORD_MIN} maxLength={128} />
      </Field>
      <Field id="confirm" label="Confirme a senha" error={e.confirm}>
        <Input {...fieldA11y("confirm", e.confirm)} type="password" autoComplete="new-password" required maxLength={128} />
      </Field>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </form>
  );
};
