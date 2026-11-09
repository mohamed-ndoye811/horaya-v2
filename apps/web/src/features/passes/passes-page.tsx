import { PageHeader } from "@/components/app/page-header";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { PlusIcon } from "@/components/ui/icons";
import { ProgressBar } from "@/components/ui/progress";
import { cardClasses, SectionHeading } from "@/components/ui/section";
import { MiniStat } from "@/components/ui/stat";
import type { getPassesPage } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { formatMoney, plural } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { PassPaymentActions } from "./pending-pass-row";
import { PlanDialog, type PlanFormValues } from "./plan-form";
import { formatValidity } from "./validity";

/** Une carte expire « bientôt » dans les 30 jours : de quoi relancer l'élève. */
const SOON_DAYS = 30;
const DAY = 86_400_000;

/**
 * Cartes de séances : à quoi elles servent, les chiffres (cartes en cours, séances à honorer,
 * échéances, à encaisser), les formules en vente, puis qui a une carte et ce qu'il lui reste.
 * Une formule se crée et se modifie dans une fenêtre (`?formule=`).
 */
export function PassesPage({
  data,
  selected,
}: {
  data: Awaited<ReturnType<typeof getPassesPage>>;
  selected: string | undefined;
}) {
  const { plans, pending, active, eventTypes, timeZone, slug } = data;
  const now = new Date(data.now).getTime();
  const editing = plans.find((plan) => plan.id === selected);
  const dialog: PlanFormValues | null = editing
    ? { ...editing, archived: editing.archivedAt !== null }
    : selected === "nouvelle"
      ? {
          id: null,
          name: "",
          sessions: 0,
          priceCents: 0,
          validityDays: 0,
          eventTypeIds: [],
          archived: false,
        }
      : null;
  const typeNames = new Map(eventTypes.map((type) => [type.id, type.name]));
  const day = (iso: string) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone })
      .format(new Date(iso))
      .replace(".", "");
  const daysLeft = (iso: string | null) =>
    iso === null ? null : Math.ceil((new Date(iso).getTime() - now) / DAY);
  const soon = active.filter((entry) => {
    const left = daysLeft(entry.expiresAt);
    return left !== null && left <= SOON_DAYS;
  }).length;
  const owed = active.reduce((sum, entry) => sum + entry.balance, 0);
  const holders = new Set(active.map((entry) => entry.customerId)).size;
  const onSale = plans.some((plan) => plan.archivedAt === null);

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Tableau de bord / Cartes de séances"
        title="Cartes de séances"
        subtitle="Des forfaits payés d'avance : ton élève achète plusieurs séances d'un coup, puis chaque réservation en décompte une."
        actions={
          <ButtonLink href="/app/cartes?formule=nouvelle" icon={<PlusIcon />}>
            Nouvelle formule
          </ButtonLink>
        }
      />
      {plans.length === 0 ? (
        <EmptyState
          title="Pas encore de carte de séances."
          description="Une carte, c'est un forfait : par exemple 10 séances payées d'avance, valables 6 mois. Ton élève réserve ensuite sans repayer, et chaque réservation décompte une séance."
          steps={[
            "Crée une formule : séances, prix, validité",
            "Ton élève l'achète sur ta page, ou tu la vends au comptoir",
            "Chaque réservation décompte une séance",
          ]}
          actions={
            <ButtonLink href="/app/cartes?formule=nouvelle" arrow>
              Créer ma première formule
            </ButtonLink>
          }
        />
      ) : (
        <div className="flex flex-col pb-4">
          <div className="grid grid-cols-2 gap-3 px-4 xl:grid-cols-4">
            <MiniStat
              label="Cartes en cours"
              value={active.length}
              aside={holders > 0 && `chez ${plural(holders, "élève")}`}
            />
            <MiniStat
              dark
              label="Séances à honorer"
              value={owed}
              aside={<span className="text-on-ink-muted">payées, pas encore faites</span>}
            />
            <MiniStat
              label={`Expirent sous ${SOON_DAYS} jours`}
              value={soon}
              aside={soon > 0 ? "pense à relancer" : "rien d'urgent"}
            />
            <MiniStat
              warning={pending.length > 0}
              label="À encaisser"
              value={pending.length}
              aside={pending.length > 0 ? "demandées sur ta page" : "tout est réglé"}
            />
          </div>

          <SectionHeading
            title="Formules"
            meta={plural(plans.length, "formule")}
            action={
              onSale ? { label: "Voir ma page de vente", href: `/${slug}/cartes` } : undefined
            }
          />
          <ul aria-label="Formules" className="grid gap-3 px-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((plan) => {
              const types =
                plan.eventTypeIds.length === 0
                  ? "Tous les types"
                  : plan.eventTypeIds
                      .map((id) => typeNames.get(id))
                      .filter(Boolean)
                      .join(", ") || "Types supprimés";
              return (
                <li key={plan.id} className="flex">
                  <Link
                    href={`/app/cartes?formule=${plan.id}`}
                    className={cn(
                      cardClasses,
                      "flex flex-1 flex-col gap-3 transition-shadow hover:shadow-[0_16px_40px_rgba(0,0,0,0.08)]",
                      plan.archivedAt && "opacity-60",
                    )}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-base font-bold leading-5 text-ink">
                          {plan.name}
                        </span>
                        <span className="truncate text-meta leading-[17px] text-ink-muted">
                          {types}
                        </span>
                      </span>
                      {plan.archivedAt ? (
                        <StatusBadge tone="draft">Archivée</StatusBadge>
                      ) : (
                        <StatusBadge tone="success">En vente</StatusBadge>
                      )}
                    </span>
                    <span className="flex items-baseline gap-2">
                      <span className="font-headline text-subtitle text-ink">
                        {formatMoney(plan.priceCents)}
                      </span>
                      <span className="text-meta leading-4 text-ink-muted">
                        {formatMoney(Math.round(plan.priceCents / plan.sessions))} la séance
                      </span>
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line-faint pt-3 text-meta font-medium leading-4 text-ink-soft">
                      <span>{plural(plan.sessions, "séance")}</span>
                      <span>valable {formatValidity(plan.validityDays)}</span>
                      <span className="ml-auto text-ink-subtle">
                        {plan.sold > 0 ? `${plural(plan.sold, "carte")} en cours` : "aucune vendue"}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {pending.length > 0 && (
            <>
              <SectionHeading title="À encaisser" meta={plural(pending.length, "carte")} />
              <section className={cn(cardClasses, "mx-4 gap-0 py-2")}>
                <ul className="relative flex flex-col">
                  <PresenceList>
                    {pending.map((entry) => (
                      <PresenceItem
                        as="li"
                        key={entry.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line-faint py-3 first:border-t-0"
                      >
                        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <Link
                            href={`/app/clients/${entry.customerId}`}
                            className="truncate text-sm font-semibold text-ink hover:underline"
                          >
                            {entry.customerName}
                          </Link>
                          <span className="text-xs text-ink-subtle">
                            {entry.name} · {formatMoney(entry.priceCents)} · demandée le{" "}
                            {day(entry.createdAt)}
                          </span>
                        </span>
                        <PassPaymentActions passId={entry.id} />
                      </PresenceItem>
                    ))}
                  </PresenceList>
                </ul>
              </section>
            </>
          )}

          <SectionHeading
            title="Cartes en cours"
            meta={active.length > 0 ? plural(active.length, "carte") : undefined}
          />
          <DataTable
            label="Cartes en cours"
            rows={active}
            rowKey={(row) => row.id}
            rowHref={(row) => `/app/clients/${row.customerId}`}
            minWidth={720}
            empty={
              <p className="px-4 py-10 text-center text-sm font-medium text-ink-muted">
                Aucune carte en cours. Elles arrivent ici dès qu'un élève en achète une, ou que tu
                en vends une depuis sa fiche.
              </p>
            }
            card={(row) => (
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="truncate text-sm font-semibold text-ink">
                    {row.customerName}
                  </span>
                  <span className="shrink-0 text-sm font-semibold text-ink">
                    {row.balance}
                    <span className="font-normal text-ink-subtle"> / {row.sessionsTotal}</span>
                  </span>
                </div>
                <ProgressBar
                  value={row.balance}
                  max={row.sessionsTotal}
                  label={`${row.balance} séances restantes sur ${row.sessionsTotal}`}
                />
                <span className="text-meta text-ink-muted">
                  {row.name}
                  {row.expiresAt && ` · jusqu'au ${day(row.expiresAt)}`}
                </span>
              </div>
            )}
            columns={[
              {
                key: "customer",
                header: "Élève",
                cell: (row) => (
                  <span className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-ink">{row.customerName}</span>
                    <span className="text-meta text-ink-muted">{row.name}</span>
                  </span>
                ),
              },
              {
                key: "left",
                header: "Séances restantes",
                width: 220,
                cell: (row) => (
                  <span className="flex flex-col gap-1.5">
                    <span className="text-sm font-semibold text-ink">
                      {row.balance}
                      <span className="font-normal text-ink-subtle"> / {row.sessionsTotal}</span>
                    </span>
                    <ProgressBar
                      value={row.balance}
                      max={row.sessionsTotal}
                      label={`${row.balance} séances restantes sur ${row.sessionsTotal}`}
                      className="w-36"
                    />
                  </span>
                ),
              },
              {
                key: "expires",
                header: "Valable jusqu'au",
                width: 200,
                cell: (row) => {
                  const left = daysLeft(row.expiresAt);
                  if (row.expiresAt === null || left === null)
                    return <span className="text-meta text-ink-subtle">Sans limite</span>;
                  return (
                    <span className="flex items-center gap-2">
                      <span className="text-meta text-ink-soft">{day(row.expiresAt)}</span>
                      {left <= SOON_DAYS && (
                        <StatusBadge tone="warning" size="sm">
                          {`dans ${plural(left, "jour")}`}
                        </StatusBadge>
                      )}
                    </span>
                  );
                },
              },
            ]}
          />
        </div>
      )}
      {dialog && (
        <PlanDialog key={dialog.id ?? "nouvelle"} initial={dialog} eventTypes={eventTypes} />
      )}
    </div>
  );
}
