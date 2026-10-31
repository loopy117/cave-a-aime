/**
 * Modèles de site : collections et blocs propres à chaque modèle (le reste est commun).
 * Le modèle d'un site est déclaré dans data/site.json (« modele »), « entreprise » par défaut.
 */
import site from '../../data/site.json' with { type: 'json' };
import type { NomCollection } from './collections';

export const COLLECTIONS_MODELE: Record<string, NomCollection[]> = {
  entreprise: ['services', 'realisations', 'zones'],
  club: ['equipes', 'rencontres', 'actualites', 'albums'],
};
/** Blocs réservés à un modèle (absents de l'éditeur des autres) ; tous les autres blocs sont communs. */
export const BLOCS_MODELE: Record<string, string[]> = {
  'match-center': ['club'],
  planning: ['club'],
  'carte-restaurant': ['entreprise'],
  reservation: ['entreprise'],
};

export const modeleSite: string = (site as { modele?: string }).modele ?? 'entreprise';
export const collectionsDuSite = (): NomCollection[] => COLLECTIONS_MODELE[modeleSite] ?? COLLECTIONS_MODELE.entreprise;
export const blocDuSite = (bloc: string): boolean => !BLOCS_MODELE[bloc] || BLOCS_MODELE[bloc].includes(modeleSite);
