/**
 * Rencontres du club : libellés communs aux cartes, au bloc « match-center » et aux pages de détail.
 * Un plateau ou un tournoi d'école de rugby n'a pas de score officiel : on n'affiche jamais de résultat inventé.
 */
import { TYPES_RENCONTRES } from '../schemas/collections';
import site from '../../data/site.json' with { type: 'json' };
const club = (site as any).nom as string;
const stade = ((site as any).club?.stade ?? '') as string;

export interface Rencontre { id: string; data: any }

const fmtJour = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fmtJourAn = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export const jourRencontre = (d: Date, avecAnnee = false) => (avecAnnee ? fmtJourAn : fmtJour).format(new Date(d));
export const heureFr = (h?: string) => (h ? h.replace(/^0(\d)/, '$1').replace(':', ' h ').replace(/ h 00$/, ' h') : '');
export const typeRencontre = (t: string) => (TYPES_RENCONTRES as Record<string, string>)[t] ?? t;

/** Intitulé : « Club – Pertuis », « Pertuis – Club », ou le titre (« Plateau à Lauris »). */
export function intitule(r: Rencontre): string {
  const d = r.data;
  if (!d.adversaire) return d.titre;
  return d.domicile ? `${club} – ${d.adversaire}` : `${d.adversaire} – ${club}`;
}

export const aScore = (r: Rencontre) => r.data.score_pour != null && r.data.score_contre != null;

/** Score dans l'ordre domicile – extérieur. */
export function score(r: Rencontre): string {
  const d = r.data;
  if (!aScore(r)) return '';
  return d.domicile ? `${d.score_pour} – ${d.score_contre}` : `${d.score_contre} – ${d.score_pour}`;
}

export function issue(r: Rencontre): 'victoire' | 'defaite' | 'nul' | null {
  if (!aScore(r)) return null;
  const { score_pour: p, score_contre: c } = r.data;
  return p > c ? 'victoire' : p < c ? 'defaite' : 'nul';
}
export const libelleIssue = { victoire: 'Victoire', defaite: 'Défaite', nul: 'Match nul' } as const;

export const lieu = (r: Rencontre) => r.data.lieu ?? (r.data.domicile ? stade : (r.data.adversaire ? `chez ${r.data.adversaire}` : ''));

/** Début du jour (UTC, comme les dates des contenus). */
export const debutDuJour = (m = new Date()) => new Date(m.toISOString().slice(0, 10));
export const estAVenir = (r: Rencontre, m = new Date()) => new Date(r.data.date) >= debutDuJour(m);
