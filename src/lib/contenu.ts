import { getCollection } from 'astro:content';
import type { Element } from './requete';
import type { NomCollection } from '../schemas/collections';
import { estPublie } from './requete';

const cache = new Map<string, Element[]>();

/** Tous les éléments d'une collection (publiés ou non : le filtre est fait par la requête). */
export async function elements(collection: NomCollection): Promise<Element[]> {
  if (!cache.has(collection)) {
    const liste = await getCollection(collection as any);
    cache.set(collection, liste.map((e: any) => ({ id: e.id, data: e.data })));
  }
  return cache.get(collection)!;
}

export async function publies(collection: NomCollection): Promise<Element[]> {
  return (await elements(collection)).filter((e) => estPublie(e));
}
