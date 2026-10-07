import { type Actor, actorRef, assertMemberCan } from "../shared/actor";
import { NotFoundError } from "../shared/errors";
import type { Deps } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import type { Customer, CustomerNote } from "./model";
import {
  type CreateCustomerInput,
  type CustomerNoteInput,
  createCustomerSchema,
  customerNoteSchema,
  type UpdateCustomerInput,
  updateCustomerSchema,
} from "./schemas";

/** Ajout d'un client par l'équipe (écran 22, « Ajouter un client »). */
export async function createCustomer(
  deps: Deps,
  actor: Actor,
  input: CreateCustomerInput,
): Promise<Customer> {
  assertMemberCan(actor, "customer", "create");
  const data = validate(createCustomerSchema, input);

  return deps.uow.run(async (repositories) => {
    const created = await repositories.customers.insert(actor.organizationId, data);
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "customer",
      entityId: created.id,
      action: "customer.created",
      ...actorRef(actor),
    });
    return created;
  });
}

export async function updateCustomer(
  deps: Deps,
  actor: Actor,
  customerId: string,
  input: UpdateCustomerInput,
): Promise<Customer> {
  assertMemberCan(actor, "customer", "update");
  const patch = validate(updateCustomerSchema, input);

  return deps.uow.run(async (repositories) => {
    const existing = await repositories.customers.find(actor.organizationId, customerId);
    if (!existing || existing.anonymizedAt) throw new NotFoundError("Client", customerId);
    const updated = await repositories.customers.update(actor.organizationId, customerId, patch);
    await repositories.activity.record({
      organizationId: actor.organizationId,
      entityType: "customer",
      entityId: customerId,
      action: "customer.updated",
      ...actorRef(actor),
      data: { fields: Object.keys(patch) },
    });
    return updated;
  });
}

/** Note interne sur un client (visible par l'équipe seulement). */
export async function addCustomerNote(
  deps: Deps,
  actor: Actor,
  customerId: string,
  input: CustomerNoteInput,
): Promise<CustomerNote> {
  assertMemberCan(actor, "customer", "update");
  const data = validate(customerNoteSchema, input);

  return deps.uow.run(async (repositories) => {
    const existing = await repositories.customers.find(actor.organizationId, customerId);
    if (!existing) throw new NotFoundError("Client", customerId);
    return repositories.customers.insertNote(actor.organizationId, {
      customerId,
      authorMemberId: actor.memberId,
      body: data.body,
      pinned: data.pinned,
    });
  });
}
