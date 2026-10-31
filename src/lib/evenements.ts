/**
 * Événements de mesure, sans cookie, sans stockage dans le navigateur, sans identifiant (1.45.0).
 * Un événement est un signal /xm-vu (POST, réponse 204 de Caddy) qui porte trois paramètres :
 *   e    nom de l'action (« outil-lance », « resultat-affiche »…), minuscules, chiffres et tirets ;
 *   o    objet facultatif : nom d'un outil ou chemin d'une page du site, jamais une adresse saisie par le visiteur ;
 *   src  origine approximative de la visite (voir origine()).
 * xm-stats les compte par jour dans resume.json (« evenements »). Rien d'autre n'est envoyé ni conservé.
 * Ce module n'envoie rien de lui-même : mesure.ts (signal de visite) et les blocs l'utilisent.
 */

const ORIGINES = ['rapport', 'campagne', 'moteur', 'lien', 'site', 'direct'] as const;
export type Origine = (typeof ORIGINES)[number];

const MOTEURS = /(^|\.)(google|bing|qwant|duckduckgo|ecosia|yahoo|startpage|brave|yandex|lilo)\.[a-z.]+$/i;

export const mesureActive = (): boolean => typeof navigator !== 'undefined' && !navigator.webdriver && location.protocol === 'https:';

export function poster(url: string): void {
  try {
    if (!navigator.sendBeacon(url)) fetch(url, { method: 'POST', keepalive: true, credentials: 'omit' }).catch(() => {});
  } catch {
    /* mesure seulement : jamais d'erreur visible */
  }
}

/**
 * Origine de la visite, lue à chaque page, sans rien mémoriser :
 * `?src=` connu (lien de prospection `?src=rapport`, ou origine transmise par un formulaire d'outil à sa page de
 * résultat), puis campagne marquée (utm_*), puis le référent : moteur de recherche, autre site (`lien`), ce site
 * (`site`), ou rien (`direct`).
 */
export function origine(): Origine {
  const q = new URLSearchParams(location.search);
  const src = q.get('src') as Origine | null;
  if (src && (ORIGINES as readonly string[]).includes(src)) return src;
  if (q.has('utm_source') || q.has('utm_campaign')) return 'campagne';
  let hote = '';
  try {
    hote = document.referrer ? new URL(document.referrer).hostname : '';
  } catch {
    hote = '';
  }
  if (!hote) return 'direct';
  const ici = location.hostname.replace(/^www\./, '');
  if (hote === ici || hote.endsWith('.' + ici)) return 'site';
  return MOTEURS.test(hote) ? 'moteur' : 'lien';
}

/** Envoie un événement. `objet` : nom d'outil ou chemin du site (/realisations/codip), 60 caractères au plus. */
export function evenement(nom: string, objet = ''): void {
  if (!mesureActive() || !/^[a-z0-9-]{2,40}$/.test(nom)) return;
  const p = new URLSearchParams({ e: nom, src: origine() });
  const o = objet.trim().slice(0, 60);
  if (o && /^[\w\-/.]+$/.test(o)) p.set('o', o);
  poster('/xm-vu?' + p.toString());
}
