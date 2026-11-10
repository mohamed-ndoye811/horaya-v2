import { Block, LegalPage, List, Mail, Strong, TextLink } from "./legal-layout";

/** Date de la dernière modification du texte ci-dessous. */
const UPDATED_ON = "10 novembre 2026";

/** Conditions d'utilisation d'Horaya, acceptées à l'inscription. */
export function TermsPage() {
  return (
    <LegalPage
      title="Conditions d'utilisation"
      intro={
        <>
          Ces conditions encadrent l'utilisation d'Horaya par les organisateurs et leurs équipes.
          Elles sont écrites pour être lues : si un point n'est pas clair, écris à <Mail />.
          Dernière mise à jour : {UPDATED_ON}.
        </>
      }
    >
      <Block title="Ce qu'est Horaya">
        <p>
          Horaya est un outil de réservation en ligne, édité par Mohamed Ndoye (voir les{" "}
          <TextLink href="/mentions-legales">mentions légales</TextLink>). Il permet à une structure
          (atelier, école, club, studio, indépendant) de publier ses séances, cours, stages et
          locations sur une page à son nom, de recevoir des réservations et de les suivre avec son
          équipe.
        </p>
        <p>
          Ces conditions s'appliquent à toute personne qui crée un compte Horaya : l'organisateur
          qui ouvre un espace et les membres de son équipe. Une personne qui réserve sur la page
          d'un espace le fait auprès de l'organisateur, selon les conditions de celui-ci : Horaya
          lui fournit l'outil, il n'est pas partie à la réservation.
        </p>
      </Block>

      <Block title="Ton compte">
        <List
          items={[
            <>Tu donnes des informations exactes et tu les tiens à jour.</>,
            <>
              Ton mot de passe reste personnel. Si tu penses qu'il a fuité, change-le et
              préviens-nous.
            </>,
            <>
              Tu ouvres un espace pour toi ou pour la structure que tu représentes, et tu réponds de
              ce que font les membres que tu y invites.
            </>,
          ]}
        />
      </Block>

      <Block title="Formules et paiement">
        <List
          items={[
            <>
              <Strong>Libre</Strong> est gratuite, sans limite de durée. <Strong>Pro</Strong> et{" "}
              <Strong>Équipe</Strong> sont payantes, au mois ou à l'année. Le contenu et le prix de
              chaque formule sont affichés dans Paramètres › Abonnement avant tout paiement.
            </>,
            <>
              Un nouvel espace essaie Pro gratuitement pendant 14 jours, sans carte bancaire. À la
              fin de l'essai, il revient à Libre sans rien perdre.
            </>,
            <>
              Le paiement et les factures sont gérés par Polar, qui vend l'abonnement en tant que
              vendeur officiel ; ses conditions s'appliquent au paiement.
            </>,
            <>
              Les limites d'une formule (nombre de réservations par mois, de membres) sont souples :
              une réservation de tes clients n'est jamais refusée à cause d'une limite. Tu es
              prévenu et Horaya te propose une formule adaptée.
            </>,
            <>
              Sans engagement : tu résilies en un clic depuis Paramètres › Abonnement. L'accès
              continue jusqu'à la fin de la période déjà payée, puis l'espace revient à Libre.
            </>,
            <>
              Un changement de prix est annoncé par e-mail au moins 30 jours avant de s'appliquer,
              et jamais à une période déjà payée.
            </>,
          ]}
        />
      </Block>

      <Block title="Tes réservations et l'argent de tes clients">
        <p>
          Horaya ne prend aucune commission sur tes réservations et n'encaisse rien pour ton compte.
          Tes clients te paient directement, par le lien de paiement que tu choisis (SumUp, PayPal,
          HelloAsso, Stripe…) ou sur place. Les prix, les remboursements, les conditions
          d'annulation et les obligations envers tes clients (facture, droit de rétractation le cas
          échéant) relèvent de toi.
        </p>
      </Block>

      <Block title="Ce que tu publies">
        <p>
          Tu restes propriétaire de tes textes, photos et logos. Tu autorises Horaya à les afficher
          et à les envoyer (pages publiques, e-mails) le temps où tu utilises le service. Tu
          t'assures d'avoir le droit de les publier, et que ta page indique qui tu es (mentions
          légales de ton espace, dans Paramètres › Organisation & marque).
        </p>
        <p>Horaya peut retirer un contenu manifestement illicite ou trompeur, et t'en informe.</p>
      </Block>

      <Block title="Les données de tes clients">
        <p>
          Pour les réservations de tes clients, tu es responsable du traitement de leurs données et
          Horaya agit comme sous-traitant : il les traite pour toi, selon tes instructions données à
          travers l'outil, et ne s'en sert pour rien d'autre. Le détail (prestataires, durées,
          sécurité) est dans la{" "}
          <TextLink href="/confidentialite">politique de confidentialité</TextLink>.
        </p>
        <p>
          Tes données t'appartiennent : tu exportes tes clients et tes réservations à tout moment,
          sur toutes les formules.
        </p>
      </Block>

      <Block title="Disponibilité">
        <p>
          Horaya est en bêta et s'améliore chaque semaine. Le service est sauvegardé chaque nuit et
          surveillé, mais une interruption reste possible. Les maintenances sont faites en dehors
          des heures d'affluence et annoncées quand elles se voient.
        </p>
      </Block>

      <Block title="Si Horaya s'arrête">
        <p>Si le service devait fermer, Horaya s'engage à :</p>
        <List
          items={[
            <>te prévenir par e-mail au moins 3 mois avant ;</>,
            <>te laisser exporter toutes tes données jusqu'au dernier jour ;</>,
            <>te rembourser la part d'abonnement payée d'avance et non utilisée.</>,
          ]}
        />
      </Block>

      <Block title="Responsabilité">
        <p>
          Horaya fait le nécessaire pour fournir un service fiable. Il ne répond pas des litiges
          entre un organisateur et ses clients, ni d'un usage de l'outil contraire à ces conditions.
          Dans la limite permise par la loi, sa responsabilité se limite aux dommages directs, à
          hauteur de ce que tu as payé à Horaya sur les 12 derniers mois.
        </p>
      </Block>

      <Block title="Suspension et fin">
        <List
          items={[
            <>
              Tu peux supprimer ton compte ou ton espace à tout moment (Paramètres › Profil,
              Paramètres › Organisation & marque).
            </>,
            <>
              En cas de manquement grave (fraude, contenu illicite, abus du service), Horaya peut
              suspendre un compte ou un espace, après t'avoir prévenu sauf urgence.
            </>,
          ]}
        />
      </Block>

      <Block title="Modifications">
        <p>
          Ces conditions peuvent évoluer avec le service. Un changement important est annoncé par
          e-mail au moins 30 jours avant de s'appliquer ; continuer à utiliser Horaya ensuite vaut
          accord. La date en haut indique la dernière mise à jour.
        </p>
      </Block>

      <Block title="Droit applicable">
        <p>
          Ces conditions relèvent du droit français. En cas de désaccord, écris d'abord à <Mail /> :
          on cherche une solution à l'amiable. À défaut, les tribunaux compétents sont ceux que
          désigne la loi.
        </p>
      </Block>
    </LegalPage>
  );
}
