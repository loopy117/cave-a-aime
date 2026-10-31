/**
 * Redirections 301 de l'ancien site : data/redirections.txt (propre au site, facultatif).
 *
 *   # ancienne adresse                         nouvelle adresse
 *   /agence-e-commerce-aix-en-provence.html     /agence-prestashop
 *   /blog.html/*                                /a-savoir
 *
 * Une redirection par ligne, deux colonnes séparées par des espaces ; « # » en début de ligne : commentaire.
 * Une ancienne adresse terminée par « * » redirige tout ce qui commence ainsi. Ancienne adresse sans « ? »
 * (le serveur compare le chemin seul), écrite telle quelle, accents compris (/améliorer-vitesse.html).
 * Nouvelle adresse : une page du site (vérifiée au build) ou une adresse https:// complète.
 *
 * Le build vérifie le fichier (npm run validate) et le publie dans dist/.redirections (jamais servi : fichier caché) ;
 * sur le serveur, « sudo xm-site redirections <nom> » l'applique dans Caddy (aussi chaque nuit, xm-taches).
 * Mêmes règles d'écriture des deux côtés : ce qui passe ici passe sur le serveur.
 */
import { existsSync, readFileSync } from 'node:fs';

export const FICHIER_REDIRECTIONS = 'data/redirections.txt';
export const MAX_REDIRECTIONS = 2000;

// Caractères refusés dans une adresse (ils casseraient la configuration du serveur) : espaces, contrôles, { } " ' \ ` # ; < >
const INTERDITS = /[\s\p{Cc}{}"'\\`#;<>]/u;

export type Redirection = { ligne: number; source: string; cible: string; probleme?: string };

export function lireRedirections(fichier = FICHIER_REDIRECTIONS): Redirection[] {
  if (!existsSync(fichier)) return [];
  const sortie: Redirection[] = [];
  const vues = new Map<string, number>();
  readFileSync(fichier, 'utf8').split(/\r?\n/).forEach((brut, i) => {
    const t = brut.trim();
    if (!t || t.startsWith('#')) return;
    const ligne = i + 1;
    const [source = '', cible = '', ...reste] = t.split(/\s+/);
    const r: Redirection = { ligne, source, cible };
    if (reste.length || !cible) r.probleme = 'deux colonnes attendues : ancienne adresse, nouvelle adresse';
    else if (!source.startsWith('/') || INTERDITS.test(source) || source.includes('?') || source.slice(0, -1).includes('*'))
      r.probleme = `ancienne adresse invalide : ${source} (commence par /, sans espace ni ?, « * » seulement à la fin)`;
    else if (!/^(\/|https:\/\/[A-Za-z0-9.-]+(\/|$))/.test(cible) || INTERDITS.test(cible) || /[*?]/.test(cible))
      r.probleme = `nouvelle adresse invalide : ${cible} (une page du site, /…, ou une adresse https:// complète)`;
    else if (vues.has(source)) r.probleme = `${source} déjà redirigée ligne ${vues.get(source)}`;
    else if (source === cible) r.probleme = `${source} redirige vers elle-même`;
    vues.set(source, ligne);
    sortie.push(r);
  });
  // Chaînes : une nouvelle adresse qui est elle-même redirigée (deux 301 de suite, ou une boucle)
  const sources = new Set(sortie.map((r) => r.source));
  for (const r of sortie) if (!r.probleme && sources.has(r.cible)) r.probleme = `${r.cible} est elle-même redirigée : viser directement l'adresse finale`;
  if (sortie.length > MAX_REDIRECTIONS) sortie[MAX_REDIRECTIONS].probleme = `plus de ${MAX_REDIRECTIONS} redirections : regrouper avec « * »`;
  return sortie;
}
