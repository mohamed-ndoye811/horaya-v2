/** Clients : logique serveur des formulaires (voir functions/clients.ts). */
import { addCustomerNote, createCustomer, updateCustomer } from "@horaya/core";
import { type CustomerSegment, listCustomers } from "@horaya/db";
import { redirect } from "@tanstack/react-router";
import { toCsv } from "@/lib/csv";
import { db } from "./db";
import { type FormState, toFormState } from "./form-state";
import { deps } from "./services";
import { getWorkspaceContext } from "./workspace";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function customerFields(form: FormData) {
  return {
    firstName: text(form, "firstName"),
    lastName: text(form, "lastName"),
    email: text(form, "email"),
    phone: text(form, "phone") || null,
    company: text(form, "company") || null,
    tags: text(form, "tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    marketingConsent: form.get("marketingConsent") === "on",
  };
}

/** Ajout (customerId null) ou modification d'un client. */
export async function saveCustomer(customerId: string | null, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  let targetId: string;
  try {
    const saved = customerId
      ? await updateCustomer(deps, actor, customerId, customerFields(form))
      : await createCustomer(deps, actor, customerFields(form));
    targetId = saved.id;
  } catch (error) {
    return toFormState(error);
  }
  throw redirect({ href: `/app/clients/${targetId}` });
}

export async function addNote(customerId: string, form: FormData): Promise<FormState> {
  const { actor } = await getWorkspaceContext();
  try {
    await addCustomerNote(deps, actor, customerId, {
      body: text(form, "body"),
      pinned: form.get("pinned") === "on",
    });
  } catch (error) {
    return toFormState(error);
  }
  return { success: "Note ajoutée." };
}

const SEGMENTS: CustomerSegment[] = ["all", "vip", "company", "inactive"];

/** Export CSV des clients, avec les filtres en cours (route serveur /app/clients/export). */
export async function exportCustomersCsv(request: Request) {
  const { workspace } = await getWorkspaceContext();
  const url = new URL(request.url);
  const segment = SEGMENTS.find((entry) => entry === url.searchParams.get("segment")) ?? "all";
  const rows = await listCustomers(db, workspace.id, {
    segment,
    now: new Date(),
    search: url.searchParams.get("q") ?? undefined,
    limit: 50_000,
  });
  const csv = toCsv(
    [
      "Prénom",
      "Nom",
      "E-mail",
      "Téléphone",
      "Entreprise",
      "Réservations",
      "Dépensé (€)",
      "Étiquettes",
      "Client depuis",
    ],
    rows.map((row) => [
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.company,
      row.bookings,
      (row.spentCents / 100).toFixed(2).replace(".", ","),
      row.tags.join(", "),
      row.createdAt.toISOString().slice(0, 10),
    ]),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clients-${workspace.slug}-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
