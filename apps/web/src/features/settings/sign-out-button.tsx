import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "@/lib/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await authClient.signOut();
    router.replace("/connexion");
    router.refresh();
  }

  return (
    <Button variant="danger" onClick={signOut} pending={pending} className="w-full">
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </Button>
  );
}
