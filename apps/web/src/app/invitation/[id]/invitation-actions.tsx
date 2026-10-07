"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { authClient } from "@/lib/auth-client";
import { acceptInvitationAction, rejectInvitationAction } from "./actions";

export function AcceptInvitation({
  invitationId,
  organizationName,
}: {
  invitationId: string;
  organizationName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (action: (id: string) => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await action(invitationId);
      if (result?.error) setError(result.error);
    });
  return (
    <div className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Button
        size="lg"
        arrow
        pending={pending}
        className="w-full"
        onClick={() => run(acceptInvitationAction)}
      >
        Rejoindre {organizationName}
      </Button>
      <Button
        variant="secondary"
        disabled={pending}
        className="w-full"
        onClick={() => run(rejectInvitationAction)}
      >
        Refuser l'invitation
      </Button>
    </div>
  );
}

/** Connecté avec un autre compte : on se déconnecte pour revenir avec le bon. */
export function SwitchAccount({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="lg"
      className="w-full"
      pending={pending}
      onClick={async () => {
        setPending(true);
        await authClient.signOut();
        router.replace(`/connexion?invitation=${invitationId}`);
        router.refresh();
      }}
    >
      Changer de compte
    </Button>
  );
}
