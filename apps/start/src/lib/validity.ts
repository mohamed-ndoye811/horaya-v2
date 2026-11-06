/** Ce qu'il faut d'un champ pour écrire son message d'erreur (testable sans DOM). */
export interface Control {
  tagName: string;
  type: string;
  validity: Pick<
    ValidityState,
    | "valueMissing"
    | "typeMismatch"
    | "patternMismatch"
    | "tooShort"
    | "tooLong"
    | "rangeUnderflow"
    | "rangeOverflow"
    | "stepMismatch"
    | "badInput"
  >;
  min?: string;
  max?: string;
  minLength?: number;
  maxLength?: number;
  title?: string;
}

/**
 * Message en français pour un champ refusé par le navigateur. Les formulaires gardent
 * leurs attributs (`required`, `type="email"`, `min`…) mais n'affichent plus la bulle
 * du navigateur : le message s'écrit sous le champ, comme les erreurs du serveur.
 */
export function validityMessage(control: Control): string {
  const { validity, type } = control;
  const tag = control.tagName.toLowerCase();
  if (validity.valueMissing) {
    if (type === "checkbox") return "Coche cette case pour continuer.";
    if (type === "file") return "Choisis un fichier.";
    if (tag === "select" || type === "radio") return "Choisis une option.";
    return "Ce champ est obligatoire.";
  }
  if (validity.badInput) {
    if (type === "number") return "Indique un nombre.";
    if (type === "date") return "Cette date n'est pas valide.";
    if (type === "time") return "Cette heure n'est pas valide.";
    return "Cette valeur n'est pas valide.";
  }
  if (validity.typeMismatch) {
    if (type === "email") return "Cette adresse e-mail n'est pas valide.";
    if (type === "url") return "Ce lien n'est pas valide : il commence par https://.";
    return "Cette valeur n'est pas valide.";
  }
  if (validity.rangeUnderflow && control.min) return `Minimum : ${control.min}.`;
  if (validity.rangeOverflow && control.max) return `Maximum : ${control.max}.`;
  if (validity.tooShort && control.minLength && control.minLength > 0) {
    return `Au moins ${control.minLength} caractères.`;
  }
  if (validity.tooLong && control.maxLength && control.maxLength > 0) {
    return `${control.maxLength} caractères au maximum.`;
  }
  if (validity.patternMismatch && control.title) return control.title;
  return "Cette valeur n'est pas valide.";
}
