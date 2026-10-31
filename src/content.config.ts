import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { page } from './schemas/page';
import { collectionSchemas, nomsCollections } from './schemas/collections';

// Les fichiers de contenu vivent dans /content (hors src/), un dossier par collection (une par schéma de collections.ts).
export const collections = {
  pages: defineCollection({ loader: glob({ pattern: '**/*.yaml', base: './content/pages' }), schema: page }),
  ...Object.fromEntries(nomsCollections.map((nom) => [nom, defineCollection({ loader: glob({ pattern: '*.md', base: `./content/${nom}` }), schema: collectionSchemas[nom] })])),
};
