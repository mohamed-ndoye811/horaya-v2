"use client";

import { BRAND_COLOR_PRESETS, slugify, TENANT_SECTORS } from "@horaya/core";
import { useActionState, useEffect, useState } from "react";
import { AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { OnboardingSteps } from "@/components/auth/onboarding-steps";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Check, ChevronDown } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { checkSlug, createWorkspace, type SlugStatus, type WorkspaceFormState } from "./actions";

const COLOR_NAMES: Record<string, string> = {
  "#264489": "Bleu encre",
  "#528D74": "Vert sauge",
  "#CF879C": "Rose poudré",
  "#66537C": "Violet prune",
  "#1F1F1F": "Noir",
};

/** Écran 12 : création de l'espace, avec l'aperçu de la page publique à gauche. */
export function WorkspaceOnboarding() {
  const [state, formAction, pending] = useActionState<WorkspaceFormState, FormData>(
    createWorkspace,
    {},
  );
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [brandColor, setBrandColor] = useState<string>(BRAND_COLOR_PRESETS[1]);
  const [slugStatus, setSlugStatus] = useState<SlugStatus | "checking" | null>(null);

  // Vérifie l'adresse 400 ms après la dernière frappe.
  useEffect(() => {
    if (!slug) {
      setSlugStatus(null);
      return;
    }
    setSlugStatus("checking");
    let cancelled = false;
    const timer = setTimeout(async () => {
      const status = await checkSlug(slug);
      if (!cancelled) setSlugStatus(status);
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [slug]);

  const slugError =
    state.fieldErrors?.slug ??
    (slugStatus && slugStatus !== "checking" && slugStatus.state !== "available"
      ? slugStatus.message
      : undefined);

  return (
    <AuthShell
      aside={<PublicPagePreview name={name} slug={slug} color={brandColor} />}
      topLink={{
        prompt: "Besoin d'aide ?",
        label: "Nous écrire",
        href: "mailto:bonjour@horaya.app",
      }}
      footnote="Tu pourras tout modifier plus tard dans Paramètres → Organisation."
      width="lg"
    >
      <form action={formAction} className="flex flex-col gap-5">
        <OnboardingSteps current={2} />
        <AuthTitle size="md">Ton espace</AuthTitle>

        {state.error && <FormAlert>{state.error}</FormAlert>}

        <Field label="Nom de l'organisation" error={state.fieldErrors?.name}>
          {(field) => (
            <input
              {...field}
              name="name"
              required
              maxLength={80}
              autoComplete="organization"
              placeholder="Cabinet Vidal"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (!slugEdited) setSlug(slugify(event.target.value));
              }}
              className={inputClasses()}
            />
          )}
        </Field>

        <Field label="Adresse de ta page publique" error={slugError}>
          {(field) => (
            <div
              className={cn(
                "flex h-12 border-[1.5px] bg-surface transition-[border-color,box-shadow] focus-within:border-ink focus-within:shadow-[0_0_0_0.5px_var(--color-ink)]",
                slugError ? "border-danger" : "border-ink-subtle",
              )}
            >
              <span className="flex shrink-0 items-center border-r-[1.5px] border-ink-subtle bg-draft-bg px-3 font-mono text-sm text-neutral">
                horaya.app/
              </span>
              <input
                {...field}
                name="slug"
                required
                spellCheck={false}
                autoCapitalize="none"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(event.target.value.toLowerCase().replace(/\s+/g, "-"));
                }}
                className="min-w-0 grow bg-transparent px-3 font-mono text-sm font-semibold text-ink outline-none"
              />
              <SlugBadge status={slugStatus} />
            </div>
          )}
        </Field>

        <Field label="Secteur d'activité" error={state.fieldErrors?.sector}>
          {(field) => (
            <div className="relative">
              <select
                {...field}
                name="sector"
                required
                defaultValue=""
                className={cn(inputClasses("md", "icon"), "appearance-none")}
              >
                <option value="" disabled>
                  Choisis ton secteur
                </option>
                {TENANT_SECTORS.map((sector) => (
                  <option key={sector.value} value={sector.value}>
                    {sector.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-ink" />
            </div>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-bold leading-[18px] text-ink">
            Couleur de marque
          </legend>
          <div className="flex items-center gap-2">
            {BRAND_COLOR_PRESETS.map((color) => {
              const selected = color === brandColor;
              return (
                <label
                  key={color}
                  className={cn(
                    "flex size-10 cursor-pointer items-center justify-center border-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
                    selected ? "border-ink" : "border-transparent",
                  )}
                >
                  <input
                    type="radio"
                    name="brandColor"
                    value={color}
                    checked={selected}
                    onChange={() => setBrandColor(color)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "flex items-center justify-center text-white",
                      selected ? "size-[30px]" : "size-8",
                    )}
                    style={{ backgroundColor: color }}
                  >
                    {selected && <Check />}
                  </span>
                  <span className="sr-only">{COLOR_NAMES[color] ?? color}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Button
          type="submit"
          arrow
          pending={pending}
          disabled={
            slugStatus !== null && slugStatus !== "checking" && slugStatus.state !== "available"
          }
          className="mt-1 w-full"
        >
          {pending ? "Création de l'espace…" : "Continuer"}
        </Button>
      </form>
    </AuthShell>
  );
}

function SlugBadge({ status }: { status: SlugStatus | "checking" | null }) {
  if (status === "checking") {
    return (
      <span className="flex shrink-0 items-center px-3 text-[13px] font-semibold text-ink-subtle">
        Vérification…
      </span>
    );
  }
  if (status?.state !== "available") return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 px-3 text-[13px] font-bold text-success">
      <Check />
      Disponible
    </span>
  );
}

/** Mini-navigateur montrant la page publique avec le nom et la couleur choisis. */
function PublicPagePreview({ name, slug, color }: { name: string; slug: string; color: string }) {
  const displayName = name.trim() || "Ton organisation";
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-label font-semibold uppercase tracking-[0.055em] opacity-80">
        Aperçu de ta page publique
      </p>
      <div className="flex flex-col border-2 border-on-ink bg-bg" aria-hidden="true">
        <div className="flex h-[30px] items-center gap-2 border-b-2 border-on-ink bg-on-ink px-3">
          <span className="size-2 bg-line-soft" />
          <span className="size-2 bg-line-soft" />
          <span className="size-2 bg-line-soft" />
          <span className="truncate pl-2 font-mono text-[11px] font-medium text-neutral">
            horaya.app/{slug || "ton-espace"}
          </span>
        </div>
        <div
          className="flex flex-col gap-7 px-6 pt-5 pb-7 text-on-ink transition-colors"
          style={{ backgroundColor: color }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex size-7 shrink-0 items-center justify-center bg-on-ink font-headline text-base"
                style={{ color }}
              >
                {displayName.slice(0, 1)}
              </span>
              <span className="truncate text-sm font-extrabold uppercase tracking-[0.02em]">
                {displayName}
              </span>
            </div>
            <span className="shrink-0 text-label font-semibold">Tous les événements</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <p className="font-headline text-[44px] leading-[42px]">Nos prochains événements</p>
            <p className="text-sm font-medium opacity-90">Séminaires, ateliers et formations.</p>
          </div>
        </div>
        {[
          { title: "Séminaire annuel", date: "Lun. 15 juin · 14h" },
          { title: "Atelier prise de parole", date: "Mer. 8 juil. · 10h" },
        ].map((event, index) => (
          <div
            key={event.title}
            className={cn(
              "flex items-center justify-between gap-3 px-6 py-3",
              index === 0 && "border-b border-line-soft",
            )}
          >
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-sm font-bold text-ink">{event.title}</span>
              <span className="font-mono text-[11px] font-semibold uppercase text-ink-muted">
                {event.date}
              </span>
            </div>
            <span
              className="flex h-7 shrink-0 items-center px-2.5 text-label font-bold text-on-ink transition-colors"
              style={{ backgroundColor: color }}
            >
              Réserver
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
