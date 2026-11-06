import { useServerFn } from "@tanstack/react-start";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormAlert } from "@/components/ui/form-alert";
import { acceptInvitationAction, rejectInvitationAction } from "@/functions/invitations";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@/lib/navigation";

export function AcceptInvitation({
  invitationId,
  organizationName,
}: {
  invitationId: string;
  organizationName: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // useServerFn suit la redirection renvoyée par le serveur (vers /app ou l'invitation).
  const accept = useServerFn(acceptInvitationAction);
  const reject = useServerFn(rejectInvitationAction);
  const run = (action: (id: string) => Promise<{ error?: string }>) =>
    startTransition(async () => {
      const result = await action(invitationId);
      if (result?.error) setError(result.error);
    });
  return (
    <div className="flex flex-col gap-4">
      {error && <FormAlert>{error}</FormAlert>}
      <Button size="lg" arrow pending={pending} className="w-full" onClick={() => run(accept)}>
        Rejoindre {organizationName}
      </Button>
      <Button variant="secondary" disabled={pending} className="w-full" onClick={() => run(reject)}>
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
