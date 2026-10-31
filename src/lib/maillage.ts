/**
 * Maillage contextuel (spec §25) : dans le texte rendu d'une page, la première
 * occurrence d'une « ancre » d'une autre page devient un lien vers elle.
 *
 * Ancres d'une page : son champ `ancres`, sinon son titre (pages et éléments de
 * collection publiés). Règles : jamais vers la page elle-même ni vers une page
 * déjà liée dans le texte, un seul lien par cible et par page, 3 liens ajoutés
 * au plus par page, jamais dans un titre, un lien, un bouton ou du code.
 * Les ancres les plus longues passent d'abord (« pompe à chaleur piscine »
 * avant « pompe à chaleur »).
 *
 * Pur TypeScript : partagé par le rendu (Markdown.astro) et les tests.
 */
import type { EntreeIndex } from './index-site';

export const LIENS_MAX_PAR_PAGE = 3;

export interface Cible { url: string; ancre: string; motif: RegExp }

/** Liste des ancres de tout le site, les plus longues d'abord. */
export function construireCibles(index: Map<string, EntreeIndex>): Cible[] {
  const cibles: Cible[] = [];
  for (const e of index.values()) {
    if (!e.publie || e.url === '/' || (e.type !== 'page' && e.type !== 'element')) continue;
    const ancres = e.ancres?.length ? e.ancres : e.titre.length >= 6 ? [e.titre] : [];
    for (const a of ancres) {
      const propre = a.trim();
      if (propre.length < 3) continue;
      cibles.push({ url: e.url, ancre: propre, motif: motifAncre(propre) });
    }
  }
  return cibles.sort((a, b) => b.ancre.length - a.ancre.length);
}

/** Expression insensible à la casse, tolérante sur les espaces et apostrophes, sur des mots entiers. */
export function motifAncre(ancre: string): RegExp {
  // Chaque mot de 3 lettres ou plus accepte un pluriel en -s / -x (« pompes à chaleur de piscine »)
  const echappe = ancre
    .trim()
    .split(/\s+/)
    .map((mot) => {
      const m = mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "(?:['’]|&#39;|&rsquo;)");
      return mot.length >= 3 && !/[sx]$/i.test(mot) ? `${m}[sx]?` : m;
    })
    .join('\\s+');
  return new RegExp(`(?<![\\p{L}\\p{N}])${echappe}(?![\\p{L}\\p{N}])`, 'iu');
}

/** État d'une page : cibles déjà liées et nombre de liens ajoutés (partagé par tous ses blocs de texte). */
export interface EtatPage { lies: Set<string>; ajoutes: number }
const etats = new Map<string, EtatPage>();
export function etatPage(url: string): EtatPage {
  const u = normaliser(url);
  if (!etats.has(u)) etats.set(u, { lies: new Set([u]), ajoutes: 0 });
  return etats.get(u)!;
}

export function normaliser(url: string): string {
  const u = url.split(/[?#]/)[0].replace(/\/index\.html$/, '').replace(/\.html$/, '');
  return u.length > 1 ? u.replace(/\/+$/, '') : '/';
}

const IGNORER = new Set(['a', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'code', 'pre', 'button', 'summary', 'script', 'style']);

/** Ajoute les liens contextuels dans un fragment HTML (issu de Markdown). */
export function lierTexte(html: string, cibles: Cible[], etat: EtatPage, max = LIENS_MAX_PAR_PAGE): string {
  // Liens déjà présents dans le texte : ces cibles ne sont pas reliées une seconde fois
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)) {
    if (m[1].startsWith('/')) etat.lies.add(normaliser(m[1]));
  }
  if (etat.ajoutes >= max) return html;

  const morceaux = html.split(/(<[^>]+>)/);
  const pile: string[] = [];
  for (let i = 0; i < morceaux.length; i++) {
    const m = morceaux[i];
    if (!m) continue;
    if (m.startsWith('<')) {
      const t = /^<\s*(\/)?\s*([a-z0-9]+)/i.exec(m);
      if (t && !m.endsWith('/>')) {
        const nom = t[2].toLowerCase();
        if (t[1]) { const k = pile.lastIndexOf(nom); if (k >= 0) pile.splice(k); }
        else if (!/^(br|img|hr|input|meta|link|source|wbr)$/.test(nom)) pile.push(nom);
      }
      continue;
    }
    if (pile.some((n) => IGNORER.has(n))) continue;
    morceaux[i] = lierSegment(m, cibles, etat, max);
  }
  return morceaux.join('');
}

/**
 * Première occurrence de l'ancre qui ne fait pas partie d'une ancre plus longue
 * (« pompe à chaleur » n'est jamais lié à l'intérieur de « pompe à chaleur de piscine »).
 */
function premiereOccurrenceLibre(texte: string, c: Cible, cibles: Cible[]): { index: number; 0: string } | null {
  const plusLongues = cibles.filter((x) => x.ancre.length > c.ancre.length);
  const occupees: [number, number][] = [];
  for (const x of plusLongues) {
    for (const r of texte.matchAll(new RegExp(x.motif.source, 'giu'))) occupees.push([r.index!, r.index! + r[0].length]);
  }
  for (const r of texte.matchAll(new RegExp(c.motif.source, 'giu'))) {
    const debut = r.index!, fin = debut + r[0].length;
    if (!occupees.some(([a, b]) => debut >= a && fin <= b)) return { index: debut, 0: r[0] };
  }
  return null;
}

/** Texte sans balise : lie l'ancre la plus longue trouvée, puis traite ce qui précède et ce qui suit. */
function lierSegment(texte: string, cibles: Cible[], etat: EtatPage, max: number): string {
  for (const c of cibles) {
    if (etat.ajoutes >= max) return texte;
    if (etat.lies.has(c.url)) continue;
    const r = premiereOccurrenceLibre(texte, c, cibles);
    if (!r) continue;
    etat.lies.add(c.url);
    etat.ajoutes++;
    const avant = texte.slice(0, r.index), apres = texte.slice(r.index + r[0].length);
    const lien = `<a href="${c.url}" class="lien-contexte">${r[0]}</a>`;
    return lierSegment(avant, cibles, etat, max) + lien + lierSegment(apres, cibles, etat, max);
  }
  return texte;
}
