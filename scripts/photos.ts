/**
 * Liste de prises de vue à envoyer au client (npm run photos).
 * Parcourt pages et collections, repère chaque image, déduit du bloc qui
 * l'affiche le format et le cadrage attendus.
 *   npm run photos            → images provisoires ou manquantes uniquement
 *   npm run photos -- --tout  → toutes les images du site
 * Produit livrables/prises-de-vue.html (pour le client) et .md (suivi interne).
 */
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { emplacement, type Emplacement } from '../src/lib/emplacements';
import { urlPage, urlElement } from '../src/lib/urls';
import { nomsCollections, type NomCollection } from '../src/schemas/collections';
import site from '../data/site.json' with { type: 'json' };

const RACINE = process.cwd();
const tout = process.argv.includes('--tout');
const lister = (dir: string, ext: string): string[] =>
  !existsSync(dir) ? [] : readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? lister(p, ext) : p.endsWith(ext) ? [p] : []; });

interface Usage { page: string; url: string; bloc: string; emplacement: Emplacement; }
interface Photo { src: string; fichier: string; sujet: string; usages: Usage[]; statut: 'manquante' | 'provisoire' | 'fournie'; }
const photos = new Map<string, Photo>();

function noter(img: any, page: string, url: string, bloc: string, e: Emplacement) {
  if (!img?.src?.startsWith('/img/')) return;
  const fichier = 'media/' + img.src.slice(5);
  const statut = !existsSync(join(RACINE, fichier)) ? 'manquante' : /provisoire/.test(fichier) ? 'provisoire' : 'fournie';
  const p = photos.get(img.src) ?? { src: img.src, fichier, sujet: img.alt || '(image décorative)', usages: [], statut };
  p.usages.push({ page, url, bloc, emplacement: e });
  photos.set(img.src, p);
}

function parcourirSections(sections: any[], page: string, url: string) {
  for (const s of sections ?? []) {
    const v = s.variant;
    if (s.image) noter(s.image, page, url, s.block, emplacement({ bloc: s.block, variant: v, champ: 'image' }));
    (s.images ?? []).forEach((img: any, i: number) => noter(img, page, url, s.block, emplacement({ bloc: s.block, variant: v, champ: 'images', index: i, nb: s.images.length })));
    (s.slides ?? []).forEach((sl: any) => noter(sl.image, page, url, s.block, emplacement({ bloc: 'slider', variant: v, champ: 'slides' })));
  }
}

// Pages publiées (les brouillons n'ont pas besoin de photos tout de suite)
for (const f of lister(join(RACINE, 'content/pages'), '.yaml')) {
  const d = parseYaml(readFileSync(f, 'utf8'));
  if (d?.statut === 'brouillon') continue;
  const id = relative(join(RACINE, 'content/pages'), f).replace(/\.yaml$/, '');
  parcourirSections(d.sections, d.titre, urlPage(id));
}
// Collections : image principale (carte + page de détail), galerie, sections
const blocCarte: Partial<Record<NomCollection, string>> = { services: 'carte-service', realisations: 'carte-realisation' };
for (const nom of nomsCollections) {
  for (const f of lister(join(RACINE, 'content', nom), '.md')) {
    const m = readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!m) continue;
    const d = parseYaml(m[1]);
    if (d?.statut === 'brouillon') continue;
    const id = relative(join(RACINE, 'content', nom), f).replace(/\.md$/, '');
    const url = urlElement(nom, id);
    if (d.image) noter(d.image, d.titre, url, blocCarte[nom] ?? 'hero', emplacement({ bloc: blocCarte[nom] ?? 'hero', variant: 'split', champ: 'image' }));
    (d.galerie ?? []).forEach((img: any) => noter(img, d.titre, url, 'galerie', emplacement({ bloc: 'galerie', champ: 'galerie' })));
    parcourirSections(d.sections, d.titre, url);
  }
}

// Sélection et numérotation, dans l'ordre des pages
const liste = [...photos.values()].filter((p) => tout || p.statut !== 'fournie');
liste.forEach((p) => p.usages.sort((a, b) => b.emplacement.exigence - a.emplacement.exigence));
const principal = (p: Photo) => p.usages[0].emplacement;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const num = (i: number) => String(i + 1).padStart(2, '0');
const date = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date());

const groupes = new Map<string, { titre: string; url: string; items: { p: Photo; i: number }[] }>();
liste.forEach((p, i) => {
  const u = p.usages[0];
  const g = groupes.get(u.url) ?? { titre: u.page, url: u.url, items: [] };
  g.items.push({ p, i });
  groupes.set(u.url, g);
});

/* ------------------------- Markdown (suivi interne) ------------------------- */
let md = `# Prises de vue — ${site.nom}\n\nGénéré le ${date} par \`npm run photos\`${tout ? ' (toutes les images)' : ''}. ${liste.length} photo(s).\n\n`;
md += '| N° | Sujet | Format | Largeur min. | Utilisée sur | Fichier à remplacer | Statut |\n| --- | --- | --- | --- | --- | --- | --- |\n';
liste.forEach((p, i) => {
  const e = principal(p);
  md += `| ${num(i)} | ${p.sujet} | ${e.format} ${e.ratio} | ${e.minLargeur} px | ${[...new Set(p.usages.map((u) => u.url))].join(', ')} | \`${p.fichier}\` | ${p.statut} |\n`;
});
md += `\nÀ réception : renommer chaque photo du client selon le fichier de sa ligne (en gardant le nom sans « -provisoire » et en mettant à jour \`src\` dans le contenu), puis \`npm run validate\`.\n`;

/* ---------------------------- HTML (pour le client) ---------------------------- */
const tokens = readFileSync(join(RACINE, 'src/styles/tokens.css'), 'utf8');
const vignette = (e: Emplacement) => {
  const [w, h] = e.format === 'portrait' ? [60, 80] : e.ratio.startsWith('16:9') ? [96, 54] : e.ratio.startsWith('16:7') ? [96, 42] : e.ratio.startsWith('2:1') ? [96, 48] : e.format === 'libre' ? [80, 64] : [88, 66];
  const texte = e.ratio.startsWith('16:9 (très') ? '<span class="v-texte"></span>' : '';
  return `<span class="vignette" style="width:${w}px;height:${h}px">${texte}<span class="v-sujet${texte ? ' v-sujet--droite' : ''}"></span></span>`;
};
let cartes = '';
for (const g of groupes.values()) {
  cartes += `<section class="groupe"><h2>${esc(g.titre)} <span class="url">${esc(g.url)}</span></h2>`;
  for (const { p, i } of g.items) {
    const e = principal(p);
    const autres = [...new Set(p.usages.slice(1).map((u) => u.page))].filter((t) => t !== g.titre);
    cartes += `<article class="photo"><div class="num">${num(i)}</div>${vignette(e)}<div class="corps">
      <h3>${esc(p.sujet)}</h3>
      <p class="meta"><span class="pastille">${e.format}</span> ${esc(e.ratio)} · au moins ${e.minLargeur} px de large</p>
      <p>${esc(e.cadrage)}</p>
      ${autres.length ? `<p class="aussi">Aussi utilisée sur : ${autres.map(esc).join(', ')}</p>` : ''}
      <p class="fichier">Nommer la photo <strong>${num(i)}.jpg</strong></p>
    </div></article>`;
  }
  cartes += '</section>';
}

const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Photos à fournir — ${esc(site.nom)}</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
${tokens}
*{box-sizing:border-box} body{margin:0;background:var(--c-surface-alt);color:var(--c-text);font-family:var(--font-sans);line-height:1.5}
.page{max-width:860px;margin:0 auto;padding:40px 20px 64px;display:flex;flex-direction:column;gap:28px}
header{display:flex;flex-direction:column;gap:10px}
.eyebrow{font-family:var(--font-mono);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--c-eyebrow)}
h1{margin:0;font-size:34px;letter-spacing:-.02em;line-height:1.1}
.intro{margin:0;color:var(--c-text-muted);font-size:16px;max-width:62ch}
.conseils{background:var(--c-surface);border:1px solid var(--c-border);border-radius:18px;padding:22px 24px}
.conseils h2{margin:0 0 10px;font-size:18px} .conseils ul{margin:0;padding-left:1.1em;display:grid;gap:6px;color:var(--c-text-body);font-size:15px}
.groupe{display:flex;flex-direction:column;gap:12px}
.groupe h2{margin:8px 0 0;font-size:20px;display:flex;flex-wrap:wrap;align-items:baseline;gap:10px}
.url{font-family:var(--font-mono);font-size:12px;font-weight:400;color:var(--c-eyebrow)}
.photo{display:grid;grid-template-columns:auto 96px 1fr;gap:18px;align-items:start;background:var(--c-surface);border:1px solid var(--c-border);border-radius:18px;padding:18px 20px;break-inside:avoid}
.num{font-family:var(--font-mono);font-size:22px;font-weight:500;color:var(--c-primary);min-width:2ch}
.vignette{position:relative;display:block;justify-self:center;border:1.5px dashed var(--c-eyebrow);border-radius:6px;background:oklch(0.97 0.01 160);margin-top:4px}
.v-sujet{position:absolute;left:50%;top:50%;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:var(--c-primary)}
.v-sujet--droite{left:74%}
.v-texte{position:absolute;left:8%;top:30%;width:34%;height:40%;background:repeating-linear-gradient(0deg,var(--c-border) 0 3px,transparent 3px 7px)}
.corps{display:flex;flex-direction:column;gap:6px;min-width:0} .corps h3{margin:0;font-size:17px} .corps p{margin:0;font-size:14.5px;color:var(--c-text-body)}
.meta{color:var(--c-text-muted)!important} .pastille{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:99px;background:var(--c-accent);color:var(--c-accent-ink)}
.aussi{font-size:13px!important;color:var(--c-text-muted)!important} .fichier{font-size:13.5px!important}
footer{font-size:13px;color:var(--c-text-muted)}
@media (max-width:600px){.photo{grid-template-columns:auto 1fr}.vignette{display:none}}
@media print{body{background:#fff}.page{padding:0}.conseils,.photo{border-color:#ccc}}
</style></head><body><div class="page">
<header><span class="eyebrow">${esc(site.nom)} · site internet</span><h1>Photos à fournir</h1>
<p class="intro">${liste.length} photo${liste.length > 1 ? 's' : ''} pour le lancement du site. Pour chacune : le sujet, le sens de l'appareil et où placer le sujet dans l'image. Le schéma à gauche montre le format ; le point vert, où mettre le sujet.</p></header>
<section class="conseils"><h2>Avant de photographier</h2><ul>
<li>Lumière du jour, sans flash. Éviter le contre-jour (fenêtre derrière le sujet).</li>
<li>Chantier rangé : outils, cartons et câbles hors du cadre. Fourgon propre.</li>
<li>Téléphone à hauteur d'yeux, bien droit ; faire 3 ou 4 essais par photo, nous choisirons.</li>
<li>Pas de filtre ni de retouche. Pas de zoom numérique : se rapprocher.</li>
<li>Personne reconnaissable (client, voisin) : uniquement avec son accord. Pas de plaque d'immatriculation ni d'adresse lisible.</li>
<li>Envoyer les originaux par un lien de téléchargement (WeTransfer, Google Drive…), pas par WhatsApp ou SMS qui réduisent la qualité.</li>
</ul></section>
${cartes}
<footer>Liste générée le ${date}. Une photo manque ou ne convient pas ? On peut utiliser une image de banque d'images pour les visuels génériques, jamais pour les réalisations.</footer>
</div></body></html>`;

mkdirSync(join(RACINE, 'livrables'), { recursive: true });
writeFileSync(join(RACINE, 'livrables/prises-de-vue.md'), md);
writeFileSync(join(RACINE, 'livrables/prises-de-vue.html'), html);
console.log(`${liste.length} photo(s) → livrables/prises-de-vue.html (client) et livrables/prises-de-vue.md (suivi)`);
