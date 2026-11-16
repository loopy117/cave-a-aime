/**
 * Collections propres au site (socle 1.46.0) : une déclaration par type de fiche, un fichier par collection.
 * Le socle en tire la validation, l'éditeur, le catalogue de l'IA, la liste filtrable, les pages et les données
 * structurées. Les fiches : content/<nom>/<id>.md. Un nom de collection du socle est refusé.
 *
 * Exemple :
 *   import vins from './vins';
 *   export const collectionsSite = [vins];
 * avec, dans ./vins.ts :
 *   import { definirCollection } from '../../lib/collections-site';
 *   export default definirCollection({ nom: 'vins', libelle: 'Vins', element: 'vin', base: '/vins', … });
 */
import type { DeclarationCollection } from '../../lib/collections-site';

export const collectionsSite: DeclarationCollection[] = [];
