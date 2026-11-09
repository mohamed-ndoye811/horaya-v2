import { ITEM_CSV_COLUMNS } from "@horaya/core";
import { useState } from "react";
import { Button, textLinkClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ActionMenu } from "@/components/ui/menu";
import { importItemsAction } from "@/functions/inventory";
import { useRouter } from "@/lib/navigation";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/**
 * « Importer CSV » de l'écran 20 : fichier, rappel des colonnes, modèle à télécharger.
 * Sous `lg`, action secondaire rangée dans un menu « … ».
 */
export function ImportItemsButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="hidden lg:flex">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Importer CSV
        </Button>
      </div>
      <div className="flex lg:hidden">
        <ActionMenu
          variant="outline"
          label="Autres actions"
          items={[{ label: "Importer un CSV", onSelect: () => setOpen(true) }]}
        />
      </div>
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
                className="text-ui font-medium text-ink file:mr-4 file:h-10 file:rounded-full file:border file:border-line file:bg-surface file:px-4 file:text-sm file:font-semibold file:text-ink hover:file:bg-field"
              />
            )}
          </Field>
          <div className="flex flex-col gap-2 text-sm font-medium leading-5 text-ink-muted">
            <p>
              Colonnes reconnues : {ITEM_CSV_COLUMNS.map((column) => column.header).join(", ")}.
              Seul le nom est obligatoire ; sans quantité, l'article a un exemplaire.
            </p>
            <a href="/app/materiel/modele-import" download className={textLinkClasses}>
              Télécharger le modèle
            </a>
          </div>
        </form>
      )}
    </Dialog>
  );
}
