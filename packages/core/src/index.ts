// Métier pur d'Horaya : aucune dépendance à Next.js, Hono ou Postgres.
// Organisation par module (tenants, events, bookings, customers, inventory…),
// chacun exposant ses entités, ses ports (interfaces de dépôt) et ses cas d'usage.
export * from "./shared/errors";
export * from "./shared/validate";
