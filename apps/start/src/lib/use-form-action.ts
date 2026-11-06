import { isRedirect, useRouter } from "@tanstack/react-router";
import { type FormEvent, startTransition, useActionState } from "react";

/**
 * Comme useActionState, mais sans la remise à zéro automatique du formulaire que fait
 * React 19 après une action : en cas d'erreur, la saisie (listes, cases) reste intacte.
 * Le bouton qui a déclenché l'envoi (ex. intent=publish) est bien transmis.
 *
 * `action` appelle une fonction serveur (voir src/functions). Après l'envoi, les données de la
 * page sont rechargées (équivalent de revalidatePath) ; une redirection renvoyée par le serveur
 * (après une création, par exemple) est suivie par le routeur.
 */
export function useFormAction<State>(
  action: (state: Awaited<State>, form: FormData) => Promise<State>,
  initial: Awaited<State>,
) {
  const router = useRouter();
  const run = async (state: Awaited<State>, form: FormData): Promise<State> => {
    try {
      const next = await action(state, form);
      await router.invalidate();
      return next;
    } catch (error) {
      if (isRedirect(error)) {
        await router.navigate(error.options);
        return state;
      }
      throw error;
    }
  };
  const [state, dispatch, pending] = useActionState<State, FormData>(run, initial);
  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const form = new FormData(event.currentTarget, submitter);
    startTransition(() => dispatch(form));
  };
  return { state, onSubmit, pending };
}
