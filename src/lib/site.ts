/** Données globales côté rendu : index du site, menu et footer résolus. */
import { getCollection } from 'astro:content';
import { construireIndex, resoudreEntree, type EntreeIndex } from './index-site';
import { elements } from './contenu';
import { nomsCollections, type NomCollection } from '../schemas/collections';
import menu from '../../data/menu.json';
import footer from '../../data/footer.json';
import taxonomies from '../../data/taxonomies.json';

let index: Map<string, EntreeIndex> | undefined;
export async function indexSite() {
  if (!index) {
    const pages = (await getCollection('pages')).map((p) => ({ id: p.id, data: p.data }));
    const cols = Object.fromEntries(await Promise.all(nomsCollections.map(async (n) => [n, await elements(n)]))) as Record<NomCollection, any>;
    index = construireIndex(pages, cols, taxonomies);
  }
  return index;
}

/** Lien vers la déclaration d'écoconception ajouté aux liens légaux du pied de page dès qu'elle est publiée. */
function avecEcoconception(liens: ReturnType<typeof resoudreEntree>[], idx: Map<string, EntreeIndex>) {
  const url = '/declaration-ecoconception';
  if (liens.some((l) => l.href === url)) return liens;
  const e = resoudreEntree({ page: url }, idx);
  return e.visible ? [...liens, e] : liens;
}

export async function navigation() {
  const idx = await indexSite();
  const r = (e: any) => resoudreEntree(e, idx);
  const visibles = (l: any[]) => l.map(r).filter((x) => x.visible);
  return {
    menu: visibles(menu.principal),
    bouton: menu.bouton,
    colonnes: footer.colonnes.map((c) => ({ titre: c.titre, liens: visibles(c.liens) })),
    legal: avecEcoconception(visibles(footer.legal), idx),
  };
}
