/**
 * Créneaux d'entraînement (collection equipes) : mise en forme et regroupement par jour.
 * Pur TypeScript : utilisé par la carte d'équipe, le bloc planning et le contexte de l'assistant.
 */
import { JOURS } from '../schemas/site';

export type Jour = (typeof JOURS)[number];
export interface Creneau { jour: Jour; debut: string; fin: string; lieu?: string }

/** « 18:00 » → « 18 h », « 19:30 » → « 19 h 30 » */
export function heureFr(h: string): string {
  const [hh, mm] = h.split(':');
  return `${Number(hh)} h${mm === '00' ? '' : ` ${mm}`}`;
}

export const plage = (c: Creneau) => `${heureFr(c.debut)} – ${heureFr(c.fin)}`;

export const nomJour = (j: Jour) => j.charAt(0).toUpperCase() + j.slice(1);
export const jourCourt = (j: Jour) => nomJour(j).slice(0, 3) + '.';

/** Créneaux de plusieurs équipes rangés par jour puis par heure ; les créneaux identiques sont regroupés. */
export function parJour<E extends { id: string; data: { nom_court: string; creneaux: Creneau[] } }>(equipes: E[]) {
  const jours = new Map<Jour, Map<string, { creneau: Creneau; equipes: E[] }>>();
  for (const e of equipes) for (const c of e.data.creneaux) {
    if (!jours.has(c.jour)) jours.set(c.jour, new Map());
    const cle = `${c.debut}|${c.fin}|${c.lieu ?? ''}`;
    const m = jours.get(c.jour)!;
    if (!m.has(cle)) m.set(cle, { creneau: c, equipes: [] });
    m.get(cle)!.equipes.push(e);
  }
  return JOURS.filter((j) => jours.has(j)).map((j) => ({
    jour: j,
    creneaux: [...jours.get(j)!.values()].sort((a, b) => a.creneau.debut.localeCompare(b.creneau.debut)),
  }));
}
