// Depois de cada envio, o React "reinicia" o formulário: campos de texto voltam ao defaultValue atual, mas
// <select> volta à opção marcada no PRIMEIRO render (vazia). Resultado: depois de um erro, UF/origem sumiam.
// Solução: numerar as tentativas e usar o número como `key` do <form>; o formulário é recriado com os
// valores devolvidos pelo servidor, inclusive nas listas.
export type WithAttempt<S> = S & { attempt?: number };

export const countAttempts =
  <S extends object>(submit: (prev: S, formData: FormData) => Promise<S>) =>
  async (prev: WithAttempt<S>, formData: FormData): Promise<WithAttempt<S>> => ({
    ...(await submit(prev, formData)),
    attempt: (prev.attempt ?? 0) + 1,
  });
