"use client";

import { type FormEvent, useState } from "react";
import { validityMessage } from "./validity";

type FormControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/** Premier champ refusé d'un envoi : il reçoit le focus une fois tous les champs vérifiés. */
let firstInvalid: FormControl | null = null;

/**
 * Remplace la bulle du navigateur par un message sous le champ. À poser sur l'élément
 * qui entoure le champ : l'événement `invalid` de React remonte jusqu'à lui. Le message
 * disparaît dès que la personne modifie le champ.
 */
export function useInvalidMessage() {
  const [message, setMessage] = useState<string | null>(null);
  const handlers = {
    onInvalid: (event: FormEvent<HTMLElement>) => {
      event.preventDefault();
      const control = event.target as FormControl;
      setMessage(validityMessage(control));
      // Les champs sont vérifiés dans l'ordre du formulaire : le premier gagne. Pas de
      // micro-tâche ici, elle passerait entre deux événements `invalid` du même envoi.
      if (!firstInvalid) {
        firstInvalid = control;
        setTimeout(() => {
          firstInvalid?.focus();
          firstInvalid = null;
        });
      }
    },
    onInput: () => setMessage(null),
    onChange: () => setMessage(null),
  };
  return { message, handlers };
}
