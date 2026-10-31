import { z } from 'astro/zod';
import { section } from './blocs';

export const page = z
  .object({
    titre: z.string().min(2).max(70).describe('Titre de la page (onglet, fil d\'Ariane, menu)'),
    statut: z.enum(['brouillon', 'publie']).default('publie'),
    seo: z
      .object({
        titre: z.string().max(60),
        description: z.string().min(120, 'description SEO : 120 caractères minimum').max(160, 'description SEO : 160 caractères maximum'),
        noindex: z.boolean().default(false),
      })
      .strict()
      .optional()
      .describe('Obligatoire pour une page publiée'),
    ancres: z
      .array(z.string().min(3).max(60))
      .max(6)
      .optional()
      .describe("Expressions qui, dans le texte des autres pages, deviennent un lien vers celle-ci (ex. « pompe à chaleur de piscine »). Précises, 2 à 6 mots ; jamais « ici », « nos services »."),
    role: z
      .enum(['aimant', 'seo'])
      .optional()
      .describe("aimant : page que le visiteur a envie d'ouvrir (prix, guide, avant/après, aides), cible des liens d'engagement. seo : page d'entrée depuis Google, doit renvoyer vers une page aimant."),
    gabarit: z.enum(['standard', 'pleine-largeur', 'landing']).default('standard'),
    fil_ariane: z.boolean().optional(),
    brief: z.string().max(2000).optional().describe('Demande d\'origine, conservée pour retoucher la page'),
    sections: z.array(section).min(1).max(12),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.statut === 'publie' && !p.seo) ctx.addIssue({ code: 'custom', path: ['seo'], message: 'seo { titre, description } obligatoire pour une page publiée' });
    // Héros du socle, ou bloc d'ouverture propre au site nommé « hero-… » (src/site/blocs)
    const estHero = (b?: string) => b === 'hero' || /^hero-/.test(b ?? '');
    if (!estHero(p.sections[0]?.block)) ctx.addIssue({ code: 'custom', path: ['sections', 0, 'block'], message: 'la première section doit être un hero' });
    const heros = p.sections.filter((s) => estHero(s.block)).length;
    if (p.sections.filter((s) => s.block === 'formulaire').length > 1) ctx.addIssue({ code: 'custom', path: ['sections'], message: 'un seul formulaire par page' });
    if (heros > 1) ctx.addIssue({ code: 'custom', path: ['sections'], message: `un seul hero par page (${heros} trouvés)` });
  });

export type Page = z.infer<typeof page>;
