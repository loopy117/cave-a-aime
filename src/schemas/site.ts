import { z } from 'astro/zod';
import { cta } from './communs';

/**
 * Types schema.org proposés pour l'entreprise : sous-types de LocalBusiness (liste fermée, vérifiée).
 * Le plus précis possible ; plusieurs si l'activité est mixte (ex. électricien + climatisation).
 */
export const TYPES_ENTREPRISE = [
  'LocalBusiness',
  // Bâtiment et services à domicile
  'HomeAndConstructionBusiness', 'Electrician', 'HVACBusiness', 'Plumber', 'RoofingContractor', 'GeneralContractor',
  'HousePainter', 'Locksmith', 'MovingCompany',
  // Automobile
  'AutomotiveBusiness', 'AutoRepair', 'AutoBodyShop', 'AutoDealer',
  // Beauté, bien-être, sport
  'HealthAndBeautyBusiness', 'BeautySalon', 'HairSalon', 'NailSalon', 'DaySpa', 'TattooParlor', 'HealthClub',
  'SportsActivityLocation', 'SportsClub', 'ExerciseGym',
  // Santé
  'MedicalBusiness', 'Dentist', 'Physician', 'Optician', 'Pharmacy',
  // Services professionnels
  'ProfessionalService', 'LegalService', 'Attorney', 'Notary', 'FinancialService', 'AccountingService',
  'InsuranceAgency', 'RealEstateAgent', 'EmploymentAgency', 'TravelAgency', 'ChildCare',
  // Restauration, hébergement
  'FoodEstablishment', 'Restaurant', 'Bakery', 'CafeOrCoffeeShop', 'BarOrPub', 'LodgingBusiness', 'Hotel', 'BedAndBreakfast',
  // Commerce
  'Store', 'Florist', 'HardwareStore', 'ClothingStore', 'FurnitureStore', 'GardenStore',
] as const;

/** Modèles de site : ils décident des collections proposées dans l'éditeur (src/schemas/modeles.ts). */
export const MODELES_SITE = ['entreprise', 'club'] as const;

export const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'] as const;
const heure = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'heure attendue au format HH:MM (ex. 08:30)');

export const site = z
  .object({
    nom: z.string().min(2).max(80),
    modele: z.enum(MODELES_SITE).default('entreprise').describe('entreprise : services, réalisations, zones · club : équipes, rencontres, actualités, albums'),
    baseline: z.string().max(80),
    description: z.string().max(300),
    url: z.string().url(),
    types_schema: z
      .array(z.enum(TYPES_ENTREPRISE))
      .min(1)
      .max(3)
      .default(['LocalBusiness'])
      .describe("Type d'entreprise pour Google (schema.org) : le plus précis, plusieurs si l'activité est mixte"),
    telephone: z.string().max(30),
    email: z.union([z.string().email(), z.literal('')]).describe('Vide si le site n\'affiche pas d\'e-mail'),
    horaires: z.string().max(160).describe('Horaires affichés (texte libre)'),
    horaires_detail: z
      .array(z.object({ jours: z.array(z.enum(JOURS)).min(1), ouverture: heure, fermeture: heure }).strict())
      .max(14)
      .optional()
      .describe('Horaires lisibles par Google, déduits des horaires affichés'),
    adresse: z
      .object({ rue: z.string().max(120).optional(), ville: z.string().max(80), code_postal: z.string().max(10), pays: z.string().length(2).default('FR') })
      .strict(),
    afficher_adresse: z.boolean().default(false).describe('Rue affichée et déclarée à Google (sinon la ville seulement)'),
    siret: z.string().max(20).optional(),
    legal: z
      .object({
        raison_sociale: z.string().max(120).describe("Nom de l'entreprise, ou nom et prénom pour une entreprise individuelle"),
        forme: z.string().max(80).describe('Forme juridique : entreprise individuelle, micro-entreprise, EURL, SARL, SAS, SASU, association…'),
        capital: z.string().max(40).optional().describe('Capital social (sociétés), ex. « 1 000 € »'),
        immatriculation: z.string().max(80).optional().describe('RCS, RNE ou répertoire des métiers, ex. « RCS Aix-en-Provence 123 456 789 »'),
        tva_intra: z.string().max(20).optional(),
        adresse: z.string().max(160).optional().describe('Adresse du siège, si différente de l\'adresse du site ou non affichée'),
        directeur_publication: z.string().max(80),
        profession: z.string().max(400).optional().describe('Profession réglementée : titre, ordre ou organisme, règles applicables'),
        assurance: z.string().max(200).optional().describe('Assureur et couverture (ex. garantie décennale), zone couverte'),
        mediateur: z.object({ nom: z.string().max(120), url: z.string().url() }).strict().optional().describe('Médiateur de la consommation (clientèle de particuliers)'),
        credits_photos: z.string().max(300).optional(),
        accessibilite: z
          .object({
            taux: z.number().min(0).max(100).optional().describe("Taux de conformité RGAA de l'audit (%)"),
            date_audit: z.string().max(30).optional(),
            auditeur: z.string().max(120).optional(),
            date_declaration: z.string().max(30).optional(),
            non_conformites: z.array(z.string().max(300)).max(30).optional(),
          })
          .strict()
          .optional()
          .describe("Résultats de l'audit d'accessibilité (déclaration d'accessibilité)"),
      })
      .strict()
      .optional()
      .describe('Informations légales : mentions légales et politique de confidentialité générées automatiquement'),
    logo: z.string().regex(/^\/img\/[A-Za-z0-9/_.-]+\.(jpe?g|png|webp)$/i).optional(),
    zone_resume: z.string().max(80).describe('Zone affichée dans le bandeau du haut'),
    villes: z.array(z.string().min(2).max(60)).max(20).optional().describe("Villes desservies, de la plus importante à la moins importante (déclarées à Google)"),
    urgence: z.object({ actif: z.boolean(), texte: z.string().max(80) }).strict(),
    reseaux: z.array(z.string().url()).max(10).default([]),
    fiche_google: z.string().url().optional().describe('Fiche Google Business Profile (lien Google Maps)'),
    libelles: z
      .object({
        services: z.string().max(40).optional().describe('Surtitre des pages de service (défaut : « Nos métiers »)'),
        devis: z.string().max(40).optional().describe('Bouton des pages de service et de zone (défaut : « Demander un devis gratuit »)'),
        temoignages: z.string().max(60).optional().describe('Titre des témoignages sur les pages de service (défaut : « Ce qu\'en disent nos clients »)'),
        temoignage_realisation: z.string().max(60).optional().describe('Titre du témoignage sur la page d\'une réalisation (défaut : « L\'avis du client »)'),
        voir_realisation: z.string().max(40).optional().describe('Lien d\'un témoignage vers sa réalisation (défaut : « Voir la réalisation »)'),
      })
      .strict()
      .optional()
      .describe('Libellés propres au site sur les pages générées'),
    club: z
      .object({
        sport: z.string().max(40).describe('Sport, pour Google (ex. « Rugby »)'),
        stade: z.string().max(80).describe('Lieu des rencontres à domicile (ex. « stade Michel Bouchard »)'),
      })
      .strict()
      .optional()
      .describe('Club : sport et lieu des rencontres à domicile (modèle club)'),
    engagement: z
      .object({
        aimant_obligatoire: z.boolean().default(false).describe('true : le build échoue si une page indexable (hors pages aimants et exemptées) n\'a aucun lien vers une page aimant'),
        exemptees: z.array(z.string().regex(/^\//)).max(20).default(['/contact']).describe('Pages dispensées de ce lien (ex. /contact)'),
      })
      .strict()
      .optional()
      .describe('Garder le visiteur : obliger chaque page à proposer une page aimant (objectif : au moins deux pages vues par visite)'),
    ecoindex: z.boolean().default(true).describe('Note EcoIndex de chaque page (A ou B) dans le pied de page, mesurée à chaque mise en ligne ; false pour ne pas l\'afficher'),
    apparence: z
      .object({
        entete: z.enum(['classique', 'centre']).default('classique').describe('classique : logo à gauche, menu à droite · centre : logo centré, menu dessous (grand écran)'),
        entete_sur_photo: z.boolean().default(false).describe('En-tête transparent posé sur la photo quand la page commence par un héros « affiche » ou « plein-ecran » ; il redevient plein en descendant'),
        pied: z.enum(['bande', 'grand']).default('bande').describe('bande : pied de page compact · grand : téléphone en très grand, adresse et horaires jour par jour en colonnes'),
        surtitres: z.enum(['capitales', 'phrase']).default('capitales').describe('capitales : petites capitales espacées · phrase : italique en minuscules, dans la police des titres'),
        cartes: z.enum(['cadre', 'nu']).default('cadre').describe('cadre : éléments des grilles encadrés · nu : sans cadre, séparés par un filet'),
      })
      .strict()
      .optional()
      .describe('Allure du site : variantes d\'en-tête, de pied de page et de détails, pour que deux sites du même socle ne se ressemblent pas'),
    langues: z
      .object({
        autres: z.array(z.enum(['en', 'de', 'it', 'es', 'nl', 'pt'])).max(6).default([]).describe('Langues en plus du français : pages /en/…, /de/…, traduites par l\'IA à chaque mise en ligne de production (scripts/langues.mjs)'),
        exclure: z.array(z.string().regex(/^\/[a-z0-9/_-]*$/)).max(40).default([]).describe('Adresses (et tout ce qui est dessous) jamais traduites, ex. /actes'),
      })
      .strict()
      .optional()
      .describe('Site multilingue'),
    cta_defaut: z
      .object({ titre: z.string().max(90), texte: z.string().max(300), ctas: z.array(cta).min(1).max(2), note: z.string().max(80).optional() })
      .strict(),
  })
  .strict()
  .superRefine((s, ctx) => {
    if (s.afficher_adresse && !s.adresse.rue) ctx.addIssue({ code: 'custom', path: ['adresse', 'rue'], message: 'rue obligatoire si afficher_adresse vaut true' });
    (s.horaires_detail ?? []).forEach((h, i) => {
      if (h.fermeture <= h.ouverture) ctx.addIssue({ code: 'custom', path: ['horaires_detail', i, 'fermeture'], message: 'fermeture avant ouverture' });
    });
  });

export type Site = z.infer<typeof site>;
