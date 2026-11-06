import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  acceptInvitation,
  invitationPage,
  joinPage,
  joinWithLink,
  rejectInvitation,
} from "@/server/invitations";

export const getInvitationPage = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => invitationPage(data));

const acceptFn = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(({ data }) => acceptInvitation(data));
const rejectFn = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(({ data }) => rejectInvitation(data));

/** Rejoint l'espace et l'ouvre aussitôt (redirection vers /app). */
export const acceptInvitationAction = (invitationId: string) => acceptFn({ data: invitationId });
export const rejectInvitationAction = (invitationId: string) => rejectFn({ data: invitationId });

export const getJoinPage = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(({ data }) => joinPage(data));

const joinFn = createServerFn({ method: "POST" })
  .validator(z.string())
  .handler(({ data }) => joinWithLink(data));

/** Rejoint l'espace d'un lien d'invitation général. */
export const joinWithLinkAction = (token: string) => joinFn({ data: token });
