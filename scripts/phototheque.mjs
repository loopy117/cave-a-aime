/**
 * Photothèque de l'éditeur (après le build) : toutes les images de media/, avec une vignette de 320 px et l'endroit
 * où chacune est utilisée (page, actualité, album…). L'éditeur (/admin, widget « Choisir dans la photothèque »)
 * lit dist/admin/phototheque.json : une photo déjà publiée se réutilise sans être renvoyée ni dupliquée.
 * Vignettes gardées en cache (.cache/phototheque, par empreinte du fichier) d'un build à l'autre.
 */
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import sharp from 'sharp';

const DIST = 'dist', CACHE = '.cache/phototheque', SORTIE = join(DIST, 'admin/phototheque');
if (!existsSync(DIST)) throw new Error('dist/ absent : lancer astro build avant.');
mkdirSync(CACHE, { recursive: true });
mkdirSync(SORTIE, { recursive: true });

const lister = (d) => (!existsSync(d) ? [] : readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? lister(p) : [p]; }));

// 1. Usages : objets { src, alt, legende? } dans les contenus et les données
const usages = new Map();   // src → { alts: Map<alt, n>, legende, ou: Set<string> }
const noter = (v, ou) => {
  if (Array.isArray(v)) return v.forEach((x) => noter(x, ou));
  if (!v || typeof v !== 'object') return;
  if (typeof v.src === 'string' && v.src.startsWith('/img/')) {
    const u = usages.get(v.src) ?? { alts: new Map(), legende: '', ou: new Set() };
    if (v.alt) u.alts.set(v.alt, (u.alts.get(v.alt) ?? 0) + 1);
    if (v.legende && !u.legende) u.legende = v.legende;
    u.ou.add(ou);
    usages.set(v.src, u);
  }
  for (const x of Object.values(v)) noter(x, ou);
};
const LIBELLES = { actualites: 'Actualité', agenda: 'Agenda', actes: 'Acte', demarches: 'Démarche', annuaire: 'Annuaire', projets: 'Projet', lieux: 'Lieu', infos: 'Info pratique', albums: 'Album', documents: 'Document', pages: 'Page', realisations: 'Réalisation', services: 'Service', zones: 'Zone', equipes: 'Équipe' };
for (const f of lister('content')) {
  const col = relative('content', f).split('/')[0];
  let d;
  try {
    if (f.endsWith('.yaml')) d = parseYaml(readFileSync(f, 'utf8'));
    else if (f.endsWith('.md')) { const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(f, 'utf8')); d = m ? parseYaml(m[1]) : null; }
  } catch { continue; }
  if (!d) continue;
  noter(d, `${LIBELLES[col] ?? col} : ${d.titre ?? relative('content', f)}`);
}
for (const f of lister('data').filter((x) => x.endsWith('.json'))) {
  try { noter(JSON.parse(readFileSync(f, 'utf8')), `Réglages : ${relative('data', f)}`); } catch { /* fichier illisible : ignoré */ }
}

// 2. Images de media/ et vignettes
const photos = [];
for (const f of lister('media').filter((x) => /\.(jpe?g|png|webp)$/i.test(x))) {
  const src = '/img/' + relative('media', f).split('\\').join('/');
  const octets = readFileSync(f);
  const empreinte = createHash('sha1').update(octets).digest('hex').slice(0, 16);
  const vignette = `${empreinte}.webp`;
  const enCache = join(CACHE, vignette);
  let largeur = 0, hauteur = 0;
  try {
    const meta = await sharp(octets).metadata();
    [largeur, hauteur] = meta.orientation >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
    if (!existsSync(enCache)) await sharp(octets).rotate().resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toFile(enCache);
    copyFileSync(enCache, join(SORTIE, vignette));
  } catch (e) {
    console.warn(`⚠ ${src} : image illisible (${e.message})`);
    continue;
  }
  const u = usages.get(src);
  const alt = u ? [...u.alts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '' : '';
  const dossier = relative('media', f).split('/').slice(0, -1).join('/');
  photos.push({ src, vignette: `/admin/phototheque/${vignette}`, largeur, hauteur, poids: octets.length, alt, legende: u?.legende ?? '', dossier, ou: u ? [...u.ou].slice(0, 6) : [] });
}
photos.sort((a, b) => a.dossier.localeCompare(b.dossier) || a.src.localeCompare(b.src));
writeFileSync(join(DIST, 'admin/phototheque.json'), JSON.stringify({ genere: new Date().toISOString(), photos }));
console.log(`Photothèque : ${photos.length} image(s), ${photos.filter((p) => !p.ou.length).length} non utilisée(s) → dist/admin/phototheque.json`);
