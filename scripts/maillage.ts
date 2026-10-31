/**
 * Contrôle du maillage interne après le build (spec §24) : relit dist/ et vérifie
 * les liens de chaque page du sitemap.
 *
 *   erreurs (build refusé)  : lien interne vers une page qui n'existe pas
 *   avertissements          : page orpheline, moins de 2 liens entrants depuis un contenu,
 *                             à plus de 3 clics de l'accueil, plus de 15 liens dans un texte,
 *                             page SEO (role: seo, zones par défaut) sans lien vers une page aimant
 *   erreurs, si data/site.json › engagement.aimant_obligatoire : toute page indexable sans lien vers une page aimant
 *
 * Écrit ai/maillage.json (lu par l'IA à chaque demande) et affiche un résumé.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const HORS_SITE = /^\/(xmedia-ai|admin|formulaire|statistiques|img|_astro)(\/|$)/;

function pages(dir: string, acc: string[] = []): string[] {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) { if (!/^(_astro|img|xmedia-ai|admin|formulaire)$/.test(f) || dir !== DIST) pages(p, acc); }
    else if (f === 'index.html') acc.push(p);
  }
  return acc;
}
const urlDe = (fichier: string) => { const r = '/' + relative(DIST, fichier).replace(/(^|\/)index\.html$/, ''); return r.length > 1 ? r.replace(/\/$/, '') : '/'; };
const normaliser = (h: string) => { const u = h.split(/[?#]/)[0]; return u.length > 1 ? u.replace(/\/+$/, '') : '/'; };
const existe = (u: string) => u === '/' ? existsSync(join(DIST, 'index.html')) : existsSync(join(DIST, u, 'index.html')) || existsSync(join(DIST, u));
const liens = (html: string) => [...html.matchAll(/<a\s[^>]*href="([^"]+)"/gi)].map((m) => m[1]).filter((h) => h.startsWith('/') && !h.startsWith('//')).map(normaliser);
/** Liens détaillés : cible, texte du lien, ajouté automatiquement (ancre) ou écrit à la main. */
const liensDetail = (html: string) => [...html.matchAll(/<a\s([^>]*)href="([^"]+)"([^>]*)>([\s\S]*?)<\/a>/gi)]
  .filter((m) => m[2].startsWith('/') && !m[2].startsWith('//'))
  .map((m) => ({ url: normaliser(m[2]), texte: m[4].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80), auto: /lien-contexte/.test(m[1] + m[3]) }));
const decoder = (t: string) => t.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

if (!existsSync(DIST)) { console.error('dist/ absent : lancer astro build avant.'); process.exit(1); }

// Pages à auditer : celles du sitemap (publiées et indexables), sinon toutes
const sitemap = existsSync(join(DIST, 'sitemap.xml')) ? readFileSync(join(DIST, 'sitemap.xml'), 'utf8') : '';
const dansSitemap = new Set([...sitemap.matchAll(/<loc>https?:\/\/[^/<]+(\/[^<]*)?<\/loc>/g)].map((m) => normaliser(m[1] || '/')));

// Titres courts et rôles des pages (index du site généré par npm run contexte), sinon le H1
const titres = new Map<string, string>();
const roles = new Map<string, 'aimant' | 'seo'>();
try {
  const ctx = JSON.parse(readFileSync(join(DIST, 'xmedia-ai', 'contexte', 'site.json'), 'utf8'));
  for (const p of ctx.pages ?? []) { titres.set(p.url, p.titre); if (p.role) roles.set(p.url, p.role); }
  for (const l of Object.values(ctx.collections ?? {}) as any[]) for (const e of l) if (e.url) { titres.set(e.url, e.titre); if (e.role) roles.set(e.url, e.role); }
} catch { /* pas d'index : H1 */ }
titres.set('/', 'Accueil');

type Info = { url: string; titre: string; tout: string[]; contenu: string[]; texte: string[]; detail: { url: string; texte: string; auto: boolean }[] };
const infos = new Map<string, Info>();
for (const f of pages(DIST)) {
  const url = urlDe(f);
  if (url === '/404') continue;
  const html = readFileSync(f, 'utf8');
  const main = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? '';
  // Contenu = <main> sans le fil d'Ariane (lien de structure, pas de contenu)
  const contenu = main.replace(/<nav[^>]*(aria-label="Fil d'Ariane"|class="[^"]*ariane[^"]*")[\s\S]*?<\/nav>/gi, '');
  const texte = [...contenu.matchAll(/<div class="prose[^"]*"[^>]*>([\s\S]*?)<\/div>/gi)].map((m) => m[1]).join(' ');
  const titre = titres.get(url) ?? decoder((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] ?? url).replace(/<[^>]+>/g, '').trim());
  infos.set(url, { url, titre, tout: liens(html), contenu: liens(contenu), texte: liens(texte), detail: liensDetail(contenu).map((l) => ({ ...l, texte: decoder(l.texte) })) });
}

const erreurs: string[] = [], avertissements: string[] = [];

// 0. Données structurées (JSON-LD) : lisibles, et l'entreprise déclarée sur l'accueil
for (const f of pages(DIST)) {
  const url = urlDe(f);
  const blocs = [...readFileSync(f, 'utf8').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  const lus: any[] = [];
  for (const b of blocs) { try { lus.push(JSON.parse(b)); } catch { erreurs.push(`${url} → données structurées illisibles (JSON invalide)`); } }
  // Pages indexables (celles du sitemap) : l'entreprise doit figurer dans leur graphe
  const entite = (d: any) => d['@id']?.endsWith('/#entreprise') || (d['@graph'] ?? []).some((x: any) => x['@id']?.endsWith('/#entreprise'));
  if ((dansSitemap.size ? dansSitemap.has(url) : url !== '/404') && !lus.some(entite)) erreurs.push(`${url} → entreprise absente des données structurées`);
}

// 1. Liens cassés (pages du site uniquement ; fichiers et espaces techniques ignorés)
for (const i of infos.values()) {
  for (const l of new Set(i.tout)) {
    if (HORS_SITE.test(l) || /\.[a-z0-9]{2,5}$/i.test(l)) continue;
    if (!existe(l)) erreurs.push(`${i.url} → ${l} : page introuvable (brouillon ou adresse erronée)`);
  }
}

// 2. Profondeur depuis l'accueil (tous les liens, menu compris)
const profondeur = new Map<string, number>([['/', 0]]);
const file = ['/'];
while (file.length) {
  const u = file.shift()!;
  for (const l of infos.get(u)?.tout ?? []) if (infos.has(l) && !profondeur.has(l)) { profondeur.set(l, profondeur.get(u)! + 1); file.push(l); }
}

// 3. Liens entrants depuis un contenu (sources distinctes, hors page elle-même)
const entrants = new Map<string, Set<string>>();
for (const i of infos.values()) for (const l of new Set(i.contenu)) if (l !== i.url) (entrants.get(l) ?? entrants.set(l, new Set()).get(l)!).add(i.url);

const audit = [...infos.values()].filter((i) => i.url !== '/' && (!dansSitemap.size || dansSitemap.has(i.url))).map((i) => ({
  url: i.url,
  role: roles.get(i.url) ?? null,
  entrants: entrants.get(i.url)?.size ?? 0,
  profondeur: profondeur.get(i.url) ?? null,
  liens_texte: new Set(i.texte).size,
}));
for (const p of audit) {
  if (p.entrants === 0) avertissements.push(`${p.url} : page orpheline (aucun lien depuis le contenu d'une autre page)`);
  else if (p.entrants < 2) avertissements.push(`${p.url} : 1 seul lien entrant depuis un contenu (2 minimum conseillés)`);
  if (p.profondeur === null) avertissements.push(`${p.url} : inaccessible depuis l'accueil`);
  else if (p.profondeur > 3) avertissements.push(`${p.url} : à ${p.profondeur} clics de l'accueil (3 maximum conseillés)`);
  if (p.liens_texte > 15) avertissements.push(`${p.url} : ${p.liens_texte} liens dans les textes (15 maximum conseillés)`);
}

// 4. Engagement (règles « Garder le visiteur ») : chaque page d'entrée SEO renvoie vers une page aimant
const aimants = audit.filter((p) => roles.get(p.url) === 'aimant').map((p) => p.url);
// Option du site (data/site.json › engagement.aimant_obligatoire) : toute page indexable, accueil compris, doit proposer
// une page aimant, sinon le build échoue (objectif : au moins deux pages vues par visite)
const engagement = (() => { try { return JSON.parse(readFileSync('data/site.json', 'utf8')).engagement ?? {}; } catch { return {}; } })();
if (engagement.aimant_obligatoire) {
  const exemptees = new Set<string>((engagement.exemptees ?? ['/contact']).map(normaliser));
  if (!aimants.length) erreurs.push('/ : engagement.aimant_obligatoire, mais aucune page « aimant » (role: aimant) n\'est publiée');
  else for (const i of infos.values()) {
    if (dansSitemap.size && !dansSitemap.has(i.url)) continue;
    if (aimants.includes(i.url) || exemptees.has(i.url)) continue;
    if (!i.contenu.some((l) => aimants.includes(l))) erreurs.push(`${i.url} : aucun lien vers une page aimant (${aimants.slice(0, 3).join(', ')}), obligatoire sur ce site (data/site.json › engagement)`);
  }
}
const entreesSeo = audit.filter((p) => roles.get(p.url) === 'seo');
if (entreesSeo.length && !aimants.length) avertissements.push(`/ : aucune page « aimant » publiée (prix, guide, avant/après, aides) vers laquelle envoyer les visiteurs arrivés de Google`);
else for (const p of entreesSeo) {
  if (!infos.get(p.url)!.contenu.some((l) => aimants.includes(l))) avertissements.push(`${p.url} : page d'arrivée depuis Google sans lien vers une page qui donne envie de rester (page « aimant » : ${aimants.slice(0, 3).join(', ')})`);
}

writeFileSync('ai/maillage.json', JSON.stringify({ genere: new Date().toISOString(), erreurs, avertissements, pages: audit.sort((a, b) => a.entrants - b.entrants) }, null, 2) + '\n');

// Récapitulatif détaillé pour l'espace xmedia·ai (onglet « Liens internes »), servi par PHP uniquement
const detail = audit.map((p) => {
  const i = infos.get(p.url)!;
  const recus = [...infos.values()].filter((s) => s.url !== p.url).flatMap((s) =>
    s.detail.filter((l) => l.url === p.url).map((l) => ({ depuis: s.url, titre: s.titre, texte: l.texte, auto: l.auto })));
  const vus = new Set<string>();
  const faits = i.detail.filter((l) => l.url !== p.url && !vus.has(l.url + l.texte) && vus.add(l.url + l.texte))
    .map((l) => ({ vers: l.url, titre: infos.get(l.url)?.titre ?? l.url, texte: l.texte, auto: l.auto }));
  return { ...p, titre: i.titre, recus, faits, alertes: avertissements.filter((a) => a.startsWith(p.url + ' :')).map((a) => a.slice(p.url.length + 3)) };
});
const contexte = join(DIST, 'xmedia-ai', 'contexte');
if (existsSync(join(DIST, 'xmedia-ai'))) {
  mkdirSync(contexte, { recursive: true });
  writeFileSync(join(contexte, 'maillage.json'), JSON.stringify({ genere: new Date().toISOString(), erreurs, pages: detail }) + '\n');
}

console.log(`Maillage : ${audit.length} pages auditées, ${erreurs.length} erreur(s), ${avertissements.length} avertissement(s) → ai/maillage.json`);
for (const a of avertissements) console.log('  ⚠ ' + a);
for (const e of erreurs) console.error('  ✖ ' + e);
if (erreurs.length) process.exit(1);
