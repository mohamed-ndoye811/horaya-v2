import { can, refreshPaymentAccount, withDefaultPreferences } from "@horaya/core";
import {
  getJoinLink,
  getNotificationPreferences,
  getWorkspaceSettings,
  listPublicUpcomingEvents,
  listTeam,
  sumAwaitingPayment,
  sumCollectedSince,
} from "@horaya/db";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { startOfDay, todayIn } from "@/lib/dates";
import { formDataInput } from "@/lib/form-data";
import { formatDayNumber, formatHour, formatMoney, formatMonthShort } from "@/lib/format";
import { ASSIGNABLE_ROLES, type AssignableRole, canManageTeam } from "@/lib/roles";
import { db } from "@/server/db";
import { env } from "@/server/env";
import type { FormState } from "@/server/form-state";
import { paymentDeps, paymentGateway, testPayments } from "@/server/payments";
import {
  cancelInvitation,
  changePassword,
  checkWorkspaceSlug as checkSlug,
  createJoinLink,
  disableJoinLink,
  inviteMember,
  removeMember,
  resendInvitation,
  saveNotifications,
  saveOrganization,
  savePayments,
  saveProfile,
  updateMemberRole,
} from "@/server/settings";
import { getWorkspaceContext } from "@/server/workspace";

/* Lectures des écrans */

/** Écran 24 : identité de l'espace et marque de la page publique. */
export const getOrganizationSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const [settings, events, team] = await Promise.all([
    getWorkspaceSettings(db, workspace.id),
    listPublicUpcomingEvents(db, workspace.id, now),
    listTeam(db, workspace.id, now),
  ]);
  if (!settings) throw notFound();
  return {
    editable: can(actor.role, "settings", "update"),
    members: team.members.length,
    initial: {
      name: settings.name,
      slug: settings.slug,
      logo: settings.logo ?? null,
      coverImageUrl: settings.coverImageUrl ?? null,
      brandColor: settings.brandColor,
      displayFont: settings.displayFont,
      description: settings.description ?? "",
      contactEmail: settings.contactEmail ?? "",
      contactPhone: settings.contactPhone ?? "",
      address: settings.address ?? "",
      legalName: settings.legalName ?? "",
      siret: settings.siret ?? "",
    },
    events: events.map((entry) => ({
      id: entry.id,
      title: entry.title,
      month: formatMonthShort(entry.startsAt, timeZone),
      day: formatDayNumber(entry.startsAt, timeZone),
      price: entry.priceCents > 0 ? formatMoney(entry.priceCents) : "Gratuit",
    })),
  };
});

export const getProfileSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { user, workspace, actor } = await getWorkspaceContext();
  const [fallbackFirst = "", ...rest] = user.name.split(" ");
  return {
    email: user.email,
    role: actor.role,
    workspaceName: workspace.name,
    firstName: user.firstName ?? fallbackFirst,
    lastName: user.lastName ?? rest.join(" "),
    image: user.image ?? null,
  };
});

/** Écran 25 : membres de l'espace, invitations et rôles. */
export const getMembersSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const manageable = canManageTeam(actor.role);
  const [{ members, invitations }, joinLink] = await Promise.all([
    listTeam(db, workspace.id, now),
    manageable ? getJoinLink(db, workspace.id) : null,
  ]);
  const since = (date: Date) => {
    const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
    if (days <= 0) return "invitée aujourd'hui";
    return days === 1 ? "invitée hier" : `invitée il y a ${days} jours`;
  };
  const link =
    joinLink && joinLink.expiresAt > now && joinLink.role !== "owner"
      ? {
          url: new URL(`/rejoindre/${joinLink.token}`, env.BETTER_AUTH_URL).toString(),
          role: joinLink.role as AssignableRole,
          validUntil: `jusqu'au ${new Intl.DateTimeFormat("fr-FR", {
            day: "numeric",
            month: "long",
            timeZone,
          }).format(joinLink.expiresAt)}, ${formatHour(joinLink.expiresAt, timeZone)}`,
        }
      : null;
  const rows = [
    ...members.map((entry) => ({
      id: entry.id,
      kind: "member" as const,
      name: entry.name,
      email: entry.email,
      image: entry.image,
      role: entry.role,
      isMe: entry.id === actor.memberId,
    })),
    ...invitations.map((entry) => ({
      id: entry.id,
      kind: "invitation" as const,
      name:
        entry.email
          .split("@")[0]
          ?.replace(/[._-]+/g, " ")
          .replace(/\b\p{L}/gu, (letter) => letter.toUpperCase()) ?? entry.email,
      email: entry.email,
      role: entry.role,
      detail: since(entry.createdAt),
      isMe: false,
    })),
  ];
  return {
    manageable,
    link,
    rows,
    membersCount: members.length,
    invitationsCount: invitations.length,
  };
});

const MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Préférences de notification du membre connecté. */
export const getNotificationsSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { actor } = await getWorkspaceContext();
  return {
    preferences: withDefaultPreferences(await getNotificationPreferences(db, actor.memberId)),
  };
});

/** Écran 26 : connexion des paiements et réglages de facturation de l'espace. */
export const getPaymentsSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const today = todayIn(timeZone);
  const [settings, collected, awaiting] = await Promise.all([
    getWorkspaceSettings(db, workspace.id),
    sumCollectedSince(db, workspace.id, startOfDay({ ...today, day: 1 }, timeZone)),
    sumAwaitingPayment(db, workspace.id),
  ]);
  if (!settings) throw notFound();
  let status = settings.stripeAccountStatus;
  // Activation en cours chez Stripe : on relit l'état du compte à chaque visite.
  if (
    paymentDeps &&
    settings.stripeAccountId &&
    (status === "pending" || status === "restricted")
  ) {
    status = await refreshPaymentAccount(paymentDeps, workspace.id).catch(() => status);
  }
  const accountId = settings.stripeAccountId;
  const connected = status === "active";
  const balance =
    paymentGateway && connected && accountId
      ? await paymentGateway.getBalance(accountId).catch(() => null)
      : null;
  const dayMonth = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "long",
    timeZone,
  });
  return {
    workspaceName: workspace.name,
    hasGateway: Boolean(paymentGateway),
    testPayments,
    editable: can(actor.role, "settings", "update"),
    canConnect: can(actor.role, "billing", "manage"),
    accountStatus: status,
    accountLabel: accountId ? `${accountId.slice(0, 9)}…${accountId.slice(-4)} · ` : "",
    balance: balance ? formatMoney(balance.availableCents) : "—",
    nextPayout: balance?.nextPayoutAt
      ? dayMonth.format(balance.nextPayoutAt).replace(/^./, (c) => c.toUpperCase())
      : "—",
    month: MONTHS[today.month - 1],
    collected,
    awaiting,
    initial: {
      vatRate: String(settings.vatRateBps / 100).replace(".", ","),
      defaultDepositPercent: String(settings.defaultDepositPercent),
      freeCancellationHours: settings.freeCancellationHours,
      lateCancellationRefundPercent: settings.lateCancellationRefundPercent,
      paymentLinkUrl: settings.paymentLinkUrl ?? "",
    },
  };
});

/** Maquette 6.4 : onglet « Plus » de la navigation mobile. */
export const getMoreMenu = createServerFn({ method: "GET" }).handler(async () => {
  const { user, workspace, actor } = await getWorkspaceContext();
  const { members } = await listTeam(db, workspace.id, new Date());
  return {
    userName: user.name,
    userImage: user.image ?? null,
    role: actor.role,
    workspace: { name: workspace.name, slug: workspace.slug },
    members: members.length,
  };
});

/* Actions (mêmes noms que les anciennes actions serveur) */

const saveOrganizationFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveOrganization(data));
const savePaymentsFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => savePayments(data));
const saveNotificationsFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveNotifications(data));
const saveProfileFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveProfile(data));
const changePasswordFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => changePassword(data));
const inviteMemberFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => inviteMember(data));

export const saveOrganizationAction = (_previous: FormState, form: FormData) =>
  saveOrganizationFn({ data: form });
export const savePaymentsAction = (_previous: FormState, form: FormData) =>
  savePaymentsFn({ data: form });
export const saveNotificationsAction = (_previous: FormState, form: FormData) =>
  saveNotificationsFn({ data: form });
export const saveProfileAction = (_previous: FormState, form: FormData) =>
  saveProfileFn({ data: form });
export const changePasswordAction = (_previous: FormState, form: FormData) =>
  changePasswordFn({ data: form });
export const inviteMemberAction = (_previous: FormState, form: FormData) =>
  inviteMemberFn({ data: form });

const checkSlugFn = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(({ data }) => checkSlug(data));
export const checkWorkspaceSlug = (slug: string) => checkSlugFn({ data: slug });

const roleSchema = z.enum(ASSIGNABLE_ROLES);

const resendFn = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string(), role: roleSchema }))
  .handler(({ data }) => resendInvitation(data.email, data.role));
export const resendInvitationAction = (email: string, role: AssignableRole) =>
  resendFn({ data: { email, role } });

const cancelFn = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(({ data }) => cancelInvitation(data));
export const cancelInvitationAction = (invitationId: string) => cancelFn({ data: invitationId });

const roleFn = createServerFn({ method: "POST" })
  .validator(z.object({ memberId: z.string(), role: roleSchema }))
  .handler(({ data }) => updateMemberRole(data.memberId, data.role));
export const updateMemberRoleAction = (memberId: string, role: AssignableRole) =>
  roleFn({ data: { memberId, role } });

const removeFn = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(({ data }) => removeMember(data));
export const removeMemberAction = (memberId: string) => removeFn({ data: memberId });

const createLinkFn = createServerFn({ method: "POST" })
  .validator(roleSchema)
  .handler(({ data }) => createJoinLink(data));
export const createJoinLinkAction = (role: AssignableRole) => createLinkFn({ data: role });

const disableLinkFn = createServerFn({ method: "POST" }).handler(() => disableJoinLink());
export const disableJoinLinkAction = () => disableLinkFn();
