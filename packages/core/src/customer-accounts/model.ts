/**
 * Espace client (lot 29) : une identité par e-mail vérifié, commune à tous les espaces.
 * Elle n'est reliée aux fiches `customer` que par l'adresse (insensible à la casse) : chaque
 * espace ne voit que ses propres fiches et réservations, et toute fiche qui a cet e-mail,
 * passée ou future, s'y rattache d'elle-même.
 */
export interface CustomerAccount {
  id: string;
  /** Toujours en minuscules. */
  email: string;
  /** Profil (maquette 8.4) : préremplit les réservations suivantes. */
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  /** Jeton de l'agenda personnel (ICS), gardé en clair comme celui des membres (lot 22). */
  calendarToken: string;
  createdAt: Date;
}

/** Lien magique de connexion : le jeton n'est stocké que haché. */
export interface CustomerLoginLink {
  email: string;
  /** Espace depuis lequel le lien a été demandé (null : vue horaya.app). */
  organizationId: string | null;
  expiresAt: Date;
  usedAt: Date | null;
}

export interface CustomerProfile {
  firstName: string;
  lastName: string;
  phone: string | null;
}
