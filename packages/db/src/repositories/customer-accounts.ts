import type { CustomerAccount, CustomerAccountRepository } from "@horaya/core";
import { and, desc, eq, gt, isNull, lt, sql } from "drizzle-orm";
import type { Executor } from "../client";
import { customer, customerAccount, customerLoginLink, customerSession } from "../schema";

const columns = {
  id: customerAccount.id,
  email: customerAccount.email,
  firstName: customerAccount.firstName,
  lastName: customerAccount.lastName,
  phone: customerAccount.phone,
  calendarToken: customerAccount.calendarToken,
  createdAt: customerAccount.createdAt,
};

const sameEmail = (email: string) => sql`lower(${customer.email}) = ${email.toLowerCase()}`;

export function customerAccountRepository(db: Executor): CustomerAccountRepository {
  const findByEmail = async (email: string) => {
    const [row] = await db
      .select(columns)
      .from(customerAccount)
      .where(eq(customerAccount.email, email.toLowerCase()));
    return (row as CustomerAccount | undefined) ?? null;
  };

  return {
    findByEmail,

    async ensure(email, calendarToken, organizationId) {
      const existing = await findByEmail(email);
      if (existing) return { account: existing, created: false };
      // Profil de départ : la fiche de l'espace d'origine, sinon la plus récente.
      const [contact] = await db
        .select({
          firstName: customer.firstName,
          lastName: customer.lastName,
          phone: customer.phone,
        })
        .from(customer)
        .where(and(sameEmail(email), isNull(customer.anonymizedAt)))
        .orderBy(
          desc(sql`${customer.organizationId} = ${organizationId ?? sql`null`}::uuid`),
          desc(customer.updatedAt),
        )
        .limit(1);
      const [created] = await db
        .insert(customerAccount)
        .values({ email: email.toLowerCase(), calendarToken, ...contact })
        .onConflictDoNothing({ target: customerAccount.email })
        .returning(columns);
      if (created) return { account: created as CustomerAccount, created: true };
      // Deux premiers liens utilisés en même temps : l'autre a créé le compte.
      const raced = await findByEmail(email);
      if (!raced) throw new Error("Espace client non créé");
      return { account: raced, created: false };
    },

    async findBySession(tokenHash, now) {
      const [row] = await db
        .select(columns)
        .from(customerSession)
        .innerJoin(customerAccount, eq(customerAccount.id, customerSession.accountId))
        .where(and(eq(customerSession.tokenHash, tokenHash), gt(customerSession.expiresAt, now)));
      return (row as CustomerAccount | undefined) ?? null;
    },

    async updateProfile(accountId, profile) {
      const [row] = await db
        .update(customerAccount)
        .set(profile)
        .where(eq(customerAccount.id, accountId))
        .returning(columns);
      if (!row) throw new Error(`Espace client introuvable : ${accountId}`);
      return row as CustomerAccount;
    },

    async syncCustomerRecord(organizationId, email, profile) {
      await db
        .update(customer)
        .set(profile)
        .where(
          and(
            eq(customer.organizationId, organizationId),
            sameEmail(email),
            isNull(customer.anonymizedAt),
          ),
        );
    },

    async delete(accountId) {
      await db.delete(customerAccount).where(eq(customerAccount.id, accountId));
    },

    async insertLoginLink(link) {
      // Ménage au passage : les liens expirés depuis plus d'un jour ne servent plus à rien.
      await db
        .delete(customerLoginLink)
        .where(lt(customerLoginLink.expiresAt, new Date(link.expiresAt.getTime() - 86_400_000)));
      await db.insert(customerLoginLink).values(link);
    },

    async findLoginLink(tokenHash) {
      const [row] = await db
        .select({
          email: customerLoginLink.email,
          organizationId: customerLoginLink.organizationId,
          expiresAt: customerLoginLink.expiresAt,
          usedAt: customerLoginLink.usedAt,
        })
        .from(customerLoginLink)
        .where(eq(customerLoginLink.tokenHash, tokenHash));
      return row ?? null;
    },

    async markLoginLinkUsed(tokenHash, at) {
      const used = await db
        .update(customerLoginLink)
        .set({ usedAt: at })
        .where(and(eq(customerLoginLink.tokenHash, tokenHash), isNull(customerLoginLink.usedAt)))
        .returning({ tokenHash: customerLoginLink.tokenHash });
      return used.length > 0;
    },

    async insertSession(session) {
      await db.insert(customerSession).values(session);
    },

    async deleteSession(tokenHash) {
      await db.delete(customerSession).where(eq(customerSession.tokenHash, tokenHash));
    },
  };
}
