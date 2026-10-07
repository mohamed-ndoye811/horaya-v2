"use client";

import { ITEM_CSV_COLUMNS } from "@horaya/core";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { importItemsAction } from "./actions";

/** « Importer CSV » de l'écran 20 : fichier, rappel des colonnes, modèle à télécharger. */
export function ImportItemsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Importer CSV
      </Button>
      {open && <ImportDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ImportDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [done, setDone] = useState<string | null>(null);
  const { state, onSubmit, pending } = useFormAction<FormState>(async (previous, form) => {
    const result = await importItemsAction(previous, form);
    if (result.success) {
      setDone(result.success);
      router.refresh();
    }
    return result;
  }, {});

  return (
    <Dialog
      open
      onClose={onClose}
      title="Importer du matériel"
      description="Un article par ligne, avec les intitulés de colonnes sur la première ligne. Tout le fichier est importé, ou rien en cas d'erreur."
      footer={
        done ? (
          <Button onClick={onClose}>Terminé</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" form="import-items-form" pending={pending}>
              Importer
            </Button>
          </>
        )
      }
    >
      {done ? (
        <FormAlert tone="success">{done}</FormAlert>
      ) : (
        <form id="import-items-form" onSubmit={onSubmit} className="flex flex-col gap-5">
          {state.error && (
            <FormAlert>
              <span className="whitespace-pre-line">{state.error}</span>
            </FormAlert>
          )}
          <Field label="Fichier CSV" required>
            {(field) => (
              <input
                {...field}
                type="file"
                name="file"
                required
                accept=".csv,text/csv"
                className="text-[15px] font-medium text-ink file:mr-4 file:h-10 file:border-2 file:border-ink file:bg-transparent file:px-4 file:font-bold file:text-ink"
              />
            )}
          </Field>
          <div className="flex flex-col gap-2 text-sm font-medium leading-5 text-ink-muted">
            <p>
              Colonnes reconnues : {ITEM_CSV_COLUMNS.map((column) => column.header).join(", ")}.
              Seul le nom est obligatoire ; sans quantité, l'article a un exemplaire.
            </p>
            <a
              href="/app/materiel/modele-import"
              download
              className="font-bold text-ink underline decoration-1 underline-offset-[3px]"
            >
              Télécharger le modèle
            </a>
          </div>
        </form>
      )}
    </Dialog>
  );
}
