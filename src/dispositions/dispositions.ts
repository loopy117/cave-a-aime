import { z } from 'astro/zod';

/** Dispositions et leurs options (spec §3). */
export const dispositions = {
  grid: { description: 'Grille responsive (cas général).', options: z.object({ colonnes: z.number().int().min(2).max(4).default(3) }).strict() },
  slider: { description: 'Défilement horizontal (scroll-snap, sans JavaScript).', options: z.object({ visibles: z.number().int().min(1).max(4).default(3) }).strict() },
  liste: { description: 'Liste verticale.', options: z.object({ separateurs: z.boolean().default(true) }).strict() },
  masonry: { description: 'Colonnes à hauteurs variables.', options: z.object({ colonnes: z.number().int().min(2).max(4).default(3) }).strict() },
  flux: { description: 'Éléments en ligne qui passent à la ligne (pastilles, étiquettes).', options: z.object({}).strict() },
} as const;

export type NomDisposition = keyof typeof dispositions;
export const nomsDispositions = Object.keys(dispositions) as [NomDisposition, ...NomDisposition[]];
