import type { Metadata } from "next";
import { SettingsShell } from "@/components/app/settings-shell";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS } from "@/lib/roles";
import { getWorkspaceContext } from "@/server/workspace";
import { PasswordForm, ProfileForm } from "./profile-forms";

export const metadata: Metadata = { title: "Profil · Horaya" };

export default async function ProfileSettingsPage() {
  const { user, workspace, actor } = await getWorkspaceContext();
  const extra = user as typeof user & { firstName?: string | null; lastName?: string | null };
  const [fallbackFirst = "", ...rest] = user.name.split(" ");
  return (
    <SettingsShell
      section="profil"
      breadcrumb="Profil"
      subtitle={
        <>
          {user.email}
          {actor.type === "member" && (
            <span className="text-ink">
              {" "}
              · {ROLE_LABELS[actor.role]} de {workspace.name}
            </span>
          )}
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
            firstName: extra.firstName ?? fallbackFirst,
            lastName: extra.lastName ?? rest.join(" "),
            email: user.email,
          }}
        />
        <PasswordForm />
      </div>
    </SettingsShell>
  );
}
