#!/usr/bin/env node
/**
 * Contrôle du site construit, avant sa mise en ligne (étape du déploiement, après le build).
 *
 * 1. Playwright (bloquant) : les pages clés (accueil, contact, une page de chaque rubrique) sont ouvertes sur
 *    téléphone (390 px) et sur ordinateur (1280 px), servies depuis dist/ par un petit serveur local. Échec si :
 *    page introuvable, erreur JavaScript, ressource du site en erreur, lien interne vers une page absente,
 *    défilement horizontal sur téléphone, violation d'accessibilité grave ou critique (axe-core, WCAG 2.1 AA).
 * 2. Lighthouse (rapport, jamais bloquant) : accueil et deux pages, profil mobile. Scores et poids dans le résumé
 *    du déploiement ; avertissement si la performance passe sous 90 (les machines de GitHub varient : le score
 *    seul ne bloque pas une mise en ligne).
 * Rapports dans controle/ (artefact du déploiement, jamais publié sur le site).
 *
 *   node scripts/controle.mjs [dist] [--sans-lighthouse]
 * Prérequis (installés par le déploiement, pas dans package.json) : playwright, axe-core, lighthouse.
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const executer = promisify(execFile);

const DIST = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'dist';
const SANS_LH = process.argv.includes('--sans-lighthouse');
const SORTIE = 'controle';
const require = createRequire(join(process.cwd(), 'package.json'));
const { chromium } = require('playwright');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
mkdirSync(SORTIE, { recursive: true });

// --- Serveur local de dist/ (adresses propres : /contact → contact/index.html) -----------------------------
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.xml': 'application/xml',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.pdf': 'application/pdf', '.wasm': 'application/wasm', '.txt': 'text/plain', '.webmanifest': 'application/manifest+json' };
function fichierDe(chemin) {
  const p = normalize(decodeURIComponent(chemin.split(/[?#]/)[0])).replace(/^(\.\.[/\\])+/, '');
  for (const c of [p, join(p, 'index.html'), p.replace(/\/$/, '') + '.html']) {
    const f = join(DIST, c);
    if (f.startsWith(normalize(DIST)) && existsSync(f) && statSync(f).isFile()) return f;
  }
  return null;
}
const serveur = createServer((req, res) => {
  const f = fichierDe(req.url || '/');
  if (!f) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(existsSync(join(DIST, '404.html')) ? readFileSync(join(DIST, '404.html')) : 'introuvable'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[extname(f).toLowerCase()] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
const BASE = `http://127.0.0.1:${serveur.address().port}`;

// --- Pages contrôlées : accueil, contact, la première page de chaque rubrique (12 au plus) --------------------
const EXCLUS = new Set(['admin', 'xmedia-ai', 'partage', 'pagefind', '_astro', 'img', 'formulaire', 'flux', 'demo-participation']);
const pages = ['/'];
if (fichierDe('/contact')) pages.push('/contact');
// Les pages du menu d'abord (en-tête de l'accueil), puis une page de chaque rubrique
const accueil = existsSync(join(DIST, 'index.html')) ? readFileSync(join(DIST, 'index.html'), 'utf8') : '';
const entete = (accueil.match(/<header[\s\S]*?<\/header>/i) || [''])[0];
for (const m of entete.matchAll(/href="(\/[^"#?]*)"/g)) {
  const h = m[1].replace(/\/$/, '') || '/';
  if (pages.length < 8 && !pages.includes(h) && !EXCLUS.has(h.split('/')[1]) && fichierDe(h)) pages.push(h);
}
for (const d of readdirSync(DIST).sort()) {
  if (EXCLUS.has(d) || !statSync(join(DIST, d)).isDirectory() || pages.length >= 12) continue;
  if (existsSync(join(DIST, d, 'index.html')) && !pages.includes('/' + d)) pages.push('/' + d);
  const sous = readdirSync(join(DIST, d)).filter((s) => s !== 'page' && s !== 'categorie' && existsSync(join(DIST, d, s, 'index.html'))).sort()[0];
  if (sous && pages.length < 12) pages.push(`/${d}/${sous}`);
}

// --- 1. Playwright ----------------------------------------------------------------------------------------------
const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const problemes = [];
const lignes = [];
// Adresses servies par le serveur, absentes de dist/ : API de l'espace client, formulaire, statistiques, et outils de
// l'agence relayés vers un autre serveur (xm-site relais : /rgaa/ tests et comparaison, /audit-seo/ audits)
const SERVEUR = /^\/(xmedia-ai|formulaire|statistiques|rgaa|audit-seo)(\/|$)/;
const ignorer = (u) => !u.startsWith(BASE) || SERVEUR.test(u.slice(BASE.length));
for (const largeur of [390, 1280]) {
  // Animations réduites (réglage système du visiteur, respecté par les sites) : le contrôle voit la page dans son état
  // final. Sans cela, axe pouvait mesurer un texte en cours d'apparition (opacité partielle) et arrêter une mise en
  // ligne au hasard (« color-contrast » sur le haut de page, une fois sur deux).
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: largeur < 600 ? 844 : 900 }, bypassCSP: false, reducedMotion: 'reduce' });
  for (const url of pages) {
    const p = await ctx.newPage();
    const erreurs = [];
    p.on('pageerror', (e) => erreurs.push(`erreur JavaScript : ${e.message.split('\n')[0]}`));
    p.on('console', (m) => { if (m.type() === 'error' && !/\/xmedia-ai\/|Failed to load resource/.test(m.text())) erreurs.push(`console : ${m.text().slice(0, 160)}`); });
    p.on('response', (r) => { if (r.status() >= 400 && !ignorer(r.url()) && r.url() !== BASE + url) erreurs.push(`ressource en erreur ${r.status()} : ${r.url().replace(BASE, '')}`); });
    p.on('requestfailed', (r) => { if (!ignorer(r.url())) erreurs.push(`ressource non chargée : ${r.url().replace(BASE, '')}`); });
    const rep = await p.goto(BASE + url, { waitUntil: 'load' }).catch((e) => (erreurs.push(`ouverture impossible : ${e.message}`), null));
    if (rep && rep.status() !== 200) erreurs.push(`page en erreur ${rep.status()}`);
    await p.waitForTimeout(400);
    // Liens internes vers des pages absentes de dist/
    const liens = await p.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href')))]);
    for (const h of liens) {
      if (!h || !h.startsWith('/') || h.startsWith('//') || h.startsWith('/admin') || SERVEUR.test(h)) continue;
      if (!fichierDe(h)) erreurs.push(`lien vers une page absente : ${h}`);
    }
    if (largeur < 600) {
      const deborde = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      if (deborde > 2) erreurs.push(`défilement horizontal sur téléphone (${deborde} px de trop)`);
    }
    // Animations d'un site qui ne respecte pas le réglage : attendre qu'elles soient finies (2 s au plus, boucles exclues)
    await p.evaluate(() => Promise.race([
      Promise.all(document.getAnimations().filter((a) => a.effect?.getComputedTiming().iterations !== Infinity).map((a) => a.finished.catch(() => {}))),
      new Promise((ok) => setTimeout(ok, 2000)),
    ])).catch(() => {});
    // axe injecté par le pilote du navigateur (non soumis à la CSP de la page, qui refuserait un script ajouté)
    await p.evaluate(AXE).catch(() => {});
    if (!(await p.evaluate(() => !!window.axe).catch(() => false))) erreurs.push('contrôle d\'accessibilité impossible (axe non chargé)');
    const v = await p.evaluate(async () => (window.axe ? (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations : [])
      .filter((x) => x.impact === 'serious' || x.impact === 'critical').map((x) => ({ id: x.id, impact: x.impact, n: x.nodes.length, cible: x.nodes[0]?.target?.join(' ') }))).catch(() => []);
    for (const x of v) erreurs.push(`accessibilité (${x.impact}) ${x.id} × ${x.n} : ${x.cible}`);
    const uniques = [...new Set(erreurs)];
    lignes.push(`${uniques.length ? '✖' : '✔'} ${largeur} px ${url}${uniques.length ? '\n    ' + uniques.join('\n    ') : ''}`);
    for (const e of uniques) problemes.push({ url, largeur, probleme: e });
    if (uniques.length) await p.screenshot({ path: join(SORTIE, `${largeur}-${url.replace(/\W+/g, '_') || 'accueil'}.png`), fullPage: true }).catch(() => {});
    await p.close();
  }
  await ctx.close();
}
await navigateur.close();
console.log(`Contrôle des pages (${pages.length} pages, téléphone et ordinateur) :\n${lignes.join('\n')}`);

// --- 2. Lighthouse (rapport) --------------------------------------------------------------------------------------
const scores = [];
if (!SANS_LH) {
  let lh = null;
  try { lh = require.resolve('lighthouse/cli/index.js'); } catch { console.log('Lighthouse absent : rapport non produit.'); }
  if (lh) {
    const chrome = process.env.CHROMIUM || chromium.executablePath();
    for (const url of pages.slice(0, 3)) {
      const nom = url.replace(/\W+/g, '_') || 'accueil';
      try {
        // Asynchrone : le serveur local de ce même processus doit pouvoir répondre pendant la mesure
        await executer(process.execPath, [lh, BASE + url, '--quiet', '--output=json', '--output=html', `--output-path=${join(SORTIE, 'lighthouse-' + nom)}`, '--chrome-flags=--headless=new --no-sandbox',
          '--only-categories=performance,accessibility,best-practices,seo', '--form-factor=mobile'], { env: { ...process.env, CHROME_PATH: chrome }, timeout: 180000, maxBuffer: 64 * 1024 * 1024 });
        const r = JSON.parse(readFileSync(join(SORTIE, `lighthouse-${nom}.report.json`), 'utf8'));
        const c = (k) => Math.round((r.categories[k]?.score ?? 0) * 100);
        const poids = Math.round((r.audits['total-byte-weight']?.numericValue ?? 0) / 1024);
        scores.push({ url, performance: c('performance'), accessibilite: c('accessibility'), pratiques: c('best-practices'), seo: c('seo'), poids_ko: poids, lcp_s: +((r.audits['largest-contentful-paint']?.numericValue ?? 0) / 1000).toFixed(1) });
      } catch (e) { console.log(`Lighthouse ${url} : ${String(e.message).split('\n')[0]}`); }
    }
    if (scores.length) {
      console.log('Lighthouse (mobile) :\n' + scores.map((s) => `  ${s.url} : performance ${s.performance}, accessibilité ${s.accessibilite}, bonnes pratiques ${s.pratiques}, SEO ${s.seo}, ${s.poids_ko} Ko, LCP ${s.lcp_s} s`).join('\n'));
      for (const s of scores) if (s.performance < 90) console.log(`::warning title=Performance ${s.url}::score Lighthouse ${s.performance} (mobile, machine GitHub) : à surveiller, la mise en ligne n'est pas bloquée`);
    }
  }
}
serveur.close();

// --- Résumé ----------------------------------------------------------------------------------------------------
writeFileSync(join(SORTIE, 'controle.json'), JSON.stringify({ date: new Date().toISOString(), pages, problemes, lighthouse: scores }, null, 1) + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Contrôle du site\n\n${problemes.length ? `**${problemes.length} problème(s) : mise en ligne arrêtée.**\n\n| Page | Largeur | Problème |\n| --- | --- | --- |\n${problemes.map((x) => `| ${x.url} | ${x.largeur} px | ${x.probleme.replace(/\|/g, '/')} |`).join('\n')}` : `${pages.length} pages contrôlées sur téléphone et ordinateur : aucun problème.`}\n\n`
    + (scores.length ? `| Lighthouse (mobile) | Performance | Accessibilité | Bonnes pratiques | SEO | Poids | LCP |\n| --- | --- | --- | --- | --- | --- | --- |\n${scores.map((s) => `| ${s.url} | ${s.performance} | ${s.accessibilite} | ${s.pratiques} | ${s.seo} | ${s.poids_ko} Ko | ${s.lcp_s} s |`).join('\n')}\n\nRapports complets : artefact « controle » du déploiement.\n` : ''));
}
if (problemes.length) { console.error(`✖ ${problemes.length} problème(s) : mise en ligne arrêtée (détail ci-dessus, captures dans l'artefact « controle »).`); process.exit(1); }
console.log('✔ Contrôle réussi');
