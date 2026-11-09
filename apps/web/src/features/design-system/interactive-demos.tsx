import { useState } from "react";
import { Collapse, Disclosure } from "@/components/motion/collapse";
import { CountUp } from "@/components/motion/count-up";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { Swap } from "@/components/motion/swap";
import { CategorySwatch } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { AddButton, Chip, ChoiceChips } from "@/components/ui/chip";
import { ChoiceCards } from "@/components/ui/choice-cards";
import { Dialog } from "@/components/ui/dialog";
import { AffixInput, Checkbox, Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { CalendarIcon, Check, CloseIcon, PinIcon } from "@/components/ui/icons";
import { ActionMenu } from "@/components/ui/menu";
import { FormSection } from "@/components/ui/section";
import { SegmentedControl } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";

const DESCRIPTION =
  "Une journée complète dédiée à la stratégie et à la cohésion d'équipe. Au programme : ateliers en petits groupes, présentations plénières et temps d'échange.";

/** Formulaire de démonstration (écran 09) : tous les champs, sans enregistrement. */
export function FormDemo() {
  const [description, setDescription] = useState(DESCRIPTION);
  const [paymentMode, setPaymentMode] = useState("online");
  const [recurring, setRecurring] = useState(true);
  const [seats, setSeats] = useState(2);
  const [day, setDay] = useState("today");
  const [items, setItems] = useState([
    { name: "Vidéoprojecteur", meta: "Dispo", tone: "success" as const },
    { name: "Micro sans fil × 2", meta: "1 / 2 dispo", tone: "warning" as const },
  ]);

  return (
    <form
      className="flex max-w-[768px] flex-col gap-10"
      onSubmit={(event) => event.preventDefault()}
    >
      <FormSection number={1} title="Informations">
        <Field label="Titre" required>
          {(field) => (
            <input {...field} defaultValue="Séminaire annuel" className={inputClasses()} />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type d'événement" required>
            {(field) => (
              <Select
                {...field}
                defaultValue="seminaire"
                leading={<CategorySwatch color="#528D74" size={12} />}
              >
                <option value="seminaire">Séminaire</option>
                <option value="atelier">Atelier</option>
                <option value="reunion">Réunion</option>
              </Select>
            )}
          </Field>
          <Field label="Visibilité" group>
            {() => (
              <SegmentedControl
                name="visibility"
                label="Visibilité"
                defaultValue="public"
                size="md"
                segments={[
                  { value: "public", label: "Public" },
                  { value: "invite_only", label: "Sur invitation" },
                ]}
              />
            )}
          </Field>
        </div>
        <Field
          label="Description"
          aside={`${description.length} / 2000`}
          hint={
            <p className="text-meta font-medium text-ink-muted">
              Visible sur la page publique de l'événement.
            </p>
          }
        >
          {(field) => (
            <textarea
              {...field}
              maxLength={2000}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={textareaClasses()}
            />
          )}
        </Field>
      </FormSection>

      <FormSection number={2} title="Date & lieu">
        <div className="grid gap-4 sm:grid-cols-[1fr_128px_1fr_128px]">
          <Field label="Début" required>
            {(field) => (
              <AffixInput
                {...field}
                type="date"
                defaultValue="2026-06-15"
                leading={<CalendarIcon size={16} />}
              />
            )}
          </Field>
          <Field label="Heure">
            {(field) => <AffixInput {...field} type="time" defaultValue="14:00" mono />}
          </Field>
          <Field label="Fin" required>
            {(field) => (
              <AffixInput
                {...field}
                type="date"
                defaultValue="2026-06-16"
                leading={<CalendarIcon size={16} />}
              />
            )}
          </Field>
          <Field label="Heure">
            {(field) => <AffixInput {...field} type="time" defaultValue="16:30" mono />}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-line-soft bg-field px-4 py-4">
          <Switch
            checked={recurring}
            onChange={(event) => setRecurring(event.target.checked)}
            label="Événement récurrent"
            description={recurring ? "Prochaine occurrence : 17 août 2026" : "Une seule date"}
          />
          {recurring && (
            <Select variant="compact" defaultValue="2" aria-label="Fréquence" className="w-44">
              <option value="1">Tous les mois</option>
              <option value="2">Tous les 2 mois</option>
              <option value="w">Toutes les semaines</option>
            </Select>
          )}
        </div>
        <Field label="Lieu" required>
          {(field) => (
            <AffixInput
              {...field}
              defaultValue="445 rue de la Thèse, 83390 Puget-Ville"
              leading={<PinIcon size={16} />}
            />
          )}
        </Field>
      </FormSection>

      <FormSection number={3} title="Places & paiement">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de places" required>
            {(field) => (
              <AffixInput {...field} inputMode="numeric" defaultValue="50" suffix="places" mono />
            )}
          </Field>
          <Field label="Prix par personne">
            {(field) => (
              <AffixInput
                {...field}
                inputMode="decimal"
                defaultValue="120,00"
                suffix="€ TTC"
                mono
              />
            )}
          </Field>
        </div>
        <Field label="Mode de paiement" group>
          {() => (
            <ChoiceCards
              name="paymentMode"
              label="Mode de paiement"
              value={paymentMode}
              onChange={setPaymentMode}
              options={[
                { value: "free", label: "Gratuit", description: "Inscription seule" },
                { value: "online", label: "Paiement en ligne", description: "Carte via Stripe" },
                { value: "deposit", label: "Acompte", description: "Le reste sur place" },
                { value: "on_site", label: "Sur place", description: "Espèces ou carte" },
              ]}
            />
          )}
        </Field>
        <Checkbox defaultChecked label="Valider manuellement chaque réservation" />
      </FormSection>

      <FormSection number={4} title="Matériel">
        <div className="flex flex-wrap gap-2.5">
          {items.map((item) => (
            <Chip
              key={item.name}
              meta={item.meta}
              metaTone={item.tone}
              removeLabel={`Retirer ${item.name}`}
              onRemove={() =>
                setItems((current) => current.filter((entry) => entry.name !== item.name))
              }
            >
              {item.name}
            </Chip>
          ))}
          <AddButton>Ajouter du matériel</AddButton>
          <AddButton size="sm">Ajouter (sm)</AddButton>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Stepper value={seats} onChange={setSeats} min={1} max={6} label="Places" />
          <SegmentedControl
            name="day"
            label="Jour"
            size="xs"
            fill={false}
            value={day}
            onChange={setDay}
            segments={[
              { value: "today", label: "Auj." },
              { value: "tomorrow", label: "Demain" },
              { value: "week", label: "Semaine" },
            ]}
          />
          <div className="w-28">
            <input
              aria-label="Code couleur"
              defaultValue="#B4532A"
              className={inputClasses("sm")}
            />
          </div>
        </div>
        <Field label="Adresse de la page publique" error="Cette adresse est déjà prise.">
          {(field) => (
            <AffixInput {...field} prefix="horaya.app/" defaultValue="atelier-lune" mono />
          )}
        </Field>
      </FormSection>
    </form>
  );
}

const REASONS = ["Atelier complet", "Profil non adapté", "Événement annulé", "Autre…"];

/** Panneau de refus (écran 17) + fenêtre modale + menu d'actions. */
export function InteractionDemo() {
  const [reason, setReason] = useState<string | null>(REASONS[0] ?? null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [compactOpen, setCompactOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="flex flex-col gap-4 border-[1.5px] border-dashed border-danger bg-bg p-5">
        <p className="text-ui font-bold text-danger">Si tu refuses : motif envoyé à la cliente</p>
        <ChoiceChips
          label="Motif du refus"
          name="refusalReason"
          options={REASONS}
          value={reason}
          onChange={setReason}
        />
        <textarea
          aria-label="Mot personnel"
          placeholder="Ajouter un mot personnel (facultatif)…"
          className={textareaClasses()}
          rows={2}
        />
        <p className="text-meta font-medium text-danger">
          La pré-autorisation de 35 € sera libérée immédiatement, aucun débit.
        </p>
      </div>

      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="danger"
            icon={<CloseIcon size={12} />}
            onClick={() => setDialogOpen(true)}
          >
            Refuser
          </Button>
          <Button variant="success" icon={<Check />}>
            Valider la réservation
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setCompactOpen(true)}>
            Fenêtre compacte
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <IconButton label="Valider" variant="approve">
            <Check size={14} />
          </IconButton>
          <IconButton label="Refuser" variant="refuse">
            <CloseIcon size={12} />
          </IconButton>
          <ActionMenu
            label="Actions de la réservation"
            items={[
              {
                label: "Voir la réservation",
                onSelect: () => setLastAction("Voir la réservation"),
              },
              {
                label: "Renvoyer la confirmation",
                onSelect: () => setLastAction("Renvoyer la confirmation"),
              },
              {
                label: "Annuler la réservation",
                tone: "danger",
                onSelect: () => setDialogOpen(true),
              },
            ]}
          />
          {lastAction && (
            <span className="text-sm font-semibold text-ink-muted">→ {lastAction}</span>
          )}
        </div>
      </div>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Refuser la demande ?"
        description="Léa Fontaine sera prévenue par e-mail avec le motif choisi."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDialogOpen(false)}>
              Garder la demande
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setDialogOpen(false);
                setLastAction(`Refusée : ${reason ?? "sans motif"}`);
              }}
            >
              Refuser
            </Button>
          </>
        }
      >
        <p className="text-ui font-medium leading-6 text-ink">
          Motif : <strong>{reason ?? "aucun"}</strong>. La pré-autorisation de 35 € est libérée
          immédiatement.
        </p>
      </Dialog>

      {/* Fenêtre d'édition dense (règle « si… alors… ») : `density="compact"`, lignes de 36 px. */}
      <Dialog
        open={compactOpen}
        onClose={() => setCompactOpen(false)}
        density="compact"
        size="lg"
        title="Nouvelle règle"
        description="Cours de tournage · règle 1 sur 1"
        footer={
          <Button size="sm" onClick={() => setCompactOpen(false)}>
            Enregistrer
          </Button>
        }
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <Select variant="dense" aria-label="Information testée" className="min-w-40 flex-1">
            <option>Participant · Âge</option>
          </Select>
          <Select variant="dense" aria-label="Comparaison" className="min-w-36">
            <option>est inférieur à</option>
          </Select>
          <div className="w-[72px]">
            <input aria-label="Valeur" defaultValue="16" className={inputClasses("xs")} />
          </div>
          <IconButton label="Retirer la condition">
            <CloseIcon size={10} />
          </IconButton>
        </div>
      </Dialog>
    </div>
  );
}

/**
 * Mouvement (lot 33) : les briques de `components/motion/`. Une courbe, des durées courtes ;
 * tout est coupé par `prefers-reduced-motion`.
 */
export function MotionDemo() {
  const [open, setOpen] = useState(false);
  const [absent, setAbsent] = useState(false);
  const [balance, setBalance] = useState(120);
  const [rows, setRows] = useState(["Niveau", "Allergies", "Matériel perso"]);
  return (
    <div className="grid max-w-[900px] gap-6 md:grid-cols-2">
      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
        <p className="text-sm font-bold text-ink">
          Collapse et Disclosure : ouvrir / fermer en hauteur
        </p>
        <Button variant="secondary" size="xs" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Masquer" : "Voir les séances"}
        </Button>
        <Collapse open={open}>
          <p className="rounded-2xl bg-field p-4 text-sm text-ink-muted">
            Le contenu apparaît sans saut, les éléments dessous suivent.
          </p>
        </Collapse>
        <Disclosure
          summary={(isOpen) => (isOpen ? "Masquer le journal" : "Journal (3)")}
          summaryClassName="w-fit text-meta font-semibold text-ink-muted hover:text-ink"
        >
          <p className="pt-2 text-sm text-ink-muted">
            Remplace les &lt;details&gt;, qui ne s'animent pas.
          </p>
        </Disclosure>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
        <p className="text-sm font-bold text-ink">PresenceList : ajouter, retirer, réordonner</p>
        <ul className="relative flex flex-col gap-2">
          <PresenceList>
            {rows.map((row) => (
              <PresenceItem
                as="li"
                key={row}
                className="flex items-center justify-between rounded-xl bg-field px-3 py-2 text-sm font-semibold text-ink"
              >
                {row}
                <button
                  type="button"
                  className="text-meta text-danger"
                  onClick={() => setRows(rows.filter((entry) => entry !== row))}
                >
                  Retirer
                </button>
              </PresenceItem>
            ))}
          </PresenceList>
        </ul>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            size="xs"
            onClick={() => setRows([...rows, `Question ${rows.length + 1}`])}
          >
            Ajouter
          </Button>
          <Button variant="secondary" size="xs" onClick={() => setRows([...rows].reverse())}>
            Inverser
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
        <p className="text-sm font-bold text-ink">Swap : changement d'état</p>
        <div className="flex items-center gap-3">
          <StatusBadge tone={absent ? "neutral" : "success"}>
            {absent ? "Absence signalée" : "Confirmée"}
          </StatusBadge>
          <Button variant="secondary" size="xs" onClick={() => setAbsent(!absent)}>
            <Swap value={String(absent)}>{absent ? "Annuler l'absence" : "Je serai absent·e"}</Swap>
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-3xl bg-surface p-5">
        <p className="text-sm font-bold text-ink">CountUp : un montant qui défile</p>
        <p className="text-[40px] font-semibold leading-[44px] tracking-[-0.03em] text-ink">
          <CountUp key={balance} value={`${balance} €`} />
        </p>
        <Button variant="secondary" size="xs" onClick={() => setBalance(balance + 40)}>
          Ajouter 40 €
        </Button>
      </div>
    </div>
  );
}
