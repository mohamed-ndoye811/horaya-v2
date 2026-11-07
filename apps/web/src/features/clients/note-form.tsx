import { useEffect, useRef, useState } from "react";
import { Button, textLinkSmClasses } from "@/components/ui/button";
import { Checkbox, FieldError, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { dashedClasses } from "@/components/ui/section";
import { addNoteAction } from "@/functions/clients";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import { useInvalidMessage } from "@/lib/use-invalid-message";
import type { FormState } from "@/server/form-state";

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

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold leading-5 text-ink">Notes internes</h2>
        {!open && (
          <button type="button" onClick={() => setOpen(true)} className={textLinkSmClasses}>
            + Ajouter
          </button>
        )}
      </div>
      {open && (
        <form
          ref={formRef}
          onSubmit={onSubmit}
          className={cn(dashedClasses, "flex w-full flex-col gap-3 rounded-[14px] p-3")}
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
            {invalid.message && <FieldError>{invalid.message}</FieldError>}
          </div>
          <div className="flex items-center justify-between gap-3">
            <Checkbox name="pinned" label="Épingler en haut" />
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" size="sm" pending={pending}>
                Ajouter la note
              </Button>
            </div>
          </div>
        </form>
      )}
    </>
  );
}
