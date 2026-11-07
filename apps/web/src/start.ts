import { DomainError } from "@horaya/core";
import { isNotFound, isRedirect } from "@tanstack/react-router";
import { createMiddleware, createStart } from "@tanstack/react-start";

/**
 * Erreurs inattendues des fonctions serveur → suivi des erreurs. Les redirections, pages
 * introuvables et erreurs métier (message affiché à l'utilisateur) ne sont pas des pannes.
 */
const reportServerErrors = createMiddleware({ type: "function" }).server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (!isRedirect(error) && !isNotFound(error) && !(error instanceof DomainError)) {
      // Import différé : le SDK ne doit jamais entrer dans le code du navigateur.
      const { reportError } = await import("./server/errors");
      reportError(error);
    }
    throw error;
  }
});

export const startInstance = createStart(() => ({ functionMiddleware: [reportServerErrors] }));
