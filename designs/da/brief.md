# Horaya · Direction artistique — brief vivant

> Document de travail, enrichi à chaque itération avec Moh.
> Le visuel vit dans Paper, fichier HORAYA, page **« DA · Moodboard »** (une planche par
> référence, plus la synthèse). Les images de référence sont dans `designs/da/refs/`.

## L'intention

**Horaya est un outil en marque blanche avec une DA de base forte** (Moh, 2026-11-10) : plus
centré sur la céramique ni sur un métier. La DA d'Horaya est un cadre calme et marqué ; chaque
espace y apporte son logo, sa couleur et ses images.

On ne refait pas tout. On garde la structure de la DA v4 de l'app (notch, Urbanist, bords
16 px, densité) et on lui donne **une ambiance plus artsy, plus léchée** : de la matière, du
caractère, un côté fait main.

**Moh, 2026-11-10, en ses mots :**
- « Visuellement assez minimaliste (synonyme de moins de prise de tête), mais assez artsy pour
  faire comprendre que c'est un peu DIY. »
- « Aéré, créatif sans pour autant être inutilisable. »
- « Montrer un peu de symbiose entre l'art et la technique (le dev). Qu'on ait des codes un peu
  des deux. »
- « Des couleurs pas trop saturées pour sentir l'apaisement, la tranquillité. »
- « Qu'en arrivant sur le site vitrine ou sur les réseaux, on se dise : wow c'est magnifique,
  c'est vraiment un outil ça ? »
- « Que la nav soit limpide, que les animations soient organiques sans rendre l'outil dur à
  utiliser. Un truc hyper relaxant et satisfaisant. »
- « Que l'interface soit en parfaite symbiose avec l'art qui la remplit. »

## L'UI et l'art

L'interface n'est pas à l'écart de l'art : **elle lui sert de cadre**, comme le passe-partout
d'une affiche. Ce sont le logo, la couleur, les photos et les couvertures d'événements de
chaque espace qui la remplissent.

| | |
|---|---|
| **L'UI prend à l'art** | le fond papier, les filets fins, les labels en mono, la palette brume, le mouvement doux |
| **L'UI ne prend jamais** | du grain sur une donnée, du flou sur un texte à lire, une trame derrière un formulaire, une animation qui fait attendre |
| **L'art pleine puissance** | site vitrine, réseaux, visuels d'articles, e-mails, écrans vides, couvertures d'événements par défaut |

## Synthèse v0.1 · « Brume »

_Proposée le 2026-11-10, à affiner. Planche « Synthèse v0.1 » dans Paper._

Minimaliste pour l'esprit, fait main pour le cœur.

1. **Le vide d'abord** : une image, des marges immenses, peu de mots. (réf. 02-06, 02-01)
2. **La chose et sa trame** : chaque visuel montre la matière (une photo, un objet, un lieu) et
   sa traduction (points, chiffres, grille horaire). C'est la rencontre de l'art et du dev.
   (réf. 02-04, 02-09 : les deux images clés)
3. **Deux voix** : Urbanist pour l'émotion, une mono pour la trame (heures, places, prix,
   repères). Piste : **Paper Mono** à la place de Geist Mono (voir plus bas). (réf. 02-01, 02-02)
4. **Couleurs de brume** : désaturées, une seule teinte forte par visuel. (réf. 02-07, 02-08)
5. **Mouvement organique** : du flou vers le net, une lente dérive sur la vitrine ; dans
   l'outil, court, doux, jamais bloquant. Attention : pas de flou dans les transitions de page
   de l'app (souci WebKit, PR #68). (réf. 02-02, 02-03)

**Palette proposée**, mesurée sur les images :

| Nom | Hex | Rôle | Source |
|---|---|---|---|
| Papier | `#E8E6E1` | fond (l'app est à `#EDEDEB`, très proche) | 02-06, 02-02 |
| Encre | `#1A1A1A` | texte | 02-01 |
| Brume | `#B9CACA` | ciel, aplats | 02-08 |
| Mousse | `#5B665A` | secondaire | 02-04 |
| Ardoise | `#376171` | accent Horaya A ? | 02-07 |
| Argile | `#974C42` | accent Horaya B ? | 02-01, 02-09 |

En marque blanche, la couleur de chaque espace remplace l'accent Horaya sur ses pages ; le
reste de la palette (papier, encre, brume) forme le cadre neutre.

## Critique de l'existant et recette du mélange (2026-11-10)

Faite à partir des captures des lots 29 et 33 (espace client, page publique, éditeur de type).

**Ce qui marche, à garder**
- **Le notch et le cadre** : c'est la signature d'Horaya, on la reconnaît en un coup d'œil.
- La structure : densité de l'admin, barre d'action noire en bas des formulaires, aperçu en direct.
- Le thème en marque blanche (ton sombre dérivé de la couleur de l'espace).
- Urbanist : ronde, douce, cohérente avec un sablier adouci.

**Ce qui fait « SaaS générique » aujourd'hui**
1. **Des boîtes dans des boîtes** : une carte blanche contient des lignes grises arrondies, qui
   contiennent des pastilles. Trois niveaux de conteneurs, c'est l'inverse de « le vide d'abord ».
2. **Trop de couleurs par écran** : notch noir, vert de l'espace, pastilles vertes, bleues et
   violettes, avatar orange, couleurs de catégorie. On est loin d'« une teinte forte par visuel ».
3. **Les couvertures d'événements** sont des dégradés flous génériques : c'est l'endroit où l'art
   devrait vivre, et c'est le plus vide de sens.
4. **Les données sont dans la même voix que les titres** : heures, prix, places, dates en Urbanist.
   La « trame » n'existe pas encore.
5. **Des petits textes gris pâles** partout (11–12 px, contraste faible) : fatigant à lire.
6. **Le favicon est bleu** (`#264489`), sans lien avec le reste.

**La recette du mélange**
1. **Commencer par les tokens**, pas par les écrans : papier, encre, brume, statuts désaturés,
   Paper Mono. Changer les tokens fait basculer 70 % de l'app d'un coup, sans toucher la structure.
2. **Un seul niveau de carte** : à l'intérieur, des filets fins et des lignes à plat (comme la
   fiche Melchior), plus de fonds gris arrondis imbriqués.
3. **Statuts calmes** : un point de couleur et un libellé en mono, plus de pastilles colorées ; les
   couleurs vives (`*-vivid`) disparaissent.
4. **Une couleur forte par écran** : celle de l'espace (ou l'accent Horaya), réservée à l'action
   principale et à la sélection.
5. **La trame pour les données** : heures, dates, prix, places, codes, compteurs en Paper Mono.
6. **L'art dans les couvertures et les écrans vides** : couvertures par défaut générées à partir de
   la couleur ou de la photo de l'espace, avec une trame (demi-teinte, points, grain). Outil :
   **Paper Shaders** (`@paper-design/shaders-react`, licence Apache-2.0). Bonus marque blanche :
   la trame unifie des photos de téléphone de qualité inégale.
7. **Aéré là où l'on regarde, dense là où l'on travaille** : vitrine, page publique et espace
   client respirent ; calendrier, listes et éditeurs gardent la densité de la v4.
8. **Mouvement** : lent et organique sur la vitrine ; dans l'outil, court (150 à 250 ms), en
   opacité et translation seulement (WebKit).

**À garder en tête**
- La brume et la mousse ne passent pas en couleur de texte sur le papier : elles servent aux
  surfaces et aux aplats, pas à la lecture.
- La couleur de chaque espace doit rester lisible sur le papier : vérifier le contraste et dériver
  un ton plus foncé si besoin (comme pour le ton sombre du notch).
- Shaders : rendre les couvertures en images fixes (une fois, côté serveur ou à l'enregistrement),
  pas en WebGL en direct dans les listes.
- Paper Mono : minimum 12 px, jamais pour un paragraphe.
- Le logo adouci impose de revoir aussi les lettres (voir planche logo).

## Références

> **On s'inspire, on ne copie pas** (Moh, 2026-11-10). Chaque référence sert à nommer des
> **principes**, jamais à reprendre une esthétique telle quelle.

### Réf. 01 · Le blog de Paper (paper.design/blog), 2026-11-10

On n'en reprend ni le fond noir « tech », ni le bleu, ni les poignées de sélection : c'est
l'univers d'un outil de design. Horaya est un cadre calme, en marque blanche.

1. **Le grain d'impression** : bruit photo, trame demi-teinte CMYK, points. L'image a l'air
   imprimée.
2. **La photo réelle, traitée** : demi-teinte noir et blanc, quelques touches de couleur.
3. **Le logo devient motif** : décliné en textures.
4. **Typo fine et immense**, lettrage géant en filigrane.
5. **Repères de construction visibles** (grille, cadre de sélection).
6. **Une seule couleur** qui ressort.

### Réf. 02 · Moodboard de Moh (9 images), 2026-11-10

Fichiers : `refs/moodboard-02/`.

| N° | Image | Ce qu'on en retient |
|---|---|---|
| 01 | Affiche Melchior (Rijksmuseum) | grand vide, titre massif, petite fiche en filets fins : l'affiche et la fiche technique ensemble |
| 02 | Portfolio au mot flou | le flou qui devient net = mouvement organique ; labels mono sur les bords |
| 03 | Sphères grises | formes douces et mates, du volume sans couleur |
| 04 | **Papillon réel / en points** | **clé** : la chose et sa traduction en code, côte à côte |
| 05 | Paysage + trame ASCII | trame de code sur la nature ; trop chargé pour l'UI, réservé aux réseaux |
| 06 | Cöchen | petite image, marges immenses, capitales espacées |
| 07 | Trio in Curio | demi-teinte en une couleur désaturée, texte vertical |
| 08 | Nuages | l'image en plein cadre, le texte minuscule posé dessus |
| 09 | **Fleur tramée + chiffres** | **clé** : trame d'impression et code qui traversent la matière |

## Pistes à explorer

- **Loader sablier** (idée de Moh, 2026-11-10) : le sablier symétrique fait un demi-tour doux
  (~700 ms), une pause, et recommence ; la symétrie rend le retournement invisible. Story-board sur
  la planche v0.3, à animer en code (rotation seulement, compatible WebKit).
- Logo : à affiner à la main (approche entre le sablier et le H et le R, finition du R adouci,
  version pour très petites tailles).

- **Typo Paper Mono** (demande de Moh, 2026-11-10) : licence OFL, donc libre et utilisable dans
  l'app (github.com/paper-design/paper-mono), 8 graisses de 100 à 800, pas d'italique. Planche
  « Typo · Paper Mono · exploration » : voix « trame » (heures, places, prix, repères), chiffres
  géants en 200, grille horaire en texture. Plus de caractère que Geist Mono, un côté machine à
  écrire.

- **Logo** : garder le dessin de l'icône et seulement **arrondir ses angles** (Moh, 2026-11-10).
  Planche « Icône · angles adoucis · v0.2 » : le SVG de Moh, chaque angle remplacé par un congé, à
  3 rayons (1,2 · 2,6 · 4,5). Vecteurs modifiables dans Paper ; SVG et script `fillet.py` dans
  `designs/da/logo/icone-adoucie/`. La v0.1 (symboles redessinés) était hors sujet, gardée dans
  `logo/v0.1-ecartee/`.
- « La chose et sa trame » appliqué aux images des espaces : une photo de l'espace et sa version
  en trame (points, chiffres) pour les couvertures par défaut ; la grille horaire en filigrane.
- Le logo en motif texturé (trame, points).

## Décisions

- 2026-11-10 · **On garde le design actuel de l'app (v4) jusqu'à la bêta** (Moh). On ne change que
  le logo (sablier adouci à 85 %) et la mono (Paper Mono). La DA Brume (registres B et C, trame,
  papier) reste une piste pour la marque et la landing, mise de côté. **La trame ne touche jamais
  les photos des clients** : le client doit voir sa photo.
- 2026-11-10 · **Logo final (v0.5)** : sablier symétrique, angles r 2,6, **85 % de large** (à la
  hauteur des lettres), **sable d'origine** (fente + deux biseaux), lettres adoucies r 3. Fichiers :
  `logo/sable/a-a85.svg` (symbole) et `logo/sable/logo-a-a85.svg` (logotype), générés par
  `logo/sable/sable.py`. Planche Paper « Logo · v0.5 · retenu ». Remplace le choix v0.3 ci-dessous.
- 2026-11-10 · **Loader** (corrigé par Moh : **le noir est le sable**, le clair est le vide ; la
  barre noire en bas est le filet qui s'écoule). Le vide du haut descend, le tas du bas monte et
  referme les biseaux par dessous ; à la fin le sable s'aplanit en laissant un espace ; demi-tour,
  l'espace remonte en fente, et le cycle repasse exactement par le logo (~2,3 s). Code de référence
  `logo/sable/loader.py`, aperçu `logo/sable/horaya-loader-sable.gif`. À coder en SVG animé.
- 2026-11-10 · **Logo retenu (v0.3)** : sablier symétrique « S2 droit adouci » (côtés verticaux,
  fente horizontale, encoches à mi-hauteur, angles r 2,6) **et lettres adoucies au même esprit**
  (r 3). Moh : « vraiment TOP, j'aime beaucoup ». Fichiers :
  `logo/symetrique/logo-s2-droit-adouci-lettres-adoucies.svg` et `s2-droit-adouci.svg`, générés
  par `logo/symetrique/sym.py`. Planche Paper « Logo · v0.3 · sablier symétrique ».
- 2026-11-10 · **Paper Mono remplace Geist Mono** (Moh). À faire en code dans un lot : police
  auto-hébergée (OFL), token `--font-geist-mono` remplacé.
- 2026-11-10 · Accent : Moh aime les deux. Proposition : ardoise = accent produit (sélection,
  liens, couleur par défaut d'un espace), argile = signature de la marque Horaya, rare (vitrine,
  réseaux). Une seule des deux par visuel. À confirmer.

## Questions ouvertes

- Paper Mono à la place de Geist Mono ? Et pour l'émotion : Urbanist seule, ou une grotesque
  d'expression ?
- Photo traitée, illustration, ou les deux ?

## Journal des itérations

- 2026-11-10 · Lancement. Réf. 01 (blog Paper) décortiquée ; page « DA · Moodboard » créée
  dans Paper.
- 2026-11-10 · Moh pose l'intention (minimaliste, DIY, symbiose de l'art et du dev, apaisant) et
  partage 9 images (réf. 02). Synthèse v0.1 « Brume d'atelier » : 5 principes et une palette de
  6 couleurs mesurées. Nouvelle règle : l'UI sert de cadre à l'art. Piste logo ouverte.
- 2026-11-10 · Recadrage : Horaya est un outil en marque blanche, plus centré céramique. La
  synthèse devient « Brume », les mentions d'atelier sont retirées. Planche d'exploration
  Paper Mono.
- 2026-11-10 · Paper Mono adoptée. Planche « Logo · sablier adouci · v0.1 » (4 variantes,
  SVG dans `designs/da/logo/`). Critique de l'existant et recette du mélange ajoutées.
- 2026-11-10 · Logo v0.1 hors sujet (Moh voulait son dessin, adouci). v0.2 : son SVG avec angles
  arrondis à 3 niveaux, en vecteurs dans Paper.
- 2026-11-10 · Logo v0.3 : versions symétriques (miroir et redressée), le sablier comme « o » du
  mot, mises en situation (icône d'app, favicon, notch, photo, pied de page, loader). Moh retient
  S2 adouci avec lettres adoucies.
- 2026-11-10 · Logo v0.4 : le sable A (fente + deux biseaux) est retenu par Moh contre trois
  variantes (réduit, dune, dune + grains). Test de largeur du sablier A à 100, 85 et 72 %, à la
  hauteur des lettres (`logo/sable/sable.py`, fichiers `a-a85`, `a-a72`, `logo-a-*`). À trancher.
- 2026-11-10 · Logo v0.5 : 85 % retenu par Moh ; planche finale avec mises en situation et loader
  du sable A (GIF de démonstration).
- 2026-11-10 · Loader refait : noir = sable (correction de Moh). Story-board mis à jour dans Paper.
- 2026-11-10 · Landing v0.1 (Paper, page « DA · Landing ») : Moh préfère commencer par la landing,
  la page la plus créative. Hero sans photo : le sablier en trame de points sur une grille d'heures
  en Paper Mono (la chose et sa trame), titre Urbanist 300 en 104 px, une seule couleur forte
  (ardoise) pour les actions, grain papier très léger. Puis le produit annoté comme une fiche, les
  trois étapes en grands chiffres Paper Mono, l'appel final. Textes repris de la landing v4.
  Art : `landing/sablier-trame.svg`, `landing/grain.png`.
- 2026-11-10 · Landing v0.1 rejetée par Moh (« fracassé ») : le notch avait disparu, ce n'était
  plus épuré, textes trop gros, navigation banale. **Leçon : partir de la landing v4 (notch vivant,
  structure, tailles) et n'y ajouter la couche Brume que par petites touches.** v0.2 = copie de la
  v4 avec fond papier, ardoise à la place de l'orange, Paper Mono pour les libellés, nouveau logo
  dans le notch. Les touches artistiques se proposent une à une, à valider.
- 2026-11-10 · Moh : « plus de briques pour construire une maison ». La DA v5 se monte comme une
  évolution de la DS v4, au même format (cadre, notch, cartes), page Paper « v5 · DA Brume ·
  briques ». Fait : v5.1 Couleur (papier et traits, encre avec contrastes, brume/ardoise/argile,
  états calmes, marque blanche avec couleur foncée automatiquement sous 4,5). Gabarit vierge prêt.
  À faire : typo, trame et matière, composants, mouvement, blocs de mise en page (hero, sections).
- 2026-11-10 · Spécimens A (douce, v4 en Brume) / B (technique : filets, grille, rayons 4, titres
  fins, mono) / C (hybride : cartes 12 + filet, en-têtes mono, pilules). Essais sur la page Paper
  « v5 · Essais » : tableau de bord v4 passé en C, landing en B dans le cadre v4 avec son notch
  (hero sablier à 72 px, fiche A/B/C en filets, l'outil annoté, trois étapes en chiffres mono,
  fin avec champ souligné).
- 2026-11-10 · Retour au design actuel : lot logo + Paper Mono codé sur le poste fix (branche
  `fix/logo-paper-mono`, à valider en local), DS v4 mise à jour dans Paper (planche Logo, toute la
  mono en Paper Mono, jeton `--font-mono`).
