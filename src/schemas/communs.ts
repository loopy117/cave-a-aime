import { z } from 'astro/zod';
import { problemesMarkdown } from '../lib/markdown-regles';
z.config(z.locales.fr());
import icones from '../../data/icones.json' with { type: 'json' };
import taxonomies from '../../data/taxonomies.json' with { type: 'json' };

/** Chemin d'image public : /img/<chemin>, résolu vers media/<chemin> au build. */
export const image = z
  .object({
    src: z.string().regex(/^\/img\/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp)$/i, 'chemin attendu : /img/<dossier>/<nom>.jpg|png|webp'),
    alt: z.string().max(125, 'texte alternatif : 125 caractères maximum').describe('Description de l\'image. Chaîne vide "" uniquement pour une image décorative.'),
    focus: z.enum(['centre', 'haut', 'bas', 'gauche', 'droite']).optional().describe("Point d'intérêt pour le recadrage"),
  })
  .strict()
  .describe('Image : { src, alt, focus? }');

export const cta = z
  .object({
    label: z.string().min(2).max(40),
    href: z.string().regex(/^(\/|#|tel:|mailto:|https:\/\/)/, 'lien interne (/...), ancre (#...), tel:, mailto: ou https://'),
    style: z.enum(['primaire', 'secondaire']).default('primaire'),
  })
  .strict()
  .describe('Bouton : { label, href, style: primaire | secondaire }');

export const lien = z
  .object({ label: z.string().min(2).max(50), href: cta.shape.href })
  .strict();

export const background = z.enum(['clair', 'alt', 'sombre', 'accent', 'sillage', 'sillage-sombre']).default('clair').describe('Fond de la section (sillage : décor de halos et de traits en S, clair ou sombre)');
export const spacing = z.enum(['compact', 'normal', 'large']).default('normal').describe('Espacement vertical');

export const icone = z.enum(Object.keys(icones) as [string, ...string[]]).describe('Icône du jeu fermé data/icones.json');
export const metier = z.enum(Object.keys(taxonomies.metiers) as [string, ...string[]]).describe('Métier (data/taxonomies.json)');

/** Options communes à tous les blocs. */
export const optionsCommunes = {
  background,
  spacing,
  id: z.string().regex(/^[a-z0-9-]+$/).optional().describe('Ancre HTML facultative'),
};

/** En-tête de section facultatif (surtitre, titre H2, intro, lien « tout voir »). */
export const entete = {
  surtitre: z.string().max(40).optional().describe('Petit texte en capitales au-dessus du titre'),
  titre: z.string().max(110).optional().describe('Titre de section (H2)'),
  intro: z.string().max(300).optional(),
};

export const markdown = z
  .string()
  .superRefine((s, ctx) => { for (const message of problemesMarkdown(s)) ctx.addIssue({ code: 'custom', message }); })
  .describe('Markdown : paragraphes, listes, gras, liens, titres ## et ### (jamais #)');
