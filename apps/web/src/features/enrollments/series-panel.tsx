import type { SeriesEnrollmentRow, SeriesOffer } from "@horaya/db";
import { useState, useTransition } from "react";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { MoneyCell, PersonCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Field } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ActionMenu } from "@/components/ui/menu";
import { Eyebrow } from "@/components/ui/section";
import { Switch } from "@/components/ui/switch";
import {
  cancelEnrollmentAction,
  saveSeriesEnrollmentAction,
  setEnrollmentPaidAction,
} from "@/functions/enrollments";
import { formatDateTimeShort, formatRelativeDateTime } from "@/lib/format";
import { centsToInput } from "@/lib/money";
import { useRouter } from "@/lib/navigation";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

/**
 * Onglet « Série » d'une fiche événement (cours à l'année) : le réglage « Inscription à la
 * série » et la liste des inscrits. Pas de maquette : motifs des écrans voisins (DA v4).
 */
export function SeriesPanel({
  seriesId,
  eventId,
  offer,
  enrollments,
  timeZone,
}: {
  seriesId: string;
  eventId: string;
  offer: SeriesOffer;
  enrollments: SeriesEnrollmentRow[];
  timeZone: string;
}) {
  const active = enrollments.filter((row) => row.cancelledAt === null);
  return (
    <div className="grid gap-6 px-4 pb-8 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      <SeriesSettingsForm seriesId={seriesId} offer={offer} timeZone={timeZone} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-baseline gap-2.5">
            <span className="text-xl font-medium leading-[26px] text-ink">Inscrits</span>
            <span className="text-sm leading-[18px] text-ink-subtle">
              {active.length} inscrit{active.length > 1 ? "s" : ""} en cours
            </span>
          </p>
          {offer.enrollmentEnabled && offer.sessions.length > 0 && (
            <ButtonLink href={`/app/reservations/nouvelle?evenement=${eventId}`} size="sm">
              Inscrire au comptoir
            </ButtonLink>
          )}
        </div>
        <DataTable
          label="Inscrits à la série"
          rows={enrollments}
          rowKey={(row) => row.id}
          rowTone={(row) => (row.cancelledAt ? "muted" : undefined)}
          minWidth={720}
          flush
          dense
          empty={
            <p className="px-4 py-10 text-center text-base font-medium text-ink-muted">
              {offer.enrollmentEnabled
                ? "Personne n'est encore inscrit à toute la série."
                : "Active l'inscription à la série pour vendre le trimestre d'un coup."}
            </p>
          }
          card={(row) => (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3.5">
                <div className="min-w-0 flex-1">
                  <PersonCell
                    name={row.customerName}
                    href={`/app/clients/${row.customerId}`}
                    avatarSize="lg"
                    stretched
                    detail={sessionsLabel(row)}
                  />
                </div>
                <MoneyCell cents={row.amountCents} caption={row.paidAt ? "Payé" : "À payer"} />
              </div>
              <div className="relative z-10 flex items-center justify-between gap-3 pl-[54px]">
                <EnrollmentBadge row={row} />
                <EnrollmentActions row={row} />
              </div>
            </div>
          )}
          columns={[
            {
              key: "person",
              header: "Inscrit",
              cell: (row) => (
                <PersonCell
                  name={row.customerName}
                  href={`/app/clients/${row.customerId}`}
                  avatarSize="md"
                  detail={row.customerEmail ?? row.customerPhone ?? undefined}
                />
              ),
            },
            {
              key: "sessions",
              header: "Séances",
              width: 170,
              cell: (row) => <span className="text-sm text-ink-muted">{sessionsLabel(row)}</span>,
            },
            {
              key: "date",
              header: "Inscrit le",
              width: 120,
              hideBelow: "xl",
              cell: (row) => (
                <span className="text-sm text-ink-muted">
                  {formatRelativeDateTime(row.createdAt, timeZone)}
                </span>
              ),
            },
            {
              key: "amount",
              header: "Montant",
              width: 110,
              align: "right",
              cell: (row) => (
                <MoneyCell cents={row.amountCents} caption={row.paidAt ? "Payé" : "À payer"} />
              ),
            },
            {
              key: "status",
              header: "Statut",
              width: 180,
              align: "right",
              cell: (row) => <EnrollmentBadge row={row} />,
            },
            {
              key: "actions",
              header: <span className="sr-only">Actions</span>,
              width: 70,
              align: "right",
              cell: (row) => <EnrollmentActions row={row} />,
            },
          ]}
        />
      </div>
    </div>
  );
}

/** « 9 séances restantes sur 12 · 1 absence ». */
function sessionsLabel(row: SeriesEnrollmentRow) {
  return [
    row.cancelledAt
      ? `${row.sessions} séance${row.sessions > 1 ? "s" : ""}`
      : `${row.remaining} restante${row.remaining > 1 ? "s" : ""} sur ${row.sessions}`,
    row.absences > 0 ? `${row.absences} absence${row.absences > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function EnrollmentBadge({ row }: { row: SeriesEnrollmentRow }) {
  return row.cancelledAt ? (
    <StatusBadge tone="draft">Désinscrit·e</StatusBadge>
  ) : (
    <StatusBadge tone="info">Inscrit·e au trimestre</StatusBadge>
  );
}

/** Menu « … » d'un inscrit : paiement noté ou retiré, désinscription (avec confirmation). */
function EnrollmentActions({ row }: { row: SeriesEnrollmentRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<FormState | null>(null);
  const run = (action: () => Promise<FormState>, onDone?: () => void) =>
    startTransition(async () => {
      const result = await action();
      setMessage(result);
      if (!result.error) {
        onDone?.();
        router.refresh();
      }
    });
  if (row.cancelledAt) return null;
  return (
    <>
      <ActionMenu
        label={`Actions pour ${row.customerName}`}
        items={[
          {
            label: row.paidAt ? "Retirer le paiement noté" : "Noter le paiement",
            onSelect: () => run(() => setEnrollmentPaidAction(row.id, !row.paidAt)),
          },
          { label: "Désinscrire", tone: "danger", onSelect: () => setConfirm(true) },
        ]}
      />
      {confirm && (
        <Dialog
          open
          onClose={() => setConfirm(false)}
          title="Désinscrire de la série ?"
          description={`Les ${row.remaining} séance${row.remaining > 1 ? "s" : ""} à venir de ${row.customerName} ${row.remaining > 1 ? "sont libérées" : "est libérée"} et profite${row.remaining > 1 ? "nt" : ""} à la liste d'attente. Les séances passées restent dans l'historique.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(false)} className="flex-1">
                Retour
              </Button>
              <Button
                variant="danger-solid"
                className="flex-1"
                pending={pending}
                onClick={() =>
                  run(
                    () => cancelEnrollmentAction(row.id),
                    () => setConfirm(false),
                  )
                }
              >
                Désinscrire
              </Button>
            </>
          }
        >
          {message?.error ? <FormAlert>{message.error}</FormAlert> : null}
        </Dialog>
      )}
      {!confirm && message?.error && (
        <div className="fixed right-4 bottom-[calc(88px+env(safe-area-inset-bottom))] left-4 z-50 sm:left-auto sm:max-w-sm lg:right-6 lg:bottom-6">
          <FormAlert>{message.error}</FormAlert>
        </div>
      )}
    </>
  );
}

/** Réglage « Inscription à la série » : prix de la série, séance à l'unité ou non. */
function SeriesSettingsForm({
  seriesId,
  offer,
  timeZone,
}: {
  seriesId: string;
  offer: SeriesOffer;
  timeZone: string;
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    saveSeriesEnrollmentAction.bind(null, seriesId),
    {},
  );
  const [enabled, setEnabled] = useState(offer.enrollmentEnabled);
  const first = offer.sessions[0];
  const last = offer.sessions.at(-1);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5 rounded-3xl bg-surface p-5 sm:p-6">
      <div className="flex flex-col gap-1.5">
        <Eyebrow>Cours à l'année</Eyebrow>
        <p className="text-sm leading-5 text-ink-muted">
          {first && last
            ? `${offer.sessions.length} séance${offer.sessions.length > 1 ? "s" : ""} à venir, du ${formatDateTimeShort(first.startsAt, timeZone)} au ${formatDateTimeShort(last.startsAt, timeZone)}.`
            : "Plus aucune séance publiée à venir dans cette série."}
        </p>
      </div>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <Switch
        name="enrollmentEnabled"
        checked={enabled}
        onChange={(event) => setEnabled(event.target.checked)}
        label="Inscription à la série"
        description="Une place dans chaque séance restante, un seul paiement."
      />
      {enabled && (
        <>
          <Field
            label="Prix de la série"
            required
            error={state.fieldErrors?.enrollmentPriceCents}
            hint="Le même prix quelle que soit la date d'inscription."
          >
            {(field) => (
              <AffixInput
                {...field}
                name="enrollmentPrice"
                inputMode="decimal"
                mono
                suffix="€ TTC"
                defaultValue={
                  offer.enrollmentPriceCents === null
                    ? ""
                    : centsToInput(offer.enrollmentPriceCents)
                }
              />
            )}
          </Field>
          <Switch
            name="dropInAllowed"
            defaultChecked={offer.dropInAllowed}
            label="Réservation à la séance"
            description="Le public peut aussi réserver une séance à l'unité."
          />
        </>
      )}
      <Button type="submit" pending={pending} className="self-start">
        Enregistrer
      </Button>
    </form>
  );
}
