import type { FieldValues } from "../fields/model";
import type { RuleFacts } from "./engine";
import type { RuleAction, RuleTriggerKind } from "./model";

/** Trace d'une règle exécutée : une seule par règle et par séance (ou inscription). */
export interface NewRuleRun {
  organizationId: string;
  eventId: string;
  /** null : règle de la séance (moment planifié). */
  bookingId: string | null;
  ruleId: string;
  ruleName: string;
  trigger: RuleTriggerKind;
  /** Conditions remplies au moment de l'évaluation. */
  matched: boolean;
  /** Actions appliquées (vide si les conditions n'étaient pas remplies). */
  actions: RuleAction[];
}

export interface RuleRepository {
  /** Enregistre la trace ; faux si elle existait déjà (la règle a déjà tourné). */
  claim(run: NewRuleRun): Promise<boolean>;
  /** Ce qu'on sait du client : nouveau (aucune autre inscription active), étiquettes, carte active. */
  customerFacts(
    organizationId: string,
    customerId: string,
    options: { now: Date; exceptBookingId?: string; exceptEnrollmentId?: string },
  ): Promise<NonNullable<RuleFacts["customer"]>>;
  /** Exemplaires réservés pour l'événement et pas encore attribués à une inscription. */
  equipmentLeft(eventId: string): Promise<number>;
  /** Réponses de chaque participant d'une inscription, dans l'ordre. */
  participantAnswers(bookingId: string): Promise<FieldValues[]>;
}
