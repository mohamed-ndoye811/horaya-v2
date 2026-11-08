/**
 * Inscriptions à une série (cours à l'année) : logique serveur des pages et actions
 * (voir functions/enrollments.ts et functions/public.ts).
 */
import {
  assignMakeup,
  cancelAbsenceWithToken,
  cancelEnrollment,
  cancelStage,
  cancelStageEnrollmentWithToken,
  type EnrollInSeriesInput,
  enrollInSeries,
  enrollmentProgress,
  hashToken,
  reportAbsenceWithToken,
  setEnrollmentPaid,
  updateSeriesEnrollment,
} from "@horaya/core";
import {
  getEnrollment,
  getPublicEvent,
  getSeriesOffer,
  listMakeupTargets,
  listSeriesEnrollments,
} from "@horaya/db";
import { notFound, redirect } from "@tanstack/react-router";
import { enrollmentPayment } from "@/lib/enrollment";
import { rawFieldValues } from "@/lib/fields";
import { parseEuroToCents } from "@/lib/money";
import { sendEnrollmentEmail } from "./booking-emails";
import { db } from "./db";
import { type FormState, toFormState } from "./form-state";
import { getWorkspaceBySlug } from "./public";
import { customerPrefill, publicEventPage } from "./public-booking";
import { clientIp, rateLimited } from "./rate-limit";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/* ---------- Page publique ---------- */

/** Inscription à toute la série depuis la fiche d'un cours : ouverte, et des places partout. */
export async function enrollEventPage(slug: string, eventSlug: string) {
  const data = await publicEventPage(slug, eventSlug, undefined);
  const offer = data.offer;
  if (data.event && (!offer || offer.fullSessions.length > 0)) {
    throw redirect({ href: `/${slug}/${eventSlug}` });
  }
  return { ...data, offer, prefill: await customerPrefill() };
}

/** « Inscris-toi pour tout le trimestre » : une inscription, une réservation par séance. */
export async function createPublicEnrollment(
  slug: string,
  eventSlug: string,
  form: FormData,
): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  const event = workspace ? await getPublicEvent(db, workspace.id, eventSlug) : null;
  if (!workspace || !event?.seriesId) return { error: "Ce cours n'est plus disponible." };
  const blocked = await rateLimited(`booking:ip:${await clientIp()}`, 20, 3600);
  if (blocked) return { error: blocked };
  if (form.get("terms") !== "on") {
    return {
      error: "Vérifie les champs en rouge.",
      fieldErrors: { terms: "Accepte les conditions pour t'inscrire" },
    };
  }
  const customer = {
    firstName: text(form, "firstName"),
    lastName: text(form, "lastName"),
    email: text(form, "email"),
    phone: text(form, "phone") || null,
  };
  let manageToken: string;
  try {
    const created = await enrollInSeries(
      deps,
      { type: "customer", organizationId: workspace.id },
      {
        seriesId: event.seriesId,
        customer,
        // « Ce que tu demandes » : une fois pour l'inscription, et pour la personne inscrite.
        answers: rawFieldValues(form, "a."),
        participants: [{ ...customer, answers: rawFieldValues(form, "p0.") }],
        // Stage : le tarif choisi (le core revérifie qu'il existe).
        rateId: text(form, "rateId") || null,
      },
    );
    manageToken = created.manageToken;
    await sendEnrollmentEmail(workspace.id, created.enrollment.id, manageToken);
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/${slug}/reservation/${manageToken}?nouvelle=1` });
}

/**
 * Lien de gestion d'une inscription (même adresse que « Gérer ma réservation ») : les
 * séances, la progression et le paiement. null si le jeton n'est pas celui d'une inscription.
 */
export async function managedEnrollment(
  workspace: { id: string; paymentLinkUrl: string | null },
  token: string,
  now: Date,
) {
  const enrollment = await getEnrollment(
    db,
    workspace.id,
    { tokenHash: await hashToken(token) },
    now,
  );
  if (!enrollment) return null;
  return {
    ...enrollment,
    progress: {
      ...enrollmentProgress(enrollment.sessions, now),
      stage: enrollment.seriesKind === "stage",
    },
    payment: enrollmentPayment(enrollment, workspace.paymentLinkUrl),
  };
}
export type ManagedEnrollment = NonNullable<Awaited<ReturnType<typeof managedEnrollment>>>;

/** « Je serai absent·e » sur une séance, depuis le lien de gestion de l'inscription. */
export async function reportAbsence(
  slug: string,
  token: string,
  eventId: string,
): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  try {
    await reportAbsenceWithToken(deps, workspace.id, token, eventId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "C'est noté : ta place profite à quelqu'un d'autre." };
}

/** Stage : l'élève annule son inscription (toutes les séances), selon la règle du type. */
export async function cancelStageEnrollment(slug: string, token: string): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  try {
    const { refundPercent } = await cancelStageEnrollmentWithToken(deps, workspace.id, token);
    return {
      success:
        refundPercent === 100
          ? "C'est noté : ton inscription est annulée, et remboursée en entier."
          : refundPercent > 0
            ? `C'est noté : ton inscription est annulée, ${refundPercent} % te sont remboursés.`
            : "C'est noté : ton inscription est annulée. Selon la règle d'annulation, rien n'est remboursé.",
    };
  } catch (error) {
    return toFormState(error);
  }
}

/** « Annuler mon absence » : la place est rendue si elle est toujours libre. */
export async function cancelAbsence(
  slug: string,
  token: string,
  eventId: string,
): Promise<FormState> {
  const workspace = await getWorkspaceBySlug(slug);
  if (!workspace) return { error: "Espace introuvable." };
  try {
    await cancelAbsenceWithToken(deps, workspace.id, token, eventId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "C'est noté : ta place t'attend." };
}

/* ---------- Côté équipe ---------- */

/** Onglet « Série » d'une fiche événement : réglage, séances restantes et inscrits. */
export async function seriesPanel(organizationId: string, seriesId: string) {
  const now = new Date();
  const [offer, enrollments] = await Promise.all([
    getSeriesOffer(db, organizationId, seriesId, now),
    listSeriesEnrollments(db, organizationId, seriesId, now),
  ]);
  if (!offer) throw notFound();
  // Séances où chaque séance à rattraper peut l'être (pour « Attribuer »).
  const targets: Record<string, Awaited<ReturnType<typeof listMakeupTargets>>> = {};
  for (const row of enrollments) {
    for (const makeup of row.makeups) {
      if (makeup.state !== "available" || row.cancelledAt) continue;
      targets[makeup.absentBookingId] = await listMakeupTargets(db, organizationId, {
        absentEventId: makeup.absentEventId,
        seriesId,
        customerId: row.customerId,
        now,
        publicOnly: false,
      });
    }
  }
  return { offer, enrollments, targets };
}

/** Attribue à un·e inscrit·e une séance de rattrapage (équipe). */
export async function assignMakeupImpl(
  absentBookingId: string,
  eventId: string,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await assignMakeup(deps, actor, absentBookingId, eventId);
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Rattrapage attribué." };
}

export async function saveSeriesEnrollment(seriesId: string, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  const enabled = form.get("enrollmentEnabled") === "on";
  const price = text(form, "enrollmentPrice");
  try {
    await updateSeriesEnrollment(deps, actor, seriesId, {
      enrollmentEnabled: enabled,
      enrollmentPriceCents: price === "" ? null : parseEuroToCents(price),
      dropInAllowed: !enabled || form.get("dropInAllowed") === "on",
      enrollmentProrata: !enabled || form.get("enrollmentProrata") === "on",
      makeupAllowed: !enabled || form.get("makeupAllowed") === "on",
    });
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Réglage de la série enregistré." };
}

export async function cancelEnrollmentImpl(enrollmentId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    const { releasedSessions } = await cancelEnrollment(deps, actor, enrollmentId);
    return {
      success: `Désinscription faite : ${releasedSessions} séance${releasedSessions > 1 ? "s" : ""} libérée${releasedSessions > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    return toFormState(error);
  }
}

/** « Annuler le stage » : toutes ses séances et ses inscriptions, un e-mail par inscrit. */
export async function cancelStageImpl(seriesId: string): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    const { cancelledSessions, cancelledEnrollments } = await cancelStage(deps, actor, seriesId);
    return {
      success: `Stage annulé : ${cancelledSessions} séance${cancelledSessions > 1 ? "s" : ""}, ${cancelledEnrollments} inscrit${cancelledEnrollments > 1 ? "s" : ""} prévenu${cancelledEnrollments > 1 ? "s" : ""}.`,
    };
  } catch (error) {
    return toFormState(error);
  }
}

export async function setEnrollmentPaidImpl(
  enrollmentId: string,
  paid: boolean,
): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await setEnrollmentPaid(deps, actor, enrollmentId, paid);
  } catch (error) {
    return toFormState(error);
  }
  return { success: paid ? "Paiement noté." : "Paiement retiré." };
}

export type CounterEnrollmentResult =
  | { ok: true; sessions: number; amountCents: number; paid: boolean }
  | ({ ok: false } & FormState);

/** Comptoir : inscrit le client choisi (ou créé) à toute la série de la séance. */
export async function createCounterEnrollmentImpl(
  input: EnrollInSeriesInput,
): Promise<CounterEnrollmentResult> {
  const { actor } = await getWorkspaceContext();
  try {
    const { enrollment, bookings, manageToken } = await enrollInSeries(deps, actor, input);
    await sendEnrollmentEmail(actor.organizationId, enrollment.id, manageToken);
    return {
      ok: true,
      sessions: bookings.length,
      amountCents: enrollment.amountCents,
      paid: enrollment.paidAt !== null,
    };
  } catch (error) {
    return { ok: false, ...toFormState(error) };
  }
}
