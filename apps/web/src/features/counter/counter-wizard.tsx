import {
  type CounterBookingInput,
  type EventTypeField,
  fieldsOfScope,
  type PaymentMethod,
} from "@horaya/core";
import { type FormEvent, type ReactNode, useEffect, useRef, useState, useTransition } from "react";
import { FieldInputs } from "@/components/app/field-inputs";
import { WordsReveal } from "@/components/motion/words";
import { ActionBar } from "@/components/ui/action-bar";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button, ButtonLink, IconButton, textLinkSmClasses } from "@/components/ui/button";
import { AddButton } from "@/components/ui/chip";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { CloseIcon } from "@/components/ui/icons";
import { SearchInput } from "@/components/ui/search-input";
import { dashedClasses, inkCardClasses } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Stepper } from "@/components/ui/stepper";
import { createCounterEnrollmentAction } from "@/functions/enrollments";
import { counterPassesAction } from "@/functions/passes";
import {
  type CounterResult,
  counterItemsAction,
  createCounterBookingAction,
  searchCounterCustomersAction,
} from "@/functions/reservations";
import { cn } from "@/lib/cn";
import { CATEGORY_COLORS } from "@/lib/colors";
import { meshCover, seedOf } from "@/lib/cover";
import { rawFieldValues } from "@/lib/fields";
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
  /** Cours à l'année : prix de l'inscription à toute la série, si elle est ouverte. */
  seriesId: string | null;
  enrollmentPriceCents: number | null;
  /** « Ce que tu demandes » : questions une fois et par participant. */
  fields: EventTypeField[];
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
  photoUrl: string | null;
  free: number;
  onEvent: number;
}

/** `sessions` : inscription à toute la série (nombre de séances réservées). */
type Done = Extract<CounterResult, { ok: true }> & { sessions?: number };

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

const EMPTY_CONTACT = { firstName: "", lastName: "", phone: "", email: "" };

/** Réponses saisies au comptoir : questions une fois, puis une ligne par place. */
function answersOf(form: FormData, seats: number) {
  return {
    answers: rawFieldValues(form, "a."),
    participants: Array.from({ length: seats }, (_, index) => ({
      firstName: String(form.get(`p${index}.firstName`) ?? ""),
      lastName: String(form.get(`p${index}.lastName`) ?? ""),
      email: null,
      answers: rawFieldValues(form, `p${index}.`),
    })),
  };
}

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
  const [passes, setPasses] = useState<
    Array<{ id: string; name: string; balance: number; expiresAt: string }>
  >([]);
  const [passId, setPassId] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod>("card");
  const [giftCode, setGiftCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<Done | null>(null);
  const [wholeSeries, setWholeSeries] = useState(false);
  const [pending, startTransition] = useTransition();

  const event = events.find((entry) => entry.id === eventId);
  // Inscription à toute la série : une place par séance restante, au prix de la série.
  const enrolling = wholeSeries && event?.enrollmentPriceCents != null;
  const total = enrolling ? (event?.enrollmentPriceCents ?? 0) : (event?.priceCents ?? 0) * seats;
  const full = event?.remaining !== null && event !== undefined && seats > (event.remaining ?? 0);
  // Questions du type (pas pour l'inscription à toute la série, qui n'en pose pas).
  const asking = Boolean(event && !enrolling && event.fields.length > 0);
  const participantFields = fieldsOfScope(event?.fields ?? [], "participant");
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

  // Cartes de séances utilisables par le client pour cette séance.
  const customerId = customer?.id;
  useEffect(() => {
    setPassId(null);
    setPasses([]);
    if (customerId && eventId) counterPassesAction(customerId, eventId).then(setPasses);
  }, [customerId, eventId]);

  function blocking(): string | null {
    if (!event) return "Choisis une séance.";
    if (full && !event.waitlist && !enrolling)
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
    const who = customer ? { customerId: customer.id } : { customer: contact };
    if (enrolling) {
      startTransition(async () => {
        const result = await createCounterEnrollmentAction({
          seriesId: event?.seriesId ?? "",
          ...who,
          paid: total > 0 && paid,
        });
        if (result.ok) {
          setDone({
            ok: true,
            bookingId: "",
            reference: "",
            status: "confirmed",
            paymentStatus: result.paid ? "paid" : "none",
            amountCents: result.amountCents,
            items: [],
            sessions: result.sessions,
          });
          return;
        }
        setError(result.error ?? "L'inscription n'a pas pu être enregistrée.");
        setFieldErrors(result.fieldErrors ?? {});
        if (result.fieldErrors?.customer) setCreating(true);
      });
      return;
    }
    const input: CounterBookingInput = {
      eventId,
      seats,
      ...who,
      items: chosenItems.map(([itemId, quantity]) => ({ itemId, quantity })),
      paid: total > 0 && paid && !passId,
      paymentMethod: total > 0 && paid && !passId ? method : null,
      passId: total > 0 ? passId : null,
      giftCardCode: total > 0 && !passId ? giftCode.trim() || null : null,
      ...answersOf(new FormData(formEvent.currentTarget as HTMLFormElement), seats),
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
    setWholeSeries(false);
    setCustomer(null);
    setCreating(false);
    setContact(EMPTY_CONTACT);
    setSearch("");
    setSessionSearch("");
    setGiftCode("");
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
        method={paid && !done.sessions ? method : null}
        onRestart={restart}
      />
    );
  }

  const paymentLabel =
    total === 0
      ? event
        ? "Gratuit"
        : null
      : passId
        ? "Payé avec la carte"
        : paid
          ? enrolling
            ? "Payé sur place"
            : `Payé · ${METHODS.find((entry) => entry.value === method)?.label.toLowerCase()}`
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
            // Pendant une recherche, aucun jour n'est choisi : elle parcourt tous les jours.
            <SegmentedControl
              size="xs"
              fill={false}
              name="jour"
              label="Jour de la séance"
              segments={DAYS}
              value={needle ? "" : day}
              onChange={(value) => {
                setDay(value as CounterEvent["day"]);
                setSessionSearch("");
              }}
            />
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
                  setWholeSeries(false);
                }}
              />
            ))}
            {sessions.length === 0 && (
              <p
                className={cn(
                  dashedClasses,
                  "rounded-[14px] px-4 py-5 text-center text-sm text-ink-muted",
                )}
              >
                {needle ? "Aucune séance ne correspond." : "Aucune séance ce jour-là."}
              </p>
            )}
          </div>
          {event?.enrollmentPriceCents != null && (
            <OptionCards
              legend="Réserver"
              value={wholeSeries}
              onChange={(value) => {
                setWholeSeries(value);
                setSeats(1);
              }}
              options={[
                {
                  value: false,
                  label: "Cette séance",
                  detail:
                    event.priceCents > 0 ? `${formatMoney(event.priceCents)} / pers.` : "Gratuit",
                },
                {
                  value: true,
                  label: "Toute la série",
                  detail: `${formatMoney(event.enrollmentPriceCents)} · une place à chaque séance restante`,
                },
              ]}
            />
          )}
        </Section>

        <Section
          number={2}
          title="Client"
          aside={
            !customer && (
              <button
                type="button"
                onClick={() => setCreating(!creating)}
                className={textLinkSmClasses}
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
              <Button variant="secondary" size="xs" onClick={() => setCustomer(null)}>
                Changer
              </Button>
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
          {seats > 1 && !asking && (
            <p className="text-xs leading-4 text-ink-subtle">
              {seats === 2
                ? "Participant 2 : tu pourras compléter son nom plus tard."
                : `Participants 2 à ${seats} : tu pourras compléter leurs noms plus tard.`}
            </p>
          )}
        </Section>

        {asking && event && (
          // Questions du type : rien n'est requis au comptoir, l'équipe note ce qu'elle sait.
          <Section key={event.id} number={3} title="Questions">
            <FieldInputs
              fields={fieldsOfScope(event.fields, "booking")}
              prefix="a."
              errorPrefix="answers."
              errors={fieldErrors}
              enforceRequired={false}
            />
            {participantFields.length > 0 &&
              Array.from({ length: seats }, (_, index) => (
                <fieldset
                  // biome-ignore lint/suspicious/noArrayIndexKey: une place = un participant, dans l'ordre.
                  key={index}
                  className="flex flex-col gap-3 rounded-2xl bg-field p-4"
                >
                  <legend className="sr-only">Participant {index + 1}</legend>
                  <p className="text-sm font-bold leading-[18px] text-ink">
                    Participant {index + 1}
                    {index === 0 && customerName ? ` · ${customerName}` : ""}
                  </p>
                  {index > 0 && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        name={`p${index}.firstName`}
                        aria-label={`Prénom du participant ${index + 1}`}
                        placeholder="Prénom"
                        maxLength={60}
                        className={inputClasses("sm")}
                      />
                      <input
                        name={`p${index}.lastName`}
                        aria-label={`Nom du participant ${index + 1}`}
                        placeholder="Nom"
                        maxLength={60}
                        className={inputClasses("sm")}
                      />
                    </div>
                  )}
                  <FieldInputs
                    fields={participantFields}
                    prefix={`p${index}.`}
                    errorPrefix={`participants.${index}.answers.`}
                    errors={fieldErrors}
                    enforceRequired={false}
                  />
                </fieldset>
              ))}
          </Section>
        )}

        <Section number={asking ? 4 : 3} title={enrolling ? "Paiement" : "Matériel et paiement"}>
          <div className={cn("flex flex-wrap gap-2", enrolling && "hidden")}>
            {chosenItems.map(([id, quantity]) => (
              <span
                key={id}
                className="flex h-9 items-center gap-2 rounded-full bg-field pr-0.5 pl-3 text-[13px] font-semibold leading-4 text-ink"
              >
                {itemName(id)} ×{quantity}
                {/* 32 px dans la pastille, zone de toucher agrandie à 48 px de haut. */}
                <IconButton
                  label={`Retirer ${itemName(id)}`}
                  size="sm"
                  className="tap-area"
                  onClick={() => setQuantities({ ...quantities, [id]: 0 })}
                >
                  <CloseIcon size={10} />
                </IconButton>
              </span>
            ))}
            <AddButton
              size="sm"
              icon={Boolean(items?.length)}
              disabled={!event || items === null || items.length === 0}
              aria-expanded={pickingItems}
              onClick={() => setPickingItems(!pickingItems)}
            >
              {!event
                ? "Choisis d'abord une séance"
                : items === null
                  ? "Chargement du matériel…"
                  : items.length === 0
                    ? "Aucun matériel libre sur cette séance"
                    : "Ajouter du matériel"}
            </AddButton>
          </div>
          {pickingItems && items && items.length > 0 && (
            // Cartes du matériel : choisies, elles prennent le contour noir des séances.
            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {items.map((item) => {
                const quantity = quantities[item.id] ?? 0;
                const left = item.free - quantity;
                // Photo de l'article, sinon un dégradé de l'app ; même teinte sombre que meshCover.
                const color =
                  CATEGORY_COLORS[seedOf(item.id) % CATEGORY_COLORS.length] ?? "#528d74";
                const shade = `oklch(from ${color} 0.2 calc(c * 0.5) h)`;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "relative isolate flex min-h-32 flex-col justify-between gap-4 overflow-hidden rounded-[20px] bg-cover bg-center p-4 text-on-ink",
                      quantity > 0 && "ring-2 ring-accent ring-offset-2",
                    )}
                    style={
                      item.photoUrl
                        ? { backgroundColor: shade, backgroundImage: `url(${item.photoUrl})` }
                        : meshCover(color, item.id)
                    }
                  >
                    {/* Côté du nom : la teinte sombre de l'image, qui s'y fond vers la droite. */}
                    <div
                      aria-hidden="true"
                      className="absolute inset-0 -z-10"
                      style={{
                        backgroundImage: `linear-gradient(to right, ${shade} 35%, transparent 85%)`,
                      }}
                    />
                    <div className="flex justify-end">
                      <StatusBadge tone={left <= 1 ? "warning" : "success"}>
                        {left} libre{left > 1 ? "s" : ""}
                      </StatusBadge>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="line-clamp-2 min-w-0 text-base font-semibold leading-5">
                        {item.name}
                      </span>
                      <Stepper
                        value={quantity}
                        min={0}
                        max={item.free}
                        label={item.name}
                        onChange={(next) => setQuantities({ ...quantities, [item.id]: next })}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {total > 0 && passes.length > 0 && (
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 text-[13px] font-semibold text-ink">
                Régler avec une carte de séances
              </legend>
              {passes.map((entry) => {
                const enough = entry.balance >= seats;
                return (
                  <label
                    key={entry.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-[14px] px-3 py-2.5",
                      "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                      passId === entry.id ? "bg-ink" : "border border-line hover:bg-field",
                      !enough && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={passId === entry.id}
                      disabled={!enough}
                      onChange={() => setPassId(passId === entry.id ? null : entry.id)}
                      className="sr-only"
                    />
                    <span
                      className={cn(
                        "text-[13px] font-semibold leading-4",
                        passId === entry.id ? "text-on-ink" : "text-ink",
                      )}
                    >
                      {entry.name}
                    </span>
                    <span
                      className={cn(
                        "text-[11px] leading-[14px]",
                        passId === entry.id ? "text-on-ink-muted" : "text-ink-subtle",
                      )}
                    >
                      {entry.balance} séance{entry.balance > 1 ? "s" : ""} · {seats} utilisée
                      {seats > 1 ? "s" : ""}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          )}
          {total > 0 && !passId && (
            <>
              {!enrolling && (
                <Field
                  label="Bon cadeau"
                  error={fieldErrors.giftCardCode}
                  hint={
                    <p className="text-xs leading-4 text-ink-subtle">
                      Le montant du bon est déduit ; le reste se paie normalement.
                    </p>
                  }
                >
                  {(field) => (
                    <input
                      {...field}
                      value={giftCode}
                      onChange={(event) => setGiftCode(event.target.value)}
                      maxLength={40}
                      autoComplete="off"
                      spellCheck={false}
                      placeholder="TERRE-8K2F"
                      className={cn(inputClasses(), "font-mono uppercase placeholder:normal-case")}
                    />
                  )}
                </Field>
              )}
              <OptionCards
                legend="Paiement"
                value={paid}
                onChange={setPaid}
                options={[
                  {
                    value: true,
                    label: "Payé sur place",
                    detail: "Espèces, carte, chèque ou virement",
                  },
                  { value: false, label: "À payer", detail: "Lien envoyé avec la confirmation" },
                ]}
              />
              {paid && !enrolling && (
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

      <aside
        className={cn(
          inkCardClasses,
          "flex w-full shrink-0 flex-col justify-between gap-6 rounded-3xl p-[22px] lg:sticky lg:top-[62px] lg:w-[360px] lg:self-start",
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="font-mono text-[11px] font-semibold leading-[14px] tracking-[0.06em] text-ink-subtle">
              TA SAISIE
            </p>
            <button
              type="button"
              onClick={restart}
              className="tap-area text-xs font-semibold text-on-ink-muted hover:text-on-ink"
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
                <p className="text-lg font-semibold leading-[22px] text-on-ink">{event.title}</p>
                <p className="text-[13px] leading-[18px] text-on-ink-muted">
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
            <p className="text-sm text-on-ink-muted">Choisis une séance.</p>
          )}
          <dl className="flex flex-col border-t border-ink-line">
            {enrolling ? (
              <SummaryLine label="Toute la série" value={formatMoney(total)} />
            ) : (
              <SummaryLine
                label={
                  event && event.priceCents > 0
                    ? `${seats} place${seats > 1 ? "s" : ""} × ${formatMoney(event.priceCents)}`
                    : "Places"
                }
                value={event ? (total > 0 ? formatMoney(total) : String(seats)) : null}
              />
            )}
            {chosenItems.map(([id, quantity]) => (
              <SummaryLine key={id} label={`${itemName(id)} ×${quantity}`} value="attribué" />
            ))}
            <SummaryLine label="Client" value={customerName} />
            <SummaryLine
              label="Paiement"
              value={paymentLabel}
              accent={total > 0 && !paid && !passId}
            />
          </dl>
        </div>
        <div className="flex flex-col gap-3.5">
          <div className="flex items-end justify-between border-t border-ink-line pt-3.5">
            <span className="text-[13px] leading-4 text-on-ink-muted">Total</span>
            <span className="text-[40px] font-medium leading-[42px] tracking-[-0.03em] text-on-ink">
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
          {/* Sur mobile, le bouton est dans la barre collée en bas (ActionBar ci-dessous). */}
          <div className="hidden flex-col gap-3.5 lg:flex">
            <Button type="submit" variant="inverse" size="lg" pending={pending}>
              {pending
                ? "Enregistrement…"
                : enrolling
                  ? "Enregistrer l'inscription"
                  : "Enregistrer la réservation"}
            </Button>
            <p className="text-center text-xs leading-4 text-ink-muted">ou ⌘ Entrée</p>
          </div>
        </div>
      </aside>

      {/* Mobile : total et enregistrement toujours à portée, en bas de l'écran (pas d'onglets ici). */}
      <div className="lg:hidden">
        <ActionBar
          message={
            <>
              Total <strong>{total > 0 ? formatMoney(total) : event ? "Gratuit" : "—"}</strong>
              {paymentLabel && total > 0 ? ` · ${paymentLabel}` : ""}
            </>
          }
        >
          <Button type="submit" variant="inverse" pending={pending}>
            {pending
              ? "Enregistrement…"
              : enrolling
                ? "Enregistrer l'inscription"
                : "Enregistrer la réservation"}
          </Button>
        </ActionBar>
      </div>
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
    <section className="flex flex-col gap-3 border-t border-line-faint px-5 py-5 first:border-t-0 sm:px-6">
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

/** Deux choix en cartes (séance ou série, payé ou à payer) : la carte choisie passe en noir. */
function OptionCards({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: boolean;
  onChange: (value: boolean) => void;
  options: Array<{ value: boolean; label: string; detail: string }>;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">{legend}</legend>
      {options.map((option) => (
        <label
          key={option.label}
          className={cn(
            "flex flex-col gap-0.5 rounded-[14px] px-3 py-2.5",
            "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
            value === option.value ? "bg-ink" : "border border-line hover:bg-field",
          )}
        >
          <input
            type="radio"
            name={legend}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="sr-only"
          />
          <span
            className={cn(
              "text-[13px] font-semibold leading-4",
              value === option.value ? "text-on-ink" : "text-ink",
            )}
          >
            {option.label}
          </span>
          <span
            className={cn(
              "text-[11px] leading-[14px]",
              value === option.value ? "text-on-ink-muted" : "text-ink-subtle",
            )}
          >
            {option.detail}
          </span>
        </label>
      ))}
    </fieldset>
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
        <Stepper value={seats} onChange={onSeats} min={1} max={99} label="Places" />
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
            <StatusBadge tone="info" size="sm">
              attente
            </StatusBadge>
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
      <dt className="truncate text-[13px] leading-4 text-on-ink-muted">{label}</dt>
      <dd
        className={cn(
          "truncate text-sm font-semibold leading-[18px]",
          value ? (accent ? "text-accent" : "text-on-ink") : "text-ink-muted",
        )}
      >
        {value ?? "—"}
      </dd>
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
  const withPass = done.paymentStatus === "paid_with_pass";
  const paidLabel =
    done.amountCents === 0
      ? "Gratuit"
      : withPass
        ? "Payée avec la carte"
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
          {done.sessions ? "Inscription au trimestre" : `Réf. ${done.reference}`}
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
            {customerName} ·{" "}
            {done.sessions
              ? `${done.sessions} séance${done.sessions > 1 ? "s" : ""}`
              : `${seats} place${seats > 1 ? "s" : ""}`}
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
            <StatusBadge
              tone={
                done.paymentStatus === "paid" || withPass || done.amountCents === 0
                  ? "success"
                  : "warning"
              }
            >
              {paidLabel}
            </StatusBadge>
          </span>
        </DoneRow>
      </dl>
      <div className="flex flex-col gap-2.5 sm:flex-row">
        <Button onClick={onRestart} arrow>
          Nouvelle saisie
        </Button>
        {done.sessions ? (
          <ButtonLink href={`/app/evenements/${event.id}?onglet=serie`} variant="secondary">
            Voir les inscrits
          </ButtonLink>
        ) : (
          <ButtonLink href={`/app/reservations/${done.bookingId}`} variant="secondary">
            Voir la réservation
          </ButtonLink>
        )}
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
    <div className={cn("flex gap-3 p-3.5", !last && "border-b border-line-faint")}>
      <dt className="w-[84px] shrink-0 text-sm leading-5 text-ink-subtle">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</dd>
    </div>
  );
}
