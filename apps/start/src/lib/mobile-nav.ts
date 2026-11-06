/* Navigation mobile de l'admin : retour de la barre du haut, écrans sans onglets. */

/** Listes et libellés pour les retours (« ‹ Événements », « ‹ Article »). */
const SECTIONS: Record<string, { list: string; item: string }> = {
  evenements: { list: "Événements", item: "Événement" },
  reservations: { list: "Réservations", item: "Réservation" },
  materiel: { list: "Matériel", item: "Article" },
  clients: { list: "Clients", item: "Client" },
};

/** Écrans de formulaire : la barre d'onglets laisse la place à leurs boutons. */
const FORM_PAGE = /\/(nouveau|nouvelle|modifier|louer)$/;

export const isFormPage = (pathname: string) => FORM_PAGE.test(pathname);

/** Où mène le retour de la barre du haut ; `null` sur les écrans d'un onglet. */
export function backLink(pathname: string): { href: string; label: string } | null {
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const [section, id, ...rest] = segments;
  if (!section || section === "calendrier" || section === "plus") return null;
  if (section === "parametres") return { href: "/app/plus", label: "Paramètres" };
  if (section === "design-system") return { href: "/app", label: "Accueil" };
  const names = SECTIONS[section];
  if (!names) return null;
  if (!id) {
    return section === "materiel" || section === "clients"
      ? { href: "/app/plus", label: "Plus" }
      : null;
  }
  if (rest.length > 0) return { href: `/app/${section}/${id}`, label: names.item };
  return { href: `/app/${section}`, label: names.list };
}
