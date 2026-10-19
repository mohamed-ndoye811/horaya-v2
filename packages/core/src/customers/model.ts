export interface Customer {
  id: string;
  organizationId: string;
  firstName: string;
  lastName: string;
  /** Facultatif pour un client saisi au comptoir (nom + téléphone suffisent). */
  email: string | null;
  phone: string | null;
  company: string | null;
  tags: string[];
  marketingConsent: boolean;
  anonymizedAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  authorMemberId: string | null;
  body: string;
  pinned: boolean;
  createdAt: Date;
}
