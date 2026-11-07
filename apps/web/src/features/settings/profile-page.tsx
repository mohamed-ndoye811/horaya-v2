import { SettingsShell } from "@/components/app/settings-shell";
import { Button } from "@/components/ui/button";
import type { getProfileSettings } from "@/functions/settings";
import { ROLE_LABELS } from "@/lib/roles";
import { CalendarFeedSection } from "./calendar-feed-section";
import { DeleteAccountSection } from "./danger-zone";
import { PasswordForm, ProfileForm } from "./profile-forms";

export function ProfileSettingsPage({
  data,
}: {
  data: Awaited<ReturnType<typeof getProfileSettings>>;
}) {
  return (
    <SettingsShell
      section="profil"
      breadcrumb="Profil"
      subtitle={
        <>
          {data.email}
          <span className="text-ink">
            {" "}
            · {ROLE_LABELS[data.role]} de {data.workspaceName}
          </span>
        </>
      }
      saveBar={{
        message: (
          <>
            <strong>Ton prénom</strong> s'affiche pour ton équipe et sur tes e-mails.
          </>
        ),
        buttons: (
          <Button type="submit" form="profile-form" variant="inverse">
            Enregistrer
          </Button>
        ),
      }}
    >
      <div className="flex flex-col gap-4">
        <ProfileForm
          initial={{
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            image: data.image,
          }}
        />
        <PasswordForm />
        <CalendarFeedSection url={data.calendarFeedUrl} workspaceName={data.workspaceName} />
        <DeleteAccountSection />
      </div>
    </SettingsShell>
  );
}
