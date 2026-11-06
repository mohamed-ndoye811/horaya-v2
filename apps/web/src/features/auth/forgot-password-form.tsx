import { type FormEvent, useEffect, useState } from "react";
import { AuthLead, AuthTitle } from "@/components/auth/auth-shell";
import { Button } from "@/components/ui/button";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ArrowLeft, Check, Envelope } from "@/components/ui/icons";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage } from "@/lib/auth-errors";
import { Link } from "@/lib/navigation";

const RESEND_DELAY_SECONDS = 45;

/** « m•••••@diamondy.dev » : on confirme l'adresse sans l'afficher en entier. */
function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  return `${local.slice(0, 1)}•••••@${domain}`;
}

/** Écrans 13 et 13b : demande du lien, puis confirmation d'envoi. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function sendLink() {
    setPending(true);
    setError(null);
    const { error } = await authClient.requestPasswordReset({
      email,
      redirectTo: "/nouveau-mot-de-passe",
    });
    setPending(false);
    if (error) {
      setError(authErrorMessage(error));
      return;
    }
    setSent(true);
    setCooldown(RESEND_DELAY_SECONDS);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendLink();
  }

  const back = (
    <Link
      href="/connexion"
      className="flex items-center justify-center gap-2 text-sm font-semibold text-ink hover:underline"
    >
      <ArrowLeft />
      Retour à la connexion
    </Link>
  );

  if (sent) {
    const minutes = Math.floor(cooldown / 60);
    const seconds = String(cooldown % 60).padStart(2, "0");
    return (
      <div className="flex flex-col gap-6">
        <span
          aria-hidden="true"
          className="flex size-16 items-center justify-center rounded-2xl bg-ink text-white"
        >
          <Envelope size={22} />
        </span>
        <div className="flex flex-col gap-2">
          <AuthTitle>Vérifie ta boîte.</AuthTitle>
          <AuthLead>
            On a envoyé un lien à{" "}
            <strong className="font-semibold text-ink">{maskEmail(email)}</strong>. Clique dessus
            pour choisir un nouveau mot de passe.
          </AuthLead>
        </div>
        <p
          role="status"
          className="flex items-center gap-2.5 rounded-2xl bg-success-bg px-4 py-3 text-sm font-semibold text-success"
        >
          <Check size={14} />
          E-mail envoyé · valable 30 minutes
        </p>
        {error && <FormAlert>{error}</FormAlert>}
        <Button
          size="lg"
          type="button"
          variant="secondary"
          onClick={() => void sendLink()}
          disabled={cooldown > 0}
          pending={pending}
          className="w-full"
        >
          {cooldown > 0 ? `Renvoyer le lien dans ${minutes}:${seconds}` : "Renvoyer le lien"}
        </Button>
        {back}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {back}
      <div className="flex flex-col gap-2">
        <AuthTitle>Mot de passe oublié.</AuthTitle>
        <AuthLead>
          Indique l'e-mail de ton compte : on t'envoie un lien pour choisir un nouveau mot de passe.
          Il reste valable 30 minutes.
        </AuthLead>
      </div>
      {error && <FormAlert>{error}</FormAlert>}
      <Field label="Adresse e-mail">
        {(field) => (
          <input
            {...field}
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value.trim())}
            className={inputClasses("lg")}
          />
        )}
      </Field>
      <Button size="lg" type="submit" arrow pending={pending} className="w-full">
        {pending ? "Envoi…" : "Recevoir le lien"}
      </Button>
    </form>
  );
}
