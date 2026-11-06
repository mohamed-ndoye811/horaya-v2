import { useState } from "react";
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
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className="flex h-[46px] items-center justify-center rounded-full border border-[#dadad6] text-[15px] font-semibold leading-[18px] text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
    >
      {pending ? "Déconnexion…" : "Se déconnecter"}
    </button>
  );
}
