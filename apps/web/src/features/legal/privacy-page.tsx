import { Block, LegalPage, List, Mail, Strong, TextLink } from "./legal-layout";

/** Date de la dernière modification du texte ci-dessous. */
const UPDATED_ON = "8 novembre 2026";

/** Politique de confidentialité d'Horaya (inscription, connexion Google, pages publiques). */
export function PrivacyPage() {
  return (
    <LegalPage
      title="Politique de confidentialité"
      intro={
        <>
          Horaya est un outil de réservation en ligne pour les ateliers, cours, clubs et petites
          structures. Cette page explique quelles données Horaya traite, pourquoi, où elles sont
          stockées et comment exercer tes droits. Dernière mise à jour : {UPDATED_ON}.
        </>
      }
    >
      <Block title="Qui est responsable">
        <p>
          Pour ton compte Horaya (organisateur ou membre d'une équipe), le responsable du traitement
          est Horaya, édité par Mohamed Ndoye. Contact : <Mail />.
        </p>
        <p>
          Pour une réservation faite sur la page d'un espace, l'organisateur de l'espace est
          responsable des données de ses clients. Horaya les traite pour son compte, comme
          sous-traitant, et ne s'en sert pour rien d'autre. Les coordonnées de l'organisateur
          figurent dans les mentions légales de sa page.
        </p>
      </Block>

      <Block title="Les données traitées">
        <List
          items={[
            <>
              <Strong>Compte</Strong> : nom, adresse e-mail, mot de passe (stocké sous forme
              chiffrée, jamais en clair), photo de profil si tu en ajoutes une. Avec la connexion
              Google : ton nom, ton adresse e-mail et ta photo, rien d'autre (ni contacts, ni
              agenda, ni fichiers).
            </>,
            <>
              <Strong>Espace</Strong> : nom, logo, couleurs, coordonnées et identité légale que tu
              renseignes, événements, matériel, clients et réservations.
            </>,
            <>
              <Strong>Réservations</Strong> (clients des espaces) : prénom, nom, adresse e-mail,
              téléphone et entreprise s'ils sont donnés, réponses aux questions de l'organisateur,
              message, nombre de places, montant et état du paiement.
            </>,
            <>
              <Strong>Abonnement</Strong> : formule, période et identifiants de client chez Polar.
              Les données de carte bancaire sont saisies chez Polar : Horaya ne les voit jamais.
            </>,
            <>
              <Strong>Données techniques</Strong> : sessions de connexion (adresse IP et
              navigateur), compteurs anti-abus par adresse IP, journaux d'erreurs (message, page et
              navigateur).
            </>,
          ]}
        />
      </Block>

      <Block title="Pourquoi">
        <List
          items={[
            <>
              Fournir le service : compte, espace, réservations, e-mails de réservation et rappels.
              Base légale : l'exécution du contrat.
            </>,
            <>
              Facturer l'abonnement. Base légale : l'exécution du contrat et les obligations
              comptables.
            </>,
            <>
              Sécuriser et corriger le service : sessions, limites anti-abus, suivi des erreurs,
              sauvegardes. Base légale : l'intérêt légitime d'Horaya à faire fonctionner un service
              fiable.
            </>,
            <>
              Prévenir ton équipe (nouvelle réservation, événement presque complet, récap
              hebdomadaire…), selon les préférences de chacun dans Paramètres › Notifications.
            </>,
          ]}
        />
        <p>
          Pas de publicité, pas de revente de données, pas de traceur publicitaire ni de mesure
          d'audience.
        </p>
      </Block>

      <Block title="Cookies">
        <p>
          Horaya n'utilise qu'un cookie : celui de ta session de connexion, indispensable au
          service. Sans cookie publicitaire ni mesure d'audience, il n'y a pas de bandeau de
          consentement.
        </p>
      </Block>

      <Block title="Où sont les données et qui y a accès">
        <p>Seuls les prestataires nécessaires au service y ont accès, pour ce service :</p>
        <List
          items={[
            <>
              <Strong>Infomaniak</Strong> (Suisse) : hébergement de l'application, de la base de
              données et du suivi des erreurs.
            </>,
            <>
              <Strong>Backblaze</Strong> (Pays-Bas, Union européenne) : fichiers envoyés (photos,
              logos, couvertures) et sauvegardes.
            </>,
            <>
              <Strong>Cloudflare</Strong> : acheminement sécurisé du trafic jusqu'aux serveurs.
            </>,
            <>
              <Strong>Resend</Strong> (États-Unis) : envoi des e-mails.
            </>,
            <>
              <Strong>Polar</Strong> : paiement et factures des abonnements Horaya, en tant que
              vendeur officiel.
            </>,
            <>
              <Strong>Google</Strong> : connexion avec Google, seulement si tu la choisis.
            </>,
          ]}
        />
        <p>
          Les transferts hors de l'Union européenne sont encadrés : décision d'adéquation de la
          Commission européenne pour la Suisse, clauses contractuelles types pour les autres pays.
        </p>
      </Block>

      <Block title="Combien de temps">
        <List
          items={[
            <>
              Compte et espace : tant qu'ils existent. Tu peux les supprimer à tout moment
              (Paramètres › Profil, Paramètres › Organisation & marque) : les données et les
              fichiers sont effacés aussitôt, puis disparaissent des sauvegardes sous 14 jours.
            </>,
            <>Réservations : tant que l'organisateur les garde dans son espace.</>,
            <>Sessions de connexion : jusqu'à leur expiration ou ta déconnexion.</>,
            <>Compteurs anti-abus : quelques heures.</>,
            <>Journaux d'erreurs : 90 jours.</>,
            <>
              Factures d'abonnement : conservées par Polar, vendeur officiel, selon ses obligations
              légales.
            </>,
          ]}
        />
      </Block>

      <Block title="Tes droits">
        <p>
          Tu peux accéder à tes données, les corriger, les exporter, les faire effacer, limiter leur
          traitement ou t'y opposer. La plupart se fait directement dans Horaya : modifier ton
          profil, exporter tes clients et réservations, supprimer ton compte ou ton espace. Pour le
          reste, écris à <Mail /> : réponse sous un mois.
        </p>
        <p>
          Client d'un espace ? Adresse-toi d'abord à l'organisateur, responsable de tes données. Tu
          peux aussi nous écrire : nous transmettrons ta demande.
        </p>
        <p>
          Tu peux enfin adresser une réclamation à la CNIL (
          <TextLink href="https://www.cnil.fr">cnil.fr</TextLink>
          ).
        </p>
      </Block>

      <Block title="Sécurité">
        <p>
          Connexions chiffrées (HTTPS), mots de passe hachés, fichiers rangés dans un espace de
          stockage privé et servis par l'application, accès aux serveurs limités, sauvegardes chaque
          nuit.
        </p>
      </Block>

      <Block title="Modifications">
        <p>
          Cette page peut évoluer avec le service. La date en haut indique la dernière mise à jour ;
          un changement important est annoncé par e-mail.
        </p>
      </Block>
    </LegalPage>
  );
}
