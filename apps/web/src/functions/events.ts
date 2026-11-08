import { can, EVENT_TYPE_TEMPLATES, type EventTypeField, isCheckInOpen } from "@horaya/core";
import {
  countEventsByTab,
  getEventDetail,
  listCalendarLinks,
  listEventItems,
  listEvents,
  listEventTypes,
  listItemsAvailableBetween,
  listLinkableEvents,
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
  publishEventActionImpl,
  removeEventItemActionImpl,
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
});

/** Écran 04 : événements filtrés, compteurs des onglets, types pour le filtre. */
export const getEvents = createServerFn({ method: "GET" })
  .validator(eventsSearch)
  .handler(async ({ data }) => {
    const { workspace, timeZone } = await getWorkspaceContext();
    const now = new Date();
    const [counts, events, types] = await Promise.all([
      countEventsByTab(db, workspace.id, now),
      listEvents(db, workspace.id, {
        tab: data.onglet ?? "all",
        now,
        search: data.q,
        typeId: data.type,
      }),
      listEventTypes(db, workspace.id),
    ]);
    return {
      timeZone,
      now,
      counts,
      events,
      types: types.map((type) => ({ id: type.id, name: type.name })),
    };
  });

/** Types proposés dans le formulaire d'événement. */
const typeOption = (type: {
  id: string;
  name: string;
  color: string;
  fields: EventTypeField[];
  defaultDurationMinutes: number | null;
  defaultPriceCents: number | null;
  defaultCapacity: number | null;
  requiresApproval: boolean;
}) => ({
  id: type.id,
  name: type.name,
  color: type.color,
  fields: type.fields,
  defaultDurationMinutes: type.defaultDurationMinutes,
  defaultPriceCents: type.defaultPriceCents,
  defaultCapacity: type.defaultCapacity,
  requiresApproval: type.requiresApproval,
});

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
      types: types.map(typeOption),
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
    const [detail, items] = await Promise.all([
      getEventDetail(db, workspace.id, data.id),
      listEventItems(db, workspace.id, data.id),
    ]);
    if (!detail) throw notFound();
    const now = new Date();
    return {
      timeZone,
      now,
      detail,
      items,
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
    // champs copiée sur l'événement.
    const current = {
      id: event.typeId,
      name: event.typeName,
      color: event.typeColor,
      fields: event.fields,
      defaultDurationMinutes: null,
      defaultPriceCents: null,
      defaultCapacity: null,
      requiresApproval: false,
    };
    const options = [
      ...types.filter((type) => type.id !== event.typeId).map(typeOption),
      typeOption(current),
    ];
    return {
      timeZone,
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
    const { workspace } = await getWorkspaceContext();
    const types = await listEventTypes(db, workspace.id);
    const existing = types.find((type) => type.id === data.type);
    const source = types.find((type) => type.id === data.depuis);
    const template = EVENT_TYPE_TEMPLATES.find((entry) => entry.id === data.modele);
    const blank = {
      eventCount: 0,
      upcomingUnbooked: 0,
      bookingNoun: "reservation" as const,
      fields: [],
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
const saveTypeFn = createServerFn({ method: "POST" })
  .validator(formDataInput)
  .handler(({ data }) => saveEventTypeImpl(idOf(data), data));
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

/** Création (typeId null) ou modification d'un type ; renvoie vers son panneau. */
export function saveEventType(typeId: string | null, _previous: FormState, form: FormData) {
  form.set(ID_FIELD, typeId ?? "");
  return saveTypeFn({ data: form });
}
/** Archive le type puis renvoie vers la liste (redirection levée, à suivre par l'appelant). */
export const archiveEventTypeAction = (typeId: string) => archiveTypeFn({ data: typeId });

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
