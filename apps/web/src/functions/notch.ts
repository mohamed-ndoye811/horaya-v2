import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  openNotifications as notifications,
  readNotifications as read,
  searchWorkspace as search,
} from "@/server/notch";

export type { NotificationItem, SearchHit, SearchResults } from "@/server/notch";

const searchFn = createServerFn({ method: "POST" })
  .validator(z.string().max(200))
  .handler(({ data }) => search(data));
const notificationsFn = createServerFn({ method: "POST" }).handler(() => notifications());
const readFn = createServerFn({ method: "POST" }).handler(() => read());

/** Recherche du notch (⌘K). */
export const searchWorkspace = (query: string) => searchFn({ data: query });
/** Ouverture de la cloche : les dernières notifications (sans les passer en lu). */
export const openNotifications = () => notificationsFn();
/** Notifications vues (restées affichées une seconde) : tout passe en lu. */
export const readNotifications = () => readFn();
