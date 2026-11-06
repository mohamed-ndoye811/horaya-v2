import type { CounterBookingInput, PaymentMethod } from "@horaya/core";
import { AnimatePresence, motion, type Variants } from "motion/react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { WordsReveal } from "@/components/motion/words";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { SearchInput } from "@/components/ui/search-input";
import {
  type CounterResult,
  counterItemsAction,
  createCounterBookingAction,
  searchCounterCustomersAction,
} from "@/functions/reservations";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

export interface CounterEvent {
  id: string;
  title: string;
  day: "today" | "tomorrow" | "later";
  time: string;
  duration: string;
  date: string;
  range: string;
  location: string | null;
  priceCents: number;
  color: string;
  /** « Mar. 16 · 10h » : ligne de la séance. */
  label: string;
  /** null = places illimitées. */
  remaining: number | null;
  capacity: number | null;
  waitlist: boolean;
}

interface CustomerHit {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  bookings: number;
}

interface CounterItem {
  id: string;
  name: string;
  free: number;
  onEvent: number;
}

type Done = Extract<CounterResult, { ok: true }>;

const DAYS = [
  { value: "today", label: "Aujourd'hui" },
  { value: "tomorrow", label: "Demain" },
  { value: "later", label: "À venir" },
];

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "cash", label: "Espèces" },
  { value: "card", label: "Carte" },
  { value: "check", label: "Chèque" },
  { value: "transfer", label: "Virement" },
];

/** Chiffre qui roule d'une hauteur entière (jamais deux chiffres superposés) : `custom` vaut 1 quand on ajoute, -1 quand on retire. */
const ROLL: Variants = {
  enter: (rise: number) => ({ y: `${100 * rise}%`, opacity: 0 }),
  center: { y: 0, opacity: 1 },
  exit: (rise: number) => ({ y: `${-100 * rise}%`, opacity: 0 }),
};

const EMPTY_CONTACT = { firstName: "", lastName: "", phone: "", email: "" };

/**
 * Comptoir sur un seul écran (maquette 1.6b) : séance et places, client, matériel et
 * paiement dans une carte, le récapitulatif noir à droite. ⌘ Entrée enregistre.
 */
export function CounterWizard({
  events,
  initialEventId,
  initialCustomer,
}: {
  events: CounterEvent[];
  initialEventId?: string;
  initialCustomer?: CustomerHit;
}) {
  const initialEvent = events.find((event) => event.id === initialEventId);
  const formRef = useRef<HTMLFormElement>(null);
  const [day, setDay] = useState(initialEvent?.day ?? events[0]?.day ?? "today");
  const [sessionSearch, setSessionSearch] = useState("");
  const [eventId, setEventId] = useState(initialEvent?.id ?? "");
  const [seats, setSeats] = useState(1);
  const [customer, setCustomer] = useState<CustomerHit | null>(initialCustomer ?? null);
  const [creating, setCreating] = useState(false);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [items, setItems] = useState<CounterItem[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [pickingItems, setPickingItems] = useState(false);
  const [paid, setPaid] = useState(true);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();

  const event = events.find((entry) => entry.id === eventId);
  const total = (event?.priceCents ?? 0) * seats;
  const full = event?.remaining !== null && event !== undefined && seats > (event.remaining ?? 0);
  const newName = `${contact.firstName} ${contact.lastName}`.trim();
  const customerName = customer?.name ?? (newName || null);
  const chosenItems = Object.entries(quantities).filter(([, quantity]) => quantity > 0);
  const itemName = (id: string) => items?.find((item) => item.id === id)?.name ?? "Matériel";
  const needle = sessionSearch.trim().toLowerCase();
  // Une recherche parcourt tous les jours ; sinon, le jour choisi.
  const sessions = events.filter((entry) =>
    needle
      ? `${entry.title} ${entry.location ?? ""}`.toLowerCase().includes(needle)
      : entry.day === day,
  );

  // Recherche du client, sans attendre la touche Entrée.
  useEffect(() => {
    if (search.trim().length < 2) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      searchCounterCustomersAction(search).then(setHits);
    }, 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Matériel attribuable sur la séance choisie.
  useEffect(() => {
    setItems(null);
    setQuantities({});
    setPickingItems(false);
    if (eventId) counterItemsAction(eventId).then(setItems);
  }, [eventId]);

  function blocking(): string | null {
    if (!event) return "Choisis une séance.";
    if (full && !event.waitlist)
      return `Il ne reste que ${event.remaining} place${(event.remaining ?? 0) > 1 ? "s" : ""}.`;
    if (!customer) {
      if (!contact.firstName.trim() || !contact.lastName.trim())
        return "Choisis un client ou indique au moins son prénom et son nom.";
      if (!contact.phone.trim() && !contact.email.trim())
        return "Indique un téléphone ou un e-mail pour le client.";
    }
    return null;
  }

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    const problem = blocking();
    setError(problem);
    if (problem) return;
    const input: CounterBookingInput = {
      eventId,
      seats,
      ...(customer ? { customerId: customer.id } : { customer: contact }),
      items: chosenItems.map(([itemId, quantity]) => ({ itemId, quantity })),
      paid: total > 0 && paid,
      paymentMethod: total > 0 && paid ? method : null,
    };
    startTransition(async () => {
      const result = await createCounterBookingAction(input);
      if (result.ok) {
        setDone(result);
        return;
      }
      setError(result.error ?? "La réservation n'a pas pu être enregistrée.");
      setFieldErrors(result.fieldErrors ?? {});
      if (result.fieldErrors?.customer) setCreating(true);
    });
  }

  function restart() {
    setDone(null);
    setEventId("");
    setSeats(1);
    setCustomer(null);
    setCreating(false);
    setContact(EMPTY_CONTACT);
    setSearch("");
    setSessionSearch("");
    setError(null);
    setFieldErrors({});
  }

  if (done && event) {
    return (
      <CounterDone
        done={done}
        event={event}
        seats={seats}
        customerName={customerName ?? ""}
        customerDetail={customer?.phone ?? (contact.phone || null)}
        method={paid ? method : null}
        onRestart={restart}
      />
    );
  }

  const paymentLabel =
    total === 0
      ? event
        ? "Gratuit"
        : null
      : paid
        ? `Payé · ${METHODS.find((entry) => entry.value === method)?.label.toLowerCase()}`
        : "Lien envoyé par e-mail";

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      onKeyDown={(key) => {
        if (key.key === "Enter" && (key.metaKey || key.ctrlKey)) {
          key.preventDefault();
          formRef.current?.requestSubmit();
        }
      }}
      className="flex flex-1 flex-col gap-4 px-4 pb-6 lg:flex-row lg:items-stretch"
    >
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface">
        {error && (
          <div className="px-6 pt-5">
            <FormAlert>{error}</FormAlert>
          </div>
        )}

        <Section
          number={1}
          title="Séance"
          aside={
            <div className="flex gap-1 rounded-full bg-[#f2f2f0] p-[3px]">
              {DAYS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  aria-pressed={!needle && day === entry.value}
                  onClick={() => {
                    setDay(entry.value as CounterEvent["day"]);
                    setSessionSearch("");
                  }}
                  className={cn(
                    "flex h-[30px] items-center rounded-full px-3 text-[13px] font-semibold leading-4",
                    !needle && day === entry.value
                      ? "bg-ink text-on-ink"
                      : "text-ink hover:bg-surface",
                  )}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          }
        >
          <SearchInput
            label="Rechercher une séance"
            placeholder="Rechercher une séance, un lieu…"
            value={sessionSearch}
            onChange={(change) => setSessionSearch(change.target.value)}
          />
          <div key={needle ? "recherche" : day} className="reveal-group flex flex-col gap-1.5">
            {sessions.map((entry) => (
              <SessionRow
                key={entry.id}
                event={entry}
                selected={entry.id === eventId}
                seats={seats}
                onSeats={setSeats}
                onSelect={() => {
                  setEventId(entry.id);
                  setSeats(1);
                }}
              />
            ))}
            {sessions.length === 0 && (
              <p className="rounded-[14px] border border-dashed border-line px-4 py-5 text-center text-sm text-ink-muted">
                {needle ? "Aucune séance ne correspond." : "Aucune séance ce jour-là."}
              </p>
            )}
          </div>
        </Section>

        <Section
          number={2}
          title="Client"
          aside={
            !customer && (
              <button
                type="button"
                onClick={() => setCreating(!creating)}
                className="text-[13px] font-bold leading-4 text-ink hover:underline"
              >
                {creating ? "Chercher un client" : "+ Nouveau client"}
              </button>
            )
          }
        >
          {customer ? (
            <div className="flex items-center gap-3 rounded-[14px] bg-field py-2.5 pr-2.5 pl-3">
              <Avatar name={customer.name} size="sm" />
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-sm font-semibold leading-[18px] text-ink">
                  {customer.name}
                </span>
                <span className="truncate text-xs leading-4 text-ink-subtle">
                  {[
                    customer.email,
                    customer.phone,
                    `${customer.bookings} réservation${customer.bookings > 1 ? "s" : ""}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setCustomer(null)}
                className="flex h-8 shrink-0 items-center rounded-full border border-line bg-surface px-3 text-xs font-semibold text-ink hover:bg-field"
              >
                Changer
              </button>
            </div>
          ) : creating ? (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="sr-only">Nouveau client</legend>
              <ContactInput
                label="Prénom"
                value={contact.firstName}
                error={fieldErrors["customer.firstName"]}
                onChange={(firstName) => setContact({ ...contact, firstName })}
              />
              <ContactInput
                label="Nom"
                value={contact.lastName}
                error={fieldErrors["customer.lastName"]}
                onChange={(lastName) => setContact({ ...contact, lastName })}
              />
              <ContactInput
                label="Téléphone"
                type="tel"
                value={contact.phone}
                error={fieldErrors["customer.phone"]}
                onChange={(phone) => setContact({ ...contact, phone })}
              />
              <ContactInput
                label="E-mail (facultatif)"
                type="email"
                value={contact.email}
                error={fieldErrors["customer.email"]}
                hint="Sans e-mail, pas de confirmation envoyée : donne-lui la référence."
                onChange={(email) => setContact({ ...contact, email })}
              />
            </fieldset>
          ) : (
            <>
              <SearchInput
                label="Rechercher un client"
                placeholder="Nom, téléphone ou e-mail"
                value={search}
                onChange={(change) => setSearch(change.target.value)}
              />
              {hits.length > 0 && (
                <div className="flex flex-col overflow-hidden rounded-[14px] border border-bg">
                  {hits.map((hit) => (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => setCustomer(hit)}
                      className="flex items-center gap-3 border-t border-bg px-3 py-2.5 text-left first:border-t-0 hover:bg-field"
                    >
                      <Avatar name={hit.name} size="sm" />
                      <span className="flex min-w-0 flex-col gap-px">
                        <span className="text-sm font-semibold leading-[18px] text-ink">
                          {hit.name}
                        </span>
                        <span className="truncate text-xs leading-4 text-ink-subtle">
                          {[
                            hit.phone ?? hit.email,
                            `${hit.bookings} réservation${hit.bookings > 1 ? "s" : ""}`,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
          {seats > 1 && (
            <p className="text-xs leading-4 text-ink-subtle">
              {seats === 2
                ? "Participant 2 : tu pourras compléter son nom plus tard."
                : `Participants 2 à ${seats} : tu pourras compléter leurs noms plus tard.`}
            </p>
          )}
        </Section>

        <Section number={3} title="Matériel et paiement">
          <div className="flex flex-wrap gap-2">
            {chosenItems.map(([id, quantity]) => (
              <span
                key={id}
                className="flex h-9 items-center gap-2 rounded-full bg-field pr-1.5 pl-3 text-[13px] font-semibold leading-4 text-ink"
              >
                {itemName(id)} ×{quantity}
                <button
                  type="button"
                  aria-label={`Retirer ${itemName(id)}`}
                  onClick={() => setQuantities({ ...quantities, [id]: 0 })}
                  className="flex size-6 items-center justify-center rounded-full bg-surface text-[13px] text-ink-subtle hover:text-ink"
                >
                  ✕
                </button>
              </span>
            ))}
            <button
              type="button"
              disabled={!event || items === null || items.length === 0}
              aria-expanded={pickingItems}
              onClick={() => setPickingItems(!pickingItems)}
              className="flex h-9 items-center rounded-full border-[1.5px] border-dashed border-[#d6d6d2] px-3 text-[13px] font-semibold leading-4 text-ink-muted hover:text-ink disabled:hover:text-ink-muted"
            >
              {!event
                ? "Choisis d'abord une séance"
                : items === null
                  ? "Chargement du matériel…"
                  : items.length === 0
                    ? "Aucun matériel libre sur cette séance"
                    : "+ Ajouter du matériel"}
            </button>
          </div>
          {pickingItems && items && items.length > 0 && (
            <div className="flex flex-col overflow-hidden rounded-[14px] border border-bg">
              {items.map((item) => {
                const quantity = quantities[item.id] ?? 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 border-t border-bg py-2 pr-2 pl-3.5 first:border-t-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-px">
                      <span className="text-sm font-semibold leading-[18px] text-ink">
                        {item.name}
                      </span>
                      <span
                        className={cn(
                          "text-xs leading-4",
                          item.free - quantity <= 1 ? "text-warning" : "text-success",
                        )}
                      >
                        {item.free - quantity} libre{item.free - quantity > 1 ? "s" : ""}
                      </span>
                    </span>
                    <QuantityStepper
                      value={quantity}
                      min={0}
                      max={item.free}
                      label={item.name}
                      onChange={(next) => setQuantities({ ...quantities, [item.id]: next })}
                    />
                  </div>
                );
              })}
            </div>
          )}
          {total > 0 && (
            <>
              <fieldset className="grid gap-2 sm:grid-cols-2">
                <legend className="sr-only">Paiement</legend>
                {[
                  {
                    value: true,
                    label: "Payé sur place",
                    detail: "Espèces, carte, chèque ou virement",
                  },
                  { value: false, label: "À payer", detail: "Lien envoyé avec la confirmation" },
                ].map((option) => (
                  <label
                    key={option.label}
                    className={cn(
                      "flex flex-col gap-0.5 rounded-[14px] px-3 py-2.5",
                      "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                      paid === option.value ? "bg-ink" : "border border-line hover:bg-field",
                    )}
                  >
                    <input
                      type="radio"
                      name="paiement"
                      checked={paid === option.value}
                      onChange={() => setPaid(option.value)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "text-[13px] font-semibold leading-4",
                        paid === option.value ? "text-white" : "text-ink",
                      )}
                    >
                      {option.label}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] leading-[14px]",
                        paid === option.value ? "text-[#9a9ea8]" : "text-ink-subtle",
                      )}
                    >
                      {option.detail}
                    </span>
                  </label>
                ))}
              </fieldset>
              {paid && (
                <fieldset className="flex flex-wrap gap-1.5">
                  <legend className="sr-only">Moyen de paiement</legend>
                  {METHODS.map((entry) => (
                    <label
                      key={entry.value}
                      className={cn(
                        "flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold leading-4",
                        "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                        method === entry.value
                          ? "bg-ink text-on-ink"
                          : "bg-field text-ink hover:bg-line-soft",
                      )}
                    >
                      <input
                        type="radio"
                        name="moyen"
                        value={entry.value}
                        checked={method === entry.value}
                        onChange={() => setMethod(entry.value)}
                        className="sr-only"
                      />
                      {entry.label}
                    </label>
                  ))}
                </fieldset>
              )}
            </>
          )}
        </Section>
      </div>

      <aside className="flex w-full shrink-0 flex-col justify-between gap-6 rounded-3xl bg-ink p-[22px] lg:sticky lg:top-[62px] lg:w-[360px] lg:self-start lg:min-h-[calc(100dvh-180px)]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-semibold leading-[14px] tracking-[0.06em] text-ink-subtle">
              TA SAISIE
            </p>
            <button
              type="button"
              onClick={restart}
              className="text-xs font-semibold text-[#9a9ea8] hover:text-white"
            >
              Tout effacer
            </button>
          </div>
          {event ? (
            <div className="flex gap-3">
              <span
                aria-hidden="true"
                className="w-[3px] shrink-0 rounded-[2px]"
                style={{ backgroundColor: event.color }}
              />
              <div className="flex flex-col gap-[3px]">
                <p className="text-lg font-semibold leading-[22px] text-white">{event.title}</p>
                <p className="text-[13px] leading-[18px] text-[#9a9ea8]">
                  {event.date} · {event.range}
                  {event.location && (
                    <>
                      <br />
                      {event.location}
                    </>
                  )}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[#9a9ea8]">Choisis une séance.</p>
          )}
          <dl className="flex flex-col border-t border-[#2a2a2a]">
            <SummaryLine
              label={
                event && event.priceCents > 0
                  ? `${seats} place${seats > 1 ? "s" : ""} × ${formatMoney(event.priceCents)}`
                  : "Places"
              }
              value={event ? (total > 0 ? formatMoney(total) : String(seats)) : null}
            />
            {chosenItems.map(([id, quantity]) => (
              <SummaryLine key={id} label={`${itemName(id)} ×${quantity}`} value="attribué" />
            ))}
            <SummaryLine label="Client" value={customerName} />
            <SummaryLine label="Paiement" value={paymentLabel} accent={total > 0 && !paid} />
          </dl>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="flex items-end justify-between border-t border-[#2a2a2a] pt-3.5">
            <span className="text-[13px] leading-4 text-[#9a9ea8]">Total</span>
            <span className="text-[40px] font-medium leading-[42px] tracking-[-0.03em] text-white">
              {total > 0 ? (
                <>
                  {formatMoney(total).replace(/\s?€$/, "")}{" "}
                  <span className="text-lg font-light tracking-normal">€</span>
                </>
              ) : event ? (
                "Gratuit"
              ) : (
                "—"
              )}
            </span>
          </div>
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="flex h-[52px] items-center justify-center rounded-full bg-white text-base font-semibold text-ink transition-colors hover:bg-field disabled:opacity-70"
          >
            {pending ? "Enregistrement…" : "Enregistrer la réservation"}
          </button>
          <p className="hidden text-center text-xs leading-4 text-ink-muted lg:block">
            ou ⌘ Entrée
          </p>
        </div>
      </aside>
    </form>
  );
}

function Section({
  number,
  title,
  aside,
  children,
}: {
  number: number;
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 border-t border-[#f4f4f2] px-5 py-5 first:border-t-0 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2.5">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold leading-[14px] text-on-ink">
            {number}
          </span>
          <span className="text-[17px] font-semibold leading-[22px] text-ink">{title}</span>
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SessionRow({
  event,
  selected,
  seats,
  onSeats,
  onSelect,
}: {
  event: CounterEvent;
  selected: boolean;
  seats: number;
  onSeats: (seats: number) => void;
  onSelect: () => void;
}) {
  const full = event.remaining === 0;
  const blocked = full && !event.waitlist;
  const remaining =
    event.remaining === null
      ? "Places illimitées"
      : `${event.remaining} place${event.remaining > 1 ? "s" : ""} libre${event.remaining > 1 ? "s" : ""}`;
  const title = (
    <span className="text-sm font-semibold leading-[18px] text-ink">
      {event.title}{" "}
      <span className="font-normal text-ink-subtle">
        · {event.priceCents > 0 ? formatMoney(event.priceCents) : "Gratuit"}
      </span>
    </span>
  );
  const date = (
    <span className="w-[76px] shrink-0 text-[13px] font-semibold leading-4 text-ink">
      {event.label}
    </span>
  );
  const bar = (
    <span
      aria-hidden="true"
      className="h-[26px] w-[3px] shrink-0 rounded-[2px]"
      style={{ backgroundColor: event.color }}
    />
  );
  if (selected) {
    return (
      <div className="flex min-h-[60px] items-center gap-3.5 rounded-[14px] border-[1.5px] border-ink bg-band py-1.5 pr-2 pl-3.5">
        {date}
        {bar}
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          {title}
          <span className={cn("text-xs leading-4", full ? "text-info" : "text-success")}>
            {full ? "Complet · liste d'attente" : remaining}
          </span>
        </span>
        <QuantityStepper value={seats} onChange={onSeats} min={1} max={99} />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={blocked}
      className="flex h-[52px] items-center gap-3.5 rounded-[14px] border border-bg px-3.5 text-left transition-colors hover:bg-band disabled:hover:bg-transparent"
    >
      {date}
      {bar}
      <span className="min-w-0 flex-1 truncate">{title}</span>
      {full ? (
        <span className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold leading-4 text-danger">Complet</span>
          {event.waitlist && (
            <span className="rounded-full bg-info-bg px-[7px] py-0.5 text-[11px] font-bold leading-[14px] text-info">
              attente
            </span>
          )}
        </span>
      ) : (
        <span
          className={cn(
            "text-[13px] font-bold leading-4",
            event.remaining !== null && event.remaining <= 2 ? "text-warning" : "text-ink-subtle",
          )}
        >
          {event.remaining === null
            ? "∞"
            : `${event.remaining} libre${event.remaining > 1 ? "s" : ""}`}
        </span>
      )}
    </button>
  );
}

function SummaryLine({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div className="flex h-10 items-center justify-between gap-4">
      <dt className="truncate text-[13px] leading-4 text-[#9a9ea8]">{label}</dt>
      <dd
        className={cn(
          "truncate text-sm font-semibold leading-[18px]",
          value ? (accent ? "text-accent" : "text-white") : "text-ink-muted",
        )}
      >
        {value ?? "—"}
      </dd>
    </div>
  );
}

/** Compteur − n + (places, exemplaires) : pilule blanche, « + » en noir (maquette 1.6b). */
function QuantityStepper({
  value,
  onChange,
  min,
  max,
  label = "Places",
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label?: string;
}) {
  // Le chiffre roule : il arrive par le bas quand on ajoute, par le haut quand on retire.
  const previous = useRef(value);
  const rise = value >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  const round =
    "flex size-8 items-center justify-center rounded-full text-lg leading-[18px] transition-[color,background-color,scale] active:scale-90";
  return (
    <div className="flex shrink-0 items-center gap-2.5 rounded-full border border-bg bg-surface p-1">
      <button
        type="button"
        aria-label={`Moins (${label})`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={cn(round, "border border-line text-ink disabled:text-ink-subtle")}
      >
        −
      </button>
      <output
        aria-label={label}
        className={cn(
          "relative flex min-w-4 justify-center overflow-hidden text-[17px] font-semibold leading-5",
          value === 0 ? "text-ink-subtle" : "text-ink",
        )}
      >
        {/* L'ancien chiffre sort pendant que le nouveau arrive (popLayout : il ne prend plus de place). */}
        <AnimatePresence initial={false} mode="popLayout" custom={rise}>
          <motion.span
            key={value}
            custom={rise}
            variants={ROLL}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", visualDuration: 0.2, bounce: 0 }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </output>
      <button
        type="button"
        aria-label={`Plus (${label})`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={cn(round, "bg-ink text-on-ink disabled:bg-line-soft disabled:text-ink-subtle")}
      >
        +
      </button>
    </div>
  );
}

function ContactInput({
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  type?: "text" | "tel" | "email";
}) {
  return (
    <Field
      label={label}
      error={error}
      hint={
        hint ? (
          <p className="text-[13px] font-medium leading-[18px] text-ink-muted">{hint}</p>
        ) : undefined
      }
    >
      {(field) => (
        <input
          {...field}
          type={type}
          value={value}
          onChange={(change) => onChange(change.target.value)}
          className={cn(inputClasses(), type === "tel" && "font-mono")}
        />
      )}
    </Field>
  );
}

function CounterDone({
  done,
  event,
  seats,
  customerName,
  customerDetail,
  method,
  onRestart,
}: {
  done: Done;
  event: CounterEvent;
  seats: number;
  customerName: string;
  customerDetail: string | null;
  method: PaymentMethod | null;
  onRestart: () => void;
}) {
  const paidLabel =
    done.amountCents === 0
      ? "Gratuit"
      : done.paymentStatus === "paid"
        ? `Payé · ${METHODS.find((entry) => entry.value === method)?.label.toLowerCase() ?? "noté"}`
        : "À payer";
  return (
    <div className="flex max-w-[640px] flex-col gap-6 px-4 pt-2 pb-10">
      <div className="flex flex-col gap-3">
        <span className="flex size-14 items-center justify-center rounded-full bg-success text-on-ink">
          {/* La coche se dessine (classe `draw`). */}
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M4 12.5L9.5 18L20 6.5"
              pathLength={1}
              className="draw"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
            />
          </svg>
        </span>
        <p className="reveal font-mono text-xs font-semibold leading-4 text-success">
          Réf. {done.reference}
        </p>
        <h2 className="font-headline text-[44px] leading-[42px] text-ink">
          <WordsReveal delay={1}>
            {done.status === "waitlisted" ? "En liste d'attente." : "C'est noté."}
          </WordsReveal>
        </h2>
      </div>
      <dl className="reveal-group flex flex-col rounded-3xl bg-surface px-2">
        <DoneRow label="Séance">
          <span className="text-[15px] font-bold leading-5 text-ink">{event.title}</span>
          <span className="text-[13px] font-medium leading-[18px] text-ink-muted">
            {[`${event.date} · ${event.range}`, event.location].filter(Boolean).join(" · ")}
          </span>
        </DoneRow>
        <DoneRow label="Client">
          <span className="text-[15px] font-bold leading-5 text-ink">
            {customerName} · {seats} place{seats > 1 ? "s" : ""}
          </span>
          {customerDetail && (
            <span className="font-mono text-label font-medium leading-[18px] text-ink-muted">
              {customerDetail}
            </span>
          )}
        </DoneRow>
        {done.items.length > 0 && (
          <DoneRow label="Matériel">
            {done.items.map((item) => (
              <span key={item.name} className="text-[15px] font-bold leading-5 text-ink">
                {item.name} {item.labels.join(", ")}
              </span>
            ))}
          </DoneRow>
        )}
        <DoneRow label="Paiement" last>
          <span className="flex items-center gap-2.5">
            {done.amountCents > 0 && (
              <span className="text-[15px] font-semibold leading-5 text-ink">
                {formatMoney(done.amountCents)}
              </span>
            )}
            <span
              className={cn(
                "rounded-full px-2.5 py-0.5 text-xs font-bold leading-[18px]",
                done.paymentStatus === "paid" || done.amountCents === 0
                  ? "bg-success-bg text-success"
                  : "bg-warning-bg text-warning",
              )}
            >
              {paidLabel}
            </span>
          </span>
        </DoneRow>
      </dl>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button onClick={onRestart} arrow>
          Nouvelle saisie
        </Button>
        <ButtonLink href={`/app/reservations/${done.bookingId}`} variant="secondary">
          Voir la réservation
        </ButtonLink>
      </div>
    </div>
  );
}

function DoneRow({
  label,
  children,
  last = false,
}: {
  label: string;
  children: ReactNode;
  last?: boolean;
}) {
  return (
    <div className={cn("flex gap-3 p-3.5", !last && "border-b border-[#f4f4f2]")}>
      <dt className="w-[84px] shrink-0 text-sm leading-5 text-ink-subtle">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</dd>
    </div>
  );
}
