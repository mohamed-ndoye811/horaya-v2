"use client";

import type { CounterBookingInput, PaymentMethod } from "@horaya/core";
import { motion } from "motion/react";
import { type FormEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { ActiveIndicator } from "@/components/motion/indicator";
import { WordsReveal } from "@/components/motion/words";
import { Avatar } from "@/components/ui/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Check } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { SegmentedControl } from "@/components/ui/segmented";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import {
  type CounterResult,
  counterItemsAction,
  createCounterBookingAction,
  searchCounterCustomersAction,
} from "../actions";

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

type Step = 1 | 2 | 3;
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

/** `short` : libellé sur mobile, où les trois étapes tiennent sur une ligne. */
const STEPS: Array<{ step: Step; label: string; short: string }> = [
  { step: 1, label: "Séance", short: "Séance" },
  { step: 2, label: "Client", short: "Client" },
  { step: 3, label: "Matériel & paiement", short: "Matériel" },
];

const EMPTY_CONTACT = { firstName: "", lastName: "", phone: "", email: "" };

/**
 * Comptoir : séance et places, client, matériel et paiement, une étape à la fois, avec le
 * récapitulatif à droite (bureau) ou la barre d'action en bas (mobile).
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
  const [step, setStepState] = useState<Step>(1);
  // Sens du dernier changement d'étape : le contenu glisse dans le sens du parcours.
  const [direction, setDirection] = useState(1);
  const setStep = (target: Step) => {
    setDirection(target >= step ? 1 : -1);
    setStepState(target);
  };
  const [day, setDay] = useState(initialEvent?.day ?? events[0]?.day ?? "today");
  const [eventId, setEventId] = useState(initialEvent?.id ?? "");
  const [seats, setSeats] = useState(1);
  const [customer, setCustomer] = useState<CustomerHit | null>(initialCustomer ?? null);
  const [contact, setContact] = useState(EMPTY_CONTACT);
  const [search, setSearch] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [items, setItems] = useState<CounterItem[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
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
    if (eventId) counterItemsAction(eventId).then(setItems);
  }, [eventId]);

  function canContinue(): string | null {
    if (step === 1) {
      if (!event) return "Choisis une séance.";
      if (full && !event.waitlist)
        return `Il ne reste que ${event.remaining} place${(event.remaining ?? 0) > 1 ? "s" : ""}.`;
    }
    if (step === 2 && !customer) {
      if (!contact.firstName.trim() || !contact.lastName.trim())
        return "Choisis un client ou indique au moins son prénom et son nom.";
      if (!contact.phone.trim() && !contact.email.trim()) return "Un téléphone ou un e-mail.";
    }
    return null;
  }

  function submit(formEvent: FormEvent) {
    formEvent.preventDefault();
    const blocking = canContinue();
    setError(blocking);
    if (blocking) return;
    if (step < 3) {
      setStep((step + 1) as Step);
      return;
    }
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
      if (result.fieldErrors?.customer) setStep(2);
    });
  }

  function restart() {
    setDone(null);
    setStep(1);
    setEventId("");
    setSeats(1);
    setCustomer(null);
    setContact(EMPTY_CONTACT);
    setSearch("");
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

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col lg:flex-row">
      <div className="flex min-w-0 flex-1 flex-col gap-7 px-4 pt-6 pb-10 sm:px-10 sm:pt-7">
        <Stepper
          step={step}
          summaries={{
            1: event ? `${event.title} · ${event.time} · ${seats} pl.` : null,
            2: customerName,
          }}
          onBack={(target) => {
            setError(null);
            setStep(target);
          }}
        />
        {error && <FormAlert>{error}</FormAlert>}

        {step === 1 && (
          <StepBlock title="Quelle séance ?" direction={direction}>
            <SegmentedControl
              name="jour"
              label="Jour"
              value={day}
              onChange={(value) => setDay(value as CounterEvent["day"])}
              segments={DAYS.map((entry) => ({
                ...entry,
                count: events.filter((event) => event.day === entry.value).length,
              }))}
              size="md"
            />
            <div key={day} className="reveal-group flex flex-col gap-2">
              {events
                .filter((entry) => entry.day === day)
                .map((entry) => (
                  <SessionTile
                    key={entry.id}
                    event={entry}
                    selected={entry.id === eventId}
                    onSelect={() => {
                      setEventId(entry.id);
                      setSeats(1);
                    }}
                  />
                ))}
              {events.every((entry) => entry.day !== day) && (
                <p className="border-[1.5px] border-dashed border-line-soft px-4 py-6 text-center text-sm font-medium text-ink-muted">
                  Aucune séance ce jour-là.
                </p>
              )}
            </div>
            {event && (
              <div className="flex items-center justify-between gap-4 border-t-2 border-ink pt-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-base font-bold leading-5 text-ink">Places</span>
                  <span className="text-[13px] font-medium leading-[18px] text-ink-muted">
                    {event.remaining === null
                      ? "Places illimitées"
                      : `${event.remaining} libre${event.remaining > 1 ? "s" : ""} sur ${event.capacity}`}
                    {full && event.waitlist ? " · liste d'attente" : ""}
                  </span>
                </div>
                <QuantityStepper value={seats} onChange={setSeats} min={1} max={99} size="lg" />
              </div>
            )}
          </StepBlock>
        )}

        {step === 2 && (
          <StepBlock title="Pour qui ?" direction={direction}>
            <SearchInput
              label="Rechercher un client"
              placeholder="Nom, téléphone ou e-mail"
              value={search}
              autoFocus
              onChange={(change) => setSearch(change.target.value)}
            />
            {(customer || hits.length > 0) && (
              <div className="flex flex-col border-[1.5px] border-ink">
                {[
                  ...(customer ? [customer] : []),
                  ...hits.filter((hit) => hit.id !== customer?.id),
                ].map((hit, index) => {
                  const selected = hit.id === customer?.id;
                  return (
                    <button
                      key={hit.id}
                      type="button"
                      onClick={() => setCustomer(selected ? null : hit)}
                      aria-pressed={selected}
                      className={cn(
                        "flex items-center gap-3 px-3.5 py-3 text-left",
                        index > 0 && "border-t-[1.5px] border-line-soft",
                        selected ? "bg-ink" : "hover:bg-surface",
                      )}
                    >
                      <Avatar name={hit.name} />
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span
                          className={cn(
                            "text-base font-bold leading-5",
                            selected ? "text-on-ink" : "text-ink",
                          )}
                        >
                          {hit.name}
                        </span>
                        <span
                          className={cn(
                            "truncate font-mono text-label font-medium leading-4",
                            selected ? "text-on-ink/80" : "text-ink-muted",
                          )}
                        >
                          {[hit.phone ?? hit.email, `${hit.bookings} résa`]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </span>
                      <span className="w-[18px] shrink-0 text-on-ink">
                        {selected && <Check size={16} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            {!customer && (
              <fieldset className="flex flex-col gap-3 border-t-2 border-ink pt-4">
                <legend className="sr-only">Nouveau client</legend>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-base font-bold leading-5 text-ink">+ Nouveau client</span>
                  <span className="font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-ink-muted">
                    Nom + tél. suffisent
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
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
                </div>
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
            )}
          </StepBlock>
        )}

        {step === 3 && event && (
          <StepBlock title="Matériel & paiement" direction={direction}>
            <section className="flex flex-col gap-2.5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-neutral">
                  Matériel
                </h3>
                <span className="text-[13px] font-medium leading-[18px] text-ink-muted">
                  Attribué à cette réservation
                </span>
              </div>
              {items === null ? (
                <p className="text-sm font-medium text-ink-muted">Chargement du matériel…</p>
              ) : items.length === 0 ? (
                <p className="border-[1.5px] border-dashed border-line-soft px-4 py-5 text-sm font-medium text-ink-muted">
                  Aucun matériel libre sur cette séance.
                </p>
              ) : (
                <div className="flex flex-col border-[1.5px] border-ink">
                  {items.map((item, index) => {
                    const quantity = quantities[item.id] ?? 0;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "flex items-center gap-3 py-2.5 pr-2.5 pl-3.5",
                          index > 0 && "border-t-[1.5px] border-line-soft",
                        )}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          <span className="text-[15px] font-bold leading-5 text-ink">
                            {item.name}
                          </span>
                          <span
                            className={cn(
                              "font-mono text-label font-semibold leading-4",
                              item.free - quantity <= 1 ? "text-warning" : "text-success",
                            )}
                          >
                            {item.free - quantity} libre{item.free - quantity > 1 ? "s" : ""}
                          </span>
                        </div>
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
            </section>

            {total > 0 && (
              <section className="flex flex-col gap-2.5 border-t-2 border-ink pt-4">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-neutral">
                    Paiement
                  </h3>
                  <span className="font-mono text-[15px] font-semibold leading-5 text-ink">
                    {seats} × {formatMoney(event.priceCents)} = {formatMoney(total)}
                  </span>
                </div>
                <ChoiceCards
                  name="paiement"
                  label="Paiement"
                  value={paid ? "now" : "later"}
                  onChange={(value) => setPaid(value === "now")}
                  options={[
                    {
                      value: "now",
                      label: "Payé maintenant",
                      description: "Reçu envoyé au client",
                    },
                    { value: "later", label: "À payer", description: "Lien envoyé par e-mail" },
                  ]}
                />
                {paid && (
                  <fieldset className="flex flex-wrap gap-2">
                    <legend className="sr-only">Moyen de paiement</legend>
                    {METHODS.map((entry) => (
                      <label
                        key={entry.value}
                        className={cn(
                          "flex h-10 items-center border-[1.5px] border-ink px-3.5 text-sm font-bold leading-[18px]",
                          "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                          method === entry.value
                            ? "bg-ink text-on-ink"
                            : "text-ink hover:bg-surface",
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
              </section>
            )}
          </StepBlock>
        )}
      </div>

      <aside className="sticky bottom-0 z-30 flex flex-col border-t-2 border-ink bg-bg pb-[env(safe-area-inset-bottom)] lg:static lg:w-[360px] lg:shrink-0 lg:border-t-0 lg:border-l-2 lg:bg-surface lg:pb-0">
        <div className="hidden flex-1 flex-col gap-[18px] px-7 pt-7 pb-6 lg:flex">
          <p className="font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-neutral">
            Ta saisie
          </p>
          {event ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="size-2.5 shrink-0" style={{ backgroundColor: event.color }} />
                <span className="text-[17px] font-bold leading-[22px] text-ink">{event.title}</span>
              </div>
              <span className="text-sm font-medium leading-5 text-ink-muted">
                {[`${event.date} · ${event.range}`, event.location].filter(Boolean).join(" · ")}
              </span>
            </div>
          ) : (
            <p className="text-sm font-medium text-ink-subtle">Choisis une séance.</p>
          )}
          <dl className="flex flex-col gap-[18px] border-t-[1.5px] border-line-soft pt-3.5">
            <RecapLine label="Places" value={event ? String(seats) : null} mono />
            <RecapLine label="Client" value={customerName} />
            <RecapLine
              label="Matériel"
              value={
                chosenItems.length > 0
                  ? chosenItems
                      .map(
                        ([id, quantity]) =>
                          `${items?.find((item) => item.id === id)?.name} ×${quantity}`,
                      )
                      .join(" · ")
                  : step === 3
                    ? "aucun"
                    : null
              }
              placeholder="à l'étape 3"
            />
          </dl>
          <div className="flex items-baseline justify-between border-t-2 border-ink pt-3.5">
            <span className="text-[15px] font-bold leading-5 text-ink">Total</span>
            <span className="font-mono text-[22px] font-semibold leading-7 text-ink">
              {total > 0 ? formatMoney(total) : event ? "Gratuit" : "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2.5 px-5 py-3 lg:border-t-2 lg:border-ink lg:px-7 lg:pt-5 lg:pb-7">
          <Button type="submit" pending={pending} className="w-full">
            <span className="flex w-full items-center justify-between gap-3">
              <span>{step < 3 ? "Continuer" : pending ? "Enregistrement…" : "Enregistrer"}</span>
              <span className="font-mono text-[13px] font-semibold opacity-85">
                {step === 3 && total > 0
                  ? `${formatMoney(total)} · ${paid ? "payé" : "à payer"}`
                  : "Entrée ↵"}
              </span>
            </span>
          </Button>
          {step > 1 && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setStep((step - 1) as Step);
              }}
              className="h-10 text-[15px] font-bold leading-5 text-ink underline decoration-1 underline-offset-[3px]"
            >
              ← Retour {step === 2 ? "à la séance" : "au client"}
            </button>
          )}
        </div>
      </aside>
    </form>
  );
}

function StepBlock({
  title,
  direction,
  children,
}: {
  title: string;
  direction: number;
  children: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 32 * direction }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-4"
    >
      <h2 className="font-headline text-[44px] leading-[42px] text-ink">
        <WordsReveal>{title}</WordsReveal>
      </h2>
      {children}
    </motion.div>
  );
}

/** Les trois étapes ; une étape faite affiche son résumé et permet d'y revenir. */
function Stepper({
  step,
  summaries,
  onBack,
}: {
  step: Step;
  summaries: Partial<Record<Step, string | null>>;
  onBack: (step: Step) => void;
}) {
  return (
    <ol className="flex border-2 border-ink">
      {STEPS.map((entry) => {
        const isDone = entry.step < step;
        const current = entry.step === step;
        const content = (
          <>
            {current && <ActiveIndicator id="counter-step" className="inset-0 -z-10 bg-ink" />}
            <span
              className={cn(
                "flex size-7 shrink-0 items-center justify-center font-mono text-[13px] font-semibold",
                isDone && "bg-success text-on-ink",
                current && "border-[1.5px] border-on-ink text-on-ink",
                !isDone && !current && "border-[1.5px] border-ink-subtle text-ink-subtle",
              )}
            >
              {isDone ? <Check size={12} /> : entry.step}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5 text-left">
              <span
                className={cn(
                  "truncate text-sm font-bold leading-5 sm:text-[15px]",
                  isDone ? "text-success" : current ? "text-on-ink" : "text-ink-subtle",
                )}
              >
                <span className="sm:hidden">{entry.short}</span>
                <span className="hidden sm:inline">{entry.label}</span>
              </span>
              {isDone && summaries[entry.step] && (
                <span className="hidden truncate font-mono text-label font-medium leading-4 text-success sm:block">
                  {summaries[entry.step]}
                </span>
              )}
            </span>
          </>
        );
        const className = cn(
          "relative isolate flex min-w-0 flex-1 items-center gap-2 px-2.5 py-3 transition-colors sm:gap-3 sm:px-[18px] sm:py-3.5",
          entry.step > 1 && "border-l-2 border-ink",
          isDone && "bg-success-bg",
        );
        return (
          <li
            key={entry.step}
            className="flex min-w-0 flex-1"
            aria-current={current ? "step" : undefined}
          >
            {isDone ? (
              <button
                type="button"
                onClick={() => onBack(entry.step)}
                className={cn(className, "hover:brightness-95")}
              >
                {content}
              </button>
            ) : (
              <span className={className}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function SessionTile({
  event,
  selected,
  onSelect,
}: {
  event: CounterEvent;
  selected: boolean;
  onSelect: () => void;
}) {
  const full = event.remaining === 0;
  const blocked = full && !event.waitlist;
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={blocked}
      aria-pressed={selected}
      className={cn(
        "flex items-center gap-3.5 p-3.5 text-left transition-[background-color,scale] active:scale-[0.99]",
        selected
          ? "border-[1.5px] border-ink bg-ink"
          : full
            ? "border-[1.5px] border-dashed border-line-soft"
            : "border-[1.5px] border-ink bg-surface hover:bg-bg",
      )}
    >
      <span className="flex w-14 shrink-0 flex-col gap-0.5">
        <span
          className={cn(
            "font-mono text-[17px] font-semibold leading-[22px]",
            selected ? "text-on-ink" : full ? "text-ink-muted" : "text-ink",
          )}
        >
          {event.time}
        </span>
        <span
          className={cn(
            "font-mono text-label font-medium leading-4",
            selected ? "text-on-ink/80" : "text-ink-muted",
          )}
        >
          {event.day === "later" ? event.date : event.duration}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2">
          <span className="size-2.5 shrink-0" style={{ backgroundColor: event.color }} />
          <span
            className={cn(
              "text-base font-bold leading-5",
              selected ? "text-on-ink" : full ? "text-ink-muted" : "text-ink",
            )}
          >
            {event.title}
          </span>
        </span>
        <span
          className={cn(
            "text-[13px] font-medium leading-[18px]",
            selected ? "text-on-ink/80" : "text-ink-muted",
          )}
        >
          {[event.location, event.priceCents > 0 ? formatMoney(event.priceCents) : "Gratuit"]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
      <span className="flex w-[68px] shrink-0 flex-col items-end gap-0.5">
        <span
          className={cn(
            "font-mono font-semibold",
            full ? "text-label leading-4 text-danger" : "text-[15px] leading-5",
            !full &&
              (selected
                ? "text-on-ink"
                : (event.remaining ?? 99) <= 2
                  ? "text-warning"
                  : "text-success"),
          )}
        >
          {full ? "Complet" : event.remaining === null ? "∞" : event.remaining}
        </span>
        <span
          className={cn(
            "text-label font-medium leading-4",
            selected ? "text-on-ink/80" : "text-ink-muted",
          )}
        >
          {full ? (event.waitlist ? "attente" : "") : event.remaining === 1 ? "place" : "places"}
        </span>
      </span>
    </button>
  );
}

/** Compteur − n + (places, exemplaires). */
function QuantityStepper({
  value,
  onChange,
  min,
  max,
  label = "Places",
  size = "md",
}: {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  label?: string;
  size?: "md" | "lg";
}) {
  const box =
    (size === "lg" ? "h-[52px] w-[52px] text-2xl" : "size-10 text-xl") +
    " transition-[color,background-color,scale] active:scale-90";
  // Le chiffre roule : il arrive par le bas quand on ajoute, par le haut quand on retire.
  const previous = useRef(value);
  const rise = value >= previous.current ? 1 : -1;
  useEffect(() => {
    previous.current = value;
  }, [value]);
  return (
    <div
      className={cn(
        "flex shrink-0 items-center border-ink",
        size === "lg" ? "border-2" : "border-[1.5px]",
      )}
    >
      <button
        type="button"
        aria-label={`Moins (${label})`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        className={cn(
          box,
          "flex items-center justify-center font-semibold text-ink disabled:text-ink-subtle",
        )}
      >
        −
      </button>
      <output
        aria-label={label}
        className={cn(
          "flex items-center justify-center overflow-hidden border-ink font-mono font-semibold",
          size === "lg"
            ? "h-[52px] w-14 border-x-2 text-[22px]"
            : "size-10 border-x-[1.5px] text-[17px]",
          value === 0 ? "text-ink-subtle" : "text-ink",
        )}
      >
        <motion.span
          key={value}
          initial={{ y: `${60 * rise}%`, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        >
          {value}
        </motion.span>
      </output>
      <button
        type="button"
        aria-label={`Plus (${label})`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={cn(
          box,
          "flex items-center justify-center font-semibold disabled:text-ink-subtle",
          size === "lg" ? "bg-ink text-on-ink disabled:bg-transparent" : "text-ink",
        )}
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

function RecapLine({
  label,
  value,
  placeholder = "—",
  mono = false,
}: {
  label: string;
  value: string | null;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-sm font-medium leading-5 text-ink-muted">{label}</dt>
      <motion.dd
        key={value ?? "vide"}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "text-right",
          value
            ? mono
              ? "font-mono text-[15px] font-semibold leading-5 text-ink"
              : "text-[15px] font-bold leading-5 text-ink"
            : "text-sm font-medium leading-5 text-ink-subtle",
        )}
      >
        {value ?? placeholder}
      </motion.dd>
    </div>
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
    <div className="flex max-w-[640px] flex-col gap-6 px-4 pt-6 pb-10 sm:px-10 sm:pt-7">
      <div className="flex flex-col gap-3">
        <span className="flex size-14 items-center justify-center bg-success text-on-ink">
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
        <p className="reveal font-mono text-label font-semibold uppercase leading-4 tracking-[0.055em] text-success">
          Réf. {done.reference}
        </p>
        <h2 className="font-headline text-[44px] leading-[42px] text-ink">
          <WordsReveal delay={1}>
            {done.status === "waitlisted" ? "En liste d'attente." : "C'est noté."}
          </WordsReveal>
        </h2>
      </div>
      <dl className="reveal-group flex flex-col border-[1.5px] border-ink bg-surface">
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
              <span className="font-mono text-[15px] font-semibold leading-5 text-ink">
                {formatMoney(done.amountCents)}
              </span>
            )}
            <span
              className={cn(
                "border-[1.5px] px-2 py-0.5 text-[13px] font-bold leading-[18px]",
                done.paymentStatus === "paid" || done.amountCents === 0
                  ? "border-success bg-success-bg text-success"
                  : "border-warning bg-warning-bg text-warning",
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
    <div className={cn("flex gap-3 p-3.5", !last && "border-b-[1.5px] border-line-soft")}>
      <dt className="w-[84px] shrink-0 font-mono text-label font-semibold uppercase leading-5 tracking-[0.055em] text-neutral">
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</dd>
    </div>
  );
}
