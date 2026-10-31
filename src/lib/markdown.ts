/**
 * Markdown des contenus (blocs, corps des collections, réponses de FAQ) → HTML, sans HTML brut ni lien dangereux.
 *
 * Les contenus viennent de l'éditeur, des rédacteurs et de l'IA : du HTML écrit dans le texte (<script>, <img onerror>,
 * <iframe>…) est affiché comme du texte, jamais interprété. Seul <u> (souligné) est permis. Les liens et images
 * n'acceptent que http(s), mailto:, tel:, les chemins du site et les ancres : javascript:, data:, vbscript: et
 * les autres protocoles sont neutralisés. La validation (scripts/validate.ts) signale ces cas avant le build ;
 * ce rendu est la seconde barrière, au cas où un contenu passerait outre.
 */
import { Marked, type Tokens } from 'marked';

const ECHAPPER: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const echapperHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ECHAPPER[c]);

/** Adresse de lien ou d'image acceptée (comparée sans espaces ni caractères de contrôle, insensible à la casse). */
export function adresseSure(href: string | null | undefined): boolean {
  if (!href) return false;
  const h = href.replace(/[\u0000-\u0020\u007f-\u009f]/g, '').toLowerCase();
  if (/^(https?:|mailto:|tel:)/.test(h)) return true;
  // Pas de protocole : chemin du site, ancre, requête, adresse relative (« services/x »)
  return !/^[a-z][a-z0-9+.-]*:/.test(h) && !h.startsWith('//') && !h.startsWith('\\');
}

const SOULIGNE = /^<\/?u>$/i;

const rendu = new Marked({
  gfm: true,
  walkTokens(t) {
    if ((t.type === 'link' || t.type === 'image') && !adresseSure((t as Tokens.Link).href)) (t as Tokens.Link).href = '#';
  },
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return SOULIGNE.test(text.trim()) ? text.trim() : echapperHtml(text);
    },
  },
});

export async function markdownVersHtml(source: string): Promise<string> {
  return rendu.parse(source ?? '', { async: true });
}
