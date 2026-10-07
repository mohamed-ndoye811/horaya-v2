"use client";

import { DISPLAY_FONTS } from "@horaya/core";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, inputClasses, textareaClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Check } from "@/components/ui/icons";
import { FormSection } from "@/components/ui/section";
import { cn } from "@/lib/cn";
import { textOn } from "@/lib/colors";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import { checkWorkspaceSlug, type SlugCheck, saveOrganizationAction } from "../actions";

/** Couleurs proposées (écran 24) ; toute couleur hexadécimale reste possible. */
const PRESETS = ["#528D74", "#264489", "#66537C", "#CF879C", "#B4532A"];

const FONT_CLASSES: Record<string, string> = {
  display: "font-headline uppercase",
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
    brandColor: string;
    displayFont: string;
    description: string;
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
    <div className="flex flex-col gap-10 xl:flex-row">
      <form
        id="organization-form"
        onSubmit={onSubmit}
        className="flex min-w-0 flex-1 flex-col gap-9"
      >
        {state.error && <FormAlert>{state.error}</FormAlert>}
        {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
        {!editable && (
          <FormAlert tone="info">
            Seuls le propriétaire et les admins peuvent modifier ces réglages.
          </FormAlert>
        )}
        <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-9">
          <FormSection number={1} title="Identité">
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
                    "flex h-12 border-[1.5px] bg-surface focus-within:border-ink",
                    errors.slug || slugCheck?.state === "taken" || slugCheck?.state === "invalid"
                      ? "border-danger"
                      : "border-ink-subtle",
                  )}
                >
                  <span className="flex shrink-0 items-center border-r-[1.5px] border-ink-subtle bg-draft-bg px-3.5 font-mono text-sm font-medium text-ink-muted">
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
                      className="h-full min-w-0 flex-1 bg-transparent font-mono text-sm font-semibold text-ink outline-none"
                    />
                    <SlugStatus check={slugCheck} />
                  </span>
                </div>
              )}
            </Field>
            <div className="flex flex-col gap-2">
              <p className="text-sm font-bold text-ink">Logo</p>
              <div className="flex items-center gap-5">
                <span
                  aria-hidden="true"
                  className="flex size-[72px] shrink-0 items-center justify-center font-headline text-[40px] leading-10"
                  style={{ backgroundColor: color, color: onColor }}
                >
                  {initial0}
                </span>
                <div className="flex flex-col items-start gap-2.5">
                  <Button variant="secondary" disabled className="h-10 px-4 text-sm">
                    Changer le logo
                  </Button>
                  <p className="text-[13px] font-medium leading-[18px] text-ink-muted">
                    L'envoi d'un logo arrive bientôt : en attendant, ton initiale s'affiche sur ta
                    couleur.
                  </p>
                </div>
              </div>
            </div>
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
              <legend className="mb-2.5 text-sm font-bold text-ink">Couleur de marque</legend>
              <div className="flex flex-wrap items-center gap-3">
                {PRESETS.map((preset) => {
                  const selected = preset.toUpperCase() === color.toUpperCase();
                  return (
                    <label
                      key={preset}
                      className={cn(
                        "flex size-11 shrink-0 items-center justify-center",
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
                  className="ml-2 h-11 w-[104px] border-[1.5px] border-ink-subtle bg-surface px-3.5 font-mono text-sm font-semibold uppercase text-ink outline-none focus:border-ink"
                />
                <input type="hidden" name="brandColor" value={color} />
              </div>
              {errors.brandColor && (
                <p className="text-[13px] font-semibold text-danger">{errors.brandColor}</p>
              )}
            </fieldset>
            <fieldset className="flex flex-col gap-2.5">
              <legend className="mb-2.5 text-sm font-bold text-ink">Police d'affichage</legend>
              <div className="grid border-2 border-ink sm:grid-cols-3">
                {DISPLAY_FONTS.map((option, index) => {
                  const selected = option.value === font;
                  return (
                    <label
                      key={option.value}
                      className={cn(
                        "flex flex-col gap-1.5 px-4 py-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:-outline-offset-4 has-[:focus-visible]:outline-ink",
                        index > 0 && "border-t-2 border-ink sm:border-t-0 sm:border-l-2",
                        selected ? "bg-ink text-on-ink" : "text-ink hover:bg-surface",
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
                      <span className={cn("text-[32px] leading-8", FONT_CLASSES[option.value])}>
                        Aa
                      </span>
                      <span className="text-sm font-bold">
                        {option.label} · {option.tone}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </FormSection>
        </fieldset>
      </form>

      <aside className="flex w-full shrink-0 flex-col gap-3 xl:w-[290px]">
        <div className="flex items-center justify-between">
          <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] text-neutral">
            Aperçu en direct
          </p>
          <span className="flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.5px] text-success">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
            Live
          </span>
        </div>
        <div className="flex flex-col overflow-hidden border-2 border-ink bg-bg">
          <div
            className="flex flex-col gap-3.5 px-4 pt-3.5 pb-[18px]"
            style={{ backgroundColor: color, color: onColor }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex size-5 shrink-0 items-center justify-center bg-on-ink font-headline text-label"
                style={{ color }}
              >
                {initial0}
              </span>
              <span className="truncate text-[11px] font-extrabold uppercase tracking-[0.02em]">
                {name || "Ton espace"}
              </span>
            </div>
            <p className={cn("text-[30px] leading-7", FONT_CLASSES[font])}>Nos événements</p>
            {description && (
              <p className="text-[11px] font-medium leading-[15px] opacity-90">{description}</p>
            )}
          </div>
          {events.length === 0 ? (
            <p className="px-4 py-4 text-[12px] font-medium text-ink-muted">
              Aucun événement publié pour l'instant.
            </p>
          ) : (
            <ul>
              {events.map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-center gap-2.5 border-b border-line-soft px-4 py-2.5 last:border-b-0"
                >
                  <span className="flex w-7 shrink-0 flex-col items-center">
                    <span className="font-mono text-[8px] font-semibold uppercase leading-[10px] text-ink-muted">
                      {entry.month}
                    </span>
                    <span className="text-[15px] font-extrabold leading-4 text-ink">
                      {entry.day}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-ink">
                    {entry.title}
                  </span>
                  <span className="shrink-0 text-[11px] font-extrabold text-ink">
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
          className="text-sm font-bold text-ink underline decoration-1 underline-offset-[3px] hover:text-link"
        >
          Ouvrir la page publique →
        </a>
        <p className="text-[13px] font-medium leading-[18px] text-ink-muted">
          Les changements s'appliquent à ta page publique et à tes e-mails de confirmation.
        </p>
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
