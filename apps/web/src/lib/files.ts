/**
 * Clé d'un fichier rangé par l'app : propriétaire (espace ou personne) / dossier /
 * identifiant.extension. Images dans leurs dossiers, PDF (documents joints d'un type) dans `documents`.
 */
export const FILE_KEY =
  /^[\w-]{1,64}\/(?:(?:articles|evenements|profils|logos|couvertures)\/[0-9a-f-]{36}\.(?:webp|jpg|png)|documents\/[0-9a-f-]{36}\.pdf)$/;
