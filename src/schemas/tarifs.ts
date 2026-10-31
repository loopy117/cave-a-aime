/**
 * data/tarifs.json : grille de prix du site, en un seul endroit (bloc `tarifs`, contexte de l'assistant).
 * Facultatif : seuls les sites qui affichent des prix en ont un. Montants HT, en euros, sans symbole.
 */
import { z } from 'astro/zod';
import { icone } from './communs';

const montant = z.number().nonnegative().max(1_000_000);

export const tarifs = z
  .object({
    mention: z.string().max(80).default('Prix hors taxes.').describe('Ligne discrète sous la grille'),
    taxes: z.string().max(12).default('HT').describe('Mention après chaque prix : « HT », « TTC », ou vide (TVA non applicable, le prix affiché est le prix payé)'),
    creation: z
      .object({
        titre: z.string().max(60).default('Création de votre site'),
        note_engagement: z.string().max(80).optional().describe('Sous le sélecteur de durée (ex. « L\'abonnement mensuel reste identique. »)'),
        texte: z.string().max(220).optional(),
        a_partir_de: z.boolean().default(true).describe('Affiche « à partir de » devant le prix'),
        prix: montant,
        paiement_3_fois: z.boolean().default(false),
        promesse: z.string().max(160).optional().describe('Phrase mise en avant au-dessus du choix (ex. « La même qualité, les mêmes performances, le même soin. Seule l\'étendue de votre site fixe le prix de création. »)'),
        niveaux_titre: z.string().max(40).default('Votre site').describe('Intitulé du choix des niveaux'),
        niveaux: z
          .array(
            z
              .object({
                nom: z.string().min(3).max(50).describe('Le besoin, à la première personne (ex. « Présenter mon entreprise »)'),
                description: z.string().max(160).optional().describe('Ce que comprend ce niveau, en une phrase'),
                prix: montant.describe('Prix de la création sur la première durée (sans remise)'),
                a_partir_de: z.boolean().default(false).describe('« à partir de » devant le prix (niveau sur mesure)'),
                note: z.string().max(80).optional().describe('Sous le prix (ex. « Prix fixé après l\'audit gratuit »)'),
                inclus: z.array(z.string().min(3).max(80)).max(5).default([]).describe('Ce que ce niveau ajoute, en lignes courtes (étendue : pages, reprise de l\'ancien site, langues…). Avec `commun`, affiché dans la carte du niveau'),
              })
              .strict(),
          )
          .max(4)
          .default([])
          .describe('Niveaux de création selon le besoin ; le prix de chaque durée est calculé à partir de la remise. Vide = un seul prix (champ prix)'),
        commun_titre: z.string().max(60).default('Pour chaque site, quel que soit le niveau').describe('Titre de la bande commune'),
        commun: z
          .array(z.string().min(3).max(70))
          .max(6)
          .default([])
          .describe('Ce qui est identique pour tous les niveaux (qualité, performances, design sur mesure…) : une bande au-dessus des niveaux, qui montre que seule l\'étendue change. Avec `commun` ou `inclus`, le prix s\'affiche dans chaque carte de niveau (une seule durée d\'engagement)'),
        premiere_annee: z.boolean().default(false).describe('Sous chaque formule : coût de la première année (création du niveau choisi + 12 mensualités)'),
        arrondi: z.enum(['aucun', 'psychologique']).default('aucun').describe('psychologique : prix après remise arrondi au prix rond inférieur (…90 ou …99), la remise réelle n\'est jamais inférieure à celle annoncée'),
        engagements: z
          .array(
            z
              .object({
                mois: z.number().int().min(1).max(60),
                remise: z.number().min(0).max(90).default(0).describe('Remise sur la création, en %'),
                prix: montant.optional().describe('Prix de la création pour cette durée (ex. 799) : remplace la remise, le pourcentage affiché est calculé et arrondi'),
              })
              .strict(),
          )
          .max(4)
          .default([])
          .describe('Durées proposées ; la première est sélectionnée par défaut. Vide = pas de sélecteur'),
      })
      .strict()
      .optional(),
    formules: z
      .array(
        z
          .object({
            nom: z.string().max(30),
            icone: icone.optional(),
            prix_mois: montant,
            accroche: z.string().max(140).optional(),
            inclus_intro: z.string().max(60).optional().describe('Ligne avant la liste (ex. « Tout Essentiel, plus : »)'),
            inclus: z.array(z.string().max(90)).min(1).max(10),
            demandes: z.string().max(80).optional().describe('Ligne sous la liste (ex. « Jusqu\'à 2 demandes de modification par mois »)'),
            bouton: z.string().max(40).optional().describe('Texte du bouton (défaut : « Choisir <nom> »)'),
            mis_en_avant: z.boolean().default(false),
            badge: z.string().max(24).optional(),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    options_titre: z.string().max(60).default('Les options, à la carte'),
    options_intro: z.string().max(120).optional(),
    options: z
      .array(
        z
          .object({
            nom: z.string().max(40),
            icone: icone.optional(),
            texte: z.string().max(160).optional(),
            prix: z.string().max(30).optional().describe('Texte libre (« 19 € HT / mois », « sur devis ») ; vide = non affiché'),
            bientot: z.boolean().default(false).describe('Option pas encore disponible : affichée « Bientôt »'),
          })
          .strict(),
      )
      .max(8)
      .default([]),
  })
  .strict()
  .superRefine((t, ctx) => {
    if (t.formules.filter((f) => f.mis_en_avant).length > 1) ctx.addIssue({ code: 'custom', path: ['formules'], message: 'une seule formule mise en avant' });
    const mois = t.creation?.engagements.map((e) => e.mois) ?? [];
    if (t.creation?.niveaux.length === 1) ctx.addIssue({ code: 'custom', path: ['creation', 'niveaux'], message: 'au moins deux niveaux (ou aucun)' });
    if (t.creation?.niveaux.length && t.creation.engagements.some((e) => e.prix != null))
      ctx.addIssue({ code: 'custom', path: ['creation', 'engagements'], message: 'avec des niveaux, chaque durée donne une remise (le prix est calculé pour chaque niveau), pas un prix' });
    const comparatif = !!t.creation && (t.creation.commun.length > 0 || t.creation.niveaux.some((n) => n.inclus.length > 0));
    if (comparatif && (t.creation?.niveaux.length ?? 0) < 2) ctx.addIssue({ code: 'custom', path: ['creation', 'commun'], message: 'bande commune et lignes « inclus » : avec des niveaux seulement' });
    if (comparatif && (t.creation?.engagements.length ?? 0) > 1) ctx.addIssue({ code: 'custom', path: ['creation', 'engagements'], message: 'bande commune et lignes « inclus » : une seule durée d\'engagement (le prix s\'affiche dans chaque carte)' });
    if (new Set(mois).size !== mois.length) ctx.addIssue({ code: 'custom', path: ['creation', 'engagements'], message: 'durées en double' });
  });

export type Tarifs = z.infer<typeof tarifs>;

/** Prix rond inférieur ou égal : le plus grand montant en …90 ou …99 (804 → 799, 1 393 → 1 390, 2 093 → 2 090). */
export function arrondiPsychologique(x: number): number {
  const n = Math.floor(x);
  if (n < 90) return n;
  const en99 = Math.floor((n - 99) / 100) * 100 + 99;
  const en90 = Math.floor((n - 90) / 100) * 100 + 90;
  return Math.max(en99, en90);
}

/** Prix de la création pour une durée : prix fixé, sinon prix de base moins la remise (arrondi psychologique si demandé). */
export function prixApresRemise(base: number, e: { remise: number; prix?: number }, arrondi: 'aucun' | 'psychologique'): number {
  if (e.prix != null) return e.prix;
  if (!e.remise) return base;
  const brut = base * (1 - e.remise / 100);
  return arrondi === 'psychologique' ? arrondiPsychologique(brut) : brut;
}

/** Montant formaté à la française : 1 490 €, 348 € (arrondi à l'euro). */
export const euros = (n: number) => `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;
