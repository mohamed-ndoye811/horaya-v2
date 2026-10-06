/**
 * Erreurs métier. Le core lève ces erreurs ; chaque porte d'entrée
 * (app web, API publique) les traduit dans son propre format.
 */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly issues: ReadonlyArray<{ path: string; message: string }> = [],
  ) {
    super("validation_failed", message);
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string, id: string) {
    super("not_found", `${entity} introuvable : ${id}`);
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Action non autorisée") {
    super("forbidden", message);
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super("conflict", message);
  }
}
