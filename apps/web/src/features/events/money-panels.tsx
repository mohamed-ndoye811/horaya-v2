import type {
  DepositModule,
  EventModules,
  PaymentMethodsModule,
  PriceOption,
  PricingModule,
  Rate,
} from "@horaya/core";
import { useState } from "react";
import { Collapse } from "@/components/motion/collapse";
import { PresenceItem, PresenceList } from "@/components/motion/presence";
import { textLinkClasses } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, inputClasses } from "@/components/ui/field";
import { PlusIcon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { centsToInput, parseEuroToCents } from "@/lib/money";

/**
 * Réglages des modules « L'argent » (lot 35) : tarifs et options, acompte, moyens acceptés.
 * Les montants saisis restent du texte le temps de la frappe (« 12, »), en centimes dans le module.
 */

type Setter = <K extends "pricing" | "deposit" | "payment_methods">(
  key: K,
  value: EventModules[K],
) => void;

/** Identifiant stable d'un tarif ou d'une option ajoutés (les réservations s'y réfèrent). */
const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

/** Champ de prix : texte libre, envoyé en centimes. */
function PriceInput({
  cents,
  onChange,
  label,
}: {
  cents: number;
  onChange: (cents: number) => void;
  label: string;
}) {
  const [text, setText] = useState(centsToInput(cents));
  return (
    <AffixInput
      aria-label={label}
      inputMode="decimal"
      value={text}
      onChange={(event) => {
        setText(event.target.value);
        onChange(parseEuroToCents(event.target.value));
      }}
      suffix="€"
      mono
    />
  );
}

const removeClasses = cn(textLinkClasses, "shrink-0 text-[13px] text-ink-muted");

export function PricingPanel({
  modules,
  set,
  itemTypes,
}: {
  modules: EventModules;
  set: Setter;
  /** Types de matériel de l'espace, pour nommer le matériel facultatif qu'une option réserve. */
  itemTypes: Array<{ id: string; name: string }>;
}) {
  const pricing: PricingModule = modules.pricing ?? { rates: [] };
  const options = pricing.options ?? [];
  // Matériel facultatif du module Matériel avancé : une option payante peut le réserver.
  const optionalNeeds = (modules.equipment?.needs ?? [])
    .filter((need) => !need.required)
    .map((need) => ({
      id: need.id,
      name: itemTypes.find((type) => type.id === need.itemTypeId)?.name ?? "Matériel",
    }));
  const defaultId = pricing.defaultRateId ?? pricing.rates[0]?.id;
  const update = (next: Partial<PricingModule>) => set("pricing", { ...pricing, ...next });
  const setRate = (id: string, patch: Partial<Rate>) =>
    update({ rates: pricing.rates.map((rate) => (rate.id === id ? { ...rate, ...patch } : rate)) });
  const setOption = (id: string, patch: Partial<PriceOption>) =>
    update({
      options: options.map((option) => (option.id === id ? { ...option, ...patch } : option)),
    });

  return (
    <>
      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold leading-[17px] text-ink">Tarifs</p>
        <ul className="relative flex flex-col gap-2.5">
          <PresenceList>
            {pricing.rates.map((rate) => (
              <PresenceItem
                as="li"
                key={rate.id}
                className="grid gap-2 rounded-xl bg-field p-2.5 sm:grid-cols-[1fr_120px_1.4fr_auto] sm:items-center"
              >
                <input
                  aria-label="Nom du tarif"
                  value={rate.name}
                  maxLength={40}
                  onChange={(event) => setRate(rate.id, { name: event.target.value })}
                  placeholder="Réduit"
                  className={inputClasses("sm")}
                />
                <PriceInput
                  label={`Prix : ${rate.name}`}
                  cents={rate.priceCents}
                  onChange={(priceCents) => setRate(rate.id, { priceCents })}
                />
                <input
                  aria-label="Pour qui"
                  value={rate.description ?? ""}
                  maxLength={120}
                  onChange={(event) =>
                    setRate(rate.id, { description: event.target.value || undefined })
                  }
                  placeholder="Pour qui : étudiant, demandeur d'emploi…"
                  className={inputClasses("sm")}
                />
                <span className="flex items-center justify-between gap-3 sm:justify-end">
                  <label className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                    <input
                      type="radio"
                      name="tarif-par-defaut"
                      checked={rate.id === defaultId}
                      onChange={() => update({ defaultRateId: rate.id })}
                      className="accent-[var(--color-ink)]"
                    />
                    Par défaut
                  </label>
                  {pricing.rates.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          rates: pricing.rates.filter((entry) => entry.id !== rate.id),
                          defaultRateId:
                            pricing.defaultRateId === rate.id ? undefined : pricing.defaultRateId,
                        })
                      }
                      className={removeClasses}
                    >
                      Retirer
                    </button>
                  )}
                </span>
              </PresenceItem>
            ))}
          </PresenceList>
        </ul>
        {pricing.rates.length < 10 && (
          <AddButton
            label="Ajouter un tarif"
            onClick={() =>
              update({ rates: [...pricing.rates, { id: newId("t"), name: "", priceCents: 0 }] })
            }
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-[13px] font-semibold leading-[17px] text-ink">Options payantes</p>
        {options.length === 0 && (
          <p className="text-[13px] leading-[18px] text-ink-muted">
            Cuisson et émaillage, déjeuner, location d'un tablier : le client les coche en
            s'inscrivant.
          </p>
        )}
        <ul className="relative flex flex-col gap-2.5">
          <PresenceList>
            {options.map((option) => (
              <PresenceItem
                as="li"
                key={option.id}
                className="grid gap-2 rounded-xl bg-field p-2.5 sm:grid-cols-[1fr_120px_1fr_96px_auto] sm:items-center"
              >
                <input
                  aria-label="Nom de l'option"
                  value={option.name}
                  maxLength={60}
                  onChange={(event) => setOption(option.id, { name: event.target.value })}
                  placeholder="Cuisson et émaillage"
                  className={inputClasses("sm")}
                />
                <PriceInput
                  label={`Prix : ${option.name}`}
                  cents={option.priceCents}
                  onChange={(priceCents) => setOption(option.id, { priceCents })}
                />
                <Select
                  aria-label="Compté"
                  variant="compact"
                  value={option.per}
                  onChange={(event) =>
                    setOption(option.id, { per: event.target.value as PriceOption["per"] })
                  }
                >
                  <option value="participant">Par participant</option>
                  <option value="booking">Par inscription</option>
                </Select>
                <AffixInput
                  aria-label="Quantité maximale"
                  inputMode="numeric"
                  disabled={option.needId !== undefined}
                  value={String(option.max ?? 1)}
                  onChange={(event) => {
                    const max = Math.trunc(Number(event.target.value));
                    setOption(option.id, {
                      max: Number.isFinite(max) && max > 1 ? max : undefined,
                    });
                  }}
                  suffix="max"
                  mono
                />
                <button
                  type="button"
                  onClick={() =>
                    update({ options: options.filter((entry) => entry.id !== option.id) })
                  }
                  className={removeClasses}
                >
                  Retirer
                </button>
                {(optionalNeeds.length > 0 || option.needId) && (
                  <Select
                    aria-label={`Matériel réservé : ${option.name}`}
                    variant="compact"
                    value={option.needId ?? ""}
                    onChange={(event) =>
                      setOption(
                        option.id,
                        event.target.value
                          ? { needId: event.target.value, max: undefined }
                          : { needId: undefined },
                      )
                    }
                    className="sm:col-span-full"
                  >
                    <option value="">Ne réserve pas de matériel</option>
                    {optionalNeeds.map((need) => (
                      <option key={need.id} value={need.id}>
                        Réserve le matériel facultatif : {need.name}
                      </option>
                    ))}
                  </Select>
                )}
              </PresenceItem>
            ))}
          </PresenceList>
        </ul>
        {options.length < 20 && (
          <AddButton
            label="Ajouter une option"
            onClick={() =>
              update({
                options: [
                  ...options,
                  { id: newId("o"), name: "", priceCents: 0, per: "participant" },
                ],
              })
            }
          />
        )}
      </div>
      <p className="text-[13px] leading-[18px] text-ink-muted">
        Chaque participant choisit son tarif. Chaque événement reprend ces tarifs et peut en changer
        les prix.
        {optionalNeeds.length > 0 &&
          " Un matériel facultatif payant passe par une option : la cocher réserve l'exemplaire."}
      </p>
    </>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 self-start text-sm font-semibold leading-[18px] text-link hover:underline"
    >
      <PlusIcon size={10} />
      {label}
    </button>
  );
}

export function DepositPanel({ modules, set }: { modules: EventModules; set: Setter }) {
  const deposit: DepositModule = modules.deposit ?? { percent: 30 };
  const fixed = deposit.amountCents !== undefined;
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Calculé">
          {(props) => (
            <Select
              {...props}
              value={fixed ? "fixed" : "percent"}
              onChange={(event) =>
                set(
                  "deposit",
                  event.target.value === "fixed"
                    ? { amountCents: 2000, balance: deposit.balance }
                    : { percent: 30, balance: deposit.balance },
                )
              }
            >
              <option value="percent">En pourcentage du total</option>
              <option value="fixed">Montant fixe par place</option>
            </Select>
          )}
        </Field>
        <Field label="Acompte">
          {(props) =>
            fixed ? (
              <PriceInput
                key="fixed"
                label="Montant par place"
                cents={deposit.amountCents ?? 0}
                onChange={(amountCents) => set("deposit", { ...deposit, amountCents })}
              />
            ) : (
              <AffixInput
                {...props}
                key="percent"
                inputMode="numeric"
                value={deposit.percent === undefined ? "" : String(deposit.percent)}
                onChange={(event) => {
                  const percent = Math.trunc(Number(event.target.value));
                  set("deposit", { ...deposit, percent: Number.isFinite(percent) ? percent : 0 });
                }}
                suffix="%"
                mono
              />
            )
          }
        </Field>
        <Field label="Le reste">
          {(props) => (
            <Select
              {...props}
              value={deposit.balance ?? "on_site"}
              onChange={(event) =>
                set("deposit", {
                  ...deposit,
                  balance: event.target.value === "later" ? "later" : "on_site",
                })
              }
            >
              <option value="on_site">Sur place</option>
              <option value="later">Plus tard, en ligne</option>
            </Select>
          )}
        </Field>
      </div>
      <p className="text-[13px] leading-[18px] text-ink-muted">
        Les nouveaux événements de ce type partent en mode « Acompte », payé en ligne à
        l'inscription avec ton lien de paiement.
      </p>
    </>
  );
}

export function PaymentMethodsPanel({
  modules,
  set,
  passPlans,
}: {
  modules: EventModules;
  set: Setter;
  passPlans: ReadonlyArray<{ id: string; name: string }>;
}) {
  const methods: PaymentMethodsModule = modules.payment_methods ?? {};
  const update = (patch: Partial<PaymentMethodsModule>) =>
    set("payment_methods", { ...methods, ...patch });
  const passes = methods.passes !== false;
  const chosen = methods.passPlanIds;
  return (
    <>
      <Switch
        checked={passes}
        onChange={(event) => update({ passes: event.target.checked ? undefined : false })}
        label="Cartes de séances"
        description="Le client règle avec une carte : une ou plusieurs séances par place."
      />
      <Collapse open={passes}>
        <div className="flex flex-col gap-4 sm:pl-[52px]">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Formules">
              {(props) => (
                <Select
                  {...props}
                  value={chosen ? "some" : "all"}
                  onChange={(event) =>
                    update({ passPlanIds: event.target.value === "some" ? [] : undefined })
                  }
                >
                  <option value="all">Toutes les formules</option>
                  <option value="some">Seulement certaines</option>
                </Select>
              )}
            </Field>
            <Field label="Séances par place">
              {(props) => (
                <AffixInput
                  {...props}
                  inputMode="numeric"
                  value={String(methods.sessionsPerSeat ?? 1)}
                  onChange={(event) => {
                    const sessions = Math.trunc(Number(event.target.value));
                    update({
                      sessionsPerSeat:
                        Number.isFinite(sessions) && sessions > 1 ? sessions : undefined,
                    });
                  }}
                  suffix="séances"
                  mono
                />
              )}
            </Field>
          </div>
          <Collapse open={chosen !== undefined}>
            <div className="flex flex-col gap-2">
              {passPlans.length === 0 ? (
                <p className="text-[13px] text-ink-muted">
                  Aucune formule de carte pour l'instant (Clients › Cartes de séances).
                </p>
              ) : (
                passPlans.map((plan) => (
                  <Checkbox
                    key={plan.id}
                    label={plan.name}
                    checked={chosen?.includes(plan.id) ?? false}
                    onChange={(event) =>
                      update({
                        passPlanIds: event.target.checked
                          ? [...(chosen ?? []), plan.id]
                          : (chosen ?? []).filter((id) => id !== plan.id),
                      })
                    }
                  />
                ))
              )}
            </div>
          </Collapse>
        </div>
      </Collapse>
      <Switch
        checked={methods.giftCards !== false}
        onChange={(event) => update({ giftCards: event.target.checked ? undefined : false })}
        label="Bons cadeaux"
        description="Le montant du bon est déduit du prix."
      />
    </>
  );
}
