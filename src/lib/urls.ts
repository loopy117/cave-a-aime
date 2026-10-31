import { reglages } from './collections';
import type { NomCollection } from '../schemas/collections';

/** content/pages/services/index.yaml → /services ; index.yaml → / */
export function urlPage(id: string): string {
  const propre = id.replace(/(^|\/)index$/, '');
  return '/' + propre;
}
export function urlElement(collection: NomCollection, id: string): string {
  return `${reglages[collection].base}/${id}`;
}
export function urlArchive(collection: NomCollection, page = 1): string {
  const base = reglages[collection].base;
  return page > 1 ? `${base}/page/${page}` : base;
}
export function urlCategorie(collection: NomCollection, categorie: string, page = 1): string {
  const base = `${reglages[collection].base}/categorie/${categorie}`;
  return page > 1 ? `${base}/page/${page}` : base;
}
