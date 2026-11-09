import { useState, useTransition } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { regenerateCalendarFeedAction } from "@/functions/settings";
import { useRouter } from "@/lib/navigation";

type Message = { tone: "success" | "danger"; text: string } | null;

/** « Mon agenda » : abonnement personnel aux événements de l'espace (flux ICS secret). */
export function CalendarFeedSection({
  url,
  workspaceName,
}: {
  url: string;
  workspaceName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const webcal = url.replace(/^https?:/, "webcal:");

  const copy = () =>
    navigator.clipboard
      .writeText(url)
      .then(() => setMessage({ tone: "success", text: "Adresse copiée." }))
      .catch(() =>
        setMessage({ tone: "danger", text: "Copie impossible : sélectionne l'adresse." }),
      );
  const regenerate = () =>
    startTransition(async () => {
      const result = await regenerateCalendarFeedAction();
      setConfirming(false);
      setMessage(result.success ? { tone: "success", text: result.success } : null);
      router.refresh();
    });

  return (
    <FormSection number={3} title="Mon agenda">
      <p className="text-meta font-medium leading-5 text-ink-muted">
        Retrouve les événements publiés de {workspaceName} dans ton agenda (Google, Apple, Outlook).
        Ils se mettent à jour tout seuls. Cette adresse est personnelle : ne la partage pas.
      </p>
      {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
      <div className="flex gap-2">
        <input
          readOnly
          aria-label="Adresse de ton agenda"
          value={url}
          onFocus={(event) => event.currentTarget.select()}
          className={inputClasses()}
        />
        <Button className="shrink-0" onClick={copy}>
          Copier
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line-soft pt-5">
        <ButtonLink
          variant="secondary"
          href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Ajouter à Google Agenda
        </ButtonLink>
        <ButtonLink variant="secondary" href={webcal}>
          Ouvrir dans Apple Calendrier
        </ButtonLink>
        <Button variant="danger" className="sm:ml-auto" onClick={() => setConfirming(true)}>
          Régénérer l'adresse
        </Button>
      </div>
      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Régénérer l'adresse ?"
        description="L'adresse actuelle cessera aussitôt de marcher : les agendas abonnés ne recevront plus les événements. Tu devras t'abonner de nouveau avec la nouvelle adresse."
        footer={
          <>
            <Button variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              Annuler
            </Button>
            <Button variant="danger-solid" pending={pending} onClick={regenerate}>
              Régénérer
            </Button>
          </>
        }
      />
    </FormSection>
  );
}
