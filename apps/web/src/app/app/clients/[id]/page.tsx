import { attendanceOf, attendanceRate } from "@horaya/core";
import { getCustomerDetail, listCustomerBookings } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DateBlock } from "@/components/ui/cells";
import { Envelope, PlusIcon } from "@/components/ui/icons";
import { Eyebrow, SectionHeading } from "@/components/ui/section";
import { Stat, StatGrid } from "@/components/ui/stat";
import { ATTENDANCE_BADGE, BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import { customerTags } from "@/lib/customer-tags";
import { formatMoney, PAYMENT_MODE_LABELS } from "@/lib/format";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "Fiche client · Horaya" };

/** Écran 23 : fiche d'un client. */
export default async function CustomerDetailPage({ params }: PageProps<"/app/clients/[id]">) {
  const { id } = await params;
  const { workspace, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const [detail, bookings] = await Promise.all([
    getCustomerDetail(db, workspace.id, id, now),
    listCustomerBookings(db, workspace.id, id),
  ]);
  if (!detail) notFound();
  const { customer, notes } = detail;
  const attendances = new Map(
    bookings.map((entry) => [
      entry.id,
      entry.eventEndsAt
        ? attendanceOf(entry, { endsAt: entry.eventEndsAt, checkInUsed: entry.checkInUsed }, now)
        : null,
    ]),
  );
  const presence = attendanceRate([...attendances.values()]);
  const name = `${customer.firstName} ${customer.lastName}`;
  const since = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone,
  }).format(customer.createdAt);
  const shortDate = (date: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone }).format(date);

  return (
    <>
      <header className="flex flex-col gap-6 border-b-2 border-ink px-4 pt-6 pb-6 sm:px-10 sm:pt-8 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-end gap-6">
          <div className="hidden sm:block">
            <Avatar name={name} size="xl" />
          </div>
          <div className="flex min-w-0 flex-col gap-3">
            <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
              Clients / Fiche client
            </p>
            <h1 className="font-headline text-[44px] leading-[42px] text-ink sm:text-display sm:leading-[60px]">
              {name}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              {customerTags(customer, now).map((tag) => (
                <Tag key={tag.label} tone={tag.tone}>
                  {tag.label}
                </Tag>
              ))}
              <span className="text-[15px] font-medium text-ink-muted">
                Client depuis {since}
                {customer.company ? ` · ${customer.company}` : ""}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <ButtonLink
            href={`mailto:${customer.email}`}
            variant="secondary"
            icon={<Envelope size={16} />}
          >
            Envoyer un e-mail
          </ButtonLink>
          <ButtonLink href={`/app/reservations/nouvelle?client=${customer.id}`} icon={<PlusIcon />}>
            Créer une réservation
          </ButtonLink>
        </div>
      </header>

      <StatGrid>
        <Stat label="Réservations" value={customer.bookings} />
        <Stat label="Total dépensé" value={formatMoney(customer.spentCents)} />
        <Stat label="Taux de présence" value={presence === null ? "—" : `${presence} %`} />
        <Stat
          label="Prochaine venue"
          value={customer.nextVisit ? shortDate(customer.nextVisit) : "—"}
        />
      </StatGrid>

      <div className="grid gap-10 px-4 py-8 sm:px-10 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="flex flex-col gap-10">
          <section className="flex flex-col">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3">
              <h2 className="font-section text-section leading-7 text-ink">Coordonnées</h2>
              <Link
                href={`/app/clients/${customer.id}/modifier`}
                className="tap-area font-mono text-label font-semibold uppercase tracking-[0.055em] text-ink hover:text-link"
              >
                Modifier
              </Link>
            </div>
            {[
              ["E-mail", customer.email],
              ["Téléphone", customer.phone],
              ["Entreprise", customer.company],
              [
                "Actualités",
                customer.marketingConsent ? "Accepte de les recevoir" : "Ne les reçoit pas",
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-1 border-b border-line-soft py-3.5">
                <Eyebrow>{label}</Eyebrow>
                <p className="break-words text-base font-medium text-ink">
                  {value || <span className="text-ink-muted">—</span>}
                </p>
              </div>
            ))}
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-center justify-between border-b-2 border-ink pb-3">
              <h2 className="font-section text-section leading-7 text-ink">Notes internes</h2>
            </div>
            <NoteForm customerId={customer.id} />
            {notes.length === 0 && (
              <p className="text-sm font-medium text-ink-muted">Pas encore de note.</p>
            )}
            {notes.map((note) => (
              <article
                key={note.id}
                className={
                  note.pinned
                    ? "border-l-4 border-warning bg-warning-bg px-4 py-3"
                    : "border-l-4 border-ink-subtle bg-surface px-4 py-3"
                }
              >
                <p className="whitespace-pre-line text-[15px] font-medium leading-6 text-ink">
                  {note.body}
                </p>
                <p className="mt-2 font-mono text-[11px] font-semibold uppercase tracking-[0.045em] text-ink-muted">
                  {note.authorName?.split(" ")[0] ?? "Équipe"} · {shortDate(note.createdAt)}
                </p>
              </article>
            ))}
          </section>
        </div>

        <section className="flex min-w-0 flex-col">
          <SectionHeading title="Historique des réservations" flush />
          {bookings.length === 0 && (
            <p className="py-6 text-base font-medium text-ink-muted">
              Aucune réservation pour l'instant.
            </p>
          )}
          <ul>
            {bookings.map((entry) => {
              const attendance = attendances.get(entry.id);
              const badge =
                attendance === "present"
                  ? ATTENDANCE_BADGE.present
                  : attendance === "absent"
                    ? ATTENDANCE_BADGE.absent
                    : BOOKING_STATUS_BADGE[entry.status];
              return (
                <li
                  key={entry.id}
                  className="flex items-center gap-5 border-b border-line-soft py-3.5"
                >
                  {entry.eventStartsAt ? (
                    <DateBlock date={entry.eventStartsAt} timeZone={timeZone} />
                  ) : (
                    <span className="w-14" />
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Link
                      href={`/app/reservations/${entry.id}`}
                      className="flex min-w-0 items-center gap-2 text-base font-bold text-ink hover:underline"
                    >
                      {entry.typeColor && <CategorySwatch color={entry.typeColor} />}
                      <span className="truncate">{entry.eventTitle ?? "Location"}</span>
                    </Link>
                    <span className="text-sm font-medium text-ink-muted">
                      {entry.seats} place{entry.seats > 1 ? "s" : ""} ·{" "}
                      {PAYMENT_MODE_LABELS[entry.paymentMode]}
                    </span>
                  </div>
                  <span className="w-20 shrink-0 text-right text-[15px] font-extrabold text-ink">
                    {formatMoney(entry.amountCents)}
                  </span>
                  <div className="hidden w-[150px] shrink-0 justify-end sm:flex">
                    <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </>
  );
}
