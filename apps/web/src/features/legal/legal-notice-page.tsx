import { Block, LegalPage, List, Mail, Strong, TextLink } from "./legal-layout";

/** Mentions légales du site horaya.app (pas celles d'un espace : voir /$slug/mentions-legales). */
export function LegalNoticePage() {
  return (
    <LegalPage
      title="Mentions légales"
      intro="Qui édite et qui héberge horaya.app. Chaque espace a ses propres mentions légales, en bas de sa page publique."
    >
      <Block title="Éditeur">
        <p>
          horaya.app est édité par <Strong>Mohamed Ndoye</Strong>, à titre personnel. Directeur de
          la publication : Mohamed Ndoye. Contact : <Mail />.
        </p>
      </Block>

      <Block title="Hébergement">
        <List
          items={[
            <>
              <Strong>Infomaniak Network SA</Strong>, rue Eugène-Marziano 25, 1227 Les Acacias
              (Genève), Suisse : application et base de données.
            </>,
            <>
              <Strong>Backblaze</Strong>, centre de données d'Amsterdam (Pays-Bas) : fichiers
              envoyés et sauvegardes.
            </>,
          ]}
        />
      </Block>

      <Block title="Pages des espaces">
        <p>
          Les pages publiques (horaya.app/nom-de-l-espace) sont publiées par chaque organisateur,
          qui en est responsable. Ses coordonnées figurent dans les mentions légales de sa page.
        </p>
      </Block>

      <Block title="Propriété intellectuelle">
        <p>
          Le nom et le logo Horaya, l'interface et le code du service appartiennent à leur éditeur.
          Les textes, photos et logos des espaces appartiennent à leurs organisateurs.
        </p>
      </Block>

      <Block title="Données personnelles">
        <p>
          Voir la <TextLink href="/confidentialite">politique de confidentialité</TextLink> et les{" "}
          <TextLink href="/cgu">conditions d'utilisation</TextLink>.
        </p>
      </Block>
    </LegalPage>
  );
}
