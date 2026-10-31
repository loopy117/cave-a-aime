/**
 * Fichiers admis dans media/ : copiés tels quels dans /img/ du site (scripts/copier-medias.mjs), ils ne doivent
 * jamais pouvoir exécuter de script sur le domaine du client. Images et PDF seulement ; un SVG, un HTML, un XML…
 * est refusé par la validation, ignoré par la copie, et refusé aussi par le relais de l'éditeur (xmedia-serveur).
 * Même liste dans scripts/copier-medias.mjs.
 */
export const MEDIA_PERMIS = /\.(jpe?g|png|webp|avif|gif|pdf)$/i;
export const mediaPermis = (chemin: string) => MEDIA_PERMIS.test(chemin) || /(^|\/)\.gitkeep$/.test(chemin);
