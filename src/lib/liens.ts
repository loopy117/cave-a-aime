/**
 * Liens qui sortent du site : nouvel onglet (target="_blank" rel="noopener"), classe « lien-externe » (petite flèche
 * ↗ au survol, styles globaux) et mention « (nouvel onglet) » pour les lecteurs d'écran.
 * Interne : chemin relatif, ancre, mailto:, tel:, ou même domaine que le site (www. ou non).
 */
const nu = (h: string) => h.toLowerCase().replace(/^www\./, '');

export function estExterne(href: string | undefined, site?: URL | string): boolean {
  if (!href || !/^https?:\/\//i.test(href)) return false;
  try {
    const hote = new URL(href).hostname;
    const local = site ? new URL(String(site)).hostname : '';
    return !local || nu(hote) !== nu(local);
  } catch { return false; }
}

export const NOUVEL_ONGLET = '<span class="visually-hidden"> (nouvel onglet)</span>';

/** HTML produit par le Markdown : chaque <a href="https://autre-site…"> ouvre un nouvel onglet. */
export function marquerLiensExternes(html: string, site?: URL | string): string {
  return html.replace(/<a\s([^>]*?)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/g, (tout, avant, href, apres, texte) => {
    if (!estExterne(href.replace(/&amp;/g, '&'), site) || /\btarget=/.test(avant + apres)) return tout;
    const attributs = `${avant}href="${href}"${apres}`.replace(/\sclass="([^"]*)"/, ' class="$1 lien-externe"');
    const classe = /\sclass="/.test(` ${attributs}`) ? '' : ' class="lien-externe"';
    return `<a ${attributs}${classe} target="_blank" rel="noopener">${texte}${NOUVEL_ONGLET}</a>`;
  });
}

/** Attributs d'un lien de composant ({...sortant(href, Astro.site)}) : nouvel onglet si le lien sort du site. */
export function sortant(href: string | undefined, site?: URL | string): Record<string, string> {
  return estExterne(href, site) ? { target: '_blank', rel: 'noopener', 'data-externe': '' } : {};
}
