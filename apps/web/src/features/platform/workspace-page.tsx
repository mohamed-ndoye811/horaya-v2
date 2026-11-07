import { type BillingRate, type MemberRole, PLANS } from "@horaya/core";
import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import {
  type getPlatformWorkspace,
  grantPlatformLicence,
  revokePlatformLicence,
  setPlatformRate,
} from "@/functions/platform";
import { cn } from "@/lib/cn";
import { useRouter } from "@/lib/navigation";
import { ROLE_LABELS } from "@/lib/roles";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { PlanBadge, shortDay } from "./shared";

type Data = Awaited<ReturnType<typeof getPlatformWorkspace>>;

const card = "flex flex-col overflow-hidden rounded-3xl bg-surface";
const head = "flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4";
const title = "font-section text-base text-ink";

const GRANT_KINDS = { trial: "Essai", beta: "Bêta-testeur", gift: "Offerte" } as const;

/** Cockpit : fiche d'un espace (formule, licences, tarif, équipe, journal). */
export function PlatformWorkspacePage({ data }: { data: Data }) {
  const router = useRouter();
  const { workspace, billing } = data;
  const [message, setMessage] = useState<FormState>({});
  const now = new Date();

  async function act(run: () => Promise<FormState>) {
    setMessage(await run());
    router.refresh();
  }

  return (
    <>
      <PageHeader
        eyebrow="Cockpit / Espaces"
        title={workspace.name}
        subtitle={
          <>
            <a
              href={`/${workspace.slug}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-ink underline-offset-2 hover:underline"
            >
              /{workspace.slug} ↗
            </a>{" "}
            · créé le {shortDay(workspace.createdAt)} · {data.events} événement
            {data.events > 1 ? "s" : ""} · {data.bookings} réservation{data.bookings > 1 ? "s" : ""}
          </>
        }
      />
      <div className="grid gap-4 px-4 pb-6 lg:grid-cols-2">
        {message.error && <FormAlert>{message.error}</FormAlert>}
        {message.success && <FormAlert tone="success">{message.success}</FormAlert>}

        <section aria-labelledby="formule" className={cn(card, "lg:col-span-2")}>
          <div className={head}>
            <h2 id="formule" className={title}>
              Formule
            </h2>
            <PlanBadge current={billing.current} />
          </div>
          <dl className="grid gap-px bg-line-soft sm:grid-cols-3">
            {[
              ["Jusqu'au", billing.current.until ? shortDay(billing.current.until) : "sans fin"],
              [
                "Places",
                `${billing.seats.used} sur ${billing.seats.limit ?? "∞"} (dont ${data.pendingInvitations} invitation${data.pendingInvitations > 1 ? "s" : ""})`,
              ],
              [
                "Réservations ce mois",
                `${billing.bookings.thisMonth} sur ${billing.bookings.limit ?? "∞"}${billing.bookings.over ? " · dépassé" : ""}`,
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 bg-surface px-5 py-4">
                <dt className="text-xs font-semibold text-ink-subtle">{label}</dt>
                <dd className="text-sm font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          {billing.account.subscription && (
            <p className="border-t border-line-soft px-5 py-3 text-sm text-ink-muted">
              Abonnement Polar {PLANS[billing.account.subscription.plan].name} (
              {billing.account.subscription.interval === "year" ? "annuel" : "mensuel"}) ·{" "}
              {billing.account.subscription.status}
              {billing.account.subscription.cancelAtPeriodEnd ? " · résilié en fin de période" : ""}
              {" · "}
              <span className="font-mono text-xs">
                {billing.account.subscription.polarCustomerId}
              </span>
            </p>
          )}
        </section>

        <section aria-labelledby="licences" className={card}>
          <div className={head}>
            <h2 id="licences" className={title}>
              Licences
            </h2>
          </div>
          <ul className="flex flex-col">
            {billing.grants.length === 0 && (
              <li className="px-5 py-4 text-sm text-ink-subtle">Aucune licence.</li>
            )}
            {billing.grants.map((grant) => {
              const active = !grant.revokedAt && (!grant.expiresAt || grant.expiresAt > now);
              return (
                <li
                  key={grant.id}
                  className="flex items-center gap-3 border-b border-line-faint px-5 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">
                      {GRANT_KINDS[grant.kind]} · {PLANS[grant.plan].name}
                    </span>
                    <span className="truncate text-xs text-ink-subtle">
                      {grant.revokedAt
                        ? `retirée le ${shortDay(grant.revokedAt)}`
                        : grant.expiresAt
                          ? `${active ? "jusqu'au" : "terminée le"} ${shortDay(grant.expiresAt)}`
                          : "sans fin"}
                      {grant.reason ? ` · ${grant.reason}` : ""}
                    </span>
                  </div>
                  {active ? (
                    <Button
                      variant="soft"
                      size="xs"
                      onClick={() =>
                        act(() =>
                          revokePlatformLicence({
                            data: { organizationId: workspace.id, grantId: grant.id },
                          }),
                        )
                      }
                    >
                      Retirer
                    </Button>
                  ) : (
                    <StatusBadge tone="neutral" size="sm">
                      Inactive
                    </StatusBadge>
                  )}
                </li>
              );
            })}
          </ul>
          <GrantForm organizationId={workspace.id} />
        </section>

        <div className="flex flex-col gap-4">
          <section aria-labelledby="tarif" className={card}>
            <div className={head}>
              <h2 id="tarif" className={title}>
                Tarif au paiement
              </h2>
            </div>
            <div className="flex flex-col gap-2 px-5 py-4">
              <SegmentedControl
                name="rate"
                label="Tarif"
                size="xs"
                fill={false}
                value={billing.account.rate}
                onChange={(rate) =>
                  act(() =>
                    setPlatformRate({
                      data: { organizationId: workspace.id, rate: rate as BillingRate },
                    }),
                  )
                }
                segments={[
                  { value: "standard", label: "Standard" },
                  { value: "solidaire", label: "Solidaire −50 %" },
                  { value: "beta", label: "Prix bêta" },
                ]}
              />
              <p className="text-xs text-ink-subtle">
                Appliqué au prochain paiement Polar (remise configurée chez Polar).
              </p>
            </div>
          </section>

          <section aria-labelledby="equipe" className={card}>
            <div className={head}>
              <h2 id="equipe" className={title}>
                Équipe
              </h2>
              <span className="text-xs text-ink-subtle">{data.team.length}</span>
            </div>
            <ul>
              {data.team.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center gap-3 border-b border-line-faint px-5 py-3 last:border-b-0"
                >
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-semibold text-ink">{person.name}</span>
                    <a
                      href={`mailto:${person.email}`}
                      className="truncate text-xs text-ink-subtle hover:text-ink"
                    >
                      {person.email}
                    </a>
                  </div>
                  <span className="text-xs font-semibold text-ink-muted">
                    {ROLE_LABELS[person.role as MemberRole] ?? person.role}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <section aria-labelledby="journal" className={cn(card, "lg:col-span-2")}>
          <div className={head}>
            <h2 id="journal" className={title}>
              Journal de facturation
            </h2>
          </div>
          <ul>
            {data.history.length === 0 && (
              <li className="px-5 py-4 text-sm text-ink-subtle">Rien pour l'instant.</li>
            )}
            {data.history.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-3 border-b border-line-faint px-5 py-3 text-sm last:border-b-0"
              >
                <span className="w-24 shrink-0 text-xs text-ink-subtle">
                  {shortDay(entry.createdAt)}
                </span>
                <span className="font-semibold text-ink">{entry.label}</span>
                {entry.by && <span className="text-xs text-ink-subtle">par {entry.by}</span>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

/** Accorder une licence : bêta-testeur ou offerte, Pro ou Équipe, durée en jours (vide : sans fin). */
function GrantForm({ organizationId }: { organizationId: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(
    (_previous, form) => grantPlatformLicence({ data: form }),
    {},
  );
  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 border-t border-line-soft bg-band px-5 py-4"
    >
      <input type="hidden" name="organizationId" value={organizationId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Licence">
          {(field) => (
            <Select {...field} name="kind" defaultValue="beta">
              <option value="beta">Bêta-testeur</option>
              <option value="gift">Offerte</option>
            </Select>
          )}
        </Field>
        <Field label="Formule">
          {(field) => (
            <Select {...field} name="plan" defaultValue="pro">
              <option value="pro">Pro</option>
              <option value="equipe">Équipe</option>
            </Select>
          )}
        </Field>
        <Field label="Durée en jours" hint="Vide : sans fin">
          {(field) => (
            <input
              {...field}
              name="days"
              inputMode="numeric"
              pattern="[0-9]*"
              className={inputClasses()}
            />
          )}
        </Field>
        <Field label="Motif">
          {(field) => <input {...field} name="reason" maxLength={200} className={inputClasses()} />}
        </Field>
      </div>
      {state.error && <FormAlert>{state.error}</FormAlert>}
      {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
      <Button type="submit" size="sm" disabled={pending} className="self-start">
        {pending ? "…" : "Accorder la licence"}
      </Button>
    </form>
  );
}
