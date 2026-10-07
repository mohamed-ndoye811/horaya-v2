import { addDays } from "@horaya/core";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { CalendarLegend } from "@/components/calendar/legend";
import { MonthCalendar } from "@/components/calendar/month-calendar";
import { TimeGridCalendar } from "@/components/calendar/time-grid";
import { Avatar, CategorySwatch } from "@/components/ui/avatar";
import { CountBadge, StatusBadge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button, ButtonLink, IconButton, textLinkClasses } from "@/components/ui/button";
import { DateBlock, EventCell, MoneyCell, MonoCaption, PersonCell } from "@/components/ui/cells";
import { DataTable } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CloseIcon,
  ExternalIcon,
  PlusIcon,
} from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/menu";
import { fillTone, ProgressBar } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { Eyebrow, SectionHeading } from "@/components/ui/section";
import { SegmentedLinks } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Stat, StatGrid } from "@/components/ui/stat";
import { BOOKING_STATUS_BADGE, eventStatusBadge } from "@/components/ui/status";
import { Tabs } from "@/components/ui/tabs";
import { Timeline } from "@/components/ui/timeline";
import { formatDateTimeShort } from "@/lib/format";
import { BOOKINGS, CALENDAR_EVENTS, CATEGORIES, NOW, TODAY, UPCOMING } from "./demo-data";
import { FormDemo, InteractionDemo } from "./interactive-demos";

export const metadata: Metadata = { title: "Design system · Horaya" };

const TZ = "Europe/Paris";

function Demo({
  title,
  note,
  children,
  flush,
}: {
  title: string;
  note?: string;
  children: ReactNode;
  flush?: boolean;
}) {
  return (
    <section className="border-b-2 border-ink">
      <SectionHeading title={title} />
      {note && <p className="px-4 pt-5 text-sm font-medium text-ink-muted sm:px-10">{note}</p>}
      <div className={flush ? "pt-5" : "px-4 py-8 sm:px-10"}>{children}</div>
    </section>
  );
}

const TOKENS = [
  ["ink", "#264489"],
  ["ink-muted", "#4E669D"],
  ["ink-subtle", "#8C9AC0"],
  ["bg", "#F2F0EF"],
  ["surface", "#FAF9F8"],
  ["line-soft", "#DCD8D4"],
  ["success", "#397A5C"],
  ["warning", "#9A6B12"],
  ["danger", "#9E3A3A"],
  ["info", "#213F7C"],
  ["draft", "#3A3A3A"],
  ["neutral", "#595959"],
];

export default function DesignSystemPage() {
  const week = Array.from({ length: 7 }, (_, offset) => addDays(TODAY, offset));

  return (
    <>
      <PageHeader
        eyebrow="Lot 4 · Composants de l'admin"
        title="Design system"
        subtitle="Tous les composants des maquettes Paper, branchés sur les tokens. Les écrans du lot 5 les assemblent."
        actions={
          <>
            <Button variant="secondary">Exporter</Button>
            <Button icon={<PlusIcon />}>Nouvel événement</Button>
          </>
        }
      />

      <Demo title="Couleurs & typo">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6">
          {TOKENS.map(([name, hex]) => (
            <div key={name} className="flex flex-col gap-2">
              <span className="h-14 border border-line-soft" style={{ backgroundColor: hex }} />
              <span className="font-mono text-label font-semibold text-ink">{name}</span>
              <span className="font-mono text-label text-ink-muted">{hex}</span>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-4">
          <p className="font-headline text-display leading-[60px]">Bonjour, Mohamed</p>
          <p className="font-section text-section">À venir · Dernières réservations</p>
          <p className="text-base font-medium text-ink-muted">
            Urbanist 16 px — texte courant des écrans.
          </p>
          <Eyebrow>Geist Mono 12 px — sur-titres et données</Eyebrow>
        </div>
      </Demo>

      <Demo title="Boutons">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            <Button icon={<PlusIcon />}>Nouvel événement</Button>
            <Button variant="secondary">Voir les réservations</Button>
            <Button variant="success" icon={<Check />}>
              Valider la réservation
            </Button>
            <Button variant="danger" icon={<CloseIcon size={12} />}>
              Refuser
            </Button>
            <ButtonLink
              href="/app/design-system"
              variant="secondary"
              icon={<ExternalIcon size={12} />}
            >
              Voir la page publique
            </ButtonLink>
            <Button disabled>Rembourser</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <IconButton label="Mois précédent" size="lg">
              <ChevronLeft />
            </IconButton>
            <IconButton label="Mois suivant" size="lg">
              <ChevronRight />
            </IconButton>
            <IconButton label="Valider" variant="approve">
              <Check size={14} />
            </IconButton>
            <IconButton label="Refuser" variant="refuse">
              <CloseIcon size={12} />
            </IconButton>
            <ActionMenu
              label="Actions"
              items={[
                { label: "Modifier", href: "/app/design-system" },
                { label: "Supprimer", tone: "danger", href: "#" },
              ]}
            />
            <a href="#form" className={`${textLinkClasses} text-sm`}>
              Lien texte
            </a>
          </div>
          <div className="flex flex-wrap gap-3 bg-ink p-6">
            <Button variant="inverse">Créer un espace</Button>
            <Button variant="inverse-outline">Se connecter</Button>
          </div>
        </div>
      </Demo>

      <Demo title="Statuts, avatars, catégories">
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-3">
            {Object.values(BOOKING_STATUS_BADGE).map((badge) => (
              <StatusBadge key={badge.label} tone={badge.tone}>
                {badge.label}
              </StatusBadge>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              eventStatusBadge("published", { seatsHeld: 4, capacity: 12 }),
              eventStatusBadge("published", { seatsHeld: 22, capacity: 25 }),
              eventStatusBadge("published", { seatsHeld: 25, capacity: 25 }),
              eventStatusBadge("draft"),
              eventStatusBadge("cancelled"),
            ].map((badge) => (
              <StatusBadge key={badge.label} tone={badge.tone}>
                {badge.label}
              </StatusBadge>
            ))}
            <StatusBadge tone="info">Payée</StatusBadge>
            <StatusBadge tone="warning">Acompte · 36 €</StatusBadge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {["Camille Roux", "Léa Fontaine", "Marc Dupont", "Sophie Martin", "Thomas Bernard"].map(
              (name) => (
                <Avatar key={name} name={name} />
              ),
            )}
            <Avatar name="Julie Moreau" pending />
            <CountBadge tone="danger">3</CountBadge>
            <CountBadge>38</CountBadge>
            {CATEGORIES.map((category) => (
              <CategorySwatch key={category.name} color={category.color} size={14} />
            ))}
          </div>
        </div>
      </Demo>

      <Demo title="Indicateurs" flush>
        <StatGrid>
          <Stat
            label="Inscrits"
            value="38"
            suffix="/ 50"
            footer={<ProgressBar value={38} max={50} tone="warning" label="38 inscrits sur 50" />}
          />
          <Stat label="Réservations" value="187" footer="▲ +23 ce mois-ci" footerTone="success" />
          <Stat label="Taux de remplissage" value="92%" footer="▲ +4 pts" footerTone="success" />
          <Stat
            label="À valider"
            value="3"
            highlight
            footer={
              <a
                href="#reservations"
                className="font-bold underline decoration-1 underline-offset-[3px]"
              >
                Traiter maintenant →
              </a>
            }
          />
        </StatGrid>
      </Demo>

      <section id="reservations" className="border-b-2 border-ink">
        <SectionHeading title="Liste avec filtres" />
        <Banner
          action={
            <a href="#reservations" className="underline decoration-1 underline-offset-[3px]">
              Afficher uniquement celles-ci
            </a>
          }
        >
          3 réservations attendent ta validation. Les clients sont prévenus par e-mail dès que tu
          réponds.
        </Banner>
        <div className="flex flex-col gap-4 px-4 py-6 sm:px-10 xl:flex-row xl:items-center">
          <SearchInput
            label="Rechercher"
            placeholder="Rechercher un client, un e-mail, un événement…"
            className="xl:flex-1"
          />
          <SegmentedLinks
            label="Filtrer par statut"
            value="all"
            segments={[
              { value: "all", label: "Toutes", count: 156, href: "#reservations" },
              { value: "pending", label: "En attente", count: 3, href: "#reservations" },
              { value: "confirmed", label: "Confirmées", count: 142, href: "#reservations" },
              { value: "cancelled", label: "Annulées", count: 11, href: "#reservations" },
            ]}
          />
          <Select
            variant="filter"
            aria-label="Événement"
            className="xl:w-[220px]"
            defaultValue="all"
          >
            <option value="all">Tous les événements</option>
            <option value="seminaire">Séminaire annuel</option>
          </Select>
        </div>
        <DataTable
          label="Réservations"
          rows={BOOKINGS}
          rowKey={(booking) => booking.id}
          columns={[
            {
              key: "client",
              header: "Client",
              cell: (b) => <PersonCell name={b.name} detail={b.email} href="#reservations" />,
            },
            {
              key: "event",
              header: "Événement",
              width: 240,
              cell: (b) => (
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-sm font-semibold text-ink">{b.event}</span>
                  <MonoCaption>{formatDateTimeShort(b.eventDate, TZ)}</MonoCaption>
                </div>
              ),
            },
            {
              key: "seats",
              header: "Places",
              width: 64,
              cell: (b) => <span className="font-mono text-sm font-semibold">{b.seats}</span>,
            },
            {
              key: "amount",
              header: "Montant",
              width: 100,
              align: "right",
              cell: (b) => <MoneyCell cents={b.amountCents} caption={b.payment} />,
            },
            {
              key: "status",
              header: "Statut",
              width: 130,
              cell: (b) => (
                <StatusBadge tone={BOOKING_STATUS_BADGE[b.status].tone}>
                  {BOOKING_STATUS_BADGE[b.status].label}
                </StatusBadge>
              ),
            },
            {
              key: "actions",
              header: "Actions",
              width: 120,
              align: "right",
              cell: (b) =>
                b.status === "pending" ? (
                  <div className="flex gap-2">
                    <IconButton label={`Valider la réservation de ${b.name}`} variant="approve">
                      <Check size={14} />
                    </IconButton>
                    <IconButton label={`Refuser la réservation de ${b.name}`} variant="refuse">
                      <CloseIcon size={12} />
                    </IconButton>
                  </div>
                ) : (
                  <ActionMenu
                    label={`Actions pour ${b.name}`}
                    items={[
                      { label: "Voir la réservation", href: "#reservations" },
                      { label: "Annuler", tone: "danger", href: "#reservations" },
                    ]}
                  />
                ),
            },
          ]}
        />
      </section>

      <section className="border-b-2 border-ink">
        <SectionHeading
          title="À venir"
          action={{ label: "Tous les événements", href: "#reservations" }}
        />
        <ul>
          {UPCOMING.map((event) => {
            const badge = eventStatusBadge(event.status, event);
            return (
              <li
                key={event.id}
                className="flex items-center gap-5 border-b border-line-soft px-4 py-3.5 sm:pr-8 sm:pl-10"
              >
                <DateBlock date={event.date} timeZone={TZ} />
                <EventCell
                  title={event.title}
                  color={event.color}
                  detail={event.detail}
                  href="#reservations"
                />
                <div className="hidden w-[120px] shrink-0 sm:block">
                  <ProgressBar
                    value={event.seatsHeld}
                    max={event.capacity}
                    tone={fillTone(event.seatsHeld, event.capacity)}
                    label={`${event.seatsHeld} places sur ${event.capacity}`}
                  />
                </div>
                <div className="flex w-[140px] shrink-0 justify-end">
                  <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <Demo title="Onglets & historique">
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div className="border-b-2 border-ink">
            <Tabs
              label="Sections de l'événement"
              value="participants"
              tabs={[
                { value: "participants", label: "Participants", href: "#", count: 38 },
                { value: "infos", label: "Infos", href: "#" },
                { value: "materiel", label: "Matériel", href: "#", count: 2 },
                { value: "paiements", label: "Paiements", href: "#" },
              ]}
            />
          </div>
          <div className="flex flex-col gap-4">
            <Eyebrow>Historique</Eyebrow>
            <Timeline
              items={[
                {
                  id: "3",
                  title: "Rappel envoyé à l'équipe",
                  meta: "14/06 · 09:00",
                  tone: "warning",
                },
                { id: "2", title: "Carte pré-autorisée · 35 €", meta: "12/06 · 16:45" },
                { id: "1", title: "Demande créée depuis la page publique", meta: "12/06 · 16:44" },
              ]}
            />
          </div>
        </div>
      </Demo>

      <Demo title="Refus, modale & menu">
        <InteractionDemo />
      </Demo>

      <section id="form" className="border-b-2 border-ink">
        <SectionHeading title="Formulaire" />
        <div className="px-4 py-8 sm:px-10">
          <FormDemo />
        </div>
      </section>

      <section className="border-b-2 border-ink">
        <SectionHeading title="Calendrier — mois" />
        <CalendarLegend
          categories={CATEGORIES}
          aside={
            <span className="flex items-center gap-2.5 text-sm font-bold text-ink">
              Tous les calendriers <ChevronDown />
            </span>
          }
        />
        <MonthCalendar year={2026} month={6} events={CALENDAR_EVENTS} timeZone={TZ} today={TODAY} />
      </section>

      <section className="border-b-2 border-ink">
        <SectionHeading title="Calendrier — semaine" />
        <TimeGridCalendar
          days={week}
          events={CALENDAR_EVENTS}
          timeZone={TZ}
          today={TODAY}
          now={NOW}
          startHour={9}
          endHour={18}
        />
      </section>

      <section className="border-b-2 border-ink">
        <SectionHeading title="Calendrier — jour" />
        <TimeGridCalendar
          days={[TODAY]}
          events={CALENDAR_EVENTS}
          timeZone={TZ}
          today={TODAY}
          now={NOW}
          startHour={9}
          endHour={18}
        />
      </section>

      <section>
        <SectionHeading title="État vide" />
        <EmptyState
          title="Rien à l'agenda. Pour l'instant."
          description="Crée ton premier événement : il apparaîtra dans ton calendrier et sur ta page publique, prêt à recevoir des réservations."
          actions={
            <>
              <Button arrow>Créer mon premier événement</Button>
              <Button variant="secondary">Importer un agenda (.ics)</Button>
            </>
          }
          steps={["Crée un événement", "Partage ta page publique", "Reçois tes réservations"]}
        />
      </section>
    </>
  );
}
