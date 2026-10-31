/**
 * Note et avis Google de la fiche du site, lus au build.
 * L'agent du serveur (xm-agent, chaque matin, clé Google Places de l'agence restée sur le serveur) les dépose dans la
 * variable GitHub AVIS_GOOGLE du dépôt ; le workflow de déploiement la passe au build. En local :
 * AVIS_GOOGLE_FICHIER=chemin/vers/exemple.json. Absente ou invalide : rien n'est affiché (jamais d'erreur de build).
 */
import { readFileSync } from 'node:fs';

export interface AvisGoogle { auteur: string; profil?: string; note: number; texte: string; date?: string; lien?: string }
export interface FicheGoogle { nom?: string; note: number; nombre: number; lien: string; ecrire?: string; maj?: string; avis: AvisGoogle[] }

const urlGoogle = (u: unknown): string | undefined => {
  if (typeof u !== 'string' || u.length > 600) return undefined;
  try {
    const x = new URL(u);
    return x.protocol === 'https:' && /(^|\.)google\.[a-z.]+$|(^|\.)goo\.gl$/.test(x.hostname) ? x.href : undefined;
  } catch { return undefined; }
};
const texte = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function lire(): unknown {
  try {
    if (process.env.AVIS_GOOGLE_FICHIER) return JSON.parse(readFileSync(process.env.AVIS_GOOGLE_FICHIER, 'utf8'));
    if (process.env.AVIS_GOOGLE) return JSON.parse(process.env.AVIS_GOOGLE);
  } catch { /* données illisibles : comme absentes */ }
  return null;
}

let cache: FicheGoogle | null | undefined;
export function ficheGoogle(): FicheGoogle | null {
  if (cache !== undefined) return cache;
  const d: any = lire();
  const lien = urlGoogle(d?.lien);
  const note = Number(d?.note), nombre = Number(d?.nombre);
  if (!d || !lien || !(note >= 1 && note <= 5) || !Number.isInteger(nombre) || nombre < 1) return (cache = null);
  const avis = (Array.isArray(d.avis) ? d.avis : []).map((a: any): AvisGoogle | null => {
    const n = Number(a?.note), t = texte(a?.texte, 1500), auteur = texte(a?.auteur, 80);
    if (!(Number.isInteger(n) && n >= 1 && n <= 5) || !t || !auteur) return null;
    return { auteur, note: n, texte: t, profil: urlGoogle(a.profil), lien: urlGoogle(a.lien), date: /^\d{4}-\d{2}-\d{2}$/.test(a?.date ?? '') ? a.date : undefined };
  }).filter(Boolean) as AvisGoogle[];
  return (cache = { nom: texte(d.nom, 120) || undefined, note: Math.round(note * 10) / 10, nombre, lien, ecrire: urlGoogle(d.ecrire), maj: texte(d.maj, 30) || undefined, avis });
}

export const noteFr = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const moisFr = (d?: string) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : '');

let compteur = 0;
/** Identifiant unique et stable d'une construction à l'autre (dégradés des étoiles). */
export const idEtoiles = () => `et${++compteur}`;
