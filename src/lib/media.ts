import type { ImageMetadata } from 'astro';

// Toutes les images maîtresses de /media, importées pour être déclinées au build.
const fichiers = import.meta.glob<ImageMetadata>('/media/**/*.{jpg,jpeg,png,webp}', { eager: true, import: 'default' });

/** /img/pages/index/x.jpg → image de media/pages/index/x.jpg */
export function resoudreImage(src: string): ImageMetadata {
  const cle = src.replace(/^\/img\//, '/media/');
  const img = fichiers[cle];
  if (!img) throw new Error(`Image introuvable : ${src} (attendue dans ${cle.slice(1)})`);
  return img;
}

export const positions: Record<string, string> = { centre: '50% 50%', haut: '50% 20%', bas: '50% 80%', gauche: '20% 50%', droite: '80% 50%' };
