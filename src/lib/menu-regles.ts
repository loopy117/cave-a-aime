/**
 * Règles de forme du menu (data/menu.json) et du pied de page (data/footer.json), partagées par scripts/validate.ts
 * (base et variantes). La résolution des cibles (page introuvable, brouillon) reste dans resoudreEntree.
 *
 * Menu principal : une entrée a un sous-menu simple (liste déroulante) ou, avec `disposition: "mega"`, un méga-menu :
 * chaque enfant qui a lui-même des enfants devient une colonne, dont l'intitulé peut être un simple texte (`label`
 * sans cible) et porter une `icone` (nom de data/icones.json). Les liens d'un méga-menu peuvent porter une `description`
 * d'une ligne.
 */
export type Signaler = (niveau: 'erreur' | 'avertissement', chemin: string, message: string) => void;

export const DESCRIPTION_MAX = 90;
export const MEGA_COLONNES_MAX = 5;
export const MEGA_LIENS_PAR_COLONNE = 8;

const sansCible = (e: any) => !e?.page && !e?.element && !e?.collection && !e?.href;

function verifierDescription(e: any, chemin: string, signaler: Signaler, affichee: boolean) {
  if (e?.description === undefined) return;
  if (typeof e.description !== 'string' || e.description.trim().length < 3 || e.description.length > DESCRIPTION_MAX)
    signaler('erreur', `${chemin}.description`, `une ligne de ${DESCRIPTION_MAX} caractères maximum`);
  else if (!affichee) signaler('avertissement', `${chemin}.description`, 'description affichée seulement sous les liens d’un méga-menu (disposition: "mega") : ignorée ici');
}

/** icone : réservée aux intitulés de colonne d'un méga-menu ; colonne = vrai si l'entrée en est un. */
function verifierIcone(e: any, chemin: string, signaler: Signaler, icones: Set<string> | undefined, colonne: boolean) {
  if (e?.icone === undefined) return;
  if (!colonne) signaler('avertissement', `${chemin}.icone`, 'icône affichée seulement devant un intitulé de colonne de méga-menu : ignorée ici');
  else if (typeof e.icone !== 'string' || (icones && !icones.has(e.icone)))
    signaler('erreur', `${chemin}.icone`, `icône inconnue${icones ? ` (disponibles : ${[...icones].join(', ')})` : ''}`);
}

export function verifierMenuPrincipal(principal: any[], signaler: Signaler, icones?: Set<string>) {
  principal.forEach((e, i) => {
    verifierIcone(e, `principal[${i}]`, signaler, icones, false);
    const c = `principal[${i}]`;
    if (sansCible(e)) signaler('erreur', c, 'une entrée du menu principal mène à une page (page, element, collection ou href) : c’est le lien ouvert au toucher et au clavier');
    if (e.disposition !== undefined && e.disposition !== 'liste' && e.disposition !== 'mega')
      signaler('erreur', `${c}.disposition`, 'valeurs possibles : "liste" (par défaut) ou "mega"');
    verifierDescription(e, c, signaler, false);
    const enfants: any[] = Array.isArray(e.enfants) ? e.enfants : [];
    const mega = e.disposition === 'mega';

    if (mega) {
      if (enfants.length === 0) { signaler('erreur', c, 'méga-menu sans sous-menu (enfants)'); return; }
      const colonnes = enfants.filter((x) => Array.isArray(x.enfants) && x.enfants.length > 0);
      const seuls = enfants.length - colonnes.length;
      const total = colonnes.length + (seuls > 0 ? 1 : 0);
      if (colonnes.length === 0) signaler('avertissement', c, 'méga-menu sans colonne (aucun enfant n’a de sous-liens) : une liste simple suffit');
      if (total > MEGA_COLONNES_MAX) signaler('erreur', c, `${MEGA_COLONNES_MAX} colonnes au plus (${total}, les liens sans colonne en forment une)`);
      if (seuls > MEGA_LIENS_PAR_COLONNE) signaler('avertissement', c, `${MEGA_LIENS_PAR_COLONNE} liens au plus hors colonne (${seuls})`);
      enfants.forEach((x, k) => {
        const cx = `${c}.enfants[${k}]`;
        if (x.disposition !== undefined) signaler('erreur', `${cx}.disposition`, 'disposition réservée aux entrées du menu principal');
        verifierDescription(x, cx, signaler, true);
        const petits: any[] = Array.isArray(x.enfants) ? x.enfants : [];
        verifierIcone(x, cx, signaler, icones, petits.length > 0);
        if (sansCible(x) && petits.length === 0) signaler('erreur', cx, 'intitulé de colonne sans lien ni sous-liens');
        if (petits.length > MEGA_LIENS_PAR_COLONNE) signaler('avertissement', cx, `${MEGA_LIENS_PAR_COLONNE} liens au plus par colonne (${petits.length})`);
        petits.forEach((y, m) => {
          const cy = `${cx}.enfants[${m}]`;
          if (sansCible(y)) signaler('erreur', cy, 'un lien de colonne mène à une page (page, element, collection ou href)');
          if (y.enfants) signaler('erreur', `${cy}.enfants`, 'pas de niveau sous les liens d’une colonne');
          if (y.disposition !== undefined) signaler('erreur', `${cy}.disposition`, 'disposition réservée aux entrées du menu principal');
          verifierDescription(y, cy, signaler, true);
          verifierIcone(y, cy, signaler, icones, false);
        });
      });
    } else {
      enfants.forEach((x, k) => {
        const cx = `${c}.enfants[${k}]`;
        if (sansCible(x)) signaler('erreur', cx, 'intitulé sans lien : réservé aux colonnes d’un méga-menu (disposition: "mega" sur l’entrée parente)');
        if (x.disposition !== undefined) signaler('erreur', `${cx}.disposition`, 'disposition réservée aux entrées du menu principal');
        verifierDescription(x, cx, signaler, false);
        verifierIcone(x, cx, signaler, icones, false);
        (Array.isArray(x.enfants) ? x.enfants : []).forEach((y: any, m: number) => {
          const cy = `${cx}.enfants[${m}]`;
          if (sansCible(y)) signaler('erreur', cy, 'un lien de sous-menu mène à une page (page, element, collection ou href)');
          if (y.enfants) signaler('erreur', `${cy}.enfants`, 'deux niveaux de sous-menu au plus');
          verifierDescription(y, cy, signaler, false);
          verifierIcone(y, cy, signaler, icones, false);
        });
      });
    }
  });
}

/** Pied de page : des liens, sans intitulé seul ni disposition. */
export function verifierLiensPied(liens: any[], chemin: string, signaler: Signaler) {
  liens.forEach((e, i) => {
    const c = `${chemin}[${i}]`;
    if (sansCible(e)) signaler('erreur', c, 'un lien du pied de page mène à une page (page, element, collection ou href)');
    if (e.disposition !== undefined || e.description !== undefined) signaler('avertissement', c, 'disposition et description ne servent qu’au menu principal : ignorées ici');
  });
}
