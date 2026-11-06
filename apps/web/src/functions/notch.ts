import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { openNotifications as notifications, searchWorkspace as search } from "@/server/notch";

export type { NotificationItem, SearchHit, SearchResults } from "@/server/notch";

const searchFn = createServerFn({ method: "POST" })
  .validator(z.string().max(200))
  .handler(({ data }) => search(data));
const notificationsFn = createServerFn({ method: "POST" }).handler(() => notifications());

/** Recherche du notch (⌘K). */
export const searchWorkspace = (query: string) => searchFn({ data: query });
/** Ouverture de la cloche : les dernières notifications, puis tout passe en lu. */
export const openNotifications = () => notificationsFn();
