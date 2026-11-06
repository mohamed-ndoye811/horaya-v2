import { SettingsShell } from "@/components/app/settings-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import type { getOrganizationSettings } from "@/functions/settings";
import { OrganizationForm } from "./organization-form";

/** Écran 24 : identité de l'espace et marque de la page publique. */
export function OrganizationSettingsPage({
  data,
}: {
  data: Awaited<ReturnType<typeof getOrganizationSettings>>;
}) {
  const { editable, members, initial, events } = data;
  return (
    <SettingsShell
      section="organisation"
      breadcrumb="Organisation & marque"
      subtitle={
        <>
          Ton espace {initial.name}.{" "}
          <span className="text-ink">
            {members} membre{members > 1 ? "s" : ""}.
          </span>
        </>
      }
      actions={
        <ButtonLink href={`/${initial.slug}`} variant="secondary" target="_blank">
          Voir ma page publique
        </ButtonLink>
      }
      saveBar={
        editable
          ? {
              message: (
                <>
                  <strong>Tes réglages</strong> s'appliquent à ta page publique et à tes e-mails.
                </>
              ),
              buttons: (
                <>
                  <ButtonLink href="/app/parametres/organisation" variant="inverse-outline">
                    Annuler
                  </ButtonLink>
                  <Button type="submit" form="organization-form" variant="inverse">
                    Enregistrer
                  </Button>
                </>
              ),
            }
          : undefined
      }
    >
      <OrganizationForm editable={editable} initial={initial} events={events} />
    </SettingsShell>
  );
}
