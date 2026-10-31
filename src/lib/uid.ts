/**
 * Identifiant unique dans la page, stable d'un build à l'autre (compteur propre à la page rendue).
 * Pas de Math.random() : le HTML d'une page inchangée doit rester identique, sinon sa date de modification
 * (<lastmod> du sitemap) et IndexNow la croient modifiée à chaque reconstruction.
 */
export function uidPage(locals: object, prefixe: string): string {
  const l = locals as { __xmUid?: number };
  l.__xmUid = (l.__xmUid ?? 0) + 1;
  return `${prefixe}-${l.__xmUid}`;
}
