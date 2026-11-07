import { z } from "zod";
import { ConflictError } from "../shared/errors";
import { generateToken, hashToken } from "../shared/tokens";
import type { Deps } from "../shared/unit-of-work";
import { validate } from "../shared/validate";
import type { CustomerAccount } from "./model";
import { customerSessionExpiresAt, isLoginLinkUsable, loginLinkExpiresAt } from "./rules";

const emailSchema = z.email("Adresse e-mail invalide").trim().toLowerCase().max(254);

export const customerProfileSchema = z.object({
  firstName: z.string().trim().min(1, "Prénom requis").max(60),
  lastName: z.string().trim().min(1, "Nom requis").max(60),
  phone: z
    .string()
    .trim()
    .max(30)
    .nullish()
    .transform((value) => value || null),
});

/**
 * Lien magique (maquette 8.1). Rien ne dit si l'adresse est connue : le premier lien crée
 * l'espace. Renvoie le jeton en clair, à envoyer par e-mail (il n'est stocké que haché).
 */
export async function requestCustomerLoginLink(
  deps: Deps,
  input: { email: string; organizationId: string | null },
): Promise<{ email: string; token: string }> {
  const email = validate(emailSchema, input.email);
  const token = generateToken();
  const tokenHash = await hashToken(token);
  await deps.uow.run((repositories) =>
    repositories.customerAccounts.insertLoginLink({
      tokenHash,
      email,
      organizationId: input.organizationId,
      expiresAt: loginLinkExpiresAt(deps.clock.now()),
      usedAt: null,
    }),
  );
  return { email, token };
}

/**
 * Connexion par le lien : valable 15 minutes, une seule fois. Le premier lien crée l'espace
 * client ; les réservations faites avec cet e-mail s'y rattachent par l'adresse.
 */
export async function signInWithLoginLink(
  deps: Deps,
  token: string,
): Promise<{
  account: CustomerAccount;
  created: boolean;
  organizationId: string | null;
  sessionToken: string;
}> {
  const tokenHash = await hashToken(token);
  const sessionToken = generateToken();
  const sessionHash = await hashToken(sessionToken);
  return deps.uow.run(async (repositories) => {
    const now = deps.clock.now();
    const link = await repositories.customerAccounts.findLoginLink(tokenHash);
    if (
      !link ||
      !isLoginLinkUsable(link, now) ||
      !(await repositories.customerAccounts.markLoginLinkUsed(tokenHash, now))
    ) {
      throw new ConflictError("Ce lien de connexion n'est plus valable : demandes-en un nouveau.");
    }
    const { account, created } = await repositories.customerAccounts.ensure(
      link.email,
      generateToken(),
      link.organizationId,
    );
    await repositories.customerAccounts.insertSession({
      tokenHash: sessionHash,
      accountId: account.id,
      expiresAt: customerSessionExpiresAt(now),
    });
    return { account, created, organizationId: link.organizationId, sessionToken };
  });
}

/** Compte de la session client (cookie), ou null si elle a expiré ou n'existe pas. */
export async function customerAccountForSession(
  deps: Deps,
  sessionToken: string,
): Promise<CustomerAccount | null> {
  const tokenHash = await hashToken(sessionToken);
  return deps.uow.run((repositories) =>
    repositories.customerAccounts.findBySession(tokenHash, deps.clock.now()),
  );
}

export async function signOutCustomer(deps: Deps, sessionToken: string): Promise<void> {
  const tokenHash = await hashToken(sessionToken);
  await deps.uow.run((repositories) => repositories.customerAccounts.deleteSession(tokenHash));
}

/**
 * Profil (maquette 8.4) : préremplit les réservations suivantes, et met à jour la fiche client
 * de l'espace où l'on se trouve (jamais celles des autres espaces).
 */
export async function updateCustomerProfile(
  deps: Deps,
  account: CustomerAccount,
  input: unknown,
  organizationId: string | null,
): Promise<CustomerAccount> {
  const profile = validate(customerProfileSchema, input);
  return deps.uow.run(async (repositories) => {
    const updated = await repositories.customerAccounts.updateProfile(account.id, profile);
    if (organizationId) {
      await repositories.customerAccounts.syncCustomerRecord(
        organizationId,
        account.email,
        profile,
      );
    }
    return updated;
  });
}

/** RGPD : l'espace client disparaît ; les réservations restent chez chaque atelier. */
export async function deleteCustomerAccount(deps: Deps, account: CustomerAccount): Promise<void> {
  await deps.uow.run((repositories) => repositories.customerAccounts.delete(account.id));
}
