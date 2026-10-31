/**
 * Empreinte des sites clients de l'agence, lue au build (1.28.0).
 * L'agent du serveur (xm-agent, chaque nuit) additionne sur les 30 derniers jours :
 *  - le serveur, le stockage et l'envoi d'e-mails, MESURÉS par Scaleway (API Environmental Footprint) ;
 *  - la construction, le contrôle et la mise en ligne chez GitHub, ESTIMÉS d'après le temps de calcul de chaque workflow ;
 *  - l'intelligence artificielle (demandes des clients, traductions), ESTIMÉE d'après les tokens consommés.
 * Il dépose le résultat dans la variable GitHub EMPREINTE du site de l'agence ; le workflow de déploiement la passe au
 * build. En local : EMPREINTE_FICHIER=chemin/vers/exemple.json. Absente ou invalide : null (rien n'est affiché).
 * Chaque valeur est vérifiée : rien de ce qui vient de l'extérieur n'est publié sans contrôle.
 */
import { readFileSync } from 'node:fs';

export interface Empreinte {
  periode: { debut: string; fin: string; jours: number };
  sites: number;
  /** Part mesurée par Scaleway (null si indisponible : total incomplet) */
  serveur: { kg_co2e: number; m3_eau: number | null } | null;
  calcul: { minutes: number; wh: number; kg_co2e: number; deploiements: number; demandes: number; traductions: number };
  ia: { tokens: number; wh: number; kg_co2e: number };
  total: { kg_co2e: number; complet: boolean };
  par_site: { g_co2e_par_mois: number };
  methode: { wh_par_minute_github: number; wh_par_million_tokens: Record<string, number>; kg_co2e_par_kwh_us: number };
}

const nombre = (v: unknown, max = 1e9) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : null);
const date = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);

function lire(): unknown {
  try {
    if (process.env.EMPREINTE_FICHIER) return JSON.parse(readFileSync(process.env.EMPREINTE_FICHIER, 'utf8'));
    if (process.env.EMPREINTE) return JSON.parse(process.env.EMPREINTE);
  } catch { /* illisible : comme absent */ }
  return null;
}

let cache: Empreinte | null | undefined;
export function empreinte(): Empreinte | null {
  if (cache !== undefined) return cache;
  const d: any = lire();
  const p = d?.periode, c = d?.calcul, ia = d?.ia, t = d?.total, m = d?.methode;
  const debut = date(p?.debut), fin = date(p?.fin), jours = nombre(p?.jours, 400), sites = nombre(d?.sites, 100000);
  const calcul = ['minutes', 'wh', 'kg_co2e', 'deploiements', 'demandes', 'traductions'].map((k) => nombre(c?.[k]));
  const tokens = Object.values(ia?.tokens ?? {}).map((v) => nombre(v, 1e13));
  const iaV = [nombre(ia?.wh), nombre(ia?.kg_co2e)], total = nombre(t?.kg_co2e), parSite = nombre(d?.par_site?.g_co2e_par_mois);
  const mt = m?.wh_par_million_tokens;
  if (!debut || !fin || !jours || !sites || calcul.some((x) => x === null) || tokens.some((x) => x === null) || iaV.some((x) => x === null)
      || total === null || parSite === null || nombre(m?.wh_par_minute_github) === null || nombre(m?.kg_co2e_par_kwh_us) === null
      || !mt || typeof mt !== 'object' || Object.values(mt).some((v) => nombre(v) === null)) return (cache = null);
  let serveur: Empreinte['serveur'] = null;
  if (d.serveur) {
    const kg = nombre(d.serveur.kg_co2e);
    if (kg === null) return (cache = null);
    serveur = { kg_co2e: kg, m3_eau: nombre(d.serveur.m3_eau) };
  }
  const [minutes, wh, kg, deploiements, demandes, traductions] = calcul as number[];
  return (cache = {
    periode: { debut, fin, jours }, sites, serveur,
    calcul: { minutes, wh, kg_co2e: kg, deploiements, demandes, traductions },
    ia: { tokens: (tokens as number[]).reduce((a, b) => a + b, 0), wh: iaV[0]!, kg_co2e: iaV[1]! },
    total: { kg_co2e: total, complet: t.complet === true && serveur !== null },
    par_site: { g_co2e_par_mois: parSite },
    methode: { wh_par_minute_github: m.wh_par_minute_github, wh_par_million_tokens: mt, kg_co2e_par_kwh_us: m.kg_co2e_par_kwh_us },
  });
}

/** Grammes ou kilogrammes, à la française : « 468 g », « 1,2 kg ». */
export function formaterCo2(kg: number): string {
  if (kg >= 1) return `${kg.toLocaleString('fr-FR', { maximumFractionDigits: kg >= 10 ? 0 : 1 })} kg`;
  return `${Math.round(kg * 1000).toLocaleString('fr-FR')} g`;
}
