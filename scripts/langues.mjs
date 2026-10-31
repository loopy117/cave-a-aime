#!/usr/bin/env node
/**
 * Site multilingue, après le build : chaque page française de dist/ est découpée en textes (titres, paragraphes,
 * boutons, menus, textes des images, description pour les moteurs…), et une page /<langue>/… est écrite en
 * remplaçant chaque texte par sa traduction. Aucun bloc ne connaît les langues : tout ce que le site affiche est
 * traduit, y compris les blocs à venir.
 *
 * Réglage : data/site.json › langues = { autres: ['en', 'de'], exclure: ['/actes'] } (absent : site en français seul).
 *
 * Traductions : content/traductions/<langue>/
 *   commun.yaml           textes présents sur beaucoup de pages (menu, pied de page…) et adresses (segments d'URL)
 *   pages/<page>.yaml     textes propres à une page (accueil.yaml, annuaire--couturetmoi.yaml…)
 * Chaque texte est noté { fr, <langue> } ; les balises sont remplacées par <g1>…</g1> (et <x1/> sans contenu), pour
 * que la traduction survive aux changements de mise en forme. Une page n'existe dans une langue que si son fichier existe.
 *
 *   node scripts/langues.mjs                  pages traduites à partir des traductions enregistrées (build)
 *   TRADUIRE=1 node scripts/langues.mjs       traduit d'abord ce qui manque (clé ANTHROPIC_API_KEY), puis écrit
 *                                             les fichiers de content/traductions (déploiement de production)
 *   node scripts/langues.mjs --simulation     traduction factice « [EN] … », pour les essais (rangée dans
 *                                             .cache/traductions-simulation, jamais dans content/traductions)
 *
 * Un texte déjà traduit n'est jamais retraduit tant que le français ne change pas : une correction faite à la main
 * dans l'éditeur est gardée. Les textes qui ne sont plus sur la page sont retirés du fichier.
 * À lancer juste après astro build, avant alleger-css et csp (qui relisent les pages de toutes les langues).
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { parse } from 'parse5';
import YAML from 'yaml';

const DIST = 'dist';
const simulation = process.argv.includes('--simulation');
// Simulation : traductions factices rangées à part, jamais dans le dépôt (sinon l'IA ne les remplacerait jamais)
const STOCK = simulation ? '.cache/traductions-simulation' : 'content/traductions';
const site = JSON.parse(readFileSync('data/site.json', 'utf8'));
const reglage = site.langues ?? {};
const LANGUES = (reglage.autres ?? []).filter((l) => /^[a-z]{2}$/.test(l) && l !== 'fr');
if (!LANGUES.length) { console.log('Langues : site en français seulement.'); process.exit(0); }
if (!existsSync(DIST)) { console.error('dist/ absent : lancer astro build avant.'); process.exit(1); }

const CLE_API = process.env.ANTHROPIC_API_KEY ?? '';
if (process.env.TRADUIRE === '1' && !CLE_API) console.log('▲ Langues : pas de clé ANTHROPIC_API_KEY, rien de nouveau ne sera traduit.');
const traduire = simulation || (process.env.TRADUIRE === '1' && !!CLE_API);
const MODELE = process.env.LANGUES_MODELE || 'claude-sonnet-5-5';
const PLAFOND = Number(process.env.LANGUES_PLAFOND || 3_000_000);   // caractères envoyés au plus par lancement

const NOMS = { fr: 'Français', en: 'English', de: 'Deutsch', it: 'Italiano', es: 'Español', nl: 'Nederlands', pt: 'Português' };
const NOMS_FR = { en: 'anglais', de: 'allemand', it: 'italien', es: 'espagnol', nl: 'néerlandais', pt: 'portugais' };
const LIBELLE_LANGUE = { fr: 'Langue', en: 'Language', de: 'Sprache', it: 'Lingua', es: 'Idioma', nl: 'Taal', pt: 'Idioma' };
const LOCALES = { fr: 'fr_FR', en: 'en_GB', de: 'de_DE', it: 'it_IT', es: 'es_ES', nl: 'nl_NL', pt: 'pt_PT' };
const SYSTEME = /^\/(_astro|xmedia-ai|admin|formulaire|img|media|partage|pagefind|statistiques)(\/|$)/;
const EXCLURE = (reglage.exclure ?? []).map((p) => p.replace(/\/+$/, '') || '/');
const exclue = (url) => SYSTEME.test(url) || /^\/[a-z]{2}(\/|$)/.test(url) && LANGUES.includes(url.slice(1, 3)) || url === '/404'
  || EXCLURE.some((p) => p === '/' ? url === '/' : url === p || url.startsWith(p + '/'));
const BASE = (process.env.SITE_URL || site.url || '').replace(/\/+$/, '');
const ORIGINE = /^https?:\/\/[^/]+/.exec(BASE)?.[0] ?? '';

// --- Découpage d'une page en textes ------------------------------------------------------------------------------------

const PHRASE = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'del', 'dfn', 'em', 'i', 'img', 'ins', 'kbd', 'mark', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr', 'svg', 'picture']);
const OPAQUES = new Set(['code', 'kbd', 'samp', 'var', 'svg', 'picture', 'img', 'br', 'wbr']);   // gardés tels quels dans un texte
const IGNORES = new Set(['script', 'style', 'template', 'textarea', 'pre', 'svg', 'math', 'iframe', 'object', 'video', 'audio', 'canvas', 'noscript']);
const ATTRIBUTS = ['alt', 'title', 'aria-label', 'aria-description', 'placeholder'];
const META = /^(description|og:title|og:description|og:image:alt|twitter:title|twitter:description)$/;

const echapper = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const desechapper = (t) => t.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const attr = (n, nom) => n.attrs?.find((a) => a.name === nom)?.value;
const ignore = (n) => IGNORES.has(n.nodeName) || attr(n, 'translate') === 'no' || attr(n, 'data-langues') !== undefined || (attr(n, 'class') ?? '').split(/\s+/).includes('notranslate');
/** Mérite traduction : au moins deux lettres, et pas seulement une adresse e-mail ou web. */
function aTraduire(cle) {
  const t = desechapper(cle.replace(/<\/?[gx]\d+\/?>/g, ' ')).trim();
  return /\p{L}.*\p{L}/su.test(t) && !/^[\w.+-]+@[\w-]+(\.[\w-]+)+$/.test(t) && !/^(https?:\/\/|www\.)\S+$/i.test(t);
}
const enPhrase = (n) => n.nodeName === '#text' || (PHRASE.has(n.nodeName) && !ignore(n) || OPAQUES.has(n.nodeName)) && (OPAQUES.has(n.nodeName) || (n.childNodes ?? []).every(enPhrase));

/**
 * Textes d'une page : { textes: [{ debut, fin, cle, balises, avant, apres, commun }], attributs: [...], jsonld: [...] }.
 * debut/fin : position dans le code de la page ; cle : texte avec balises remplacées ; balises : code d'origine.
 */
function decouper(html) {
  const doc = parse(html, { sourceCodeLocationInfo: true });
  const textes = [], attributs = [], jsonld = [];
  let marqueur = null;
  const src = (a, b) => html.slice(a, b);

  function cleDe(noeuds, balises) {
    let s = '';
    for (const n of noeuds) {
      if (n.nodeName === '#text') { s += echapper(n.value); continue; }
      if (n.nodeName === '#comment') continue;
      const l = n.sourceCodeLocation; if (!l) continue;
      const i = balises.length + 1;
      if (OPAQUES.has(n.nodeName) || ignore(n) || !l.endTag) {
        balises.push({ ouvre: src(l.startOffset, l.endOffset), debut: l.startOffset, fin: l.endOffset, opaque: true });
        s += `<x${i}/>`;
      } else {
        const b = { ouvre: src(l.startTag.startOffset, l.startTag.endOffset), ferme: src(l.endTag.startOffset, l.endTag.endOffset), debut: l.startTag.startOffset, fin: l.startTag.endOffset };
        balises.push(b);
        s += `<g${i}>` + cleDe(n.childNodes, balises) + `</g${i}>`;
      }
    }
    return s;
  }
  function serie(noeuds, commun) {
    const premier = noeuds[0].sourceCodeLocation, dernier = noeuds[noeuds.length - 1].sourceCodeLocation;
    if (!premier || !dernier) return;
    const balises = [];
    const brut = cleDe(noeuds, balises);
    const cle = brut.replace(/\s+/g, ' ').trim();
    if (!aTraduire(cle)) return;
    const debut = premier.startOffset, fin = dernier.endOffset;
    const code = src(debut, fin);
    textes.push({ debut, fin, cle, balises, avant: /^\s*/.exec(code)[0], apres: /\s*$/.exec(code)[0], commun });
  }
  function attributsDe(n, commun) {
    if (!n.attrs) return;
    if (attr(n, 'data-langues') !== undefined && attr(n, 'data-langues') !== 'non') marqueur = n;
    for (const a of n.attrs) {
      const l = n.sourceCodeLocation?.attrs?.[a.name];
      if (!l) continue;
      const estMeta = n.nodeName === 'meta' && a.name === 'content' && META.test(attr(n, 'name') ?? attr(n, 'property') ?? '');
      const estBouton = n.nodeName === 'input' && a.name === 'value' && /^(submit|button|reset)$/.test(attr(n, 'type') ?? '');
      if ((ATTRIBUTS.includes(a.name) || estMeta || estBouton) && aTraduire(echapper(a.value.trim()))) attributs.push({ debut: l.startOffset, fin: l.endOffset, nom: a.name, cle: echapper(a.value.replace(/\s+/g, ' ').trim()), commun });
    }
  }
  /** Éléments pris dans un texte : seuls leurs attributs (alt d'une image, title d'un lien…) sont relevés. */
  function attributsSous(n, commun) {
    attributsDe(n, commun);
    if (n.nodeName === 'script' || n.nodeName === 'style') return;
    for (const c of (n.content ?? n).childNodes ?? []) if (c.attrs) attributsSous(c, commun);
  }
  function visiter(n, commun) {
    if (n.nodeName === '#comment' || n.nodeName === '#documentType') return;
    attributsDe(n, commun);
    if (n.nodeName === 'script' && attr(n, 'type') === 'application/ld+json') {
      const l = n.sourceCodeLocation, t = n.childNodes?.[0];
      if (l?.startTag && l.endTag && t) jsonld.push({ debut: l.startTag.endOffset, fin: l.endTag.startOffset, json: t.value });
      return;
    }
    if (ignore(n) && n.nodeName !== '#document') return;
    commun = commun || ((n.nodeName === 'header' || n.nodeName === 'footer') && n.parentNode?.nodeName === 'body') || attr(n, 'role') === 'banner' || attr(n, 'role') === 'contentinfo';
    const enfants = (n.content ?? n).childNodes ?? [];
    let courante = [];
    const finir = () => { if (courante.length) serie(courante, commun); courante = []; };
    for (const c of enfants) {
      if (c.nodeName !== '#comment' && enPhrase(c) && !(c.nodeName !== '#text' && ignore(c))) { courante.push(c); if (c.attrs) attributsSous(c, commun); }
      else { finir(); if (c.nodeName !== '#text') visiter(c, commun); }
    }
    finir();
  }
  visiter(doc, false);
  return { textes, attributs, jsonld, marqueur, doc };
}

// Données structurées : textes à traduire (les noms d'organisations, de lieux et de personnes restent tels quels)
const TYPES_NOM_PROPRE = /Organization|Office|Place|Person|LocalBusiness|Club|Store|Restaurant|Lodging|GovernmentOrganization|WebSite|PostalAddress|City/;
function textesJson(v, parent, f) {
  if (Array.isArray(v)) return v.map((x) => textesJson(x, parent, f));
  if (v && typeof v === 'object') {
    const type = [].concat(v['@type'] ?? []).join(' ');
    const r = {};
    for (const [k, x] of Object.entries(v)) {
      const traduisible = typeof x === 'string' && (k === 'description' || k === 'headline' || k === 'text' || k === 'caption' || (k === 'name' && !TYPES_NOM_PROPRE.test(type)));
      r[k] = traduisible ? f(x) : textesJson(x, v, f);
    }
    return r;
  }
  return v;
}

/** Textes traduisibles des données structurées d'une page (clés comme les autres textes). */
function clesJson(p) {
  const r = [];
  for (const j of p.jsonld) { try { textesJson(JSON.parse(j.json), null, (x) => { const c = echapper(x.replace(/\s+/g, ' ').trim()); if (aTraduire(c)) r.push(c); return x; }); } catch { /* JSON illisible */ } }
  return r;
}

// --- Pages du site --------------------------------------------------------------------------------------------------

function fichiers(dir, acc = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) fichiers(p, acc);
    else if (f === 'index.html') acc.push(p);
  }
  return acc;
}
const urlDe = (f) => { const r = '/' + relative(DIST, f).replace(/(^|\/)index\.html$/, ''); return r.length > 1 ? r.replace(/\/$/, '') : '/'; };
const nomFichier = (url) => url === '/' ? 'accueil' : url.slice(1).replace(/\//g, '--');

// Pages déjà générées par un lancement précédent (essais en local) : on repart de zéro
for (const l of LANGUES) rmSync(join(DIST, l), { recursive: true, force: true });

const pages = [];
for (const f of fichiers(DIST)) {
  const url = urlDe(f);
  if (exclue(url)) continue;
  const html = readFileSync(f, 'utf8');
  pages.push({ url, fichier: f, html, ...decouper(html) });
}
// Textes communs : en-tête et pied de page, ou présents sur au moins trois pages
const frequence = new Map();
for (const p of pages) {
  const cles = new Set([...p.textes, ...p.attributs].map((u) => u.cle));
  for (const c of clesJson(p)) cles.add(c);
  for (const c of cles) frequence.set(c, (frequence.get(c) ?? 0) + 1);
}
const titreDe = (p) => desechapper((/<title>([^<]*)<\/title>/.exec(p.html)?.[1] ?? p.url).replace(/\s+/g, ' ').trim());

// --- Traductions enregistrées ---------------------------------------------------------------------------------------

// Fichier de traductions illisible (erreur de saisie dans l'éditeur) : jamais réécrit, et pas de traduction
// par l'IA tant qu'il n'est pas corrigé (on ne paierait pas deux fois, on n'écraserait pas les corrections)
const illisibles = [];
function lireYaml(f) {
  try { const d = YAML.parse(readFileSync(f, 'utf8')); return d && typeof d === 'object' ? d : {}; }
  catch (e) { illisibles.push(f); console.log(`✖ Langues : ${f} illisible (${String(e.message).split('\n')[0]}) : à corriger.`); return null; }
}
/** Textes d'une fiche : Map fr → traduction (entrées incomplètes ignorées). */
function textesDe(liste, l) {
  const m = new Map();
  for (const t of Array.isArray(liste) ? liste : []) if (t && typeof t.fr === 'string' && typeof t[l] === 'string' && t[l].trim()) m.set(t.fr, t[l]);
  return m;
}
const SEGMENT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
function charger(l) {
  const dossier = join(STOCK, l);
  const commun = (existsSync(join(dossier, 'commun.yaml')) ? lireYaml(join(dossier, 'commun.yaml')) : {}) ?? { illisible: true };
  const fiches = new Map();
  if (existsSync(join(dossier, 'pages'))) for (const f of readdirSync(join(dossier, 'pages'))) if (f.endsWith('.yaml')) {
    const d = lireYaml(join(dossier, 'pages', f));
    fiches.set(f.slice(0, -5), d ? { ...d, carte: textesDe(d.textes, l) } : { illisible: true, carte: new Map() });
  }
  const textesCommuns = textesDe(commun.textes, l);
  // Mémoire : un texte traduit ailleurs sur le site sert aussi ici (après la fiche de la page et les textes communs)
  const memoire = new Map();
  for (const f of fiches.values()) for (const [c, t] of f.carte) if (!memoire.has(c)) memoire.set(c, t);
  // Adresses : seulement des segments propres (minuscules, chiffres, tirets), sinon le segment français
  const adresses = new Map();
  for (const [k, v] of Object.entries(commun.adresses && typeof commun.adresses === 'object' ? commun.adresses : {})) {
    if (typeof v === 'string' && SEGMENT.test(v)) adresses.set(k, v);
    else console.log(`▲ Langues (${l}) : adresse « ${k} » → « ${v} » refusée (minuscules, chiffres et tirets seulement).`);
  }
  return { commun, textesCommuns, fiches, memoire, adresses };
}
/** Traduction d'un texte sur une page : sa fiche, puis les textes communs, puis le reste du site. */
function chercher(s, nomPage, cle) {
  return s.fiches.get(nomPage)?.carte.get(cle) ?? s.textesCommuns.get(cle) ?? s.memoire.get(cle);
}
const stock = Object.fromEntries(LANGUES.map((l) => [l, charger(l)]));
if (illisibles.length && traduire) {
  // Pas d'échec du déploiement pour une faute de saisie : le site est publié avec les traductions lisibles
  console.log(`✖ Langues : ${illisibles.length} fichier(s) de traductions illisible(s) ; rien n'est traduit ni réécrit tant qu'ils ne sont pas corrigés.`);
}
const ecrire = traduire && !illisibles.length;

// --- Traduction par l'IA ----------------------------------------------------------------------------------------------

/** Texte traduit sûr : &, < et > échappés, sauf entités et marqueurs. */
const assainir = (t) => t.replace(/&(?!(amp|lt|gt|quot|#\d+|#x[0-9a-f]+);)/gi, '&amp;').replace(/<(?!\/?[gx]\d+\/?>)/g, '&lt;').replace(/(?<!<\/?[gx]\d+\/?)>/g, (m, i, t2) => '&gt;');
/**
 * La traduction garde exactement les marqueurs du français : chaque <gN> ouvert puis fermé une fois, bien imbriqué,
 * chaque <xN/> une fois, de même nature. Sinon elle est refusée (le texte reste en français).
 */
function marqueursValides(trad, cle) {
  const types = new Map();
  for (const m of cle.matchAll(/<\/?([gx])(\d+)\/?>/g)) types.set(m[2], m[1]);
  const vus = new Set(), pile = [];
  for (const m of trad.matchAll(/<(\/?)([gx])(\d+)(\/?)>/g)) {
    const [, fermant, type, n, auto] = m;
    if (types.get(n) !== type) return false;
    if (type === 'x') { if (fermant || !auto || vus.has('x' + n)) return false; vus.add('x' + n); continue; }
    if (auto) return false;
    if (!fermant) { if (vus.has('g' + n)) return false; vus.add('g' + n); pile.push(n); }
    else if (pile.pop() !== n) return false;
  }
  return !pile.length && vus.size === types.size;
}
let envoyes = 0, refusees = 0, echecs = 0, plafondAtteint = false;
// Tokens consommés, pour l'empreinte publiée (le déploiement les envoie au serveur avec sa durée : étape « Mesure »)
const tokens = { entree: 0, sortie: 0, cache_ecriture: 0, cache_lecture: 0 };
process.on('exit', () => {
  if (tokens.entree + tokens.sortie + tokens.cache_ecriture + tokens.cache_lecture === 0) return;
  try { writeFileSync('.mesure-ia.json', JSON.stringify({ modele: MODELE, tokens })); } catch { /* mesure facultative */ }
});

/** Un appel à l'API : objet JSON de la réponse, ou null après plusieurs échecs (le paquet sera retenté au prochain déploiement). */
async function claude(systeme, contenu, taille = 0) {
  const attendre = (ms) => new Promise((ok) => setTimeout(ok, ms));
  let dernier = '';
  for (let essai = 1; essai <= 4; essai++) {
    try {
      const r = await fetch(`${(process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/+$/, '')}/v1/messages`, {
        method: 'POST',
        headers: { 'x-api-key': CLE_API, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model: MODELE, max_tokens: 16000, system: systeme, messages: [{ role: 'user', content: contenu }] }),
        signal: AbortSignal.timeout(180_000),
      });
      if (r.ok) {
        const d = await r.json();
        envoyes += taille;
        const u = d.usage ?? {};
        tokens.entree += u.input_tokens ?? 0; tokens.sortie += u.output_tokens ?? 0;
        tokens.cache_ecriture += u.cache_creation_input_tokens ?? 0; tokens.cache_lecture += u.cache_read_input_tokens ?? 0;
        const t = (d.content ?? []).map((c) => c.text ?? '').join('');
        try { const j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); if (j && typeof j === 'object') return j; } catch { /* réponse mal formée : on réessaie */ }
        dernier = 'réponse illisible';
        continue;
      }
      dernier = `HTTP ${r.status} ${(await r.text()).slice(0, 200)}`;
      if (r.status === 429 || r.status >= 500) { await attendre(Math.min(60, Number(r.headers.get('retry-after')) || 5 * essai) * 1000); continue; }
      break;   // 400, 401, 403… : inutile d'insister
    } catch (e) { dernier = String(e.message ?? e); await attendre(3000 * essai); }
  }
  echecs++;
  if (echecs <= 5) console.log(`▲ Langues : un paquet n'a pas pu être traduit (${dernier}).`);
  return null;
}

function consignes(l) {
  const genre = site.modele === 'collectivite' ? 'le site officiel d\'une mairie' : site.modele === 'club' ? 'le site d\'un club sportif' : 'le site d\'une entreprise';
  return `Tu traduis ${genre} (${site.nom}) du français vers l'${NOMS_FR[l] ?? l}, pour des visiteurs étrangers.
Règles :
- Traduction naturelle et concise, dans le style d'un site web ; vouvoiement ou forme de politesse habituelle de la langue (Sie, Lei, usted…).
- Les marqueurs <g1>…</g1> et <x1/> représentent la mise en forme et les liens : garde-les tous, exactement, autour des mots correspondants (tu peux changer leur ordre si la phrase l'exige).
- Garde les entités &amp; &lt; &gt; telles quelles ; n'ajoute aucune balise HTML.
- Ne traduis pas les noms propres : personnes, associations, entreprises, enseignes, rues, lieux-dits, noms de salles et d'événements portant un nom propre. Garde les adresses, téléphones, e-mails, adresses web, sigles (CCAS, CMEJ…) ; une institution française peut être explicitée brièvement si c'est utile.
- Les dates, heures et montants suivent les usages de la langue cible.
- Un texte qui ne doit pas changer (nom propre seul…) est renvoyé tel quel.
Réponds uniquement par un objet JSON { "numéro": "traduction" }, avec exactement les mêmes numéros.`;
}

async function traduireTextes(l, cles) {
  const resultat = new Map();
  if (simulation) {
    for (const c of cles) resultat.set(c, c.replace(/(^|>)([^<]+)/g, (m, a, t) => a + (t.trim() ? `[${l.toUpperCase()}] ` + t : t)));
    return resultat;
  }
  // Paquets d'environ 6 000 caractères, quatre requêtes à la fois
  const paquets = []; let courant = [], taille = 0, prevus = envoyes;
  for (const c of cles) {
    if (prevus + taille + c.length > PLAFOND) { plafondAtteint = true; break; }
    courant.push(c); taille += c.length;
    if (taille > 6000 || courant.length >= 60) { paquets.push(courant); prevus += taille; courant = []; taille = 0; }
  }
  if (courant.length) paquets.push(courant);
  const systeme = consignes(l);
  let suivant = 0;
  async function ouvrier() {
    while (suivant < paquets.length) {
      const p = paquets[suivant++];
      const r = await claude(systeme, JSON.stringify(Object.fromEntries(p.map((c, i) => [String(i + 1), c]))), p.reduce((n, c) => n + c.length, 0));
      if (!r) continue;
      p.forEach((c, i) => {
        const t = r[String(i + 1)];
        if (typeof t === 'string' && t.trim() && marqueursValides(t, c)) resultat.set(c, t.trim()); else refusees++;
      });
    }
  }
  await Promise.all(Array.from({ length: 4 }, ouvrier));
  return resultat;
}

const slug = (s) => s.normalize('NFKD').replace(/ß/g, 'ss').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);

async function traduireSegments(l, segments) {
  const r = new Map();
  if (simulation) { for (const [s] of segments) r.set(s, /^\d+$/.test(s) ? s : `${s}-${l}`); return r; }
  const liste = [...segments];
  for (let i = 0; i < liste.length; i += 80) {
    const p = liste.slice(i, i + 80);
    const rep = (await claude(`Tu traduis des segments d'adresses web d'un site français (${site.nom}) vers l'${NOMS_FR[l] ?? l}. Chaque segment est donné avec le titre d'une page où il apparaît. Rends un segment court, en minuscules, mots séparés par des tirets, sans accents. Les noms propres et les numéros restent tels quels. Réponds uniquement par un objet JSON { "numéro": "segment" }.`,
      JSON.stringify(Object.fromEntries(p.map(([s, titre], j) => [String(j + 1), { segment: s, titre }]))))) ?? {};
    p.forEach(([s], j) => { const t = slug(String(rep[String(j + 1)] ?? '')); if (t && SEGMENT.test(t)) r.set(s, t); });
  }
  return r;
}

// --- Adresses dans chaque langue ----------------------------------------------------------------------------------------

/**
 * Adresse de chaque page dans la langue : adresse traduite du parent (s'il est traduit) + segment traduit.
 * Deux pages qui tomberaient sur la même adresse : la seconde garde son segment français, puis un numéro.
 */
function adresses(l) {
  const prises = new Set([`/${l}`]);
  const carte = new Map();
  const disponibles = pages.filter((p) => publiable(p, l));
  if (disponibles.some((p) => p.url === '/')) carte.set('/', `/${l}`);
  const sur = (x) => (SEGMENT.test(x) ? x : slug(x) || 'page');
  for (const p of disponibles.filter((x) => x.url !== '/').sort((a, b) => a.url.split('/').length - b.url.split('/').length || a.url.localeCompare(b.url))) {
    const segs = p.url.slice(1).split('/');
    const seg = segs[segs.length - 1];
    let parent = `/${l}`, chemin = '';
    for (const s of segs.slice(0, -1)) { chemin += '/' + s; parent = carte.get(chemin) ?? parent + '/' + sur(stock[l].adresses.get(s) ?? s); }
    const essais = [stock[l].adresses.get(seg), seg].filter(Boolean).map(sur);
    let url = essais.map((x) => `${parent}/${x}`).find((u) => !prises.has(u));
    for (let n = 2; !url; n++) if (!prises.has(`${parent}/${sur(seg)}-${n}`)) url = `${parent}/${sur(seg)}-${n}`;
    prises.add(url); carte.set(p.url, url);
  }
  return carte;
}

// --- Écriture d'une page traduite -------------------------------------------------------------------------------------

/** Texte traduit (marqueurs) → code HTML, avec les balises d'origine (et leurs attributs traduits). */
function reconstruire(trad, u, retoucherBalise) {
  return assainir(trad).replace(/<(\/?)([gx])(\d+)(\/?)>/g, (m, fermant, type, n) => {
    const b = u.balises[Number(n) - 1];
    if (!b) return '';
    if (type === 'x') return retoucherBalise(b.ouvre, b.debut);
    return fermant ? b.ferme : retoucherBalise(b.ouvre, b.debut);
  });
}

function reecrireLiens(html, carte, urlFr) {
  const reecrire = (u) => {
    const m = /^([^?#]*)(.*)$/.exec(u);
    const chemin = m[1].length > 1 ? m[1].replace(/\/+$/, '') : m[1];
    const cible = carte.get(chemin || '/');
    return cible ? cible + m[2] : u;
  };
  // Lien relatif (« contact », « ../agenda ») : résolu comme le ferait le navigateur sur la page française
  const relatif = (u) => {
    if (/^([a-z][a-z0-9+.-]*:|#|\/|\?|$)/i.test(u)) return u;
    try { const r = new URL(desechapper(u), 'https://x' + urlFr); return reecrire(echapperAttr(r.pathname + r.search + r.hash)); } catch { return u; }
  };
  const balisage = (h) => h
    .replace(/(\s(?:href|action)=")(\/(?!\/)[^"]*)"/g, (m, a, u) => a + reecrire(u) + '"')
    .replace(/(<a\b[^>]*?\shref=")([^"]*)"/g, (m, a, u) => a + relatif(u) + '"')
    .replace(/(\s(?:href|content)=")(https?:\/\/[^/"]+)(\/[^"]*)?"/g, (m, a, hote, u = '/') => (ORIGINE && hote === ORIGINE ? a + hote + reecrire(u) + '"' : m));
  // Le code des scripts n'est jamais touché (gabarits JavaScript du type href="${…}") : seulement le balisage
  return html.split(/(<script\b[\s\S]*?<\/script>)/i).map((morceau, i) => (i % 2 ? morceau : balisage(morceau))).join('');
}

const echapperAttr = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function selecteur(langueCourante, equivalents) {
  const liens = ['fr', ...LANGUES].filter((l) => equivalents[l]).map((l) => l === langueCourante
    ? `<a href="${echapperAttr(equivalents[l])}" hreflang="${l}" lang="${l}" aria-current="true"><abbr title="${NOMS[l] ?? l}">${l.toUpperCase()}</abbr></a>`
    : `<a href="${echapperAttr(equivalents[l])}" hreflang="${l}" lang="${l}" data-langue="${l}"><abbr title="${NOMS[l] ?? l}">${l.toUpperCase()}</abbr><span class="visually-hidden"> — ${NOMS[l] ?? l}</span></a>`);
  return liens.length > 1 ? `<span class="langues__liste" aria-label="${LIBELLE_LANGUE[langueCourante] ?? 'Language'}" role="group">${liens.join('')}</span>` : '';
}

function alternatives(equivalents) {
  const abs = (u) => BASE + (u === '/' ? '/' : u);
  return Object.entries(equivalents).map(([l, u]) => `<link rel="alternate" hreflang="${l}" href="${echapperAttr(abs(u))}">`).join('') + (equivalents.fr ? `<link rel="alternate" hreflang="x-default" href="${echapperAttr(abs(equivalents.fr))}">` : '');
}

/** Ajoute alternatives et sélecteur ; dans une page traduite, langue de la page, locale et liens. */
function habiller(html, marqueur, langue, equivalents, carte, urlFr) {
  // Sélecteur à l'emplacement prévu par l'en-tête (élément data-langues), retiré du découpage
  if (marqueur?.sourceCodeLocation?.startTag && marqueur.sourceCodeLocation.endTag) {
    const l = marqueur.sourceCodeLocation;
    const contenu = selecteur(langue, equivalents);
    let ouvre = html.slice(l.startTag.startOffset, l.startTag.endOffset);
    const h = l.attrs?.hidden;
    if (h && contenu) ouvre = ouvre.slice(0, h.startOffset - l.startTag.startOffset).replace(/\s+$/, '') + ouvre.slice(h.endOffset - l.startTag.startOffset);
    else if (!h && !contenu) ouvre = ouvre.replace(/\s*\/?>$/, ' hidden>');
    html = html.slice(0, l.startTag.startOffset) + ouvre + contenu + html.slice(l.endTag.startOffset);
  }
  html = html.replace(/<\/head>/, alternatives(equivalents) + '</head>');
  if (langue !== 'fr') {
    html = html.replace(/<html([^>]*)\slang="[^"]*"/, `<html$1 lang="${langue}"`)
      .replace(/(<meta property="og:locale" content=")[^"]*"/, `$1${LOCALES[langue] ?? langue}"`)
      // Image de partage : une par langue, avec le titre traduit (scripts/partage.mjs la dessine d'après og:title)
      .replace(/(<meta property="og:image" content="[^"]*\/partage\/)([^"/]+\.png")/, `$1${langue}--$2`);
    // Le lien vers la page française ne doit pas être réécrit : on le protège le temps de la réécriture
    html = html.replace(/href="([^"]*)" hreflang="fr"/g, 'data-href-fr="$1" hreflang="fr"');
    html = reecrireLiens(html, carte, urlFr).replace(/data-href-fr="([^"]*)" hreflang="fr"/g, 'href="$1" hreflang="fr"');
  }
  return html;
}

function traduirePage(p, l, carte, equivalents) {
  const nom = nomFichier(p.url);
  const t = (cle) => { const x = chercher(stock[l], nom, cle); if (x === undefined) return undefined; if (marqueursValides(x, cle)) return x; invalides.add(`${l} ${p.url} : ${cle.slice(0, 60)}`); return undefined; };
  let manquants = 0;
  const modifs = [];
  // Attributs : remplacés dans les balises (aussi celles qu'un texte réutilise)
  const attrsParPos = new Map(p.attributs.map((a) => [a.debut, a]));
  const valeurAttr = (a) => { const tr = t(a.cle); if (!tr) { manquants++; return null; } return `${a.nom}="${desechapper(tr).replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"`; };
  const retoucherBalise = (code, debut) => {
    const fin = debut + code.length;
    const dedans = p.attributs.filter((a) => a.debut >= debut && a.fin <= fin).sort((a, b) => b.debut - a.debut);
    for (const a of dedans) { const v = valeurAttr(a); if (v) code = code.slice(0, a.debut - debut) + v + code.slice(a.fin - debut); a.fait = true; }
    return code;
  };
  for (const a of p.attributs) a.fait = false;
  for (const u of p.textes) {
    const tr = t(u.cle);
    if (!tr) { manquants++; continue; }
    modifs.push({ debut: u.debut, fin: u.fin, code: u.avant + reconstruire(tr, u, retoucherBalise) + u.apres });
  }
  // Les textes qui n'ont pas été traduits gardent leurs balises : leurs attributs sont traduits en place
  for (const a of p.attributs) {
    if (a.fait) continue;
    if (modifs.some((m) => a.debut >= m.debut && a.fin <= m.fin)) continue;
    const v = valeurAttr(a); if (v) modifs.push({ debut: a.debut, fin: a.fin, code: v });
  }
  for (const j of p.jsonld) {
    try {
      const d = JSON.parse(j.json);
      const tr = textesJson(d, null, (s) => { const x = t(echapper(s.replace(/\s+/g, ' ').trim())); return x ? desechapper(x) : s; });
      // Adresses des pages traduites dans les données structurées
      const chaine = JSON.stringify(tr).replace(/"(https?:\/\/[^"]+)"/g, (m, u) => {
        if (!BASE || !u.startsWith(BASE)) return m;
        const reste = u.slice(BASE.length) || '/'; const [chemin, suite = ''] = reste.split(/(?=[?#])/);
        // Entités du site (…/#entreprise, …/#site) : mêmes identifiants dans toutes les langues
        if ((chemin === '/' || chemin === '') && suite.startsWith('#')) return m;
        const c = carte.get(chemin.length > 1 ? chemin.replace(/\/+$/, '') : chemin);
        return c ? `"${BASE}${c}${suite}"` : m;
      }).replace(/</g, '\\u003c');
      modifs.push({ debut: j.debut, fin: j.fin, code: chaine });
    } catch { /* JSON illisible : laissé tel quel */ }
  }
  modifs.sort((a, b) => b.debut - a.debut);
  let html = p.html;
  let borne = Infinity;
  for (const m of modifs) { if (m.fin > borne) continue; html = html.slice(0, m.debut) + m.code + html.slice(m.fin); borne = m.debut; }
  // Le marqueur du sélecteur a bougé : on le retrouve dans la page traduite
  const marq = decouperMarqueur(html);
  return { html: habiller(html, marq, l, equivalents, carte, p.url), manquants };
}

function decouperMarqueur(html) {
  let trouve = null;
  (function v(n) { if (trouve) return; if (n.attrs && attr(n, 'data-langues') !== undefined && attr(n, 'data-langues') !== 'non') { trouve = n; return; } for (const c of (n.content ?? n).childNodes ?? []) v(c); })(parse(html, { sourceCodeLocationInfo: true }));
  return trouve;
}

// --- Programme -------------------------------------------------------------------------------------------------------

/** Clés d'une page : textes, attributs et données structurées, sans doublon. */
const clesPage = (p) => [...new Set([...p.textes.map((u) => u.cle), ...p.attributs.map((u) => u.cle), ...clesJson(p)])];
const estCommunCle = (p, c) => (frequence.get(c) ?? 0) >= 3 || [...p.textes, ...p.attributs].some((u) => u.cle === c && u.commun);
// Une page n'est créée dans une langue qu'une fois traduite à 90 % (une panne de l'API ne publie pas de pages en français)
const COUVERTURE_MIN = 0.9;
/** La page existe dans la langue : sa fiche existe. */
const publiable = (p, l) => stock[l].fiches.has(nomFichier(p.url)) && !stock[l].fiches.get(nomFichier(p.url)).illisible;
/** Traduction valable d'un texte d'une page : enregistrée (si ses marqueurs sont justes), sinon traduite à l'instant. */
function trouver(s, nom, c) {
  const x = chercher(s, nom, c);
  return x !== undefined && marqueursValides(x, c) ? x : s.neuves?.get(c);
}

let manquantsTotal = 0;
const invalides = new Set();
const cartes = {};
for (const l of LANGUES) {
  const s = stock[l];
  s.neuves = new Map();
  if (ecrire) {
    // 1. Ce qui manque (ou dont les marqueurs sont faux) est envoyé à l'IA
    const manque = new Set();
    for (const p of pages) { const nom = nomFichier(p.url); for (const c of clesPage(p)) if (trouver(s, nom, c) === undefined) manque.add(c); }
    s.neuves = await traduireTextes(l, [...manque]);
    const segments = new Map();
    for (const p of pages) if (p.url !== '/') for (const seg of p.url.slice(1).split('/')) if (!s.adresses.has(seg) && !/^\d+$/.test(seg)) segments.set(seg, titreDe(p));
    for (const [seg, tr] of await traduireSegments(l, segments)) s.adresses.set(seg, tr);

    // 2. Textes communs et adresses
    const dossier = join(STOCK, l);
    mkdirSync(join(dossier, 'pages'), { recursive: true });
    const communs = new Map();
    for (const p of pages) {
      const nom = nomFichier(p.url);
      for (const c of clesPage(p)) {
        if (communs.has(c) || !estCommunCle(p, c)) continue;
        const enCommun = s.textesCommuns.get(c);
        const tr = enCommun !== undefined && marqueursValides(enCommun, c) ? enCommun : trouver(s, nom, c);
        if (tr !== undefined) communs.set(c, tr);
      }
    }
    const utilises = new Set(pages.flatMap((p) => (p.url === '/' ? [] : p.url.slice(1).split('/'))));
    const adressesTriees = Object.fromEntries([...s.adresses].filter(([seg]) => utilises.has(seg)).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(join(dossier, 'commun.yaml'), `# Textes communs à beaucoup de pages et adresses des pages, en ${NOMS_FR[l] ?? l}. Fichier tenu par scripts/langues.mjs :\n# corrigez une traduction ou une adresse (minuscules, chiffres et tirets), elle est gardée tant que le texte français ne change pas.\n`
      + YAML.stringify({ adresses: adressesTriees, textes: [...communs].map(([fr, tr]) => ({ fr, [l]: tr })) }, { lineWidth: 0 }));

    // 3. Une fiche par page : ses textes propres
    const gardees = new Set();
    let enAttente = 0;
    for (const p of pages) {
      const nom = nomFichier(p.url);
      const cles = clesPage(p);
      const propres = new Map();
      let traduits = 0;
      for (const c of cles) {
        const tr = communs.has(c) ? communs.get(c) : trouver(s, nom, c);
        if (tr === undefined) continue;
        traduits++;
        if (!communs.has(c)) propres.set(c, tr);
      }
      const avant = s.fiches.get(nom);
      if (!avant && cles.length && traduits / cles.length < COUVERTURE_MIN) { enAttente++; continue; }   // pas encore assez traduite
      gardees.add(nom);
      const anciennes = avant?.carte ?? new Map();
      const change = !avant || anciennes.size !== propres.size || [...propres].some(([c, tr]) => anciennes.get(c) !== tr);
      // État : auto (traduite par l'IA) ; relue (vérifiée par le client) ; a-revoir (relue, puis de nouveaux textes)
      const nouveaux = [...propres.keys()].some((c) => !anciennes.has(c));
      const etat = avant?.etat === 'relue' && nouveaux ? 'a-revoir' : (['auto', 'relue', 'a-revoir'].includes(avant?.etat) ? avant.etat : 'auto');
      const fiche = { page: p.url, titre: titreDe(p), etat, textes: [...propres].map(([fr, tr]) => ({ fr, [l]: tr })) };
      if (change || avant.page !== fiche.page || avant.titre !== fiche.titre || avant.etat !== etat) writeFileSync(join(dossier, 'pages', nom + '.yaml'), YAML.stringify(fiche, { lineWidth: 0 }));
      s.fiches.set(nom, { ...fiche, carte: propres });
    }
    s.textesCommuns = communs;
    // Pages disparues (ou exclues) : leur fiche est retirée
    for (const f of readdirSync(join(dossier, 'pages'))) if (f.endsWith('.yaml') && !gardees.has(f.slice(0, -5))) { rmSync(join(dossier, 'pages', f)); s.fiches.delete(f.slice(0, -5)); }
    if (enAttente) console.log(`▲ Langues (${l}) : ${enAttente} page(s) pas encore assez traduites, publiées au prochain déploiement.`);
  }
  cartes[l] = adresses(l);
}

// Équivalents de chaque page française, puis écriture des pages
const ecrites = {};
for (const p of pages) {
  const eq = { fr: p.url };
  for (const l of LANGUES) if (cartes[l].has(p.url)) eq[l] = cartes[l].get(p.url);
  // Langue sans cette page : le sélecteur mène à l'accueil de la langue
  for (const l of LANGUES) if (!eq[l] && cartes[l].has('/')) eq[`~${l}`] = cartes[l].get('/');
  p.equivalents = eq;
}
const pourSelecteur = (eq) => Object.fromEntries(['fr', ...LANGUES].map((l) => [l, eq[l] ?? eq[`~${l}`]]).filter(([, u]) => u));
const pourAlternatives = (eq) => Object.fromEntries(Object.entries(eq).filter(([l]) => !l.startsWith('~')));
const ALTERNATIVES = /(<link rel="alternate" hreflang="[^"]+" href="[^"]*">)+(?=<\/head>)/;
for (const l of LANGUES) {
  let n = 0;
  for (const p of pages) {
    if (!p.equivalents[l]) continue;
    const eqSel = pourSelecteur(p.equivalents), eqAlt = pourAlternatives(p.equivalents);
    // habiller() reçoit les adresses du sélecteur ; les alternatives (hreflang) ne listent que les vraies traductions
    const { html, manquants } = traduirePage(p, l, cartes[l], eqSel);
    const dest = join(DIST, p.equivalents[l].slice(1), 'index.html');
    if (!dest.startsWith(join(DIST, l) + '/')) throw new Error(`Adresse hors du site : ${p.equivalents[l]}`);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, html.replace(ALTERNATIVES, alternatives(eqAlt)));
    manquantsTotal += manquants; n++;
  }
  ecrites[l] = n;
}
// Pages françaises : alternatives et sélecteur
for (const p of pages) {
  const eqSel = pourSelecteur(p.equivalents), eqAlt = pourAlternatives(p.equivalents);
  const html = habiller(p.html, p.marqueur, 'fr', eqSel, null, p.url).replace(ALTERNATIVES, Object.keys(eqAlt).length > 1 ? alternatives(eqAlt) : '');
  writeFileSync(p.fichier, html);
}

// Plan du site pour les moteurs : chaque page avec ses équivalents ; le reste du fichier est gardé tel quel
const plan = join(DIST, 'sitemap.xml');
if (existsSync(plan)) {
  const parUrl = new Map(pages.map((p) => [p.url, p]));
  const abs = (u) => BASE + (u === '/' ? '/' : u);
  let xml = readFileSync(plan, 'utf8').replace(/[ \t]*<url>([\s\S]*?)<\/url>/g, (bloc, corps) => {
    const m = /<loc>\s*(?:https?:\/\/[^/<\s]+)?(\/[^<\s]*)?\s*<\/loc>/.exec(corps);
    if (!m) return bloc;
    const chemin = m[1] && m[1].length > 1 ? m[1].replace(/\/+$/, '') : '/';
    if (/^\/[a-z]{2}(\/|$)/.test(chemin) && LANGUES.includes(chemin.slice(1, 3))) return '';   // d'un lancement précédent : refaite ci-dessous
    const propre = corps.replace(/\s*<xhtml:link\b[^>]*\/>/g, '');
    const eq = parUrl.has(chemin) ? pourAlternatives(parUrl.get(chemin).equivalents) : null;
    if (!eq || Object.keys(eq).length < 2) return `  <url>${propre}</url>`;
    const alt = Object.entries(eq).map(([l, u]) => `<xhtml:link rel="alternate" hreflang="${l}" href="${echapperAttr(abs(u))}"/>`).join('');
    return Object.values(eq).map((u) => `  <url>${propre.replace(m[0], `<loc>${echapperAttr(abs(u))}</loc>`)}${alt}</url>`).join('\n');
  }).replace(/\n\s*\n/g, '\n');
  if (!/xmlns:xhtml=/.test(xml)) xml = xml.replace(/<urlset\b/, '<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml"');
  writeFileSync(plan, xml);
}

const total = Object.entries(ecrites).map(([l, n]) => `${l} ${n}`).join(', ');
console.log(`✔ Langues : ${pages.length} pages françaises ; pages traduites : ${total}${ecrire && !simulation ? ` ; ${envoyes.toLocaleString('fr-FR')} caractères traduits par l'IA` : ''}`);
if (manquantsTotal) console.log(`▲ ${manquantsTotal} texte(s) encore sans traduction, affichés en français (traduits au prochain déploiement de production)`);
if (refusees) console.log(`▲ ${refusees} traduction(s) de l'IA refusée(s) (mise en forme perdue) : retentées au prochain déploiement`);
if (echecs) console.log(`▲ ${echecs} paquet(s) non traduits (API indisponible) : retentés au prochain déploiement`);
if (invalides.size) console.log(`▲ ${invalides.size} traduction(s) enregistrée(s) aux marqueurs <g1>…</g1> abîmés, affichées en français ; par exemple ${[...invalides].slice(0, 3).join(' · ')}`);
if (plafondAtteint) console.log(`▲ Plafond de ${PLAFOND.toLocaleString('fr-FR')} caractères atteint : la suite sera traduite au prochain déploiement.`);
