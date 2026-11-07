import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection, inkCardClasses } from "@/components/ui/section";
import { Tag } from "@/components/ui/tag";
import { saveCustomer } from "@/functions/clients";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

export interface CustomerFormValues {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  tags: string;
  marketingConsent: boolean;
}

/** Ajout ou modification d'un client. */
export function CustomerForm({
  customerId,
  initial,
}: {
  customerId: string | null;
  initial: CustomerFormValues;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    saveCustomer.bind(null, customerId),
    {},
  );
  const errors = state.fieldErrors ?? {};
  // Aperçu de la fiche, mis à jour à chaque frappe.
  const [preview, setPreview] = useState(initial);
  const name = `${preview.firstName} ${preview.lastName}`.trim();
  const tags = preview.tags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return (
    <form
      onSubmit={onSubmit}
      onChange={(event) => {
        const data = new FormData(event.currentTarget);
        const text = (key: string) => String(data.get(key) ?? "");
        setPreview({
          firstName: text("firstName"),
          lastName: text("lastName"),
          email: text("email"),
          phone: text("phone"),
          company: text("company"),
          tags: text("tags"),
          marketingConsent: data.has("marketingConsent"),
        });
      }}
      className="grid items-start gap-4 px-4 pb-4 xl:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div className="flex min-w-0 flex-col gap-4">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        <FormSection number={1} title="Coordonnées">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom" required error={errors.firstName}>
              {(field) => (
                <input
                  {...field}
                  name="firstName"
                  required
                  maxLength={60}
                  defaultValue={initial.firstName}
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="Nom" required error={errors.lastName}>
              {(field) => (
                <input
                  {...field}
                  name="lastName"
                  required
                  maxLength={60}
                  defaultValue={initial.lastName}
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="E-mail" error={errors.email}>
              {(field) => (
                <input
                  {...field}
                  type="email"
                  name="email"
                  defaultValue={initial.email}
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="Téléphone" error={errors.phone}>
              {(field) => (
                <input
                  {...field}
                  type="tel"
                  name="phone"
                  maxLength={30}
                  defaultValue={initial.phone}
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field label="Entreprise" error={errors.company}>
              {(field) => (
                <input
                  {...field}
                  name="company"
                  maxLength={120}
                  defaultValue={initial.company}
                  className={inputClasses()}
                />
              )}
            </Field>
            <Field
              label="Étiquettes"
              error={errors.tags}
              hint={
                <p className="text-[13px] font-medium text-ink-muted">
                  Séparées par des virgules. « vip » met le client en avant.
                </p>
              }
            >
              {(field) => (
                <input
                  {...field}
                  name="tags"
                  defaultValue={initial.tags}
                  placeholder="vip, traiteur…"
                  className={inputClasses()}
                />
              )}
            </Field>
          </div>
          <Checkbox
            name="marketingConsent"
            defaultChecked={initial.marketingConsent}
            label="Accepte de recevoir les actualités de l'espace"
          />
          <div className="flex justify-end border-t border-line-soft pt-5">
            <Button type="submit" pending={pending}>
              {customerId ? "Enregistrer" : "Ajouter le client"}
            </Button>
          </div>
        </FormSection>
      </div>
      <aside className={cn(inkCardClasses, "flex flex-col gap-4 rounded-3xl p-5")}>
        <p className="text-[11px] font-bold uppercase leading-[14px] tracking-[0.06em] text-ink-subtle">
          Aperçu de la fiche
        </p>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name || "?"} size="profile" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-[17px] font-semibold leading-[22px] text-on-ink">
              {name || "Nouveau client"}
            </p>
            <p className="truncate text-[13px] leading-[17px] text-on-ink-muted">
              {[preview.email, preview.phone].filter(Boolean).join(" · ") || "Pas de contact"}
            </p>
          </div>
        </div>
        {(tags.length > 0 || !customerId) && (
          <div className="flex flex-wrap gap-1.5">
            {!customerId && <Tag tone="success">Nouveau</Tag>}
            {tags.map((tag) => (
              <Tag key={tag} tone={tag.toLowerCase() === "vip" ? "ink" : "inverse"}>
                {tag.toLowerCase() === "vip" ? "VIP" : tag}
              </Tag>
            ))}
          </div>
        )}
        {!preview.email && (
          <p className="rounded-2xl bg-white/5 px-3.5 py-3 text-[13px] leading-5 text-on-ink-muted">
            Sans e-mail, pas de confirmation automatique : ses réservations passeront par le
            comptoir.
          </p>
        )}
      </aside>
    </form>
  );
}
