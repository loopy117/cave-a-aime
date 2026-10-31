/**
 * Scores PageSpeed des sites de l'agence, lus au build.
 * L'agent du serveur (xm-agent, chaque semaine, clé PageSpeed Insights de l'agence restée sur le serveur) mesure chaque
 * site et dépose les résultats dans la variable GitHub SCORES_SITES du site de l'agence ; le workflow de déploiement la
 * passe au build. En local : SCORES_SITES_FICHIER=chemin/vers/exemple.json. Absente ou invalide : liste vide.
 * Chaque valeur est vérifiée : rien de ce qui vient de l'extérieur n'est publié sans contrôle.
 */
import { readFileSync } from 'node:fs';

export interface MesurePageSpeed {
  performance: number; accessibilite: number; bonnes_pratiques: number; seo: number;
  fcp: string; lcp: string; tbt: string; cls: string; si: string;
}
export interface ScoreSite { site: string; url: string; date: string; mobile: MesurePageSpeed; ordinateur: MesurePageSpeed; verifier: string }

const score = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100 ? (v as number) : null);
const valeur = (v: unknown) => (typeof v === 'string' && v.length <= 12 && /^[\d\s,.]+(\s?(s|ms))?$/.test(v.trim()) ? v.trim() : '–');
const https = (u: unknown, hote?: RegExp) => {
  if (typeof u !== 'string' || u.length > 400) return null;
  try { const x = new URL(u); return x.protocol === 'https:' && (!hote || hote.test(x.hostname)) ? x.href : null; } catch { return null; }
};

function mesure(m: any): MesurePageSpeed | null {
  const s = ['performance', 'accessibilite', 'bonnes_pratiques', 'seo'].map((k) => score(m?.[k]));
  if (s.some((x) => x === null)) return null;
  return { performance: s[0]!, accessibilite: s[1]!, bonnes_pratiques: s[2]!, seo: s[3]!, fcp: valeur(m.fcp), lcp: valeur(m.lcp), tbt: valeur(m.tbt), cls: valeur(m.cls), si: valeur(m.si) };
}

function lire(): unknown {
  try {
    if (process.env.SCORES_SITES_FICHIER) return JSON.parse(readFileSync(process.env.SCORES_SITES_FICHIER, 'utf8'));
    if (process.env.SCORES_SITES) return JSON.parse(process.env.SCORES_SITES);
  } catch { /* illisible : comme absent */ }
  return null;
}

let cache: ScoreSite[] | undefined;
/** Sites mesurés, du meilleur score mobile au moins bon. */
export function scoresSites(): ScoreSite[] {
  if (cache) return cache;
  const d: any = lire();
  const liste = (Array.isArray(d?.sites) ? d.sites : []).map((x: any): ScoreSite | null => {
    const url = https(x?.url), verifier = https(x?.verifier, /^pagespeed\.web\.dev$/);
    const mobile = mesure(x?.mobile), ordinateur = mesure(x?.ordinateur);
    const site = typeof x?.site === 'string' ? x.site.trim().slice(0, 80) : '';
    if (!url || !verifier || !mobile || !ordinateur || !site || !/^\d{4}-\d{2}-\d{2}$/.test(x?.date ?? '')) return null;
    return { site, url, date: x.date, mobile, ordinateur, verifier };
  }).filter(Boolean) as ScoreSite[];
  return (cache = liste.sort((a, b) => b.mobile.performance - a.mobile.performance || a.site.localeCompare(b.site, 'fr')));
}
