import type { ReactNode } from "react";
import { Block, LegalPage, Mail, Strong } from "./legal-layout";

/**
 * Aide : un guide court par tâche, avec les noms exacts des menus. Les chemins « A › B » suivent
 * le notch (desktop) ; sur téléphone, les mêmes pages sont dans l'onglet Plus.
 */
const GUIDES: Array<{ id: string; title: string; steps: ReactNode[]; note?: ReactNode }> = [
  {
    id: "demarrer",
    title: "Bien démarrer",
    steps: [
      <>
        Dans <Strong>Paramètres › Organisation & marque</Strong> : ton nom, ton logo, ta couleur,
        tes coordonnées et tes mentions légales. Ta page publique les reprend aussitôt.
      </>,
      <>
        Dans <Strong>Paramètres › Paiements</Strong> : ta politique d'annulation, l'acompte par
        défaut et ton lien de paiement (SumUp, PayPal, HelloAsso…).
      </>,
      <>
        Crée ton premier événement (bouton <Strong>Créer › Événement</Strong>), puis ouvre{" "}
        <Strong>Ma page publique</Strong> depuis ton avatar pour la voir comme tes clients.
      </>,
    ],
    note: "Partage l'adresse horaya.app/ton-espace : en lien dans ta bio Instagram, sur ton site ou dans tes messages.",
  },
  {
    id: "types",
    title: "Adapter un type d'événement",
    steps: [
      <>
        Ouvre <Strong>Événements › Types d'événements</Strong>. Un type est le modèle de tes séances
        : cours collectif, stage, cours à l'année, rendez-vous, location, privatisation, soirée, ou
        un type vide.
      </>,
      <>
        Règle ce qui revient à chaque séance : tarifs et options, questions posées à la réservation,
        conditions, matériel, règles « si… alors… ».
      </>,
      <>Chaque nouvel événement de ce type part de ces réglages ; tu peux les ajuster ensuite.</>,
    ],
  },
  {
    id: "evenement",
    title: "Créer et publier un événement",
    steps: [
      <>
        <Strong>Créer › Événement</Strong> : choisis le type, la date, l'horaire et le nombre de
        places.
      </>,
      <>
        Enregistré en brouillon, il n'est visible que de ton équipe. Publie-le pour l'ouvrir aux
        réservations sur ta page.
      </>,
      <>
        Une séance complète passe en liste d'attente : quand une place se libère, la première
        personne en attente la prend automatiquement.
      </>,
    ],
  },
  {
    id: "reservations",
    title: "Suivre les réservations",
    steps: [
      <>
        <Strong>Réservations</Strong> liste tout ; <Strong>À valider</Strong> regroupe les demandes
        qui attendent ta réponse.
      </>,
      <>
        Sur la fiche d'une réservation : confirmer, refuser, annuler, noter un paiement ou un
        remboursement, marquer la présence.
      </>,
      <>
        Tes clients reçoivent la confirmation par e-mail, puis un rappel la veille. Ils annulent ou
        changent de date eux-mêmes, dans ton délai d'annulation.
      </>,
    ],
  },
  {
    id: "comptoir",
    title: "Inscrire quelqu'un au téléphone ou sur place",
    steps: [
      <>
        <Strong>Créer › Réservation</Strong> ouvre le comptoir : la séance, le client, le matériel
        et le paiement sur un seul écran.
      </>,
      <>
        Enregistre avec le bouton ou <Strong>⌘ Entrée</Strong> : la place est bloquée tout de suite
        et le client reçoit sa confirmation s'il a donné son e-mail.
      </>,
    ],
  },
  {
    id: "paiement",
    title: "Te faire payer",
    steps: [
      <>
        Colle ton lien de paiement dans <Strong>Paramètres › Paiements</Strong> (ou un lien propre à
        un événement). Il est envoyé dans l'e-mail de confirmation.
      </>,
      <>
        Quand l'argent arrive, marque la réservation payée depuis sa fiche. Horaya ne prend aucune
        commission.
      </>,
    ],
    note: "Le paiement par carte intégré à la réservation arrive plus tard.",
  },
  {
    id: "trimestre",
    title: "Cours à l'année",
    steps: [
      <>
        Crée une série avec le type <Strong>Cours à l'année</Strong> : tes élèves s'inscrivent à
        toute la série, au prorata s'ils arrivent en cours de route si tu l'as prévu.
      </>,
      <>
        Un élève prévient d'une absence depuis son espace : sa place se libère pour la séance, et il
        gagne une séance à rattraper si ton type le permet.
      </>,
    ],
  },
  {
    id: "cartes",
    title: "Cartes de séances",
    steps: [
      <>
        Dans <Strong>Événements › Cartes de séances</Strong>, crée une formule : nombre de séances,
        prix, validité, types d'événements acceptés.
      </>,
      <>
        Vends-la au comptoir, ou laisse tes élèves l'acheter sur ta page ; marque-la payée pour
        l'activer.
      </>,
      <>
        Chaque réservation réglée avec la carte décompte une séance. Si tu annules une réservation,
        tu choisis de rendre la séance ou non.
      </>,
    ],
  },
  {
    id: "bons",
    title: "Bons cadeaux",
    steps: [
      <>
        Active-les dans <Strong>Paramètres › Bons cadeaux</Strong> : montants proposés, montant
        libre, validité, message.
      </>,
      <>
        On les achète sur ta page ou tu les vends au comptoir. Tu es prévenu à chaque achat en ligne
        ; marque le bon payé pour l'envoyer.
      </>,
      <>Le bénéficiaire saisit son code en réservant : le montant est déduit du prix.</>,
    ],
  },
  {
    id: "materiel",
    title: "Matériel",
    steps: [
      <>
        <Strong>Matériel › Nouvel article</Strong> : tours, machines, postes, combinaisons… suivis
        exemplaire par exemplaire, avec leur prix de location.
      </>,
      <>
        Associe-les à tes événements : le matériel réservé n'est jamais attribué deux fois. Un
        article en maintenance n'est plus proposé.
      </>,
    ],
  },
  {
    id: "equipe",
    title: "Ton équipe",
    steps: [
      <>
        <Strong>Paramètres › Membres & rôles</Strong> : invite par e-mail et choisis le rôle de
        chacun.
      </>,
      <>
        Chacun règle ses alertes dans <Strong>Paramètres › Notifications</Strong> et peut abonner
        son agenda (Google, Apple, Outlook) depuis <Strong>Calendrier › Liens calendrier</Strong>.
      </>,
    ],
  },
  {
    id: "donnees",
    title: "Tes données",
    steps: [
      <>
        <Strong>Exporter</Strong> en haut de Clients et de Réservations : un fichier CSV, sur toutes
        les formules.
      </>,
      <>
        Ta formule et tes factures sont dans <Strong>Paramètres › Abonnement</Strong> ; tu résilies
        en un clic.
      </>,
    ],
  },
];

export function HelpPage() {
  return (
    <LegalPage
      title="Aide"
      intro={
        <>
          Les gestes de tous les jours, en quelques étapes. Une question qui n'est pas ici ? Écris à{" "}
          <Mail /> : réponse le jour même, du lundi au samedi.
        </>
      }
    >
      <nav aria-label="Guides" className="flex flex-wrap gap-2 px-1">
        {GUIDES.map((guide) => (
          <a
            key={guide.id}
            href={`#${guide.id}`}
            className="rounded-full bg-surface px-3.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-field"
          >
            {guide.title}
          </a>
        ))}
      </nav>
      {GUIDES.map((guide) => (
        <div key={guide.id} id={guide.id} className="scroll-mt-6">
          <Block title={guide.title}>
            <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-semibold marker:text-ink-subtle">
              {guide.steps.map((step, index) => (
                // Étapes figées : l'ordre ne change jamais.
                // biome-ignore lint/suspicious/noArrayIndexKey: contenu statique
                <li key={index}>{step}</li>
              ))}
            </ol>
            {guide.note && <p className="text-sm leading-6">{guide.note}</p>}
          </Block>
        </div>
      ))}
    </LegalPage>
  );
}
