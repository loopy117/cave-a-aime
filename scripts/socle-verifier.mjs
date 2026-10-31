#!/usr/bin/env node
/**
 * Vérifie que les fichiers du socle n'ont pas été modifiés dans le site (lancé par « npm run validate »).
 * Une évolution du code se fait dans le dépôt socle-sites, puis s'installe ici (outils/installer.mjs).
 * Un besoin propre au site va dans src/site/ (ou les autres fichiers propres au site listés dans .socle/manifest.json).
 * Messages sur stderr : « npm run validate -- --json » doit ne produire que du JSON sur stdout (lu par jq dans les workflows).
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const f = '.socle/manifest.json';
if (!existsSync(f)) { console.error('socle : pas de manifeste (site hors socle), vérification ignorée'); process.exit(0); }
const m = JSON.parse(readFileSync(f, 'utf8'));
const motif = (g) => new RegExp('^' + g.split('**').map((p) => p.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')).join('.*') + '$');
const dans = (c, ms) => ms.some((g) => motif(g).test(c));
const erreurs = [];
for (const [chemin, h] of Object.entries(m.fichiers)) {
  if (!existsSync(chemin)) { erreurs.push(`supprimé : ${chemin}`); continue; }
  if (createHash('sha256').update(readFileSync(chemin)).digest('hex') !== h) erreurs.push(`modifié : ${chemin}`);
}
// Fichiers ajoutés dans une zone du socle (ex. un bloc créé directement dans le site)
let suivis = [];
try { suivis = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean); } catch {}
for (const c of suivis) if (dans(c, m.motifs.socle) && !dans(c, m.motifs.site) && !m.fichiers[c]) erreurs.push(`ajouté hors socle : ${c}`);
if (erreurs.length) {
  console.error(`✗ Socle ${m.version} : ${erreurs.length} fichier(s) ne correspondent pas à la version installée :\n  ${erreurs.join('\n  ')}\n`
    + 'Faites la modification dans le dépôt socle-sites puis réinstallez-le, ou placez ce qui est propre au site dans src/site/.');
  process.exit(1);
}
console.error(`✔ Socle ${m.version} (${m.commit}) : ${Object.keys(m.fichiers).length} fichiers conformes`);
