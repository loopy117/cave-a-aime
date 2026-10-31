// Copie media/ → dist/img/ après le build.
// Le site utilise les versions optimisées (/_astro/…) ; ces originaux servent
// uniquement aux aperçus de l'éditeur /admin (Decap affiche les images par leur
// chemin /img/…). Ils ne sont pas indexés et pas mis en cache longtemps.
import { cpSync, existsSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';

if (!existsSync('dist')) throw new Error('dist/ absent : lancer astro build avant.');
// media/ peut être absent (site neuf, dossier vide non suivi par Git)
mkdirSync('dist/img', { recursive: true });
// Images et PDF seulement (même liste que src/lib/medias.ts) : un SVG ou un HTML copié ici s'exécuterait sur le
// domaine du site. La validation les refuse déjà ; la copie les ignore au cas où.
const PERMIS = /\.(jpe?g|png|webp|avif|gif|pdf)$/i;
let ignores = 0;
if (existsSync('media')) cpSync('media', 'dist/img', {
  recursive: true,
  filter: (src) => {
    if (statSync(src).isDirectory() || PERMIS.test(src)) return true;
    if (!basename(src).startsWith('.')) ignores++;   // .gitkeep : ignoré sans le signaler
    return false;
  },
});
if (ignores) console.warn(`Médias : ${ignores} fichier(s) d'un type non permis ignoré(s) (images et PDF seulement).`);
writeFileSync('dist/img/.htaccess', `Options -Indexes
<IfModule mod_headers.c>
  Header set X-Robots-Tag "noindex"
  Header set Cache-Control "public, max-age=300"
</IfModule>
`);
console.log('Médias copiés dans dist/img (aperçus de l\'éditeur).');
