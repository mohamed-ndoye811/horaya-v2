"use client";

import { useEffect, useRef, useState } from "react";
import { Button, textLinkClasses } from "@/components/ui/button";
import { Checkbox, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { PlusIcon } from "@/components/ui/icons";
import { useFormAction } from "@/lib/use-form-action";
import { useInvalidMessage } from "@/lib/use-invalid-message";
import type { FormState } from "@/server/form-state";
import { addNoteAction } from "../actions";

/** « + Ajouter » une note interne sur la fiche client. */
export function NoteForm({ customerId }: { customerId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const invalid = useInvalidMessage();
  // Focus sur la note juste après le clic « Ajouter » (action de l'utilisateur).
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);
  const { state, onSubmit, pending } = useFormAction<FormState>(async (previous, form) => {
    const result = await addNoteAction(customerId, previous, form);
    if (result.success) {
      formRef.current?.reset();
      setOpen(false);
    }
    return result;
  }, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${textLinkClasses} flex items-center gap-1.5 font-mono text-label uppercase tracking-[0.055em] no-underline`}
      >
        <PlusIcon size={10} />
        Ajouter
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="flex w-full flex-col gap-3 border-[1.5px] border-dashed border-ink-subtle p-3"
    >
      {state.error && <FormAlert>{state.fieldErrors?.body ?? state.error}</FormAlert>}
      <div className="flex flex-col gap-2" {...invalid.handlers}>
        <textarea
          ref={textareaRef}
          name="body"
          aria-label="Note interne"
          required
          rows={3}
          maxLength={2000}
          placeholder="Visible par ton équipe uniquement…"
          className={textareaClasses()}
        />
        {invalid.message && (
          <p className="text-[13px] font-semibold leading-4 text-danger">{invalid.message}</p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <Checkbox name="pinned" label="Épingler en haut" />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setOpen(false)} className="h-10 px-4 text-sm">
            Annuler
          </Button>
          <Button type="submit" pending={pending} className="h-10 px-4 text-sm">
            Ajouter la note
          </Button>
        </div>
      </div>
    </form>
  );
}
