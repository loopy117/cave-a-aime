#!/usr/bin/env node
/**
 * Note EcoIndex de chaque page, écrite dans son pied de page (étape du déploiement, après le contrôle).
 *
 * Méthode EcoIndex (ecoindex.fr, formule publique du collectif Green IT) : chaque page de dist/ est ouverte dans
 * Chromium (1920 × 1080, défilée jusqu'en bas) ; on relève le nombre d'éléments de la page (sans l'intérieur des
 * dessins SVG), le nombre de requêtes et le poids transféré (fichiers texte comptés compressés en gzip, comme le
 * serveur les envoie). La note (0 à 100) place ces trois mesures parmi celles du web (quantiles d'EcoIndex),
 * le nombre d'éléments comptant triple et les requêtes double.
 *
 * Seules les notes A (plus de 80) et B (plus de 70) sont affichées ; en dessous, l'élément est retiré.
 * L'élément du pied de page (src/partials/Ecoindex.astro) est construit masqué : sans cette étape (aperçu, local),
 * rien ne s'affiche. Écart possible d'un ou deux points avec ecoindex.fr (mesure du poids) : d'où « méthode ».
 * Les empreintes des pages (sitemap, IndexNow) sont calculées au build, avant la note : elle ne les change pas.
 *
 *   node scripts/ecoindex.mjs [dist]
 * Prérequis : playwright (installé par le déploiement, comme pour le contrôle). Sans lui : rien n'est fait.
 */
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, extname, normalize, relative } from 'node:path';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';

const DIST = process.argv[2] || 'dist';
const require = createRequire(join(process.cwd(), 'package.json'));
let chromium;
try { ({ chromium } = require('playwright')); } catch { console.log('EcoIndex : playwright absent, note non calculée (élément laissé masqué)'); process.exit(0); }

// Empreinte carbone par visite : CO2.js (Green Web Foundation), modèle Sustainable Web Design v4, hébergement vert,
// électricité française pour le serveur, le réseau et l'appareil (intensité moyenne fournie par CO2.js, données Ember).
let carbone = () => null;
try {
  const { co2 } = require('@tgwf/co2');
  const modele = new co2({ model: 'swd', version: 4 });
  const fra = { device: { country: 'FRA' }, dataCenter: { country: 'FRA' }, network: { country: 'FRA' } };
  carbone = (octets) => modele.perVisitTrace(octets, true, { gridIntensity: fra, dataReloadRatio: 0, firstVisitPercentage: 1, returnVisitPercentage: 0 }).co2;  // nombre (grammes) sans l'option rating
} catch { console.log('EcoIndex : @tgwf/co2 absent, empreinte carbone non calculée'); }
// « environ 0,012 g » ; sous 0,01 g : « moins de 0,01 g » (texte sans « < », écrit tel quel dans le HTML)
const grammes = (g) => (g < 0.01 ? 'moins de 0,01' : `environ ${g.toLocaleString('fr-FR', { maximumSignificantDigits: 2 })}`);

// --- Formule EcoIndex (quantiles du projet ecoindex, Green IT) --------------------------------------------------
const Q_DOM = [0, 47, 75, 159, 233, 298, 358, 417, 476, 537, 603, 674, 753, 843, 949, 1076, 1237, 1459, 1801, 2479, 594601];
const Q_REQ = [0, 2, 15, 25, 34, 42, 49, 56, 63, 70, 78, 86, 95, 105, 117, 130, 147, 170, 205, 281, 3920];
const Q_KO = [0, 1.37, 144.7, 319.53, 479.46, 631.97, 783.38, 937.91, 1098.62, 1265.47, 1448.32, 1648.27, 1876.08, 2142.06,
  2465.37, 2866.31, 3401.59, 4155.73, 5400.08, 8037.54, 223212.26];
function quantile(q, v) {
  for (let i = 1; i < q.length; i++) if (v <= q[i]) return i - 1 + (v - q[i - 1]) / (q[i] - q[i - 1]);
  return q.length - 1;
}
const noteEcoindex = (dom, req, ko) => Math.round(100 - (5 * (3 * quantile(Q_DOM, dom) + 2 * quantile(Q_REQ, req) + quantile(Q_KO, ko))) / 6);
const lettre = (n) => (n > 80 ? 'A' : n > 70 ? 'B' : n > 55 ? 'C' : n > 40 ? 'D' : n > 25 ? 'E' : n > 10 ? 'F' : 'G');

// --- Pages : toutes celles qui portent l'élément du pied de page ------------------------------------------------
const ELEMENT = /<p class="ecoindex"[^>]*\bdata-ecoindex\b[^>]*>[\s\S]*?<\/p>/;
const pages = [];
(function parcourir(d) {
  for (const n of readdirSync(d)) {
    const f = join(d, n);
    if (statSync(f).isDirectory()) { if (!['_astro', 'admin', 'pagefind', 'img'].includes(n)) parcourir(f); }
    else if (n.endsWith('.html') && ELEMENT.test(readFileSync(f, 'utf8'))) pages.push(f);
  }
})(DIST);
if (!pages.length) { console.log('EcoIndex : aucune page avec la note (désactivée dans data/site.json ?)'); process.exit(0); }

// --- Serveur local de dist/ ---------------------------------------------------------------------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain',
  '.webmanifest': 'application/manifest+json', '.wasm': 'application/wasm' };
function fichierDe(chemin) {
  const p = normalize(decodeURIComponent(chemin.split(/[?#]/)[0])).replace(/^(\.\.[/\\])+/, '');
  for (const c of [p, join(p, 'index.html')]) {
    const f = join(DIST, c);
    if (f.startsWith(normalize(DIST)) && existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}
const serveur = createServer((req, res) => {
  const f = fichierDe(req.url || '/');
  if (!f) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${serveur.address().port}`;

// Poids transféré : un fichier texte est compté compressé (le serveur compresse), les autres tels quels
const TEXTE = /^(text\/|application\/(javascript|json|xml|manifest)|image\/svg)/;
const poids = (type, corps) => (TEXTE.test(type) ? gzipSync(corps, { level: 6 }).length : corps.length);

// --- Mesure ---------------------------------------------------------------------------------------------------------
const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const resultats = [];
async function mesurer(fichier) {
  const chemin = '/' + relative(DIST, fichier).replace(/\\/g, '/').replace(/(^|\/)index\.html$/, '');
  const ctx = await navigateur.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  let requetes = 0, octets = 0;
  const attentes = [];
  page.on('response', (r) => {
    requetes++;
    attentes.push(r.body().then((b) => { octets += poids(r.headers()['content-type'] || '', b); }).catch(() => {}));
  });
  try {
    await page.goto(BASE + chemin, { waitUntil: 'networkidle', timeout: 30000 });
    await page.evaluate(async () => {   // défiler jusqu'en bas, comme EcoIndex (images différées)
      for (let y = 0; y < document.body.scrollHeight; y += 800) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); }
    });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    const dom = await page.evaluate(() => document.getElementsByTagName('*').length - document.querySelectorAll('svg *').length);
    await Promise.all(attentes);
    const note = noteEcoindex(dom, requetes, octets / 1024);
    resultats.push({ fichier, chemin: chemin || '/', dom, requetes, ko: Math.round(octets / 102.4) / 10, note, lettre: lettre(note), co2: carbone(octets) });
  } catch (e) {
    resultats.push({ fichier, chemin: chemin || '/', erreur: String(e.message || e).split('\n')[0] });
  } finally { await ctx.close(); }
}
const file = [...pages];
await Promise.all(Array.from({ length: 4 }, async () => { while (file.length) await mesurer(file.shift()); }));
await navigateur.close();
serveur.close();

// --- Écriture dans chaque page ----------------------------------------------------------------------------------------
let affichees = 0;
for (const r of resultats) {
  const html = readFileSync(r.fichier, 'utf8');
  const visible = r.lettre === 'A' || r.lettre === 'B';
  // Étiquette : lettre, « Plus sobre que N % des pages web », note sur 100 dans le title. La note EcoIndex vaut
  // 100 − 5 × (moyenne pondérée des rangs de la page parmi 20 tranches du web) : elle se lit donc directement comme
  // le pourcentage de pages web moins sobres (en moyenne pondérée des trois mesures).
  // Empreinte par visite affichée sur toutes les pages (RGESN 4.15) : avec la lettre si la note vaut A ou B, seule sinon.
  const co2 = r.co2 != null ? `${grammes(r.co2)} g CO₂e par visite` : null;
  const methodeCo2 = 'empreinte estimée avec CO2.js (Green Web Foundation, modèle Sustainable Web Design v4, électricité française, hébergement vert)';
  const remplace = html.replace(ELEMENT, (tout) => {
    if (!visible && !co2) return '';
    const ouvrir = (t, etat) => t.replace(/^<p[^>]*>/, (ouv) => ouv.replace(/\shidden(?:="[^"]*")?(?=[\s>])/, '').replace(/\sdata-ecoindex(?:="[^"]*")?(?=[\s>])/, ` data-ecoindex="${etat}"`));
    if (visible) return ouvrir(tout, r.lettre)
      .replace(/title="Note EcoIndex"/, `title="Note EcoIndex de cette page : ${r.lettre} (${r.note}/100), mesurée à la mise en ligne selon la méthode EcoIndex (Green IT)${co2 ? ` ; ${methodeCo2}` : ''}"`)
      .replace(/(<b\b[^>]*\bdata-lettre\b[^>]*>)\?<\/b>/, `$1${r.lettre}</b>`)
      .replace(/(<span\b[^>]*\bdata-detail\b[^>]*>)\?<\/span>/, `$1Plus sobre que ${r.note} % des pages web${co2 ? ` · ${co2}` : ''}</span>`);
    return ouvrir(tout, 'co2')
      .replace(/href="https:\/\/www\.ecoindex\.fr\/"/, 'href="https://www.thegreenwebfoundation.org/co2-js/"')
      .replace(/title="Note EcoIndex"/, `title="Cette page : ${methodeCo2}"`)
      .replace(/<span\b[^>]*\bclass="ecoindex__nom"[^>]*>EcoIndex<\/span>/, (m) => m.replace('>EcoIndex<', '>Empreinte<'))
      .replace(/<b\b[^>]*\bdata-lettre\b[^>]*>\?<\/b>/, '')
      .replace(/(<span\b[^>]*\bdata-detail\b[^>]*>)\?<\/span>/, `$1${co2}</span>`);
  });
  writeFileSync(r.fichier, remplace);
  if (visible) affichees++;
}

// --- Déclaration d'écoconception : résumé des mesures et respect des seuils (RGESN 6.1) ---------------------------------
// L'élément [data-ecoconception-mesures] (bloc legal, variant ecoconception) porte les seuils en attributs.
const ENCART = /<div\b[^>]*\bdata-ecoconception-mesures\b[^>]*>[\s\S]*?<\/div>/;
const mesurees = resultats.filter((r) => r.note != null && !/^\/?404(\.html)?$/.test(r.chemin));
const ORDRE = 'ABCDEFG';
const fr = (n) => n.toLocaleString('fr-FR', { maximumFractionDigits: 1 });
for (const f of [...pages, ...(function tous(d, l = []) {
  for (const n of readdirSync(d)) { const x = join(d, n); if (statSync(x).isDirectory()) { if (!['_astro', 'admin', 'pagefind', 'img'].includes(n)) tous(x, l); } else if (n.endsWith('.html')) l.push(x); }
  return l;
})(DIST)].filter((f, i, l) => l.indexOf(f) === i)) {
  const html = readFileSync(f, 'utf8');
  const m = ENCART.exec(html);
  if (!m || !mesurees.length) continue;
  const attr = (nom) => (new RegExp(`\\b${nom}="([^"]*)"`).exec(m[0]) || [])[1];
  const poidsMax = Number(attr('data-poids-max')), requetesMax = Number(attr('data-requetes-max')), noteMin = attr('data-note-min') || 'B';
  const hors = mesurees.filter((r) => r.ko > poidsMax || r.requetes > requetesMax || ORDRE.indexOf(r.lettre) > ORDRE.indexOf(noteMin));
  const plusLourde = [...mesurees].sort((a, b) => b.ko - a.ko)[0];
  const plusRequetes = [...mesurees].sort((a, b) => b.requetes - a.requetes)[0];
  const moyenneNotes = Math.round(mesurees.reduce((s, r) => s + r.note, 0) / mesurees.length);
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });
  const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const contenu = [
    `<p><strong>Mesure du ${date}</strong> sur ${mesurees.length} page${mesurees.length > 1 ? 's' : ''} : note EcoIndex moyenne ${moyenneNotes}/100 (${lettre(moyenneNotes)}).</p>`,
    ...(mesurees.every((r) => r.co2 != null) ? [`<p>Empreinte estimée par visite : ${grammes(mesurees.reduce((t, r) => t + r.co2, 0) / mesurees.length)} g CO₂e en moyenne, ${grammes(Math.max(...mesurees.map((r) => r.co2)))} g pour la page la plus lourde (<a href="https://www.thegreenwebfoundation.org/co2-js/">CO2.js</a>, modèle Sustainable Web Design v4, électricité française, hébergement vert).</p>`] : []),
    `<p>Page la plus lourde : ${fr(plusLourde.ko)} Ko (${echapper(plusLourde.chemin)}). Page la plus demandeuse : ${plusRequetes.requetes} requêtes (${echapper(plusRequetes.chemin)}).</p>`,
    hors.length
      ? `<p>${hors.length} page${hors.length > 1 ? 's dépassent' : ' dépasse'} un seuil : ${hors.slice(0, 5).map((r) => `${echapper(r.chemin)} (${r.lettre}, ${fr(r.ko)} Ko, ${r.requetes} requêtes)`).join(', ')}${hors.length > 5 ? '…' : ''}. ${hors.length > 1 ? 'Elles sont' : 'Elle est'} à corriger en priorité.</p>`
      : `<p>Toutes les pages respectent les seuils.</p>`,
  ].join('');
  const ouverture = m[0].slice(0, m[0].indexOf('>') + 1).replace(/\shidden(?:="[^"]*")?(?=[\s>])/, '');
  writeFileSync(f, html.replace(ENCART, `${ouverture}${contenu}</div>`));
  console.log(`EcoIndex : déclaration d'écoconception complétée (${hors.length} page(s) hors seuils)`);
}

// --- Rapport ------------------------------------------------------------------------------------------------------------
const tri = [...resultats].sort((a, b) => (a.note ?? -1) - (b.note ?? -1));
mkdirSync('controle', { recursive: true });
writeFileSync('controle/ecoindex.json', JSON.stringify(tri.map(({ fichier, ...r }) => r), null, 2));
const erreurs = resultats.filter((r) => r.erreur).length;
const notes = resultats.filter((r) => r.note != null).map((r) => r.note);
const moyenne = notes.length ? Math.round(notes.reduce((a, b) => a + b, 0) / notes.length) : 0;
console.log(`EcoIndex : ${resultats.length} page(s), note moyenne ${moyenne}, ${affichees} affichée(s) (A ou B), ${erreurs} non mesurée(s)`);
for (const r of tri.slice(0, 5)) console.log(`  ${r.chemin} : ${r.erreur ?? `${r.lettre} ${r.note} (${r.dom} éléments, ${r.requetes} requêtes, ${r.ko} Ko)`}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const lignes = ['### EcoIndex des pages', '', `${resultats.length} page(s) · moyenne ${moyenne}/100 · note affichée sur ${affichees} (A ou B)`, '',
    '| Page | Note | Éléments | Requêtes | Poids |', '| --- | --- | --- | --- | --- |',
    ...tri.slice(0, 15).map((r) => r.erreur ? `| ${r.chemin} | non mesurée | | | |` : `| ${r.chemin} | ${r.lettre} ${r.note} | ${r.dom} | ${r.requetes} | ${r.ko} Ko |`),
    tri.length > 15 ? `\n(${tri.length - 15} autres pages dans l'artefact « controle », ecoindex.json)` : ''];
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lignes.join('\n') + '\n');
}
