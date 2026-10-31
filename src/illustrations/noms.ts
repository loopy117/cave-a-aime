/**
 * Illustrations codées (HTML + CSS, sans image) propres au site : aperçus de l'espace client,
 * bilan mensuel, scores… Utilisables dans hero (split), texte-image et features.
 * Les noms sont ici (lus par les schémas) ; les composants dans index.ts.
 */
import { z } from 'astro/zod';

export const nomsIllustrations = ['demande', 'bilan', 'tableau-demandes', 'pagespeed'] as const;

const mesure = z
  .object({
    performance: z.number().int().min(0).max(100),
    accessibilite: z.number().int().min(0).max(100),
    bonnes_pratiques: z.number().int().min(0).max(100),
    seo: z.number().int().min(0).max(100),
    fcp: z.string().max(10).describe('First Contentful Paint, ex. « 1,0 s »'),
    lcp: z.string().max(10).describe('Largest Contentful Paint'),
    tbt: z.string().max(10).describe('Total Blocking Time, ex. « 0 ms »'),
    cls: z.string().max(10).describe('Cumulative Layout Shift, ex. « 0 »'),
    si: z.string().max(10).describe('Speed Index'),
  })
  .strict();

export const illustration = z
  .object({
    nom: z.enum(nomsIllustrations).describe('demande : une demande dans l\'espace client · bilan : bilan mensuel · tableau-demandes : suivi des demandes en colonnes · pagespeed : scores de vitesse'),
    score_mobile: z.number().int().min(0).max(100).optional().describe('Score PageSpeed mobile réellement mesuré (sinon rien n\'est affiché)'),
    score_ordinateur: z.number().int().min(0).max(100).optional(),
    date: z.string().max(20).optional().describe('Date du relevé (ex. 30/09/2026)'),
    mobile: mesure.optional().describe('pagespeed : rapport complet mesuré sur mobile (onglet Mobile)'),
    ordinateur: mesure.optional().describe('pagespeed : rapport complet mesuré sur ordinateur (onglet Ordinateur)'),
    legende: z.string().max(90).optional().describe('Ex. « Site réalisé pour MYR Énergie, mesuré avec Google PageSpeed »'),
  })
  .strict()
  .describe('Illustration codée du site : { nom, … }');
export type Illustration = z.infer<typeof illustration>;
