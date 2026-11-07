import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { deleteAccount, deleteWorkspace } from "@/functions/privacy";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/*
 * Suppressions (RGPD) en bas des réglages : définitives, confirmées dans une fenêtre. Les données
 * s'exportent avant (clients, réservations) ; rien n'est gardé après.
 */

function DangerCard({
  title,
  text,
  action,
  children,
}: {
  title: string;
  text: string;
  action: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col gap-3 rounded-3xl border-[1.5px] border-danger-bg bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="font-section text-base text-ink">{title}</h2>
        <p className="text-sm text-ink-muted">{text}</p>
      </div>
      <Button
        variant="danger"
        size="sm"
        className="self-start sm:self-auto"
        onClick={() => setOpen(true)}
      >
        {action}
      </Button>
      {open && children(() => setOpen(false))}
    </section>
  );
}

/** Profil : supprimer son compte (mot de passe ; vide pour un compte Google). */
export function DeleteAccountSection() {
  return (
    <DangerCard
      title="Supprimer mon compte"
      text="Ton compte et ta photo partent pour de bon. Si tu possèdes un espace, supprime-le ou donne-le à un membre avant."
      action="Supprimer mon compte"
    >
      {(close) => <DeleteAccountDialog onClose={close} />}
    </DangerCard>
  );
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    (_previous, form) => deleteAccount({ data: form }),
    {},
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title="Supprimer ton compte ?"
      description="C'est définitif : ton compte, tes accès aux espaces et ta photo sont supprimés."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="delete-account" variant="danger" pending={pending}>
            Supprimer définitivement
          </Button>
        </>
      }
    >
      <form id="delete-account" onSubmit={onSubmit} className="flex flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <Field label="Ton mot de passe" hint="Connexion avec Google ? Laisse vide.">
          {(field) => (
            <input
              {...field}
              name="password"
              type="password"
              autoComplete="current-password"
              className={inputClasses()}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

/** Organisation : supprimer l'espace (propriétaire), en retapant son adresse. */
export function DeleteWorkspaceSection({ name, slug }: { name: string; slug: string }) {
  return (
    <DangerCard
      title="Supprimer l'espace"
      text={`${name}, ses événements, réservations, clients, matériel et fichiers partent pour de bon. Exporte d'abord ce que tu veux garder.`}
      action="Supprimer l'espace"
    >
      {(close) => <DeleteWorkspaceDialog slug={slug} onClose={close} />}
    </DangerCard>
  );
}

function DeleteWorkspaceDialog({ slug, onClose }: { slug: string; onClose: () => void }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    (_previous, form) => deleteWorkspace({ data: form }),
    {},
  );
  return (
    <Dialog
      open
      onClose={onClose}
      title="Supprimer l'espace ?"
      description="C'est définitif. Ton équipe perd l'accès, ta page publique disparaît."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="delete-workspace" variant="danger" pending={pending}>
            Supprimer définitivement
          </Button>
        </>
      }
    >
      <form id="delete-workspace" onSubmit={onSubmit} className="flex flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <Field label={`Tape « ${slug} » pour confirmer`} error={state.fieldErrors?.confirm}>
          {(field) => (
            <input
              {...field}
              name="confirm"
              autoComplete="off"
              autoCapitalize="none"
              className={inputClasses()}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}
