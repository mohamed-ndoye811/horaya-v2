import { SettingsShell } from "@/components/app/settings-shell";
import { Button, ButtonLink } from "@/components/ui/button";
import type { getNotificationsSettings } from "@/functions/settings";
import { NotificationsForm } from "./notifications-form";

/** Ce qui prévient le membre connecté, et comment (e-mail, cloche du notch). */
export function NotificationsSettingsPage({
  data,
}: {
  data: Awaited<ReturnType<typeof getNotificationsSettings>>;
}) {
  return (
    <SettingsShell
      section="notifications"
      breadcrumb="Notifications"
      subtitle="Ce qui te prévient, par e-mail ou dans l'app"
      saveBar={{
        message: (
          <>
            <strong>Tes préférences</strong> ne changent que pour toi.
          </>
        ),
        buttons: (
          <>
            <ButtonLink href="/app/parametres/notifications" variant="inverse-outline">
              Annuler
            </ButtonLink>
            <Button type="submit" form="notifications-form" variant="inverse">
              Enregistrer
            </Button>
          </>
        ),
      }}
    >
      <NotificationsForm preferences={data.preferences} />
    </SettingsShell>
  );
}
