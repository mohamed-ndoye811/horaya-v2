import type { CustomerAccount, CustomerLoginLink, CustomerProfile } from "./model";

export interface CustomerAccountRepository {
  findByEmail(email: string): Promise<CustomerAccount | null>;
  /**
   * Crée le compte (profil prérempli depuis la fiche client de cet e-mail, celle de l'espace
   * d'origine d'abord), ou renvoie celui qui existe déjà.
   */
  ensure(
    email: string,
    calendarToken: string,
    organizationId: string | null,
  ): Promise<{ account: CustomerAccount; created: boolean }>;
  /** Compte d'une session encore valable. */
  findBySession(tokenHash: string, now: Date): Promise<CustomerAccount | null>;
  updateProfile(accountId: string, profile: CustomerProfile): Promise<CustomerAccount>;
  /** Recopie le profil sur la fiche client de cet e-mail dans un espace (s'il en a une). */
  syncCustomerRecord(
    organizationId: string,
    email: string,
    profile: CustomerProfile,
  ): Promise<void>;
  /** Supprime le compte et ses sessions ; les fiches et réservations des espaces restent. */
  delete(accountId: string): Promise<void>;
  insertLoginLink(link: CustomerLoginLink & { tokenHash: string }): Promise<void>;
  findLoginLink(tokenHash: string): Promise<CustomerLoginLink | null>;
  /** Marque le lien utilisé ; false s'il l'était déjà (deux clics simultanés). */
  markLoginLinkUsed(tokenHash: string, at: Date): Promise<boolean>;
  insertSession(session: { tokenHash: string; accountId: string; expiresAt: Date }): Promise<void>;
  deleteSession(tokenHash: string): Promise<void>;
}
