/**
 * Collections propres au site (socle 1.46.0) : une déclaration par type de fiche, un fichier par collection.
 * Les fiches : content/<nom>/<id>.md.
 */
import type { DeclarationCollection } from '../../lib/collections-site';
import vins from './vins';

export const collectionsSite: DeclarationCollection[] = [vins];
