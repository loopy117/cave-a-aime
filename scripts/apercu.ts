/**
 * Aperçu des modifications en attente (build d'une branche cms/* de l'éditeur, déployé sur <nom>.apercu.…) :
 * repère dans les pages construites les textes qui viennent tels quels d'un champ du contenu (titre, bouton,
 * paragraphe sans mise en forme), pour qu'un relecteur les corrige directement sur la page.
 *
 * Pour chaque page : la place exacte de chaque champ dans son fichier source (octets début/fin + empreinte), dans
 * <script id="xm-apercu" type="application/json">, et data-xm-i="<n>" sur l'élément qui l'affiche. Le serveur
 * (xmedia-ai, action apercu_enregistrer) vérifie l'empreinte avant de remplacer : un fichier modifié depuis
 * l'aperçu n'est jamais écrasé. Ajoute aussi /apercu.json (branche, date) et le script /xmedia-ai/apercu.js.
 *
 * Sans APERCU=1 : ne fait rien (production, recette).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parseDocument, isMap, isSeq, isScalar, Scalar } from 'yaml';
import { urlPage, urlElement } from '../src/lib/urls';
import { nomsCollections } from '../src/schemas/collections';
import site from '../data/site.json' with { type: 'json' };

if (process.env.APERCU !== '1') process.exit(0);
const R = process.cwd();
const DIST = join(R, 'dist');
const lister = (dir: string, ext: string): string[] =>
  !existsSync(dir) ? [] : readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? lister(p, ext) : p.endsWith(ext) ? [p] : []; });

// riche : texte Markdown corrigé avec une petite barre (gras, italique, souligné) ; sinon texte brut
type Champ = { debut: number; fin: number; empreinte: string; valeur: string; chemin: string; riche?: boolean; balise?: string };
/** Texte affiché d'un Markdown en ligne (sans **, *, _, `, liens réduits à leur texte, balises retirées). */
const mdTexte = (v: string) => v.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, '')
  .replace(/\*\*|__|`/g, '').replace(/(?<![\w\\])\*|\*(?![\w])/g, '').replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1').replace(/\\([\\`*_[\]<>#|+-])/g, '$1');
const MD_EN_LIGNE = /\*\*[^*]+\*\*|(?<![\w*])\*[^*\s][^*]*\*(?![\w*])|\[[^\]]+\]\([^)]+\)|(?<!\w)_[^_\s][^_]*_(?!\w)|<u>/;
// Comparaison tolérante à la typographie automatique du Markdown (' → ’, " → “ ”, ... → …) et aux espaces insécables
const norm = (s: string) => s.replace(/[\u00a0\u202f\s]+/g, ' ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/…/g, '...').trim();
const octets = (texte: string, i: number) => Buffer.byteLength(texte.slice(0, i), 'utf8');

/** Champs texte d'un document YAML (scalaires sur une ligne ou entre guillemets ; pas les blocs | et >). */
function champsYaml(source: string, decalage: string): Champ[] {
  const doc = parseDocument(source, { keepSourceTokens: false });
  const champs: Champ[] = [];
  const visiter = (n: unknown, chemin: string) => {
    if (isMap(n)) for (const it of n.items) visiter(it.value, chemin + '.' + String((it.key as Scalar)?.value ?? ''));
    else if (isSeq(n)) n.items.forEach((x, i) => visiter(x, `${chemin}.${i}`));
    else if (isScalar(n) && typeof n.value === 'string' && n.range && [Scalar.PLAIN, Scalar.QUOTE_DOUBLE, Scalar.QUOTE_SINGLE].includes(n.type as string)) {
      if (norm(n.value).length < 2 || /^(\/|https?:|#|[a-z0-9_-]+$)/.test(n.value)) return;   // liens, identifiants, réglages
      const brut = decalage + source;
      const d = octets(brut, decalage.length + n.range[0]), f = octets(brut, decalage.length + n.range[1]);
      const tranche = Buffer.from(brut, 'utf8').subarray(d, f).toString('utf8');
      champs.push({ debut: d, fin: f, empreinte: createHash('sha256').update(tranche).digest('hex'), valeur: n.value, chemin: chemin.slice(1), ...(MD_EN_LIGNE.test(n.value) ? { riche: true } : {}) });
    }
  };
  visiter(doc.contents, '');
  return champs;
}

function champsFichier(fichier: string): Champ[] {
  const texte = readFileSync(fichier, 'utf8');
  if (fichier.endsWith('.yaml')) return champsYaml(texte, '');
  const m = texte.match(/^(---\r?\n)([\s\S]*?\r?\n)---\r?\n/);
  if (!m) return [];
  const champs = champsYaml(m[2], m[1]);
  champs.push(...champsCorps(texte, m[0].length));
  return champs;
}

/**
 * Corps Markdown : chaque paragraphe, intertitre et élément de liste devient une zone corrigeable sur la page, avec sa
 * mise en forme (gras, italique, souligné, liens conservés). Tableaux, code, citations et images restent à l'éditeur.
 */
function champsCorps(texte: string, debutCorps: number): Champ[] {
  const champs: Champ[] = [];
  let n = 0;
  const bloc = (i: number, j: number, balise: string) => {
    while (i < j && /\s/.test(texte[i])) i++;
    while (j > i && /\s/.test(texte[j - 1])) j--;
    const valeur = texte.slice(i, j);
    if (norm(mdTexte(valeur)).length < 2) return;
    const d = octets(texte, i), f = octets(texte, j);
    champs.push({ debut: d, fin: f, empreinte: createHash('sha256').update(Buffer.from(texte, 'utf8').subarray(d, f)).digest('hex'), valeur, chemin: `corps.${n++}`, riche: true, balise });
  };
  const lignes: { i: number; t: string }[] = [];
  for (let i = debutCorps; i < texte.length;) {
    const k = texte.indexOf('\n', i), fin = k < 0 ? texte.length : k;
    lignes.push({ i, t: texte.slice(i, fin) });
    i = fin + 1;
  }
  let enCode = false, para: { i: number; j: number } | null = null;
  let enListe = false;
  const fermer = () => { if (para) bloc(para.i, para.j, enListe ? 'li' : 'p'); para = null; };
  for (const l of lignes) {
    const t = l.t;
    if (/^\s*(```|~~~)/.test(t)) { fermer(); enCode = !enCode; continue; }
    if (enCode || !t.trim() || /^\s*(\||<|>|!\[|---|\*\*\*|___)/.test(t)) { fermer(); continue; }
    const titre = t.match(/^(#{1,6}\s+)(.*?)\s*#*\s*$/);
    const item = t.match(/^(\s*(?:[-*+]|\d+[.)])\s+)(.*)$/);
    if (titre) { fermer(); bloc(l.i + titre[1].length, l.i + titre[1].length + titre[2].length, 'h' + titre[1].trim().length); continue; }
    if (item) { fermer(); enListe = true; para = { i: l.i + item[1].length, j: l.i + t.length }; continue; }
    if (para) { para.j = l.i + t.length; continue; }           // suite du paragraphe (ou de l'élément de liste)
    enListe = false;
    para = { i: l.i, j: l.i + t.length };
  }
  fermer();
  return champs;
}

const ENTITES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', laquo: '«', raquo: '»', hellip: '…', mdash: '—', ndash: '–' };
const decoder = (s: string) => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (t, e: string) => e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENTITES[e.toLowerCase()] ?? t);
const echapperAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function htmlDe(url: string): string | null {
  const f = url === '/' ? join(DIST, 'index.html') : join(DIST, url.slice(1), 'index.html');
  return existsSync(f) ? f : null;
}

const editeur = (site.url || '').replace(/\/$/, '') + '/admin/#/collections/';
const sources: { url: string; fichier: string; lien: string }[] = [
  ...lister(join(R, 'content/pages'), '.yaml').map((f) => {
    const id = relative(join(R, 'content/pages'), f).replace(/\.yaml$/, '');
    return { url: urlPage(id), fichier: relative(R, f), lien: editeur + (id.includes('/') ? 'sous_pages' : `pages/entries/${id}`) };
  }),
  ...nomsCollections.flatMap((nom) => lister(join(R, 'content', nom), '.md').map((f) => {
    const id = relative(join(R, 'content', nom), f).replace(/\.md$/, '');
    return { url: urlElement(nom, id), fichier: relative(R, f), lien: editeur + `${nom}/entries/${id}` };
  })),
];

let pages = 0, reperes = 0;
for (const s of sources) {
  const f = htmlDe(s.url);
  if (!f) continue;
  const champs = champsFichier(join(R, s.fichier));
  // Champs par texte (dans l'ordre du fichier) : un même texte présent deux fois (bouton répété) est attribué dans
  // l'ordre de la page, seulement si la page l'affiche exactement autant de fois que le fichier le contient
  const parValeur = new Map<string, Champ[]>(), parTexteRiche = new Map<string, Champ[]>();
  for (const c of champs) {
    const m = c.riche ? parTexteRiche : parValeur, k = c.riche ? norm(mdTexte(c.valeur)) + '|' + (c.balise ?? '*') : norm(c.valeur);
    m.set(k, [...(m.get(k) ?? []), c]);
  }
  let html = readFileSync(f, 'utf8');
  const debutMain = html.indexOf('<main'), finMain = html.lastIndexOf('</main>');
  const utilises: Champ[] = [];
  if (debutMain >= 0 && finMain > debutMain) {
    // Un seul passage, dans l'ordre de la page : élément qui ne contient que du texte (data-xm-i sur l'élément),
    // ou texte à côté d'une icône (bouton, titre avec pictogramme : le texte seul est entouré d'un <span>)
    const motif = /<(h[1-6]|p|a|span|li|button|figcaption|strong|em|small|dt|dd|blockquote|label|td|th|div|cite|b)((?:\s[^>]*)?)>([^<]+)<\/\1(?=>)|>([^<>]*[^\s<>][^<>]*)</g;   // « > » final laissé au texte qui suit
    // Passe A — zones riches : paragraphe, intertitre, élément de liste… dont le texte (sans les balises de mise en
    // forme) est celui d'un champ Markdown. Leur contenu est mis de côté pendant la passe B.
    const BLOC = /<(p|li|h[1-6]|dd|dt|td|th|figcaption)((?:\s[^>]*)?)>((?:[^<]|<\/?(?:strong|em|b|i|u|a|code|br|span|small|abbr|q|s|sub|sup)(?:\s[^>]*)?\/?>)*)<\/\1>/g;
    const texteBloc = (inner: string) => norm(decoder(inner.replace(/<[^>]+>/g, '')));
    let zone = html.slice(debutMain, finMain);
    // Clés : « texte|balise » (corps Markdown : p, li, h2…) et « texte|* » (champ YAML, quelle que soit la balise)
    const vuesR = new Map<string, number>();
    const compter = (k: string) => vuesR.set(k, (vuesR.get(k) ?? 0) + 1);
    for (const m of zone.matchAll(BLOC)) { compter(texteBloc(m[3]) + '|' + m[1]); compter(texteBloc(m[3]) + '|*'); }
    const fileR = new Map([...parTexteRiche].filter(([v, l]) => vuesR.get(v) === l.length).map(([v, l]) => [v, [...l]]));
    const misDeCote: string[] = [];
    zone = zone.replace(BLOC, (tout, tag: string, attrs: string, inner: string) => {
      const c = (fileR.get(texteBloc(inner) + '|' + tag) ?? fileR.get(texteBloc(inner) + '|*'))?.shift();
      if (!c) return tout;
      utilises.push(c);
      misDeCote.push(inner);
      return `<${tag}${attrs} data-xm-i="${utilises.length - 1}">\u0000${misDeCote.length - 1}\u0000</${tag}>`;
    });
    // Passe B — textes simples
    const morceaux = zone.split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<textarea[\s\S]*?<\/textarea>|<select[\s\S]*?<\/select>)/);
    // Texte qui suit un intitulé en gras (« Un suivi simple : nouvelle demande… ») : sans le « : » de liaison
    const SEP = /^(\s*[:,;–—-]\s+)([\s\S]*?)(\s*)$/;
    const sansSep = (t: string) => { const m = t.match(SEP); return m ? m[2] : t; };
    const texteDe = (m: RegExpMatchArray | string[]) => norm(decoder(m[3] ?? sansSep(m[4] ?? '')));
    const vues = new Map<string, number>(), titres = new Map<string, number>();
    morceaux.forEach((x, i) => { if (!(i % 2)) for (const m of x.matchAll(motif)) {
      vues.set(texteDe(m), (vues.get(texteDe(m)) ?? 0) + 1);
      if (/^h[1-6]$/.test(m[1] ?? '')) titres.set(texteDe(m), (titres.get(texteDe(m)) ?? 0) + 1);
    } });
    // Un champ affiché plusieurs fois (titre de la page repris dans le fil d'Ariane) : on garde l'intertitre s'il est seul
    const seulTitre = new Set([...parValeur].filter(([v, l]) => l.length === 1 && (vues.get(v) ?? 0) > 1 && titres.get(v) === 1).map(([v]) => v));
    const file = new Map([...parValeur].filter(([v, l]) => vues.get(v) === l.length || seulTitre.has(v)).map(([v, l]) => [v, [...l]]));
    const main = morceaux.map((x, i) => i % 2 ? x : x.replace(motif, (tout, tag?: string, attrs?: string, inner?: string, texte?: string) => {
      const cle = norm(decoder(inner ?? sansSep(texte ?? '')));
      if (seulTitre.has(cle) && !/^h[1-6]$/.test(tag ?? '')) return tout;
      const c = file.get(cle)?.shift();
      if (!c) return tout;
      utilises.push(c);
      const n = utilises.length - 1;
      if (tag) return `<${tag}${attrs} data-xm-i="${n}">${inner}</${tag}`;
      const t = texte!, sep = t.match(SEP);
      const avant = sep ? sep[1] : t.match(/^\s*/)![0], coeur = sep ? sep[2] : t.trim(), apres = sep ? sep[3] : t.match(/\s*$/)![0];
      return `>${avant}<span data-xm-i="${n}">${coeur}</span>${apres}<`;
    })).join('');
    html = html.slice(0, debutMain) + main.replace(/\u0000(\d+)\u0000/g, (_, k: string) => misDeCote[+k]) + html.slice(finMain);
  }
  const donnees = JSON.stringify({ fichier: s.fichier, editeur: s.lien, champs: utilises.map(({ debut, fin, empreinte, valeur, chemin, riche }: Champ) => ({ debut, fin, empreinte, valeur, chemin, ...(riche ? { riche } : {}) })) }).replace(/</g, '\\u003c');
  html = html.replace('</body>', `<script id="xm-apercu" type="application/json">${donnees}</script><script src="/xmedia-ai/apercu.js" defer></script></body>`);
  writeFileSync(f, html);
  pages++; reperes += utilises.length;
}
// Les autres pages (archives, plan du site…) ont aussi le bandeau, sans texte modifiable
for (const f of lister(DIST, '.html')) {
  const html = readFileSync(f, 'utf8');
  if (html.includes('id="xm-apercu"') || !html.includes('</body>') || f.includes(`${join(DIST, 'admin')}`)) continue;
  writeFileSync(f, html.replace('</body>', `<script id="xm-apercu" type="application/json">{"fichier":null,"editeur":${JSON.stringify(echapperAttr(editeur.replace(/collections\/$/, '')))},"champs":[]}</script><script src="/xmedia-ai/apercu.js" defer></script></body>`));
}
writeFileSync(join(DIST, 'apercu.json'), JSON.stringify({ branche: process.env.APERCU_BRANCHE || '', sha: process.env.APERCU_SHA || process.env.GITHUB_SHA || '', date: new Date().toISOString() }));
console.log(`Aperçu : ${reperes} texte(s) modifiable(s) sur ${pages} page(s)`);
