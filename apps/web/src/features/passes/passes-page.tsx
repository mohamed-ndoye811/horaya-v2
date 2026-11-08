import { PageHeader } from "@/components/app/page-header";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRight, PlusIcon } from "@/components/ui/icons";
import { cardClasses, cardShellClasses } from "@/components/ui/section";
import type { getPassesPage } from "@/functions/passes";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { Link } from "@/lib/navigation";
import { PassPaymentActions } from "./pending-pass-row";
import { PlanForm, type PlanFormValues } from "./plan-form";

/** Cartes de séances : formules à vendre (panneau d'édition à droite) et cartes à encaisser. */
export function PassesPage({
  data,
  selected,
}: {
  data: Awaited<ReturnType<typeof getPassesPage>>;
  selected: string | undefined;
}) {
  const { plans, pending, eventTypes, timeZone } = data;
  const editing = plans.find((plan) => plan.id === selected);
  const panel: PlanFormValues | null = editing
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

  return (
    <div className="flex flex-1 flex-col">
      <PageHeader
        eyebrow="Tableau de bord / Cartes"
        title="Cartes de séances"
        subtitle="Vends des cartes de 5 ou 10 séances : tes élèves réservent ensuite avec une séance de leur carte."
        actions={
          <ButtonLink href="/app/cartes?formule=nouvelle" icon={<PlusIcon />}>
            Nouvelle formule
          </ButtonLink>
        }
      />
      <div className="flex flex-1 flex-col gap-4 px-4 pb-4 lg:flex-row lg:items-start">
        <div className={cn("flex min-w-0 flex-1 flex-col gap-4", panel && "hidden lg:flex")}>
          {pending.length > 0 && (
            <section className={cn(cardClasses, "gap-3")}>
              <h2 className="text-base font-semibold leading-5 text-ink">
                À encaisser
                <span className="ml-2 text-[13px] font-normal text-ink-subtle">
                  {pending.length}
                </span>
              </h2>
              <ul className="relative flex flex-col">
                <PresenceList>
                  {pending.map((entry) => (
                    <PresenceItem
                      as="li"
                      key={entry.id}
                      className="flex flex-col gap-2 border-t border-line-faint py-3 first:border-t-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/app/clients/${entry.customerId}`}
                          className="text-sm font-semibold text-ink hover:underline"
                        >
                          {entry.customerName}
                        </Link>
                        <span className="text-sm font-semibold text-ink">
                          {formatMoney(entry.priceCents)}
                        </span>
                      </div>
                      <p className="text-xs text-ink-subtle">
                        {entry.name} · demandée le {day(entry.createdAt)}
                      </p>
                      <PassPaymentActions passId={entry.id} />
                    </PresenceItem>
                  ))}
                </PresenceList>
              </ul>
            </section>
          )}
          {plans.length === 0 && !panel ? (
            <EmptyState
              title="Aucune formule pour l'instant."
              description="Crée ta première carte : nombre de séances, prix, durée de validité et types d'événements acceptés."
              actions={
                <ButtonLink href="/app/cartes?formule=nouvelle" arrow>
                  Créer ma première formule
                </ButtonLink>
              }
            />
          ) : (
            <ul
              aria-label="Formules de carte"
              className={cn(cardShellClasses, "reveal-group overflow-hidden")}
            >
              {plans.map((plan) => (
                <li key={plan.id} className="border-b border-line-soft last:border-b-0">
                  <Link
                    href={`/app/cartes?formule=${plan.id}`}
                    aria-current={plan.id === selected ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3.5 px-5 py-4 text-ink transition-colors hover:bg-band",
                      plan.id === selected && "bg-band",
                    )}
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-base font-bold leading-5">{plan.name}</span>
                        {plan.archivedAt && <StatusBadge tone="draft">Archivée</StatusBadge>}
                      </span>
                      <span className="truncate text-[13px] font-medium leading-[17px] text-ink-muted">
                        {plan.sessions} séances · valable {plan.validityDays} jours ·{" "}
                        {plan.eventTypeIds.length === 0
                          ? "tous les types"
                          : plan.eventTypeIds
                              .map((id) => typeNames.get(id))
                              .filter(Boolean)
                              .join(", ") || "types supprimés"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-base font-extrabold leading-5">
                        {formatMoney(plan.priceCents)}
                      </span>
                      <span className="text-xs leading-4 text-ink-subtle">
                        {plan.sold} active{plan.sold > 1 ? "s" : ""}
                      </span>
                    </span>
                    <ChevronRight />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
        {panel && (
          <aside
            className={cn(
              cardShellClasses,
              "animate-rise overflow-hidden lg:sticky lg:top-4 lg:w-[460px] lg:shrink-0",
            )}
          >
            <PlanForm key={panel.id ?? "nouvelle"} initial={panel} eventTypes={eventTypes} />
          </aside>
        )}
      </div>
    </div>
  );
}
