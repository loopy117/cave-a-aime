/**
 * Import d'une image fournie (spec §9) :
 *   npm run import-media -- <fichier source> <chemin dans media/>
 * Redresse selon l'orientation, redimensionne à 3200 px maximum (sans agrandir ; les pages affichent 2400 px au plus, la marge permet de recadrer),
 * supprime les métadonnées (EXIF, position GPS), enregistre en JPEG.
 */
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';

const [source, cible] = process.argv.slice(2);
if (!source || !cible || !/^[a-z0-9/_-]+\.jpg$/.test(cible)) {
  console.error('Usage : npm run import-media -- <source> <dossier/nom-en-minuscules.jpg>');
  process.exit(1);
}
const sortie = join('media', cible);
mkdirSync(dirname(sortie), { recursive: true });
const info = await sharp(source)
  .rotate()
  .resize({ width: 3200, height: 3200, fit: 'inside', withoutEnlargement: true })
  .jpeg({ quality: 85, mozjpeg: true })
  .toFile(sortie);
console.log(`${sortie} : ${info.width} × ${info.height} px, ${Math.round(info.size / 1024)} Ko, métadonnées supprimées`);
if (info.width < 1600) console.log(`⚠ Largeur ${info.width} px : trop petite pour un hero plein écran (2400 px) et juste pour un hero split (1600 px conseillés).`);
console.log(`Référence dans le contenu : /img/${cible}`);
