import { z } from 'astro/zod';
import taxonomies from '../../data/taxonomies.json' with { type: 'json' };
import site from '../../data/site.json' with { type: 'json' };
import { image, metier } from './communs';
import { JOURS } from './site';

const tagsDe = (collection: keyof typeof taxonomies.tags) =>
  z.array(z.enum(Object.keys(taxonomies.tags[collection]) as [string, ...string[]])).max(6).default([]);

// Thèmes d'articles « À savoir » : définis par le site (data/taxonomies.json › themes).
// Sans thèmes définis, le champ accepte une chaîne libre (sites sans rubrique À savoir).
const themesArticles = ((taxonomies as any).themes ?? {}) as Record<string, string>;
const themeArticle = Object.keys(themesArticles).length
  ? z.enum(Object.keys(themesArticles) as [string, ...string[]])
  : z.string().max(40);

const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'heure attendue au format HH:MM (ex. 18:30)');

const seo = z
  .object({
    titre: z.string().max(60).optional(),
    description: z.string().min(120).max(160).optional(),
    noindex: z.boolean().default(false),
  })
  .strict()
  .default({ noindex: false });

/** Champs communs à toutes les collections (spec §5). */
const communs = {
  titre: z.string().min(3).max(90),
  statut: z.enum(['brouillon', 'publie', 'programme']).default('publie'),
  date: z.coerce.date().optional(),
  resume: z.string().max(300).optional(),
  image: image.optional(),
  categorie: metier,
  mis_en_avant: z.boolean().default(false),
  ordre: z.number().int().default(100),
  seo,
  ancres: z
    .array(z.string().min(3).max(60))
    .max(6)
    .optional()
    .describe("Expressions qui, dans le texte des autres pages, deviennent un lien vers celle-ci (ex. « pompe à chaleur de piscine »). Précises, 2 à 6 mots ; jamais « ici », « nos services »."),
  role: z
    .enum(['aimant', 'seo'])
    .optional()
    .describe("aimant : élément que le visiteur a envie d'ouvrir, cible des liens d'engagement. seo : page d'entrée depuis Google (les zones le sont par défaut)."),
  /** Sections facultatives ajoutées après le corps sur la page de détail (validées par le schéma de page). */
  sections: z.array(z.any()).optional(),
};

/** Collections du club (rencontres, actualités, albums) : le type d'équipe est facultatif, l'équipe suffit. */
const communsClub = { ...communs, categorie: metier.optional() };
const idEquipe = z.string().regex(/^[a-z0-9-]{2,60}$/).describe('Équipe (identifiant de la page équipe, ex. « moins-16-ans »)');

export const TYPES_RENCONTRES = { match: 'Match', plateau: 'Plateau', tournoi: 'Tournoi', amical: 'Match amical' } as const;

export const collectionSchemas = {
  services: z
    .object({
      ...communs,
      prestations: z
        .array(z.object({ label: z.string().max(45), badge: z.string().max(14).optional() }).strict())
        .min(1)
        .max(6)
        .describe('Prestations listées sur la carte et la page du service'),
      lien_label: z.string().max(40).default('Voir le détail').describe('Texte du lien de la carte'),
    })
    .strict()
    .describe('Un métier / une offre de service. Page de détail : /services/<id>.'),

  articles: z
    .object({
      ...communs,
      categorie: metier.optional(),
      date: z.coerce.date().describe('Date de mise à jour, affichée sur l\'article et la carte'),
      theme: themeArticle.optional().describe('Thème (data/taxonomies.json › themes) : sert aux filtres de la liste et à l\'encart « À lire aussi »'),
      auteur: z.string().min(3).max(60).optional().describe('Auteur, tel qu\'il veut être nommé : affiché sous le titre et déclaré dans les données structurées (sinon : l\'entreprise)'),
    })
    .strict()
    .describe('Un article « À savoir » (guide, dépannage, comparatif). Page de détail : /a-savoir/<id>.'),

  realisations: z
    .object({
      ...communs,
      date: z.coerce.date(),
      lieu: z.string().max(40).describe('Commune du chantier'),
      tags: tagsDe('realisations'),
      galerie: z.array(image).max(24).default([]),
    })
    .strict()
    .describe('Un chantier réalisé. Page de détail : /realisations/<id>.'),

  zones: z
    .object({
      ...communs,
      ville: z.string().max(40),
    })
    .strict()
    .describe("Une page locale « métier + ville » pour le référencement. Page de détail : /zones/<id>."),

  equipes: z
    .object({
      ...communs,
      nom_court: z.string().min(2).max(30).describe('Nom court affiché dans les listes et le planning (ex. « −12 ans », « Baby rugby »)'),
      ages: z.string().max(60).optional().describe('Âges ou années de naissance, seulement si le club les a donnés'),
      championnat: z.string().max(80).optional().describe('Compétition disputée (équipes en championnat)'),
      creneaux: z
        .array(
          z
            .object({
              jour: z.enum(JOURS),
              debut: heure,
              fin: heure,
              lieu: z.string().max(60).optional().describe('Si différent du lieu habituel'),
            })
            .strict()
            .refine((c) => c.fin > c.debut, { message: 'fin avant le début', path: ['fin'] }),
        )
        .max(6)
        .default([])
        .describe('Entraînements de la semaine'),
      encadrants: z
        .array(z.object({ nom: z.string().min(2).max(60), role: z.string().max(40).optional() }).strict())
        .max(6)
        .default([])
        .describe('Éducateurs et entraîneurs : nom affiché seulement avec leur accord'),
    })
    .strict()
    .describe("Une équipe ou une catégorie d'âge, avec ses créneaux. Le type (école, compétition, loisir) est la catégorie. Page de détail : /equipes/<id>."),

  rencontres: z
    .object({
      ...communsClub,
      equipe: idEquipe,
      type: z.enum(Object.keys(TYPES_RENCONTRES) as [string, ...string[]]).default('match').describe('Plateau et tournoi : école de rugby, sans score officiel'),
      date: z.coerce.date().describe('Jour de la rencontre'),
      heure: heure.optional().describe('Coup d\'envoi ou début (HH:MM)'),
      adversaire: z.string().max(80).optional().describe('Club adverse (match) ; vide pour un plateau ou un tournoi'),
      domicile: z.boolean().default(true).describe('À domicile (stade du club) ou à l\'extérieur'),
      lieu: z.string().max(80).optional().describe('Lieu, si ce n\'est pas le stade du club'),
      competition: z.string().max(80).optional().describe('Ex. « Championnat territorial −16 ans, poule 2 »'),
      score_pour: z.number().int().min(0).max(300).optional().describe('Points marqués par le club'),
      score_contre: z.number().int().min(0).max(300).optional().describe('Points de l\'adversaire'),
      annulee: z.boolean().default(false).describe('Rencontre annulée ou reportée'),
    })
    .strict()
    .refine((r) => (r.score_pour == null) === (r.score_contre == null), { message: 'indiquer les deux scores, ou aucun', path: ['score_contre'] })
    .describe('Une rencontre (match, plateau, tournoi) d\'une équipe. Le compte rendu va dans le corps. Page : /rencontres/<id>.'),

  actualites: z
    .object({
      ...communsClub,
      date: z.coerce.date(),
      equipe: idEquipe.optional(),
    })
    .strict()
    .describe('Une actualité du club, éventuellement d\'une équipe. Page : /actualites/<id>.'),

  albums: z
    .object({
      ...communsClub,
      date: z.coerce.date().describe('Date de l\'événement photographié'),
      equipe: idEquipe.optional(),
      photos: z
        .array(image.extend({ legende: z.string().max(200).optional() }))
        .min(1)
        .max(80)
        .describe('Photos (80 au plus). Texte alternatif vide : « titre de l\'album, photo n ».'),
      credit: z.string().max(80).default(`© ${(site as any).nom}`),
      autorisations: z.boolean().default(false).describe('Droit à l\'image vérifié : aucun licencié ayant refusé la diffusion n\'apparaît. Obligatoire pour publier.'),
    })
    .strict()
    .describe('Un album photo (rencontre, tournoi, fête du club). Page : /albums/<id>.'),
} as const;

export type NomCollection = keyof typeof collectionSchemas;
export const nomsCollections = Object.keys(collectionSchemas) as NomCollection[];
