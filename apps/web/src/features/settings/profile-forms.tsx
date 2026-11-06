import { useRef, useState } from "react";
import { useImageUpload } from "@/components/app/image-upload";
import { PasswordMeter } from "@/components/auth/password-strength";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, inputClasses, PasswordInput } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { FormSection } from "@/components/ui/section";
import { changePasswordAction, saveProfileAction } from "@/functions/settings";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";

export function ProfileForm({
  initial,
}: {
  initial: { firstName: string; lastName: string; email: string; image: string | null };
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveProfileAction, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form id="profile-form" onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormSection number={1} title="Toi">
        {state.error && <FormAlert>{state.error}</FormAlert>}
        {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
        <ProfilePhoto name={`${initial.firstName} ${initial.lastName}`} image={initial.image} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Prénom" required error={errors.firstName}>
            {(field) => (
              <input
                {...field}
                name="firstName"
                required
                maxLength={60}
                autoComplete="given-name"
                defaultValue={initial.firstName}
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="Nom" required error={errors.lastName}>
            {(field) => (
              <input
                {...field}
                name="lastName"
                required
                maxLength={60}
                autoComplete="family-name"
                defaultValue={initial.lastName}
                className={inputClasses()}
              />
            )}
          </Field>
        </div>
        <Field
          label="Adresse e-mail"
          hint={
            <p className="text-[13px] font-medium text-ink-muted">
              C'est ton identifiant de connexion.
            </p>
          }
        >
          {(field) => (
            <input
              {...field}
              type="email"
              readOnly
              value={initial.email}
              className={inputClasses()}
            />
          )}
        </Field>
        {pending && <p className="sr-only">Enregistrement…</p>}
      </FormSection>
    </form>
  );
}

export function PasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [password, setPassword] = useState("");
  const { state, onSubmit, pending } = useFormAction<FormState>(async (previous, form) => {
    const result = await changePasswordAction(previous, form);
    if (result.success) {
      formRef.current?.reset();
      setPassword("");
    }
    return result;
  }, {});
  const errors = state.fieldErrors ?? {};
  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormSection number={2} title="Mot de passe">
        {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
        {state.success && <FormAlert tone="success">{state.success}</FormAlert>}
        <div className="grid items-start gap-4 sm:grid-cols-2">
          <Field label="Mot de passe actuel" required>
            {(field) => (
              <PasswordInput
                {...field}
                name="currentPassword"
                required
                autoComplete="current-password"
              />
            )}
          </Field>
          <Field
            label="Nouveau mot de passe"
            required
            error={errors.newPassword}
            hint={<PasswordMeter password={password} />}
          >
            {(field) => (
              <PasswordInput
                {...field}
                name="newPassword"
                required
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            )}
          </Field>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-soft pt-5">
          <Checkbox
            name="revokeOtherSessions"
            defaultChecked
            label="Déconnecter mes autres appareils"
          />
          <Button type="submit" pending={pending}>
            Changer le mot de passe
          </Button>
        </div>
      </FormSection>
    </form>
  );
}

/** Photo de profil (512 px suffisent pour un avatar) ; sans photo, les initiales. */
function ProfilePhoto({ name, image }: { name: string; image: string | null }) {
  const { pick, remove, pending, error, fileInput } = useImageUpload("profil", undefined, 512);
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} image={image} size="header" />
      <div className="flex flex-col gap-2">
        <p className="text-[15px] font-semibold leading-5 text-ink">Photo de profil</p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            pending={pending}
            onClick={pick}
            className="h-9 px-4 text-[13px]"
          >
            {image ? "Changer" : "Ajouter une photo"}
          </Button>
          {image && (
            <Button
              variant="secondary"
              disabled={pending}
              onClick={remove}
              className="h-9 px-4 text-[13px]"
            >
              Retirer
            </Button>
          )}
        </div>
        {error && <p className="text-xs font-semibold leading-4 text-danger">{error}</p>}
      </div>
      {fileInput}
    </div>
  );
}
