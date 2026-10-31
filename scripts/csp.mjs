#!/usr/bin/env node
/**
 * Politique de sécurité du contenu (CSP) de chaque page, après le build : balise <meta http-equiv=
 * "Content-Security-Policy"> en tête de page. Seuls s'exécutent les scripts du site lui-même (fichiers servis par le
 * site, et scripts intégrés à la page autorisés par leur empreinte sha256, calculée ici sur la version finale de la
 * page). Les contenus ne peuvent pas apporter de script : le Markdown est rendu sans HTML brut (src/lib/markdown.ts) et les
 * données structurées sont échappées (src/lib/jsonld.ts). En plus, un script intégré trouvé dans une zone de contenu
 * (.prose, rendu du Markdown) fait échouer le build au lieu de recevoir une empreinte : il ne peut venir que d'une injection.
 *
 * Autorisé en plus : WebAssembly de la recherche (Pagefind), styles intégrés (Astro, attributs style), images https
 * (tuiles de la carte des mairies), carte Google Maps intégrée au clic (bloc carte). /admin/ (Decap) n'est pas concerné.
 * À lancer après tout ce qui modifie les scripts des pages (alleger-css).
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parse } from 'parse5';

const DIST = process.argv[2] || 'dist';
const NON_EXECUTES = /^(application\/(ld\+)?json|text\/(template|plain)|speculationrules|importmap)$/i;

function politique(empreintes) {
  return [
    "default-src 'self'",
    // 'unsafe-inline' : secours pour les navigateurs d'avant les empreintes (CSP 1), ignoré par tous les autres dès
    // qu'une empreinte est présente ; jamais sur une page sans empreinte, où il serait réellement appliqué.
    `script-src 'self' 'wasm-unsafe-eval'${empreintes.map((h) => ` 'sha256-${h}'`).join('')}${empreintes.length ? " 'unsafe-inline'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-src https://www.google.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "media-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Scripts (ou éléments qui en exécutent) à l'intérieur d'un rendu Markdown (.prose) : aucun composant n'en place. */
function scriptsDansContenu(html) {
  const trouves = [];
  const visiter = (n, dansContenu) => {
    const classe = (n.attrs || []).find((a) => a.name === 'class')?.value || '';
    const ici = dansContenu || /(^|\s)prose(\s|$)/.test(classe);
    if (ici && n.tagName && (n.tagName === 'script' || n.tagName === 'iframe' || n.tagName === 'object' || n.tagName === 'embed'
      || (n.attrs || []).some((a) => /^on/i.test(a.name) || (/^(href|src|action|formaction)$/i.test(a.name) && /^\s*(javascript|data|vbscript):/i.test(a.value))))) {
      trouves.push(`<${n.tagName}> dans un contenu`);
    }
    for (const c of n.childNodes || []) visiter(c, ici);
    if (n.content) visiter(n.content, ici);
  };
  visiter(parse(html), false);
  return trouves;
}

function traiter(fichier, stats) {
  const html = readFileSync(fichier, 'utf8');
  if (/http-equiv=["']?Content-Security-Policy/i.test(html)) return;
  if (/<div[^>]*\bclass="[^"]*\bprose\b/.test(html)) stats.injectes.push(...scriptsDansContenu(html).map((t) => `${fichier} : ${t}`));
  const empreintes = new Set();
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (type && NON_EXECUTES.test(type)) continue;
    empreintes.add(createHash('sha256').update(m[2], 'utf8').digest('base64'));
  }
  const meta = `<meta http-equiv="Content-Security-Policy" content="${politique([...empreintes].sort())}">`;
  // Le plus tôt possible : juste après <meta charset>, sinon en tête de <head>
  let sortie = html.replace(/(<meta charset=[^>]*>)/i, `$1${meta}`);
  if (sortie === html) sortie = html.replace(/<head>/i, `<head>${meta}`);
  if (sortie === html) { stats.sansTete.push(fichier); return; }
  writeFileSync(fichier, sortie);
  stats.pages++; stats.scripts += empreintes.size;
}

function parcourir(d, stats) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (!['_astro', 'admin', 'xmedia-ai', 'pagefind', 'img'].includes(n)) parcourir(p, stats); }   // img/ : originaux, jamais des pages
    else if (n.endsWith('.html')) traiter(p, stats);
  }
}

const stats = { pages: 0, scripts: 0, sansTete: [], injectes: [] };
parcourir(DIST, stats);
if (stats.injectes.length) {
  console.error(`CSP : script ou attribut actif dans un contenu (injection probable), build arrêté :\n  ${stats.injectes.slice(0, 20).join('\n  ')}`);
  process.exit(1);
}
console.log(`CSP : ${stats.pages} page(s), ${stats.scripts} script(s) intégrés autorisés par empreinte`
  + (stats.sansTete.length ? ` ; sans <head>, laissées telles quelles : ${stats.sansTete.join(', ')}` : ''));
