import type { Metadata } from "next";
import { SettingsShell } from "@/components/app/settings-shell";
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
      subtitle={`${user.email}${actor.type === "member" ? ` · ${ROLE_LABELS[actor.role]} de ${workspace.name}` : ""}`}
    >
      <div className="flex max-w-[640px] flex-col gap-10">
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
