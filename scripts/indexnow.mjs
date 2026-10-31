// IndexNow : prévient Bing (et Yandex, Seznam, Naver… via api.indexnow.org) des pages ajoutées, modifiées
// ou supprimées, dès la mise en ligne, sans attendre leur prochain passage. Google n'utilise pas IndexNow.
//
//   node scripts/indexnow.mjs preparer [ancien]  (build) clé dans dist/<clé>.txt + empreintes des pages du sitemap,
//                                               et date de modification (<lastmod>) de chaque page dans dist/sitemap.xml
//   node scripts/indexnow.mjs envoyer <ancien>   (après rsync) compare avec les empreintes de la version précédente
//                                               et envoie les adresses qui ont changé
// Dates du sitemap : une page dont l'empreinte n'a pas changé depuis la version en ligne (ancien, relevé avant le
// build : indexnow-ancien.json) garde sa date ; une page nouvelle ou modifiée prend la date du build. Les
// reconstructions de la nuit ne changent donc pas les dates, et Google peut s'y fier (il ignore <lastmod> s'il
// le trouve souvent faux).
// Rien n'est fait si NOINDEX=1 (recette, site pas encore ouvert) ou sans SITE_URL.
// Clé : variable INDEXNOW_CLE si elle existe, sinon dérivée de l'adresse du site (la clé est publique par nature :
// elle sert seulement à prouver que l'envoi vient du site, en étant publiée à sa racine).
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const FICHIER = 'indexnow-empreintes.json';
const site = (process.env.SITE_URL || '').replace(/\/+$/, '');
const actif = site && process.env.NOINDEX !== '1';
const cle = (process.env.INDEXNOW_CLE || '').trim() || createHash('sha256').update(`indexnow:${site}`).digest('hex').slice(0, 32);
if (!/^[a-zA-Z0-9-]{8,128}$/.test(cle)) { console.error('INDEXNOW_CLE invalide (8 à 128 caractères a-z, A-Z, 0-9, -)'); process.exit(1); }

function pagesDuSitemap() {
  const xml = readFileSync(join(DIST, 'sitemap.xml'), 'utf8');
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1].replace(/&amp;/g, '&')).filter((u) => u.startsWith(site + '/'));
}

function fichierDe(url) {
  const chemin = decodeURIComponent(new URL(url).pathname);
  if (chemin.includes('..')) return null;
  for (const f of [join(DIST, chemin, 'index.html'), join(DIST, chemin.replace(/\/$/, '') + '.html'), join(DIST, chemin)]) {
    if (existsSync(f) && f.endsWith('.html')) return f;
  }
  return null;
}

// Empreinte du contenu, sans les noms de fichiers générés (_astro/xxx.HASH.css) qui changent à chaque build de style
const empreinte = (html) => createHash('sha256').update(html.replace(/\/_astro\/[^"'\s)]+/g, '/_astro/')).digest('hex').slice(0, 20);

function lireAncien(fichier) {
  try {
    const a = JSON.parse(readFileSync(fichier, 'utf8'));
    if (a && a.site === site && a.pages && typeof a.pages === 'object') return { pages: a.pages, lastmod: a.lastmod && typeof a.lastmod === 'object' ? a.lastmod : {} };
  } catch { /* pas de version en ligne lisible : première mise en ligne indexable, ou build local */ }
  return null;
}

const DATE_W3C = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+00:00$/;

function preparer(ancienFichier) {
  if (!actif) { console.log('IndexNow : site non indexable (NOINDEX=1 ou sans SITE_URL), rien à préparer'); return; }
  writeFileSync(join(DIST, `${cle}.txt`), cle);
  const ancien = lireAncien(ancienFichier);
  const maintenant = new Date().toISOString().replace(/\.\d+Z$/, '+00:00');
  const pages = {};
  const lastmod = {};
  let gardees = 0;
  for (const url of pagesDuSitemap()) {
    const f = fichierDe(url);
    if (!f) continue;
    pages[url] = empreinte(readFileSync(f, 'utf8'));
    const date = ancien?.lastmod[url];
    if (ancien && ancien.pages[url] === pages[url] && typeof date === 'string' && DATE_W3C.test(date)) { lastmod[url] = date; gardees++; }
    else lastmod[url] = maintenant;
  }
  writeFileSync(join(DIST, FICHIER), JSON.stringify({ site, pages, lastmod }));
  // <lastmod> dans le sitemap, juste après <loc>
  const fichierSitemap = join(DIST, 'sitemap.xml');
  const xml = readFileSync(fichierSitemap, 'utf8').replace(/<loc>\s*([^<\s]+)\s*<\/loc>(?!\s*<lastmod>)/g, (m, loc) => {
    const d = lastmod[loc.replace(/&amp;/g, '&')];
    return d ? `${m}<lastmod>${d}</lastmod>` : m;
  });
  writeFileSync(fichierSitemap, xml);
  const n = Object.keys(pages).length;
  console.log(`IndexNow : ${n} page(s) prête(s) ; sitemap : ${gardees} date(s) gardée(s), ${n - gardees} page(s) nouvelle(s) ou modifiée(s)`);
}

async function envoyer(ancienFichier) {
  if (!actif) { console.log('IndexNow : site non indexable, aucun envoi'); return; }
  const nouveau = JSON.parse(readFileSync(join(DIST, FICHIER), 'utf8')).pages;
  // Première mise en ligne indexable (pas de version en ligne lisible) : tout est nouveau
  const ancien = lireAncien(ancienFichier)?.pages ?? null;
  const urls = ancien === null
    ? Object.keys(nouveau)
    : [...Object.keys(nouveau).filter((u) => ancien[u] !== nouveau[u]), ...Object.keys(ancien).filter((u) => !(u in nouveau))];
  if (!urls.length) { console.log('IndexNow : aucune page modifiée'); return; }
  const hote = new URL(site).host;
  // La clé doit être en ligne avant l'envoi (les moteurs la vérifient)
  const verif = await fetch(`${site}/${cle}.txt`).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  if (verif.trim() !== cle) { console.log(`::warning::IndexNow : ${site}/${cle}.txt pas encore accessible, envoi annulé`); return; }
  for (let i = 0; i < urls.length; i += 10000) {
    const lot = urls.slice(i, i + 10000);
    const r = await fetch(process.env.INDEXNOW_API || 'https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: hote, key: cle, keyLocation: `${site}/${cle}.txt`, urlList: lot }),
    }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
    // 200 : reçu ; 202 : reçu, clé en cours de vérification
    if (r.ok) console.log(`IndexNow : ${lot.length} adresse(s) envoyée(s) (HTTP ${r.status})\n  ${lot.join('\n  ')}`);
    else console.log(`::warning::IndexNow : envoi refusé (HTTP ${r.status}) ${(await r.text()).slice(0, 200)}`);
  }
}

const [commande, arg] = process.argv.slice(2);
if (commande === 'preparer') preparer(arg || 'indexnow-ancien.json');
else if (commande === 'envoyer') await envoyer(arg || 'indexnow-ancien.json');
else { console.error('usage : node scripts/indexnow.mjs preparer [ancien.json] | envoyer [ancien.json]'); process.exit(1); }
