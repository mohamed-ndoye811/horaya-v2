"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { Dialog } from "@/components/ui/dialog";
import { Field, inputClasses } from "@/components/ui/field";
import { FormAlert } from "@/components/ui/form-alert";
import { ActionMenu, type MenuItem } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { ASSIGNABLE_ROLES, type AssignableRole, JOIN_LINK_ROLES, ROLE_LABELS } from "@/lib/roles";
import { useFormAction } from "@/lib/use-form-action";
import type { FormState } from "@/server/form-state";
import {
  cancelInvitationAction,
  createJoinLinkAction,
  disableJoinLinkAction,
  inviteMemberAction,
  removeMemberAction,
  resendInvitationAction,
  updateMemberRoleAction,
} from "./actions";

export interface TeamRow {
  id: string;
  kind: "member" | "invitation";
  name: string;
  email: string;
  role: keyof typeof ROLE_LABELS;
  /** « invitée il y a 2 jours ». */
  detail?: string;
  isMe: boolean;
}

type Message = { tone: "success" | "danger"; text: string } | null;

/** Exécute une action d'équipe, affiche le résultat et rafraîchit la page. */
function useTeamAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<Message>(null);
  const run = (action: () => Promise<FormState>) =>
    startTransition(async () => {
      const result = await action();
      setMessage(
        result.error
          ? { tone: "danger", text: result.error }
          : result.success
            ? { tone: "success", text: result.success }
            : null,
      );
      if (!result.error) router.refresh();
      setTimeout(() => setMessage(null), 4000);
    });
  return { pending, message, run, setMessage };
}

function Toast({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <div className="fixed right-6 bottom-6 z-50 max-w-sm" role="status">
      <FormAlert tone={message.tone}>{message.text}</FormAlert>
    </div>
  );
}

/** Écran 25 : membres et invitations, rôle modifiable sur place. */
export function TeamTable({ rows, manageable }: { rows: TeamRow[]; manageable: boolean }) {
  const { pending, message, run, setMessage } = useTeamAction();
  const [removing, setRemoving] = useState<TeamRow | null>(null);

  const menuItems = (row: TeamRow): MenuItem[] => {
    if (row.kind === "invitation") {
      return [
        {
          label: "Copier le lien d'invitation",
          onSelect: () => {
            navigator.clipboard
              .writeText(`${window.location.origin}/invitation/${row.id}`)
              .then(() => setMessage({ tone: "success", text: "Lien copié." }));
            setTimeout(() => setMessage(null), 3000);
          },
        },
        {
          label: "Renvoyer l'invitation",
          onSelect: () => run(() => resendInvitationAction(row.email, row.role as AssignableRole)),
        },
        {
          label: "Annuler l'invitation",
          tone: "danger",
          onSelect: () => run(() => cancelInvitationAction(row.id)),
        },
      ];
    }
    return [{ label: "Retirer de l'espace", tone: "danger", onSelect: () => setRemoving(row) }];
  };

  return (
    <>
      <DataTable
        label="Membres de l'espace"
        rows={rows}
        rowKey={(row) => row.id}
        minWidth={720}
        flush
        columns={[
          {
            key: "member",
            header: "Membre",
            cell: (row) => (
              <div className="flex min-w-0 items-center gap-3.5">
                <Avatar name={row.name} pending={row.kind === "invitation"} />
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-base font-bold text-ink">
                    {row.name}
                    {row.isMe && " (toi)"}
                  </span>
                  <span className="truncate text-sm font-medium text-ink-muted">
                    {[row.email, row.detail].filter(Boolean).join(" · ")}
                  </span>
                </div>
              </div>
            ),
          },
          {
            key: "role",
            header: "Rôle",
            width: 190,
            cell: (row) =>
              !manageable || row.isMe || row.role === "owner" ? (
                <Select
                  variant="compact"
                  disabled
                  aria-label={`Rôle de ${row.name}`}
                  value={row.role}
                >
                  <option value={row.role}>{ROLE_LABELS[row.role]}</option>
                </Select>
              ) : row.kind === "invitation" ? (
                <Select
                  variant="compact"
                  disabled
                  aria-label={`Rôle proposé à ${row.email}`}
                  value={row.role}
                >
                  <option value={row.role}>{ROLE_LABELS[row.role]}</option>
                </Select>
              ) : (
                <Select
                  variant="compact"
                  aria-label={`Rôle de ${row.name}`}
                  value={row.role}
                  disabled={pending}
                  onChange={(event) =>
                    run(() => updateMemberRoleAction(row.id, event.target.value as AssignableRole))
                  }
                >
                  {ASSIGNABLE_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>
              ),
          },
          {
            key: "status",
            header: "Statut",
            width: 200,
            cell: (row) =>
              row.kind === "invitation" ? (
                <StatusBadge tone="warning">Invitation en attente</StatusBadge>
              ) : (
                <StatusBadge tone="success">Actif</StatusBadge>
              ),
          },
          {
            key: "actions",
            header: <span className="sr-only">Actions</span>,
            width: 48,
            align: "right",
            cell: (row) =>
              manageable && !row.isMe && row.role !== "owner" ? (
                <ActionMenu label={`Actions pour ${row.name}`} items={menuItems(row)} />
              ) : null,
          },
        ]}
      />
      {removing && (
        <Dialog
          open
          onClose={() => setRemoving(null)}
          title="Retirer ce membre ?"
          description={`${removing.name} n'aura plus accès à l'espace. Ses actions passées restent dans l'historique.`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setRemoving(null)}>
                Garder
              </Button>
              <Button
                variant="danger"
                pending={pending}
                onClick={() => {
                  const target = removing;
                  setRemoving(null);
                  run(() => removeMemberAction(target.id));
                }}
              >
                Retirer
              </Button>
            </>
          }
        />
      )}
      <Toast message={message} />
    </>
  );
}

/** Lien d'invitation général tel que l'écran l'affiche (null : aucun lien actif). */
export interface JoinLinkView {
  url: string;
  role: AssignableRole;
  /** « jusqu'au 15 octobre, 14h ». */
  validUntil: string;
}

/**
 * « Copier le lien d'invitation » (écran 25) : un lien à partager, valable 7 jours, avec un
 * rôle limité (lecteur ou éditeur). Le régénérer coupe l'ancien.
 */
export function JoinLinkButton({ link }: { link: JoinLinkView | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Copier le lien d'invitation
      </Button>
      {open && <JoinLinkDialog link={link} onClose={() => setOpen(false)} />}
    </>
  );
}

function JoinLinkDialog({ link, onClose }: { link: JoinLinkView | null; onClose: () => void }) {
  const { pending, message, run, setMessage } = useTeamAction();
  const [role, setRole] = useState<AssignableRole>(link?.role ?? "viewer");
  const copy = (url: string) =>
    navigator.clipboard
      .writeText(url)
      .then(() => setMessage({ tone: "success", text: "Lien copié." }))
      .catch(() => setMessage({ tone: "danger", text: "Copie impossible : sélectionne le lien." }));

  return (
    <Dialog
      open
      onClose={onClose}
      title="Lien d'invitation"
      description="Toute personne qui a ce lien peut rejoindre l'espace avec le rôle choisi, pendant 7 jours. Ne le partage qu'avec ton équipe."
      footer={
        link ? (
          <>
            <Button variant="danger" disabled={pending} onClick={() => run(disableJoinLinkAction)}>
              Désactiver
            </Button>
            <Button
              variant="secondary"
              pending={pending}
              onClick={() => run(() => createJoinLinkAction(role))}
            >
              Régénérer
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Fermer
            </Button>
            <Button pending={pending} onClick={() => run(() => createJoinLinkAction(role))}>
              Créer le lien
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        {message && <FormAlert tone={message.tone}>{message.text}</FormAlert>}
        <Field
          label="Rôle des personnes qui rejoignent"
          hint={
            link && role !== link.role ? (
              <p className="text-[13px] font-medium text-ink-muted">
                Régénère le lien pour appliquer ce rôle.
              </p>
            ) : undefined
          }
        >
          {(field) => (
            <Select
              {...field}
              value={role}
              onChange={(event) => setRole(event.target.value as AssignableRole)}
            >
              {JOIN_LINK_ROLES.map((entry) => (
                <option key={entry} value={entry}>
                  {ROLE_LABELS[entry]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {link && (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                readOnly
                aria-label="Lien d'invitation"
                value={link.url}
                onFocus={(event) => event.currentTarget.select()}
                className={inputClasses()}
              />
              <Button className="shrink-0" onClick={() => copy(link.url)}>
                Copier
              </Button>
            </div>
            <p className="text-[13px] font-medium text-ink-muted">
              {ROLE_LABELS[link.role]} · valable {link.validUntil}
            </p>
          </div>
        )}
      </div>
    </Dialog>
  );
}

/** « Inviter un membre » : e-mail et rôle, l'invitation part par e-mail (valable 7 jours). */
export function InviteMemberButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Inviter un membre</Button>
      {open && <InviteDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function InviteDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [sent, setSent] = useState<string | null>(null);
  const { state, onSubmit, pending } = useFormAction<FormState>(async (previous, form) => {
    const result = await inviteMemberAction(previous, form);
    if (result.success) {
      setSent(result.success);
      router.refresh();
    }
    return result;
  }, {});
  const errors = state.fieldErrors ?? {};
  return (
    <Dialog
      open
      onClose={onClose}
      title="Inviter un membre"
      description="La personne reçoit un e-mail pour rejoindre l'espace. L'invitation est valable 7 jours."
      footer={
        sent ? (
          <Button onClick={onClose}>Terminé</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" form="invite-form" pending={pending}>
              Envoyer l'invitation
            </Button>
          </>
        )
      }
    >
      {sent ? (
        <FormAlert tone="success">{sent}</FormAlert>
      ) : (
        <form id="invite-form" onSubmit={onSubmit} className="flex flex-col gap-4">
          {state.error && !state.fieldErrors && <FormAlert>{state.error}</FormAlert>}
          <Field label="Adresse e-mail" required error={errors.email}>
            {(field) => (
              <input
                {...field}
                type="email"
                name="email"
                required
                placeholder="prenom@entreprise.fr"
                className={inputClasses()}
              />
            )}
          </Field>
          <Field label="Rôle" required error={errors.role}>
            {(field) => (
              <Select {...field} name="role" defaultValue="editor">
                {ASSIGNABLE_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </form>
      )}
    </Dialog>
  );
}
