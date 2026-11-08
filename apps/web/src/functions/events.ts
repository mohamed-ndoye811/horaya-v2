import {
  can,
  EVENT_TYPE_TEMPLATES,
  type EventModules,
  type EventTypeField,
  isCheckInOpen,
  unitLabel,
} from "@horaya/core";
import {
  countEventsByTab,
  equipmentUnitsOfType,
  getEventDetail,
  listCalendarLinks,
  listEventItems,
  listEventRuleRuns,
  listEventStaff,
  listEvents,
  listEventTypes,
  listItemsAvailableBetween,
  listItemTypes,
  listLinkableEvents,
  listPassPlans,
  listRuleTestBookings,
  listTeam,
  tenantSettingsReader,
} from "@horaya/db";
import { notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { EventTypeEditorValues } from "@/features/events/event-type-editor";
import { emptyEventValues, eventToValues } from "@/features/events/form-values";
import { parseCivilDate } from "@/lib/dates";
import { formDataInput } from "@/lib/form-data";
import { formatShortDateTime } from "@/lib/format";
import { searchText } from "@/lib/search-params";
import { db } from "@/server/db";
import { seriesPanel } from "@/server/enrollments";
import { env } from "@/server/env";
import {
  archiveEventTypeActionImpl,
  cancelEventActionImpl,
  deleteCalendarLinkImpl,
  keepEventActionImpl,
  publishEventActionImpl,
  removeEventItemActionImpl,
  ruleTestFactsImpl,
  saveCalendarLink,
  saveEvent as saveEventImpl,
  saveEventType as saveEventTypeImpl,
  setCalendarLinkActiveImpl,
  setEventItemActionImpl,
} from "@/server/events";
import type { FormState } from "@/server/form-state";
import { getWorkspaceContext } from "@/server/workspace";

export const EVENT_TABS = ["all", "published", "draft", "past"] as const;

/** Filtres de l'écran 04, tels qu'ils sont dans l'adresse. */
export const eventsSearch = z.object({
  onglet: z.enum(EVENT_TABS).optional().catch(undefined),
  q: searchText,
  type: searchText,
  intervenant: searchText,
});

/** Écran 04 : événements filtrés, compteurs des onglets, types pour le filtre. */
export const getEvents = createServerFn({ method: "GET" })
  .validator(eventsSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const [counts, events, types, staff] = await Promise.all([
      countEventsByTab(db, workspace.id, now),
      listEvents(db, workspace.id, {
        tab: data.onglet ?? "all",
        now,
        search: data.q,
        typeId: data.type,
        staffMemberId: data.intervenant,
      }),
      listEventTypes(db, workspace.id),
      listEventStaff(db, workspace.id),
    ]);
    return {
      timeZone,
      now,
      counts,
      events,
      types: types.map((type) => ({ id: type.id, name: type.name })),
      staff,
    };
  });

/** Types proposés dans le formulaire d'événement. */
const typeOption = (
  type: {
    id: string;
    name: string;
    color: string;
    fields: EventTypeField[];
    defaultDurationMinutes: number | null;
    defaultPriceCents: number | null;
    modules: EventModules;
  },
  resourceModules: EventModules = type.modules,
) => ({
  id: type.id,
  name: type.name,
  color: type.color,
  fields: type.fields,
  defaultDurationMinutes: type.defaultDurationMinutes,
  defaultPriceCents: type.defaultPriceCents,
  // Réglages de départ des modules (places, validation, invitation, tarifs, acompte).
  pricing: type.modules.pricing ?? null,
  deposit: type.modules.deposit ?? null,
  defaultCapacity: type.modules.places?.capacity ?? null,
  requiresApproval: Boolean(type.modules.approval),
  inviteOnly: Boolean(type.modules.access?.inviteOnly),
  // Modules Ressources : intervenant, matériel et lieu (ceux de l'événement à la modification).
  staff: resourceModules.staff ? { memberIds: resourceModules.staff.memberIds ?? [] } : null,
  needs: (resourceModules.equipment?.needs ?? []).map((need) => ({
    id: need.id,
    itemTypeId: need.itemTypeId,
  })),
  locationMode: resourceModules.location?.mode ?? null,
});

/** Équipe et exemplaires des types de matériel visés, pour l'intervenant et les exemplaires proposés. */
async function resourceChoices(workspaceId: string, modulesList: EventModules[]) {
  const wanted = new Set(
    modulesList.flatMap((modules) => (modules.equipment?.needs ?? []).map((n) => n.itemTypeId)),
  );
  const [team, ...categories] = await Promise.all([
    listTeam(db, workspaceId, new Date()),
    ...[...wanted].map((id) => equipmentUnitsOfType(db, workspaceId, id)),
  ]);
  return {
    members: team.members.map((entry) => ({ id: entry.id, name: entry.name })),
    itemTypes: Object.fromEntries(
      [...wanted].flatMap((id, index) => {
        const found = categories[index];
        return found
          ? [
              [
                id,
                {
                  name: found.name,
                  units: found.units
                    .filter((unit) => unit.status !== "retired")
                    .map((unit) => ({ id: unit.id, label: unitLabel(unit) })),
                },
              ],
            ]
          : [];
      }),
    ),
  };
}

export const newEventSearch = z.object({ date: searchText, titre: searchText });

/** Écran 09 (création) : types et valeurs de départ (jour choisi dans le calendrier). */
export const getNewEvent = createServerFn({ method: "GET" })
  .validator(newEventSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const types = await listEventTypes(db, workspace.id);
    const day = parseCivilDate(data.date) ?? undefined;
    return {
      timeZone,
      types: types.map((type) => typeOption(type)),
      resources: await resourceChoices(
        workspace.id,
        types.map((type) => type.modules),
      ),
      initial: { ...emptyEventValues(timeZone, day), title: data.titre ?? "" },
    };
  });

export const EVENT_DETAIL_TABS = ["participants", "materiel", "infos", "serie"] as const;
export const eventSearch = z.object({
  onglet: z.enum(EVENT_DETAIL_TABS).optional().catch(undefined),
});

/** Écran 15 : fiche d'un événement, son matériel et (onglet Matériel) les articles libres. */
export const getEvent = createServerFn({ method: "GET" })
  .validator(z.object({ id: z.string().uuid(), onglet: eventSearch.shape.onglet }))
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const [detail, items, ruleRuns] = await Promise.all([
      getEventDetail(db, workspace.id, data.id),
      listEventItems(db, workspace.id, data.id),
      data.onglet === "infos" ? listEventRuleRuns(db, workspace.id, data.id) : [],
    ]);
    if (!detail) throw notFound();
    const now = new Date();
    return {
      timeZone,
      now,
      detail,
      items,
      // Onglet « Infos » : ce que les règles « si… alors… » ont fait (lot 36).
      ruleRuns,
      // Check-in : à partir de la veille, la fiche sert à pointer les arrivées.
      checkIn: detail.event.status === "published" && isCheckInOpen(detail.event, now),
      candidates:
        data.onglet === "materiel"
          ? await listItemsAvailableBetween(db, workspace.id, detail.event, detail.event.id)
          : [],
      // Cours à l'année : réglage de la série et inscrits (onglet « Série »).
      series:
        data.onglet === "serie" && detail.event.seriesId
          ? await seriesPanel(workspace.id, detail.event.seriesId)
          : null,
    };
  });

/** Modification d'un événement (pas d'un événement annulé). */
export const getEditEvent = createServerFn({ method: "GET" })
  .validator(z.string().uuid())
  .handler(async ({ data: id }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const [detail, types] = await Promise.all([
      getEventDetail(db, workspace.id, id),
      listEventTypes(db, workspace.id),
    ]);
    if (!detail) throw notFound();
    if (detail.event.status === "cancelled") throw redirect({ href: `/app/evenements/${id}` });
    const { event } = detail;
    // Le type actuel reste proposé même s'il a été archivé depuis, avec la version de ses
    // champs et de ses tarifs copiée sur l'événement.
    const current = {
      id: event.typeId,
      name: event.typeName,
      color: event.typeColor,
      fields: event.fields,
      defaultDurationMinutes: null,
      defaultPriceCents: null,
      modules: event.modules.pricing ? { pricing: event.modules.pricing } : {},
    };
    const options = [
      ...types.filter((type) => type.id !== event.typeId).map((type) => typeOption(type)),
      typeOption(current, event.modules),
    ];
    return {
      timeZone,
      resources: await resourceChoices(workspace.id, [event.modules]),
      event: { id: event.id, title: event.title, status: event.status },
      types: options,
      initial: eventToValues(event, timeZone),
      fieldValues: event.fieldValues,
    };
  });

/** `type` : un type à modifier, ou « nouveau » (avec `modele` ou `depuis` : l'éditeur, sinon le choix). */
export const eventTypesSearch = z.object({
  type: searchText,
  modele: searchText,
  depuis: searchText,
});

/** Écran 16 : types d'événements ; maquettes 9.1 (éditeur) et 9.3 (nouveau type). */
export const getEventTypes = createServerFn({ method: "GET" })
  .validator(eventTypesSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const [types, settings, itemTypes, team, plans, testBookings] = await Promise.all([
      listEventTypes(db, workspace.id),
      tenantSettingsReader(db).get(workspace.id),
      listItemTypes(db, workspace.id),
      listTeam(db, workspace.id, new Date()),
      listPassPlans(db, workspace.id),
      data.type && data.type !== "nouveau"
        ? listRuleTestBookings(db, workspace.id, data.type).catch(() => [])
        : [],
    ]);
    const existing = types.find((type) => type.id === data.type);
    const source = types.find((type) => type.id === data.depuis);
    const template = EVENT_TYPE_TEMPLATES.find((entry) => entry.id === data.modele);
    const blank = {
      eventCount: 0,
      upcomingUnbooked: 0,
      bookingNoun: "reservation" as const,
      fields: [],
      modules: {},
      rules: [],
    };
    // Nouveau type : copie d'un type, ou modèle du core (nom libre si déjà pris).
    const base = existing ?? source ?? template;
    const editor: EventTypeEditorValues | null =
      !base || (data.type !== "nouveau" && !existing)
        ? null
        : {
            ...blank,
            ...base,
            id: existing?.id ?? null,
            name: existing
              ? existing.name
              : source
                ? `${source.name} (copie)`
                : types.some((type) => type.name === template?.name)
                  ? ""
                  : (template?.name ?? ""),
            eventCount: existing?.eventCount ?? 0,
            upcomingUnbooked: existing?.upcomingUnbooked ?? 0,
            origin: existing
              ? null
              : source
                ? `Copie de « ${source.name} »`
                : `Créé depuis le modèle « ${template?.name} »`,
            structure: {
              freeCancellationHours: settings.freeCancellationHours,
              lateCancellationRefundPercent: settings.lateCancellationRefundPercent,
            },
            timeZone,
            itemTypes: itemTypes.map((type) => ({ id: type.id, name: type.name })),
            members: team.members.map((entry) => ({ id: entry.id, name: entry.name })),
            passPlans: plans
              .filter((plan) => !plan.archivedAt)
              .map((plan) => ({ id: plan.id, name: plan.name })),
            // « Tester sur une inscription » : les dernières inscriptions aux événements du type.
            testBookings: testBookings.map((entry) => ({
              id: entry.id,
              label: `${entry.customerName || entry.reference} · ${entry.eventTitle} · ${formatShortDateTime(entry.startsAt, timeZone)}`,
            })),
          };
    return {
      workspaceName: workspace.name,
      types: types.map((type) => ({ ...type })),
      editor,
    };
  });

/** Liens calendrier : liens, ce qu'ils montrent, et les choix possibles. */
export const getCalendarLinks = createServerFn({ method: "GET" }).handler(async () => {
  const { workspace, actor, timeZone } = await getWorkspaceContext();
  const now = new Date();
  const [links, types, events] = await Promise.all([
    listCalendarLinks(db, workspace.id, now),
    listEventTypes(db, workspace.id),
    listLinkableEvents(db, workspace.id, now),
  ]);
  const editable = actor.type === "member" && can(actor.role, "event", "publish");
  const canDelete = actor.type === "member" && can(actor.role, "event", "delete");

  const typeNames = new Map(types.map((type) => [type.id, type.name]));
  const eventTitles = new Map(events.map((entry) => [entry.id, entry.title]));
  const summary = (link: (typeof links)[number]) => {
    if (link.filterMode === "all") return "Tous les événements";
    const names = link.filterIds
      .map((id) => (link.filterMode === "event_types" ? typeNames.get(id) : eventTitles.get(id)))
      .filter(Boolean);
    if (link.filterMode === "event_types") return names.join(", ") || "Types supprimés";
    return names.length === 1
      ? (names[0] ?? "")
      : `${link.filterIds.length} événements${names.length ? ` : ${names.slice(0, 2).join(", ")}${names.length > 2 ? "…" : ""}` : ""}`;
  };
  return {
    editable,
    canDelete,
    rows: links.map((link) => ({
      id: link.id,
      name: link.name,
      url: new URL(`/${workspace.slug}/calendrier/${link.slug}`, env.BETTER_AUTH_URL).toString(),
      filterMode: link.filterMode,
      filterIds: link.filterIds,
      summary: summary(link),
      upcomingEvents: link.upcomingEvents,
      isActive: link.isActive,
    })),
    choices: {
      types: types.map((type) => ({ id: type.id, name: type.name, color: type.color })),
      events: events.map((entry) => ({
        id: entry.id,
        title: entry.title,
        date: formatShortDateTime(entry.startsAt, timeZone),
        inviteOnly: entry.visibility === "invite_only",
        draft: entry.status === "draft",
      })),
    },
  };
});

/*
 * Actions, aux mêmes noms que les anciennes Server Actions. Les arguments liés (bind) sont
 * glissés dans le formulaire envoyé.
 */
const ID_FIELD = "_id";
const idOf = (form: FormData) => String(form.get(ID_FIELD) ?? "") || null;
const id = z.string().uuid();

const saveEventFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveEventImpl(idOf(data), data));
const publishFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => publishEventActionImpl(data));
const cancelFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventId: id, reason: z.string().max(500) }))
  .handler(({ data }) => cancelEventActionImpl(data.eventId, data.reason));
const keepFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => keepEventActionImpl(data));
const saveTypeFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveEventTypeImpl(idOf(data), data));
const ruleTestFactsFn = createServerFn({ method: "GET" })
  .validator(id)
  .handler(({ data }) => ruleTestFactsImpl(data));
const archiveTypeFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => archiveEventTypeActionImpl(data));
const setItemFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventId: id, itemId: id, quantity: z.number().int() }))
  .handler(({ data }) => setEventItemActionImpl(data.eventId, data.itemId, data.quantity));
const removeItemFn = createServerFn({ method: "POST" })
  .validator(z.object({ eventId: id, itemId: id }))
  .handler(({ data }) => removeEventItemActionImpl(data.eventId, data.itemId));
const saveLinkFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveCalendarLink(idOf(data), data));
const setLinkActiveFn = createServerFn({ method: "POST" })
  .validator(z.object({ linkId: id, isActive: z.boolean() }))
  .handler(({ data }) => setCalendarLinkActiveImpl(data.linkId, data.isActive));
const deleteLinkFn = createServerFn({ method: "POST" })
  .validator(id)
  .handler(({ data }) => deleteCalendarLinkImpl(data));

/** Création (eventId null) ou modification d'un événement ; renvoie vers sa fiche. */
export function saveEvent(eventId: string | null, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, eventId ?? "");
  return saveEventFn({ data: form });
}
export const publishEventAction = (eventId: string) => publishFn({ data: eventId });
export const cancelEventAction = (eventId: string, reason: string) =>
  cancelFn({ data: { eventId, reason } });
export const keepEventAction = (eventId: string) => keepFn({ data: eventId });

/** Création (typeId null) ou modification d'un type ; renvoie vers son panneau. */
export function saveEventType(typeId: string | null, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, typeId ?? "");
  return saveTypeFn({ data: form });
}
/** Archive le type puis renvoie vers la liste (redirection levée, à suivre par l'appelant). */
export const archiveEventTypeAction = (typeId: string) => archiveTypeFn({ data: typeId });
/** Ce qu'on sait d'une inscription pour « Tester sur une inscription » (rien n'est exécuté). */
export const getRuleTestFacts = (bookingId: string) => ruleTestFactsFn({ data: bookingId });

export const setEventItemAction = (eventId: string, itemId: string, quantity: number) =>
  setItemFn({ data: { eventId, itemId, quantity } });
export const removeEventItemAction = (eventId: string, itemId: string) =>
  removeItemFn({ data: { eventId, itemId } });

export function saveCalendarLinkAction(
  linkId: string | null,
  _previous: FormState,
  form: FormData,
) {
  form.set(ID_FIELD, linkId ?? "");
  return saveLinkFn({ data: form });
}
export const setCalendarLinkActiveAction = (linkId: string, isActive: boolean) =>
  setLinkActiveFn({ data: { linkId, isActive } });
export const deleteCalendarLinkAction = (linkId: string) => deleteLinkFn({ data: linkId });
