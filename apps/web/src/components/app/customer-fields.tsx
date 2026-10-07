import { Field, inputClasses, textareaClasses } from "@/components/ui/field";

export interface CustomerDefaults {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
}

/** Coordonnées du client d'une réservation saisie par l'équipe (événement ou location). */
export function CustomerFields({
  customer,
  errors,
}: {
  customer?: CustomerDefaults;
  errors: Record<string, string | undefined>;
}) {
  return (
    <>
      {customer && (
        <p className="text-sm font-medium text-ink-muted">
          Client existant : ses coordonnées sont reprises de sa fiche.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Prénom" required error={errors["customer.firstName"]}>
          {(field) => (
            <input
              {...field}
              name="firstName"
              required
              defaultValue={customer?.firstName}
              className={inputClasses()}
            />
          )}
        </Field>
        <Field label="Nom" required error={errors["customer.lastName"]}>
          {(field) => (
            <input
              {...field}
              name="lastName"
              required
              defaultValue={customer?.lastName}
              className={inputClasses()}
            />
          )}
        </Field>
        <Field label="E-mail" required error={errors["customer.email"]}>
          {(field) => (
            <input
              {...field}
              type="email"
              name="email"
              required
              defaultValue={customer?.email}
              className={inputClasses()}
            />
          )}
        </Field>
        <Field label="Téléphone">
          {(field) => (
            <input
              {...field}
              type="tel"
              name="phone"
              defaultValue={customer?.phone ?? ""}
              className={inputClasses()}
            />
          )}
        </Field>
        <Field label="Entreprise">
          {(field) => (
            <input
              {...field}
              name="company"
              defaultValue={customer?.company ?? ""}
              className={inputClasses()}
            />
          )}
        </Field>
      </div>
      <Field label="Note (visible dans la réservation)">
        {(field) => (
          <textarea
            {...field}
            name="customerMessage"
            rows={3}
            maxLength={1000}
            className={textareaClasses()}
          />
        )}
      </Field>
    </>
  );
}
