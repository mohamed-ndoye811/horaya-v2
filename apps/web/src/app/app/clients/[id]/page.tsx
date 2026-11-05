import { attendanceOf, attendanceRate } from "@horaya/core";
import { getCustomerDetail, listCustomerBookings } from "@horaya/db";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RENTAL_COLOR } from "@/components/app/availability-grid";
import { PageHeader } from "@/components/app/page-header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { DateBlock } from "@/components/ui/cells";
import { PlusIcon } from "@/components/ui/icons";
import { cardClasses, cardShellClasses } from "@/components/ui/section";
import { MiniStat, ProgressRing } from "@/components/ui/stat";
import { ATTENDANCE_BADGE, BOOKING_STATUS_BADGE } from "@/components/ui/status";
import { Tag } from "@/components/ui/tag";
import { cn } from "@/lib/cn";
import { customerTags } from "@/lib/customer-tags";
import { formatMoney, formatRelativeDay, PAYMENT_MODE_LABELS } from "@/lib/format";
import { db } from "@/server/db";
import { getWorkspaceContext } from "@/server/workspace";
import { NoteForm } from "./note-form";

export const metadata: Metadata = { title: "Fiche client · Horaya" };

/** Maquette 2.2 : fiche d'un client. */
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
  const dayMonth = (date: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", timeZone }).format(date);
  const noteDate = (date: Date) =>
    new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone })
      .format(date)
      .replace(".", "");
  // Prochaine venue : la réservation à venir la plus proche (la liste est du plus récent au plus ancien).
  const next = bookings
    .filter(
      (entry) =>
        entry.eventStartsAt &&
        entry.eventStartsAt >= now &&
        (entry.status === "confirmed" || entry.status === "pending"),
    )
    .at(-1);
  const cancelled = (status: string) => status === "cancelled" || status === "refused";

  return (
    <>
      <PageHeader
        eyebrow="Clients / Fiche client"
        leading={
          <span className="hidden sm:block">
            <Avatar name={name} size="header" />
          </span>
        }
        title={name}
        titleAside={
          <div className="flex flex-wrap gap-1.5">
            {customerTags(customer, now).map((tag) => (
              <Tag key={tag.label} tone={tag.tone} size="lg">
                {tag.label}
              </Tag>
            ))}
          </div>
        }
        subtitle={
          <>
            Client depuis {since}
            {customer.company ? ` · ${customer.company}` : ""}.
            {next?.eventStartsAt && (
              <span className="text-ink">
                {" "}
                Prochaine venue {formatRelativeDay(next.eventStartsAt, timeZone, now)},{" "}
                {next.eventTitle ?? "location"}.
              </span>
            )}
          </>
        }
        actions={
          <>
            {customer.email && (
              <ButtonLink href={`mailto:${customer.email}`} variant="secondary">
                Envoyer un e-mail
              </ButtonLink>
            )}
            <ButtonLink
              href={`/app/reservations/nouvelle?client=${customer.id}`}
              icon={<PlusIcon />}
            >
              Créer une réservation
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 px-4 pb-4 xl:grid-cols-4">
        <MiniStat label="Réservations" value={customer.bookings} />
        <MiniStat
          label="Total dépensé"
          value={formatMoney(customer.spentCents).replace(/\s?€$/, "")}
          unit="€"
        />
        <MiniStat
          label="Taux de présence"
          value={presence ?? "—"}
          unit={presence === null ? undefined : "%"}
          aside={presence !== null && <ProgressRing percent={presence} />}
        />
        <MiniStat
          dark
          label="Prochaine venue"
          value={
            next?.eventStartsAt ? (
              <>
                {dayMonth(next.eventStartsAt)}
                {["aujourd'hui", "demain"].includes(
                  formatRelativeDay(next.eventStartsAt, timeZone, now),
                ) && (
                  <span className="ml-1 text-sm tracking-normal text-accent">
                    · {formatRelativeDay(next.eventStartsAt, timeZone, now)}
                  </span>
                )}
              </>
            ) : (
              "—"
            )
          }
        />
      </div>

      <div className="grid items-start gap-4 px-4 pb-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <section className={cn(cardClasses, "gap-1")}>
            <div className="flex items-baseline justify-between pb-2">
              <h2 className="text-base font-semibold leading-5 text-ink">Coordonnées</h2>
              <Link
                href={`/app/clients/${customer.id}/modifier`}
                className="text-[13px] font-semibold leading-[17px] text-ink hover:underline"
              >
                Modifier
              </Link>
            </div>
            <dl className="flex flex-col">
              {[
                ["E-mail", customer.email],
                ["Téléphone", customer.phone],
                ["Entreprise", customer.company],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex min-h-10 items-center justify-between gap-4 border-t border-[#f4f4f2] py-2"
                >
                  <dt className="text-[13px] leading-[17px] text-ink-subtle">{label}</dt>
                  <dd
                    className={cn(
                      "min-w-0 break-words text-right text-sm font-medium leading-[18px]",
                      value ? "text-ink" : "text-[#ababa6]",
                    )}
                  >
                    {value || "—"}
                  </dd>
                </div>
              ))}
              <div className="flex min-h-10 items-center justify-between gap-4 border-t border-[#f4f4f2] py-2">
                <dt className="text-[13px] leading-[17px] text-ink-subtle">Actualités</dt>
                <dd
                  className={cn(
                    "text-right text-sm font-medium leading-[18px]",
                    customer.marketingConsent ? "text-success" : "text-ink-subtle",
                  )}
                >
                  {customer.marketingConsent ? "Accepte de les recevoir" : "Ne les reçoit pas"}
                </dd>
              </div>
            </dl>
          </section>

          <section className={cn(cardClasses, "gap-2.5")}>
            <NoteForm customerId={customer.id} />
            {notes.length === 0 && (
              <p className="text-[13px] leading-[17px] text-ink-subtle">Pas encore de note.</p>
            )}
            {notes.map((note) => (
              <article
                key={note.id}
                className={cn(
                  "flex flex-col gap-1.5 rounded-[14px] border-l-[3px] px-3.5 py-3",
                  note.pinned ? "border-warning bg-warning-bg" : "border-[#dcdcd8] bg-field",
                )}
              >
                <p
                  className={cn(
                    "whitespace-pre-line text-sm leading-5",
                    note.pinned ? "text-[#3a2e10]" : "text-[#333]",
                  )}
                >
                  {note.body}
                </p>
                <p
                  className={cn(
                    "text-[11px] font-bold uppercase leading-[14px] tracking-[0.04em]",
                    note.pinned ? "text-[#8a6a2a]" : "text-ink-subtle",
                  )}
                >
                  {note.pinned ? "Épinglée · " : ""}
                  {note.authorName?.split(" ")[0] ?? "Équipe"} · {noteDate(note.createdAt)}
                </p>
              </article>
            ))}
          </section>
        </div>

        <section className={cn(cardShellClasses, "min-w-0 overflow-hidden pt-1 pb-2")}>
          <h2 className="flex items-baseline gap-2 px-5 pt-4 pb-3 text-base font-semibold leading-5 text-ink">
            Historique des réservations
            <span className="text-[13px] font-normal leading-[17px] text-ink-subtle">
              {bookings.length}
            </span>
          </h2>
          {bookings.length === 0 && (
            <p className="border-t border-[#f4f4f2] px-5 py-6 text-sm text-ink-subtle">
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
              const off = cancelled(entry.status);
              return (
                <li
                  key={entry.id}
                  className="relative flex min-h-[60px] items-center gap-3.5 border-t border-[#f4f4f2] px-5 py-2.5 hover:bg-band"
                >
                  {entry.eventId && entry.eventStartsAt ? (
                    <DateBlock
                      date={entry.eventStartsAt}
                      timeZone={timeZone}
                      dark={entry.id === next?.id}
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex size-10 shrink-0 items-center justify-center rounded-[10px] border-[1.5px] border-dashed border-[#dcdcd8]"
                    >
                      <svg
                        aria-hidden="true"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#8a8a8a"
                      >
                        <path
                          d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"
                          strokeWidth="1.75"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-px">
                    <Link
                      href={`/app/reservations/${entry.id}`}
                      className={cn(
                        "flex min-w-0 items-center gap-[7px] text-sm font-semibold leading-[18px] after:absolute after:inset-0",
                        off ? "text-ink-subtle" : "text-ink",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className="size-[7px] shrink-0 rounded-full"
                        style={{
                          backgroundColor: off ? "#ababa6" : (entry.typeColor ?? RENTAL_COLOR),
                        }}
                      />
                      <span className="truncate">{entry.eventTitle ?? "Location"}</span>
                    </Link>
                    <span
                      className={cn(
                        "truncate text-xs leading-4",
                        off ? "text-[#ababa6]" : "text-ink-subtle",
                      )}
                    >
                      {entry.seats} place{entry.seats > 1 ? "s" : ""} ·{" "}
                      {PAYMENT_MODE_LABELS[entry.paymentMode]}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "w-20 shrink-0 text-right text-sm font-semibold leading-[18px]",
                      off ? "text-[#ababa6] line-through" : "text-ink",
                    )}
                  >
                    {formatMoney(entry.amountCents)}
                  </span>
                  <div className="hidden w-[110px] shrink-0 justify-end sm:flex">
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
