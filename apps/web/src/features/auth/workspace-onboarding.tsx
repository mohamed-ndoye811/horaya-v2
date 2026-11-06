import { BRAND_COLOR_PRESETS, slugify, TENANT_SECTORS } from "@horaya/core";
import { useEffect, useState } from "react";
import { AuthLead, AuthShell, AuthTitle } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { Check } from "@/components/ui/icons";
import { checkSlug, createWorkspace } from "@/functions/auth";
import { cn } from "@/lib/cn";
import { useFormAction } from "@/lib/use-form-action";
import type { SlugStatus, WorkspaceFormState } from "@/server/onboarding";

const COLOR_NAMES: Record<string, string> = {
  "#264489": "Bleu encre",
  "#528D74": "Vert sauge",
  "#CF879C": "Rose poudré",
  "#66537C": "Violet prune",
  "#1F1F1F": "Noir",
};

/** Écran 12 : création de l'espace, avec l'aperçu de la page publique à gauche. */
export function WorkspaceOnboarding() {
  const { state, onSubmit, pending } = useFormAction<WorkspaceFormState>(createWorkspace, {});
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
      step={2}
      footnote={
        <>
          Tu pourras tout modifier plus tard dans Paramètres. Besoin d'aide ?{" "}
          <a href="mailto:bonjour@horaya.app" className="text-ink underline underline-offset-2">
            Nous écrire
          </a>
        </>
      }
      width="lg"
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <AuthTitle size="md">Ton espace.</AuthTitle>
          <AuthLead>C'est ce que tes clients verront en réservant.</AuthLead>
        </div>

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
                "flex h-12 items-center overflow-hidden rounded-[14px] border bg-surface pr-1.5 transition-[border-color,box-shadow] focus-within:border-ink focus-within:shadow-[0_0_0_0.5px_var(--color-ink)]",
                slugError ? "border-danger" : "border-line",
              )}
            >
              <span className="flex shrink-0 items-center pl-4 text-[15px] text-ink-subtle">
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
                className="min-w-0 grow bg-transparent pr-3 text-[15px] font-semibold text-ink outline-none"
              />
              <SlugBadge status={slugStatus} />
            </div>
          )}
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold leading-[17px] text-ink">
            Secteur d'activité
          </legend>
          <div className="flex flex-wrap gap-2">
            {TENANT_SECTORS.map((sector) => (
              <label
                key={sector.value}
                className="flex h-9 items-center rounded-full border border-line bg-surface px-3.5 text-[13px] font-medium text-ink transition-colors hover:bg-field has-checked:border-ink has-checked:bg-ink has-checked:text-on-ink has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink"
              >
                <input
                  type="radio"
                  name="sector"
                  value={sector.value}
                  required
                  className="sr-only"
                />
                {sector.label}
              </label>
            ))}
          </div>
          {state.fieldErrors?.sector && (
            <p className="text-[13px] font-semibold text-danger">{state.fieldErrors.sector}</p>
          )}
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13px] font-semibold leading-[17px] text-ink">
            Couleur de ta marque
          </legend>
          <div className="flex items-center gap-2.5">
            {BRAND_COLOR_PRESETS.map((color) => {
              const selected = color === brandColor;
              return (
                <label
                  key={color}
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full border-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink",
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
                      "flex items-center justify-center rounded-full text-white",
                      selected ? "size-[30px]" : "size-8",
                    )}
                    style={{ backgroundColor: color }}
                  ></span>
                  <span className="sr-only">{COLOR_NAMES[color] ?? color}</span>
                </label>
              );
            })}
            <span className="pl-1 text-[13px] text-ink-muted">{COLOR_NAMES[brandColor]}</span>
          </div>
        </fieldset>

        <Button
          size="lg"
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
    <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-success-bg px-2.5 text-xs font-bold text-success">
      <Check />
      Disponible
    </span>
  );
}

/** Aperçu en direct de la page publique avec le nom et la couleur choisis (maquette 4.3). */
function PublicPagePreview({ name, slug, color }: { name: string; slug: string; color: string }) {
  const displayName = name.trim() || "Ton organisation";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center justify-between gap-3 text-[13px]">
        <span className="font-medium text-[#9a9ea8]">Aperçu en direct</span>
        <span className="flex min-w-0 items-center gap-2 font-mono text-xs text-[#9a9ea8]">
          <span className="size-1.5 shrink-0 rounded-full bg-success" />
          <span className="truncate">horaya.app/{slug || "ton-espace"}</span>
        </span>
      </div>
      <div
        className="flex flex-1 flex-col overflow-hidden rounded-[20px] bg-band"
        aria-hidden="true"
      >
        <div
          className="flex flex-col gap-4 px-7 pt-7 pb-6 text-white transition-colors"
          style={{ backgroundColor: color }}
        >
          <div className="flex items-center gap-2.5">
            <span
              className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-white text-sm font-bold"
              style={{ color }}
            >
              {initials}
            </span>
            <span className="truncate text-base font-semibold">{displayName}</span>
          </div>
          <p className="font-headline text-[34px] leading-10">Nos événements</p>
          <p className="text-[13px] opacity-85">Réserve ta place en ligne</p>
        </div>
        <div className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-3.5 rounded-2xl bg-surface p-3">
            <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-field">
              <span className="text-[9px] font-bold uppercase" style={{ color }}>
                Juin
              </span>
              <span className="text-[17px] font-semibold leading-5 text-ink">12</span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-sm font-semibold text-ink">Ton premier événement</span>
              <span className="truncate text-xs text-ink-subtle">
                Il apparaîtra ici, prêt à réserver
              </span>
            </span>
            <span
              className="flex h-8 shrink-0 items-center rounded-full px-3.5 text-xs font-bold text-white transition-colors"
              style={{ backgroundColor: color }}
            >
              Réserver
            </span>
          </div>
          {[0, 1].map((index) => (
            <div key={index} className="flex items-center gap-3.5 rounded-2xl bg-surface/60 p-3">
              <span className="size-12 shrink-0 rounded-xl bg-field" />
              <span className="flex flex-1 flex-col gap-2">
                <span className="h-2.5 w-2/5 rounded-full bg-field" />
                <span className="h-2 w-1/4 rounded-full bg-field" />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
