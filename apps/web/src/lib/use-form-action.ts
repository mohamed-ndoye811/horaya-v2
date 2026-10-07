"use client";

import { type FormEvent, startTransition, useActionState } from "react";

/**
 * Comme useActionState, mais sans la remise à zéro automatique du formulaire que fait
 * React 19 après une action : en cas d'erreur, la saisie (listes, cases) reste intacte.
 * Le bouton qui a déclenché l'envoi (ex. intent=publish) est bien transmis.
 */
export function useFormAction<State>(
  action: (state: Awaited<State>, form: FormData) => Promise<State>,
  initial: Awaited<State>,
) {
  const [state, dispatch, pending] = useActionState<State, FormData>(action, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(form));
  };
  return { state, onSubmit, pending };
}
