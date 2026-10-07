"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { Select } from "@/components/ui/select";
import { formatMoney } from "@/lib/format";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { createBookingAction } from "../actions";

export interface BookableEvent {
  id: string;
  title: string;
  label: string;
  remaining: number | null;
  priceCents: number;
}

/** « Ajouter une réservation » : choisir l'événement, les places et le client. */
export function NewBookingForm({
  events,
  initialEventId,
  customer,
}: {
  events: BookableEvent[];
  initialEventId?: string;
  customer?: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
  };
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(createBookingAction, {});
  const [eventId, setEventId] = useState(initialEventId ?? "");
  const [seats, setSeats] = useState("1");
  const errors = state.fieldErrors ?? {};
  const selected = events.find((event) => event.id === eventId);
  const total = selected ? selected.priceCents * Math.max(1, Number(seats) || 1) : 0;

  return (
    <form onSubmit={onSubmit} className="flex max-w-[768px] flex-col gap-10 px-4 py-8 sm:px-10">
      {state.error && <FormAlert>{state.error}</FormAlert>}
      <FormSection number={1} title="Événement">
        <Field label="Événement" required error={errors.eventId}>
          {(field) => (
            <Select
              {...field}
              name="eventId"
              required
              value={eventId}
              onChange={(event) => setEventId(event.target.value)}
            >
              <option value="" disabled>
                Choisis un événement publié
              </option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Places"
            required
            error={errors.seats}
            hint={
              selected ? (
                <p className="text-[13px] font-medium text-ink-muted">
                  {selected.remaining === null
                    ? "Places illimitées"
                    : `${selected.remaining} place${selected.remaining > 1 ? "s" : ""} restante${selected.remaining > 1 ? "s" : ""}`}
                  {selected.priceCents > 0 ? ` · ${formatMoney(total)} au total` : " · gratuit"}
                </p>
              ) : undefined
            }
          >
            {(field) => (
              <AffixInput
                {...field}
                name="seats"
                inputMode="numeric"
                required
                value={seats}
                onChange={(event) => setSeats(event.target.value.replace(/\D/g, ""))}
                suffix="places"
                mono
              />
            )}
          </Field>
        </div>
      </FormSection>

      <FormSection number={2} title="Client">
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
        <p className="text-[13px] font-medium text-ink-muted">
          Une réservation saisie par l'équipe est confirmée d'office. Si l'e-mail existe déjà, elle
          est rattachée au même client.
        </p>
      </FormSection>

      <div>
        <Button type="submit" arrow pending={pending} disabled={events.length === 0}>
          {pending ? "Enregistrement…" : "Enregistrer la réservation"}
        </Button>
      </div>
    </form>
  );
}
