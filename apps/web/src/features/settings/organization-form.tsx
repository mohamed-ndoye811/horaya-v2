import { DISPLAY_FONTS } from "@horaya/core";
import { useEffect, useState } from "react";
import { useImageUpload } from "@/components/app/image-upload";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Check } from "@/components/ui/icons";
import { FormSection } from "@/components/ui/section";
import { checkWorkspaceSlug, saveOrganizationAction } from "@/functions/settings";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import type { SlugCheck } from "@/server/settings";

/** Couleurs proposées (écran 24) ; toute couleur hexadécimale reste possible. */
const PRESETS = ["#528D74", "#264489", "#66537C", "#CF879C", "#B4532A"];

const FONT_CLASSES: Record<string, string> = {
  display: "font-headline",
  ui: "font-ui font-extrabold",
  mono: "font-mono font-bold",
};

interface PreviewEvent {
  id: string;
  title: string;
  month: string;
  day: string;
  price: string;
}

export function OrganizationForm({
  editable,
  initial,
  events,
}: {
  editable: boolean;
  initial: {
    name: string;
    slug: string;
    logo: string | null;
    brandColor: string;
    displayFont: string;
    description: string;
    contactEmail: string;
    contactPhone: string;
    address: string;
    legalName: string;
    siret: string;
  };
  events: PreviewEvent[];
}) {
  const { state, onSubmit } = useFormAction<FormState>(saveOrganizationAction, {});
  const errors = state.fieldErrors ?? {};
  const [name, setName] = useState(initial.name);
  const [slug, setSlug] = useState(initial.slug);
  const [color, setColor] = useState(initial.brandColor);
  const [hex, setHex] = useState(initial.brandColor);
  const [font, setFont] = useState(initial.displayFont);
  const [description, setDescription] = useState(initial.description);
  const [slugCheck, setSlugCheck] = useState<SlugCheck | null>({ state: "current" });

  // Vérifie l'adresse 400 ms après la dernière frappe.
  useEffect(() => {
    if (!editable) return;
    setSlugCheck(null);
    const timer = setTimeout(() => checkWorkspaceSlug(slug).then(setSlugCheck), 400);
    return () => clearTimeout(timer);
  }, [slug, editable]);

  const pickColor = (value: string) => {
    setColor(value);
    setHex(value);
  };
  const initial0 = (name.trim()[0] ?? "?").toUpperCase();
  const onColor = textOn(color);

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
      <form
        id="organization-form"
        onSubmit={onSubmit}
        className="flex min-w-0 flex-1 flex-col gap-4"
      >
        {state.error && <FormAlert>{state.error}</FormAlert>}
        {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
        {!editable && (
          <FormAlert tone="info">
            Seuls le propriétaire et les admins peuvent modifier ces réglages.
          </FormAlert>
        )}
        <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-4">
          <FormSection number={1} title="Identité">
            <div className="flex gap-5">
              <div className="hidden flex-col items-center gap-2 sm:flex">
                {initial.logo ? (
                  <img
                    src={initial.logo}
                    alt=""
                    className="size-[72px] shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <span
                    aria-hidden="true"
                    className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl font-headline text-[34px] leading-10"
                    style={{ backgroundColor: color, color: onColor }}
                  >
                    {initial0}
                  </span>
                )}
                <span className="text-xs leading-4 text-ink-subtle">Logo</span>
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-4">
                <Field label="Nom de l'organisation" required error={errors.name}>
                  {(field) => (
                    <input
                      {...field}
                      name="name"
                      required
                      maxLength={80}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      className={inputClasses()}
                    />
                  )}
                </Field>
                <Field label="Adresse de la page publique" error={errors.slug}>
                  {(field) => (
                    <div
                      className={cn(
                        "flex h-11 overflow-hidden rounded-xl border bg-field focus-within:border-ink",
                        errors.slug ||
                          slugCheck?.state === "taken" ||
                          slugCheck?.state === "invalid"
                          ? "border-danger"
                          : "border-line-soft",
                      )}
                    >
                      <span className="flex shrink-0 items-center border-r border-line-soft bg-[#efefec] px-3.5 text-sm text-ink-subtle">
                        horaya.app/
                      </span>
                      <span className="flex min-w-0 flex-1 items-center gap-3 px-3.5">
                        <input
                          {...field}
                          name="slug"
                          required
                          maxLength={48}
                          value={slug}
                          onChange={(event) =>
                            setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"))
                          }
                          className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm text-ink outline-none"
                        />
                        <SlugStatus check={slugCheck} />
                      </span>
                    </div>
                  )}
                </Field>
              </div>
            </div>
            <LogoActions logo={initial.logo} />
            <Field
              label="Présentation"
              error={errors.description}
              hint={
                <p className="text-[13px] font-medium text-ink-muted">
                  Une phrase en haut de ta page publique.
                </p>
              }
            >
              {(field) => (
                <textarea
                  {...field}
                  name="description"
                  rows={2}
                  maxLength={280}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Séminaires et ateliers pour les équipes, à Puget-Ville."
                  className={textareaClasses()}
                />
              )}
            </Field>
          </FormSection>

          <FormSection number={2} title="Marque">
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[13px] font-semibold text-ink">
                Couleur de marque
              </legend>
              <div className="flex flex-wrap items-center gap-3">
                {PRESETS.map((preset) => {
                  const selected = preset.toUpperCase() === color.toUpperCase();
                  return (
                    <label
                      key={preset}
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl",
                        selected && "outline-2 outline-offset-[3px] outline-ink",
                      )}
                      style={{ backgroundColor: preset, color: textOn(preset) }}
                    >
                      <input
                        type="radio"
                        name="brandColorPreset"
                        value={preset}
                        checked={selected}
                        onChange={() => pickColor(preset)}
                        aria-label={`Couleur ${preset}`}
                        className="sr-only"
                      />
                      {selected && <Check size={16} />}
                    </label>
                  );
                })}
                <input
                  aria-label="Couleur hexadécimale"
                  value={hex}
                  maxLength={7}
                  onChange={(event) => {
                    const value = event.target.value.startsWith("#")
                      ? event.target.value
                      : `#${event.target.value}`;
                    setHex(value.toUpperCase());
                    if (/^#[0-9A-Fa-f]{6}$/.test(value)) setColor(value.toUpperCase());
                  }}
                  className="ml-2 h-10 w-[110px] rounded-xl border border-line-soft bg-field px-3.5 font-mono text-sm uppercase text-ink outline-none focus:border-ink"
                />
                <input type="hidden" name="brandColor" value={color} />
              </div>
              {errors.brandColor && (
                <p className="text-[13px] font-semibold text-danger">{errors.brandColor}</p>
              )}
            </fieldset>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-[13px] font-semibold text-ink">
                Police d'affichage
              </legend>
              <div className="grid gap-3 sm:grid-cols-3">
                {DISPLAY_FONTS.map((option) => {
                  const selected = option.value === font;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex h-[60px] items-center gap-3 rounded-2xl border px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink",
                        selected
                          ? "border-ink bg-ink text-on-ink"
                          : "border-line-soft text-ink hover:bg-field",
                      )}
                    >
                      <input
                        type="radio"
                        name="displayFont"
                        value={option.value}
                        checked={selected}
                        onChange={() => setFont(option.value)}
                        className="sr-only"
                      />
                      <span className={cn("text-[26px] leading-8", FONT_CLASSES[option.value])}>
                        Aa
                      </span>
                      <span className="text-[13px] font-medium">
                        {option.label} · {option.tone}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </FormSection>

          <FormSection number={3} title="Coordonnées & mentions légales">
            <p className="-mt-1 text-[13px] font-medium leading-[18px] text-ink-muted">
              Affichées en bas de ta page publique (« Contact », « Mentions légales »). Laisse vide
              ce que tu ne veux pas montrer.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="E-mail de contact" error={errors.contactEmail}>
                {(field) => (
                  <input
                    {...field}
                    type="email"
                    name="contactEmail"
                    maxLength={120}
                    defaultValue={initial.contactEmail}
                    placeholder="contact@entreprise.fr"
                    className={inputClasses()}
                  />
                )}
              </Field>
              <Field label="Téléphone" error={errors.contactPhone}>
                {(field) => (
                  <input
                    {...field}
                    type="tel"
                    name="contactPhone"
                    maxLength={30}
                    defaultValue={initial.contactPhone}
                    className={inputClasses()}
                  />
                )}
              </Field>
            </div>
            <Field label="Adresse" error={errors.address}>
              {(field) => (
                <textarea
                  {...field}
                  name="address"
                  rows={2}
                  maxLength={300}
                  defaultValue={initial.address}
                  className={textareaClasses()}
                />
              )}
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Raison sociale" error={errors.legalName}>
                {(field) => (
                  <input
                    {...field}
                    name="legalName"
                    maxLength={120}
                    defaultValue={initial.legalName}
                    placeholder="Cabinet Vidal SARL"
                    className={inputClasses()}
                  />
                )}
              </Field>
              <Field label="SIRET" error={errors.siret}>
                {(field) => (
                  <input
                    {...field}
                    name="siret"
                    inputMode="numeric"
                    maxLength={17}
                    defaultValue={initial.siret}
                    className={inputClasses()}
                  />
                )}
              </Field>
            </div>
          </FormSection>
        </fieldset>
      </form>

      <aside className="flex w-full shrink-0 flex-col gap-3 xl:sticky xl:top-4 xl:w-[300px]">
        <div className="flex items-center justify-between px-1">
          <p className="text-[13px] font-semibold leading-[17px] text-ink">Aperçu en direct</p>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
            Live
          </span>
        </div>
        <div className="flex flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.04),0_16px_40px_rgba(0,0,0,0.06)]">
          <div
            className="flex items-center gap-2.5 px-4 py-4"
            style={{ backgroundColor: color, color: onColor }}
          >
            {initial.logo ? (
              <img src={initial.logo} alt="" className="size-7 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/20 font-headline text-sm">
                {initial0}
              </span>
            )}
            <span className="truncate text-[15px] font-semibold">{name || "Ton espace"}</span>
          </div>
          <div className="flex flex-col gap-1 px-4 pt-4 pb-3">
            <p className={cn("text-2xl leading-7 text-ink", FONT_CLASSES[font])}>Nos événements</p>
            {description && <p className="text-xs leading-4 text-ink-subtle">{description}</p>}
          </div>
          {events.length === 0 ? (
            <p className="px-4 pb-4 text-xs text-ink-subtle">
              Aucun événement publié pour l'instant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 px-4 pb-4">
              {events.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-3 rounded-2xl bg-field px-2 py-2"
                >
                  <span className="flex h-9 w-[34px] shrink-0 flex-col items-center justify-center rounded-lg bg-surface">
                    <span
                      className="text-[8px] font-bold uppercase leading-[10px]"
                      style={{ color }}
                    >
                      {entry.month}
                    </span>
                    <span className="text-sm font-semibold leading-4 text-ink">{entry.day}</span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">
                    {entry.title}
                  </span>
                  <span className="shrink-0 pr-1 text-xs font-semibold text-ink">
                    {entry.price}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <a
          href={`/${initial.slug}`}
          target="_blank"
          rel="noreferrer"
          className="px-1 text-[13px] font-semibold text-ink hover:underline"
        >
          Ouvrir la page publique →
        </a>
      </aside>
    </div>
  );
}

function SlugStatus({ check }: { check: SlugCheck | null }) {
  if (!check)
    return <span className="shrink-0 text-[13px] font-semibold text-ink-muted">Vérification…</span>;
  if ("message" in check)
    return <span className="shrink-0 text-[13px] font-bold text-danger">{check.message}</span>;
  if (check.state === "current")
    return (
      <span className="shrink-0 text-[13px] font-semibold text-ink-muted">Adresse actuelle</span>
    );
  return <span className="shrink-0 text-[13px] font-bold text-success">✓ Disponible</span>;
}

/** Logo de l'espace (512 px suffisent) : sans logo, l'initiale sur la couleur de marque. */
function LogoActions({ logo }: { logo: string | null }) {
  const { pick, remove, pending, error, fileInput } = useImageUpload("logo", undefined, 512);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-field px-3 py-2.5">
      <Button variant="secondary" pending={pending} onClick={pick} className="h-9 px-4 text-[13px]">
        {logo ? "Changer le logo" : "Ajouter un logo"}
      </Button>
      {logo && (
        <Button
          variant="secondary"
          disabled={pending}
          onClick={remove}
          className="h-9 px-4 text-[13px]"
        >
          Retirer
        </Button>
      )}
      <p
        className={cn("text-xs leading-4", error ? "font-semibold text-danger" : "text-ink-subtle")}
      >
        {error ?? "Il s'affiche sur ta page publique ; carré de préférence."}
      </p>
      {fileInput}
    </div>
  );
}
