/** Étiquettes affichées d'un client : celles posées par l'équipe + celles déduites. */
export interface CustomerTagInput {
  tags: string[];
  company: string | null;
  bookings: number;
  createdAt: Date;
  lastVisit: Date | null;
  nextVisit: Date | null;
}

export type CustomerTag = { label: string; tone: "ink" | "outline" | "success" | "draft" };

const VIP_BOOKINGS = 5;
const NEW_DAYS = 30;
const INACTIVE_DAYS = 180;

export function customerTags(customer: CustomerTagInput, now: Date): CustomerTag[] {
  const day = 86_400_000;
  const manual = customer.tags.map((tag) => tag.toLowerCase());
  const tags: CustomerTag[] = [];
  if (manual.includes("vip") || customer.bookings >= VIP_BOOKINGS)
    tags.push({ label: "VIP", tone: "ink" });
  if (customer.company || manual.includes("entreprise"))
    tags.push({ label: "Entreprise", tone: "outline" });
  const lastActivity = Math.max(
    customer.lastVisit?.getTime() ?? 0,
    customer.nextVisit?.getTime() ?? 0,
    customer.createdAt.getTime(),
  );
  if (now.getTime() - customer.createdAt.getTime() < NEW_DAYS * day)
    tags.push({ label: "Nouveau", tone: "success" });
  else if (!customer.nextVisit && now.getTime() - lastActivity > INACTIVE_DAYS * day)
    tags.push({ label: "Inactif", tone: "draft" });
  for (const tag of manual) {
    if (tag !== "vip" && tag !== "entreprise") tags.push({ label: tag, tone: "outline" });
  }
  return tags;
}
