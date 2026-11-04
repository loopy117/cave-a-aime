/**
 * Rendus propres au site pour ses collections (facultatif) : remplacent la carte par défaut.
 *   import VinCarte from './VinCarte.astro';
 *   export const rendusSite = { vins: { Carte: VinCarte } };
 * La carte reçoit { element, collection } comme les cartes du socle. La page de détail se remplace dans la
 * déclaration (rendu.detail), toujours par des blocs.
 */
export const rendusSite: Record<string, { Carte?: any }> = {};
