/**
 * data/carte-restaurant.json : la carte d'un restaurant (bloc `carte-restaurant`), en un seul endroit.
 * Un seul modèle pour toutes les cartes : des rubriques (Entrées, Plats, Pizzas, Vins… ou une seule sans titre),
 * des plats (prix unique ou plusieurs prix : verre / bouteille), des menus (permanents, du jour, d'un événement).
 * Les 14 allergènes réglementaires (règlement UE 1169/2011, annexe II) se cochent plat par plat.
 * Prix TTC en euros, sans symbole. Le restaurateur n'écrit jamais ce fichier à la main : l'assistant le remplit
 * à partir d'une photo, d'un PDF ou d'un message, puis l'éditeur (Réglages › Carte du restaurant) sert aux retouches.
 */
import { z } from 'astro/zod';
import { image } from './communs';

export const ALLERGENES = [
  'gluten', 'crustaces', 'oeufs', 'poissons', 'arachides', 'soja', 'lait',
  'fruits-a-coque', 'celeri', 'moutarde', 'sesame', 'sulfites', 'lupin', 'mollusques',
] as const;
export type Allergene = (typeof ALLERGENES)[number];

/** Libellés affichés (liste réglementaire). */
export const LIBELLES_ALLERGENES: Record<Allergene, string> = {
  gluten: 'Gluten', crustaces: 'Crustacés', oeufs: 'Œufs', poissons: 'Poissons', arachides: 'Arachides', soja: 'Soja',
  lait: 'Lait', 'fruits-a-coque': 'Fruits à coque', celeri: 'Céleri', moutarde: 'Moutarde', sesame: 'Sésame',
  sulfites: 'Sulfites', lupin: 'Lupin', mollusques: 'Mollusques',
};

export const REGIMES = ['vegetarien', 'vegan', 'sans-gluten'] as const;
export const LIBELLES_REGIMES: Record<(typeof REGIMES)[number], string> = { vegetarien: 'Végétarien', vegan: 'Vegan', 'sans-gluten': 'Sans gluten' };
/** schema.org/RestrictedDiet (données structurées). */
export const REGIMES_SCHEMA: Record<(typeof REGIMES)[number], string> = {
  vegetarien: 'https://schema.org/VegetarianDiet', vegan: 'https://schema.org/VeganDiet', 'sans-gluten': 'https://schema.org/GlutenFreeDiet',
};

const prix = z.number().nonnegative().max(100_000);
const jourIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue au format AAAA-MM-JJ');
const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;

const plat = z
  .object({
    nom: z.string().min(1).max(80),
    description: z.string().max(240).optional(),
    prix: prix.optional().describe('Prix TTC en euros (vide si prix selon la taille : voir « variantes »)'),
    variantes: z
      .array(z.object({ libelle: z.string().min(1).max(24).describe('Ex. « verre 12 cl », « bouteille », « grande »'), prix }).strict())
      .max(4)
      .optional()
      .describe('Plusieurs prix pour le même plat ou la même boisson'),
    allergenes: z.array(z.enum(ALLERGENES)).max(14).optional().describe('Allergènes présents (liste réglementaire)'),
    sans_allergene: z.boolean().optional().describe('Coché : aucun des 14 allergènes (sinon, cocher ceux qui sont présents)'),
    regimes: z.array(z.enum(REGIMES)).max(3).optional(),
    fait_maison: z.boolean().optional(),
    nouveau: z.boolean().optional(),
    epuise: z.boolean().optional().describe('Affiché barré « Épuisé » (pour le service en cours)'),
    photo: image.optional(),
  })
  .strict()
  .refine((p) => !(p.prix !== undefined && p.variantes?.length), { message: 'un prix unique ou des variantes, pas les deux', path: ['variantes'] })
  .refine((p) => !(p.sans_allergene && p.allergenes?.length), { message: '« aucun allergène » coché alors que des allergènes sont indiqués', path: ['sans_allergene'] });

const menu = z
  .object({
    titre: z.string().min(1).max(60),
    type: z.enum(['permanent', 'du-jour', 'evenement']).default('permanent')
      .describe('permanent : toujours affiché · du-jour : affiché le jour de « date » seulement · evenement : du « du » au « au »'),
    prix: prix.optional(),
    description: z.string().max(240).optional().describe('Ex. « Entrée, plat, dessert », « Accords mets et vins : +35 € »'),
    quand: z.string().max(80).optional().describe('Ex. « Le midi en semaine », « Le 14 février au soir »'),
    jours: z.array(z.enum(JOURS)).max(7).optional().describe('Jours où le menu est servi (menu permanent)'),
    date: jourIso.optional().describe('Menu du jour : la date du jour concerné'),
    du: jourIso.optional().describe('Événement : premier jour d\'affichage'),
    au: jourIso.optional().describe('Événement : dernier jour (le menu disparaît le lendemain)'),
    composition: z
      .array(z.object({ titre: z.string().max(40).optional().describe('Ex. « Entrée au choix »'), choix: z.array(z.string().min(1).max(120)).min(1).max(8) }).strict())
      .max(8)
      .optional(),
  })
  .strict()
  .refine((m) => m.type !== 'du-jour' || !!m.date, { message: 'menu du jour : date obligatoire', path: ['date'] })
  .refine((m) => m.type !== 'evenement' || !!m.au, { message: 'menu d\'événement : date de fin (« au ») obligatoire', path: ['au'] })
  .refine((m) => !m.du || !m.au || m.du <= m.au, { message: 'date de début après la date de fin', path: ['du'] });

export const carteRestaurant = z
  .object({
    titre: z.string().max(60).default('La carte').describe('Nom de la carte dans les données structurées (ex. « Carte d\'été »)'),
    mention: z.string().max(160).default('Prix nets en euros, service compris.'),
    mention_allergenes: z.string().max(240).default('Les allergènes présents sont indiqués sous chaque plat. Pour toute question, notre équipe vous renseigne.'),
    menus: z.array(menu).max(12).default([]),
    rubriques: z
      .array(z.object({
        titre: z.string().max(40).optional().describe('Ex. « Entrées », « Pizzas », « Vins rouges » ; vide pour une carte sans rubrique'),
        note: z.string().max(160).optional().describe('Ex. « Servies avec frites ou salade »'),
        plats: z.array(plat).min(1).max(60),
      }).strict())
      .max(20)
      .default([]),
  })
  .strict()
  .refine((c) => c.menus.length + c.rubriques.length > 0, { message: 'carte vide : au moins un menu ou une rubrique' });

export type CarteRestaurant = z.infer<typeof carteRestaurant>;
export type Plat = z.infer<typeof plat>;
export type Menu = z.infer<typeof menu>;

/** Plat dont les allergènes ne sont pas renseignés (ni présents cochés, ni « aucun »). */
export const allergenesManquants = (p: Plat) => !p.sans_allergene && !(p.allergenes?.length);

/** Menu visible le jour donné (AAAA-MM-JJ, heure de Paris). */
export function menuVisible(m: Menu, jour: string): boolean {
  if (m.type === 'du-jour') return m.date === jour;
  if (m.type === 'evenement') return (!m.du || m.du <= jour) && (!m.au || jour <= m.au);
  return true;
}

/** Aujourd'hui à Paris, au format AAAA-MM-JJ. */
export const aujourdhuiParis = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

export const prixFr = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }) + ' €';
