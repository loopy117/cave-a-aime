import { z } from 'astro/zod';
import { image, lien, metier } from './communs';

/**
 * Témoignages de clients : data/temoignages.json (Réglages › Témoignages clients), affichés par le bloc « temoignages ».
 * Ce sont les mots du client, recueillis par l'entreprise (message, courriel, carnet, de vive voix) et publiés avec son
 * accord : jamais inventés ni réécrits (orthographe corrigée, coupes signalées par « […] », rien d'autre).
 * Un témoignage peut être rattaché à une réalisation (affiché sur sa page, avec un lien depuis les autres pages),
 * à un métier (affiché sur la page du service), ou à une page quelconque par un lien (référence, événement…).
 * Pas de données structurées Review : Google ignore les avis publiés par l'entreprise sur son propre site.
 */
const mois = z.string().regex(/^\d{4}-\d{2}$/, 'mois attendu : AAAA-MM');

export const temoignage = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{2,60}$/, 'identifiant : minuscules, chiffres, tirets').describe('Identifiant (ne pas changer)'),
    texte: z.string().min(20).max(700).describe('Les mots du client, tels quels (orthographe corrigée seulement ; « […] » pour une coupe)'),
    auteur: z.string().min(2).max(60).describe('Comme le client accepte d\'être nommé : « Claire M. », « Famille Roux », « La boulangerie Martin »'),
    precision: z.string().max(70).optional().describe('Qui il est : « Particulier à Manosque », « Gérante d\'un salon de coiffure », « Mariage, 80 couverts »'),
    date: mois.optional().describe('Mois du témoignage ou de la prestation'),
    note: z.number().int().min(1).max(5).optional().describe('Note sur 5, seulement si le client l\'a donnée'),
    realisation: z.string().regex(/^[a-z0-9-]{2,90}$/).optional().describe('Réalisation concernée (identifiant dans content/realisations/) : le témoignage s\'affiche sur sa page'),
    categorie: metier.optional().describe('Métier concerné : le témoignage s\'affiche sur la page du service'),
    lien: lien.optional().describe('Page liée, si ce n\'est pas une réalisation (référence, événement, page de service…)'),
    photo: image.optional().describe('Photo du client ou de la prestation, seulement avec son accord'),
    accord: z.literal(true, { message: 'publier un témoignage demande l\'accord du client' }).describe('Le client a accepté que ses mots soient publiés sous ce nom'),
    mis_en_avant: z.boolean().default(false).describe('Montré en priorité sur l\'accueil'),
  })
  .strict();

export const temoignages = z
  .object({ liste: z.array(temoignage).max(80).default([]) })
  .strict()
  .superRefine((v, ctx) => {
    const vus = new Set<string>();
    v.liste.forEach((t, i) => {
      if (vus.has(t.id)) ctx.addIssue({ code: 'custom', path: ['liste', i, 'id'], message: `identifiant « ${t.id} » déjà utilisé` });
      vus.add(t.id);
    });
  });

export type Temoignage = z.infer<typeof temoignage>;
