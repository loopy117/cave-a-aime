// Icônes du site et images de partage (réseaux sociaux), à partir de data/partage.json.
//
//   node scripts/partage.mjs icones   (à la main, quand le dessin change) public/favicon.ico, favicon.svg,
//                                     apple-touch-icon.png, icone-app-192.png et icone-app-512.png
//                                     depuis data/partage/favicon.svg (ou favicon.png)
//   node scripts/partage.mjs images   (au build) une image 1200×630 par page qui déclare une og:image :
//                                     fond et décor du site, logo, titre de la page, adresse du site
//
// Les textes sont convertis en tracés (opentype.js + polices @fontsource) : rendu identique partout,
// sans dépendre des polices installées sur la machine de build.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import opentype from 'opentype.js';

const require = createRequire(import.meta.url);
const C = JSON.parse(readFileSync('data/partage.json', 'utf8'));
const site = JSON.parse(readFileSync('data/site.json', 'utf8'));
const W = 1200, H = 630;

const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const polices = new Map();
const police = (p) => polices.get(p) ?? polices.set(p, policeBrute(p)).get(p);
const policeBrute = (p) => opentype.parse(toArrayBuffer(readFileSync(require.resolve(p))));
const echapper = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const decoder = (s) => String(s).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');

/** Fichier SVG ou image matricielle → contenu à placer dans une image SVG (x, y, hauteur). */
function image(fichier, x, y, h) {
  if (!fichier || !existsSync(fichier)) return '';
  if (extname(fichier) === '.svg') {
    const svg = readFileSync(fichier, 'utf8');
    const vb = (svg.match(/viewBox="([^"]+)"/) || [])[1]?.split(/[\s,]+/).map(Number);
    if (!vb) return '';
    const k = h / vb[3];
    const interieur = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    return `<g transform="translate(${x} ${y}) scale(${k}) translate(${-vb[0]} ${-vb[1]})">${interieur}</g>`;
  }
  const b64 = readFileSync(fichier).toString('base64');
  return { png: b64, x, y, h };
}

/** Coupe un texte en lignes de largeur max. */
function lignes(font, texte, taille, largeur) {
  const mots = texte.split(/\s+/); const res = []; let l = '';
  for (const m of mots) {
    const essai = l ? l + ' ' + m : m;
    if (l && font.getAdvanceWidth(essai, taille) > largeur) { res.push(l); l = m; } else l = essai;
  }
  if (l) res.push(l);
  return res;
}

async function imagePartage(titre) {
  const fT = police(C.police_titre), fX = police(C.police_texte);
  const largeur = W - 2 * 80 - (C.marge_droite ?? 0);
  // taille du titre : la plus grande qui tient en 3 lignes
  let taille = 76, ls;
  for (; taille >= 44; taille -= 4) { ls = lignes(fT, titre, taille, largeur); if (ls.length <= 3) break; }
  if (ls.length > 3) { ls = ls.slice(0, 3); ls[2] = ls[2].replace(/\s+\S*$/, '') + '…'; }
  const interligne = Math.round(taille * 1.12);
  const bas = H - 150;                        // le titre est calé au-dessus de l'adresse
  const y0 = bas - (ls.length - 1) * interligne;
  const traces = ls.map((l, i) => fT.getPath(l, 80, y0 + i * interligne, taille).toPathData(2)).join(' ');
  const domaine = new URL(site.url).host;
  const adresse = fX.getPath(domaine, 80, H - 70, 28).toPathData(2);
  const logo = image(C.logo, C.logo_x ?? 80, C.logo_y ?? 64, C.logo_hauteur ?? 64);
  const decor = C.decor && existsSync(C.decor) ? readFileSync(C.decor, 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '') : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs><linearGradient id="fond" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.fond}"/><stop offset="1" stop-color="${C.fond2 ?? C.fond}"/></linearGradient></defs>
  <rect width="${W}" height="${H}" fill="url(#fond)"/>
  ${decor}
  ${typeof logo === 'string' ? logo : ''}
  <path d="${traces}" fill="${C.texte}"/>
  <rect x="80" y="${H - 122}" width="56" height="6" rx="3" fill="${C.accent}"/>
  <path d="${adresse}" fill="${C.secondaire ?? C.texte}"/>
</svg>`;
  let img = sharp(Buffer.from(svg));
  if (typeof logo === 'object') {
    const l = await sharp(Buffer.from(logo.png, 'base64')).resize({ height: logo.h }).png().toBuffer();
    img = sharp(await img.png().toBuffer()).composite([{ input: l, left: logo.x, top: logo.y }]);
  }
  return img.png({ compressionLevel: 9 }).toBuffer();
}

function pagesHtml(dossier, res = []) {
  for (const n of readdirSync(dossier)) {
    const f = join(dossier, n);
    if (statSync(f).isDirectory()) { if (!['_astro', 'xmedia-ai', 'admin', 'img', 'partage'].includes(n)) pagesHtml(f, res); }
    else if (n.endsWith('.html')) res.push(f);
  }
  return res;
}

async function images() {
  const faites = new Set();
  let n = 0;
  for (const f of pagesHtml('dist')) {
    const html = readFileSync(f, 'utf8');
    const og = html.match(/<meta property="og:image" content="([^"]+)"/);
    const t = html.match(/<meta property="og:title" content="([^"]+)"/);
    if (!og || !t) continue;
    const chemin = new URL(og[1]).pathname;
    if (faites.has(chemin)) continue;
    faites.add(chemin);
    // titre sans le nom du site (« Contact — Sillaya », « Sillaya · Création… »)
    const nom = site.nom.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let titre = decoder(t[1]).replace(new RegExp(`\\s*[—|·-]\\s*${nom}\\s*$`), '').replace(new RegExp(`^${nom}\\s*[—|·:-]\\s*`), '').trim();
    if (chemin.endsWith('/accueil.png') && C.titre_accueil) titre = C.titre_accueil;
    const sortie = join('dist', chemin);
    mkdirSync(dirname(sortie), { recursive: true });
    writeFileSync(sortie, await imagePartage(titre || site.nom));
    n++;
  }
  console.log(`Partage : ${n} image(s) générée(s)`);
}

/** ICO avec PNG intégrés (16, 32, 48) : lu par tous les navigateurs. */
function ico(pngs) {
  const entete = Buffer.alloc(6); entete.writeUInt16LE(0, 0); entete.writeUInt16LE(1, 2); entete.writeUInt16LE(pngs.length, 4);
  let decalage = 6 + 16 * pngs.length; const dir = [];
  for (const { taille, data } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(taille >= 256 ? 0 : taille, 0); e.writeUInt8(taille >= 256 ? 0 : taille, 1);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(data.length, 8); e.writeUInt32LE(decalage, 12);
    dir.push(e); decalage += data.length;
  }
  return Buffer.concat([entete, ...dir, ...pngs.map((p) => p.data)]);
}

async function icones() {
  const svg = 'data/partage/favicon.svg', png = 'data/partage/favicon.png';
  const source = existsSync(svg) ? readFileSync(svg) : readFileSync(png);
  const rendu = (t) => sharp(source, { density: 600 }).resize(t, t, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  writeFileSync('public/favicon.ico', ico(await Promise.all([16, 32, 48].map(async (t) => ({ taille: t, data: await rendu(t) })))));
  if (existsSync(svg)) copyFileSync(svg, 'public/favicon.svg');
  // Écran d'accueil (iPhone, Android) : fond plein, dessin avec une marge (zone de sécurité des icônes masquées)
  const icone = C.icone_app && existsSync(C.icone_app) ? readFileSync(C.icone_app) : source;
  const fondApp = C.fond_app ?? C.fond;
  // marge_app : 0 quand le dessin a déjà son propre fond plein (le système arrondit lui-même les coins)
  const m = C.marge_app ?? 0.12;
  for (const [nom, t, marge] of [['apple-touch-icon.png', 180, m], ['icone-app-192.png', 192, m], ['icone-app-512.png', 512, m]]) {
    const interieur = Math.round(t * (1 - 2 * marge));
    const dessin = await sharp(icone, { density: 600 }).resize(interieur, interieur, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
    await sharp({ create: { width: t, height: t, channels: 4, background: fondApp } })
      .composite([{ input: dessin, gravity: 'center' }]).png().toFile(join('public', nom));
  }
  console.log('Icônes : public/favicon.ico, apple-touch-icon.png, icone-app-192.png, icone-app-512.png' + (existsSync(svg) ? ', favicon.svg' : ''));
}

const commande = process.argv[2];
if (commande === 'images') await images();
else if (commande === 'icones') await icones();
else if (commande === 'apercu') writeFileSync(process.argv[4] || 'apercu-partage.png', await imagePartage(process.argv[3] || site.nom));
else { console.error('usage : node scripts/partage.mjs icones | images | apercu "Titre" [sortie.png]'); process.exit(1); }
