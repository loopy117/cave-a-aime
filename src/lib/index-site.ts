/**
 * Index du site : toutes les URL générées, avec leur titre et leur statut.
 * Pur TypeScript, partagé par le rendu (menu, fil d'Ariane) et la validation.
 */
import { reglages } from './collections';
import { urlPage, urlElement, urlArchive, urlCategorie } from './urls';
import { estPublie, type Element } from './requete';
import type { NomCollection } from '../schemas/collections';

export interface EntreeIndex { url: string; titre: string; publie: boolean; type: 'page' | 'element' | 'archive' | 'categorie'; collection?: NomCollection; id?: string; resume?: string; ancres?: string[] }

export function construireIndex(pages: Element[], collections: Record<NomCollection, Element[]>, taxonomies: { metiers: Record<string, string> }): Map<string, EntreeIndex> {
  const index = new Map<string, EntreeIndex>();
  for (const p of pages) {
    const url = urlPage(p.id);
    index.set(url, { url, titre: p.data.titre, publie: p.data.statut !== 'brouillon', type: 'page', id: p.id, ancres: p.data.ancres });
  }
  for (const [nom, liste] of Object.entries(collections) as [NomCollection, Element[]][]) {
    const r = reglages[nom];
    if (r.archive) {
      // Archive vide (aucun élément publié) : pas de page générée, liens masqués. Une page du site à la même adresse
      // (ex. content/pages/zones.yaml sur un site sans collection zones) garde sa place.
      const pleine = liste.some((e) => estPublie(e));
      if (pleine || index.get(urlArchive(nom))?.type !== 'page')
        index.set(urlArchive(nom), { url: urlArchive(nom), titre: r.libelle, publie: pleine, type: 'archive', collection: nom });
      if (r.archive.parCategorie) {
        const cats = new Set(liste.filter((e) => estPublie(e)).map((e) => e.data.categorie));
        for (const c of cats) index.set(urlCategorie(nom, c), { url: urlCategorie(nom, c), titre: `${r.libelle} · ${taxonomies.metiers[c] ?? c}`, publie: true, type: 'categorie', collection: nom });
      }
    }
    if (r.detail) {
      for (const e of liste) {
        const url = urlElement(nom, e.id);
        index.set(url, { url, titre: e.data.titre, publie: estPublie(e), type: 'element', collection: nom, id: e.id, resume: e.data.resume, ancres: e.data.ancres });
      }
    }
  }
  return index;
}

export interface EntreeNav { page?: string; element?: string; collection?: NomCollection; href?: string; label?: string; description?: string; disposition?: 'liste' | 'mega'; icone?: string; enfants?: EntreeNav[] }
export interface LienResolu { label: string; href: string; visible: boolean; description?: string; disposition?: 'liste' | 'mega'; icone?: string; /** intitulé de colonne sans lien (méga-menu) */ groupe?: boolean; probleme?: { grave: boolean; message: string }; enfants?: LienResolu[] }

/** Transforme une entrée de menu.json / footer.json en lien. Une cible en brouillon est masquée. */
export function resoudreEntree(e: EntreeNav, index: Map<string, EntreeIndex>): LienResolu {
  // description et disposition : méga-menu (règles de forme : lib/menu-regles.ts)
  const plus = { description: e.description, disposition: e.disposition, icone: e.icone };
  let url: string | undefined;
  let ancre = '';
  if (e.page) { const k = e.page.indexOf('#'); url = k < 0 ? e.page : e.page.slice(0, k) || '/'; ancre = k < 0 ? '' : e.page.slice(k); }
  else if (e.element) { const [col, ...id] = e.element.split('/'); url = urlElement(col as NomCollection, id.join('/')); }
  else if (e.collection) url = urlArchive(e.collection);
  else if (e.href) return { label: e.label ?? e.href, href: e.href, visible: true, ...plus, enfants: e.enfants?.map((x) => resoudreEntree(x, index)) };
  else if (e.label && e.enfants?.length) {
    // Intitulé de colonne sans lien : visible tant qu'un de ses liens l'est
    const enfants = e.enfants.map((x) => resoudreEntree(x, index));
    return { label: e.label, href: '', visible: enfants.some((x) => x.visible), groupe: true, ...plus, enfants };
  }

  const cible = url ? index.get(url) : undefined;
  const enfants = e.enfants?.map((x) => resoudreEntree(x, index));
  if (!url || !cible) {
    return { label: e.label ?? url ?? '?', href: url ?? '#', visible: false, enfants, probleme: { grave: true, message: `cible introuvable : ${JSON.stringify(e)}` } };
  }
  if (!cible.publie) {
    return { label: e.label ?? cible.titre, href: url + ancre, visible: false, enfants, probleme: { grave: false, message: `« ${cible.titre} » (${url}) est en brouillon : entrée masquée` } };
  }
  return { label: e.label ?? cible.titre, href: url + ancre, visible: true, ...plus, enfants };
}
