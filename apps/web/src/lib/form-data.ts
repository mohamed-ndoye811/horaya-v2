/** Valideur des fonctions serveur qui reçoivent un formulaire tel quel (FormData). */
export function formDataInput(data: unknown): FormData {
  if (!(data instanceof FormData)) throw new Error("Formulaire attendu.");
  return data;
}
