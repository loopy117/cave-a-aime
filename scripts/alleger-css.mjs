#!/usr/bin/env node
/**
 * Allège le CSS intégré à chaque page (après astro build).
 *
 * Le registre des blocs (src/blocks/index.ts) importe tous les blocs : Astro intègre donc à chaque page le CSS de
 * tous les blocs du site, même absents de la page (≈ 70 Ko sur 100 sur une page d'accueil). Ce CSS ne s'applique
 * pas (ses règles portent l'attribut data-astro-cid-… d'un composant qui n'est pas dans la page) mais le navigateur
 * doit l'analyser avant le premier affichage.
 *
 * Pour chaque page : on relève les data-astro-cid-… présents dans le HTML (hors <style>), puis on retire des <style>
 * les sélecteurs qui en exigent un autre. Une règle sans sélecteur restant disparaît, une @media vide aussi.
 * Tout le reste (règles globales, @font-face, @keyframes, variables) est gardé tel quel. Une page dont le CSS ne se
 * lit pas comme prévu est laissée intacte.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = process.argv[2] || 'dist';
const RE_CID = /data-astro-cid-([a-z0-9]+)/g;

/** Découpe une liste CSS en éléments de premier niveau : { prelude, corps } (corps = null pour une instruction ;). */
function decouper(css) {
  const out = [];
  let i = 0, debut = 0;
  while (i < css.length) {
    const c = css[i];
    if (c === '"' || c === "'") { i = finChaine(css, i); continue; }
    if (c === '/' && css[i + 1] === '*') { const f = css.indexOf('*/', i + 2); i = f < 0 ? css.length : f + 2; continue; }
    if (c === ';') { out.push({ prelude: css.slice(debut, i + 1), corps: null }); debut = i + 1; i++; continue; }
    if (c === '{') {
      const fin = accolade(css, i);
      if (fin < 0) throw new Error('accolade non fermée');
      out.push({ prelude: css.slice(debut, i), corps: css.slice(i + 1, fin) });
      debut = i = fin + 1;
      continue;
    }
    if (c === '}') throw new Error('accolade orpheline');
    i++;
  }
  if (css.slice(debut).trim()) out.push({ prelude: css.slice(debut), corps: null });
  return out;
}
function finChaine(s, i) {
  const q = s[i];
  for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') { j++; continue; } if (s[j] === q) return j + 1; }
  return s.length;
}
function accolade(s, i) {
  let n = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '"' || c === "'") { j = finChaine(s, j) - 1; continue; }
    if (c === '/' && s[j + 1] === '*') { const f = s.indexOf('*/', j + 2); j = f < 0 ? s.length : f + 1; continue; }
    if (c === '{') n++;
    else if (c === '}' && --n === 0) return j;
  }
  return -1;
}
/** Sépare une liste de sélecteurs sur les virgules de premier niveau (pas celles de :is(), :not()…). */
function selecteurs(prelude) {
  const out = []; let n = 0, debut = 0;
  for (let i = 0; i < prelude.length; i++) {
    const c = prelude[i];
    if (c === '"' || c === "'") { i = finChaine(prelude, i) - 1; continue; }
    if (c === '(' || c === '[') n++;
    else if (c === ')' || c === ']') n--;
    else if (c === ',' && n === 0) { out.push(prelude.slice(debut, i)); debut = i + 1; }
  }
  out.push(prelude.slice(debut));
  return out;
}
const GROUPES = /^\s*@(media|supports|container|layer|scope|document)\b/i;

function filtrer(css, presents, stats) {
  let res = '';
  for (const { prelude, corps } of decouper(css)) {
    if (corps === null) { res += prelude; continue; }
    if (/^\s*@/.test(prelude)) {
      if (GROUPES.test(prelude)) {
        const dedans = filtrer(corps, presents, stats);
        if (dedans.trim()) res += `${prelude}{${dedans}}`;
      } else res += `${prelude}{${corps}}`;          // @font-face, @keyframes, @property… : gardés
      continue;
    }
    const gardes = selecteurs(prelude).filter((s) => {
      for (const m of s.matchAll(RE_CID)) if (!presents.has(m[1])) return false;
      return true;
    });
    if (gardes.length) res += `${gardes.join(',')}{${corps}}`;
    else stats.retirees++;
  }
  return res;
}

function traiter(fichier, stats) {
  const html = readFileSync(fichier, 'utf8');
  if (!html.includes('<style')) return;
  const sansStyle = html.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  const presents = new Set([...sansStyle.matchAll(RE_CID)].map((m) => m[1]));
  let avant = 0, apres = 0;
  let sortie;
  try {
    sortie = html.replace(/(<style\b[^>]*>)([\s\S]*?)(<\/style>)/gi, (_, o, css, f) => {
      const nouveau = filtrer(css, presents, stats);
      avant += css.length; apres += nouveau.length;
      return o + nouveau + f;
    });
  } catch (e) {
    stats.intactes.push(`${fichier} (${e.message})`);
    return;
  }
  stats.pages++; stats.avant += avant; stats.apres += apres;
  if (sortie !== html) writeFileSync(fichier, sortie);
}

function parcourir(d, stats) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) { if (n !== '_astro' && n !== 'admin') parcourir(p, stats); }
    else if (n.endsWith('.html')) traiter(p, stats);
  }
}

const stats = { pages: 0, avant: 0, apres: 0, retirees: 0, intactes: [] };
parcourir(DIST, stats);
const ko = (n) => `${Math.round(n / 1024)} Ko`;
console.log(`CSS allégé : ${stats.pages} page(s), ${ko(stats.avant)} → ${ko(stats.apres)} (${stats.retirees} règle(s) inutiles retirées)`
  + (stats.intactes.length ? `, laissées intactes : ${stats.intactes.join(' ; ')}` : ''));

