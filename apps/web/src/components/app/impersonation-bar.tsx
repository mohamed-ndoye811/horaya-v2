import { useState } from "react";
import { Banner } from "@/components/ui/banner";
import { endImpersonation } from "@/functions/privacy";

/**
 * « Se connecter en tant que » en cours (équipe Horaya) : rappel permanent en haut de l'app et
 * retour à son compte. Rechargement complet : la session change.
 */
export function ImpersonationBar({ name }: { name: string }) {
  const [pending, setPending] = useState(false);
  return (
    <div className="px-4 pt-3 lg:pt-0 lg:pb-3">
      <Banner
        tone="warning"
        action={
          <button
            type="button"
            disabled={pending}
            onClick={async () => {
              setPending(true);
              // La fonction répond par une redirection : on recharge tout de toute façon.
              await endImpersonation().catch(() => undefined);
              window.location.assign("/app/plateforme");
            }}
          >
            {pending ? "Retour…" : "Revenir à mon compte"}
          </button>
        }
      >
        <strong>Connecté en tant que {name}.</strong> Tout ce que tu fais compte comme fait par
        cette personne.
      </Banner>
    </div>
  );
}
