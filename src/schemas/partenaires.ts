import { z } from 'astro/zod';
import { lien } from './communs';

/**
 * data/partenaires.json : partenaires et sponsors du site, en un seul endroit (bloc `partenaires`,
 * Decap « Réglages › Partenaires », contexte de l'assistant).
 * Générique : club (sponsors du maillot), mairie (partenaires institutionnels), artisan (fabricants, réseaux).
 */
export const NIVEAUX_PARTENAIRES = ['principal', 'officiel', 'soutien'] as const;

export const LIBELLES_PARTENAIRES: Record<(typeof NIVEAUX_PARTENAIRES)[number], string> = {
  principal: 'Partenaire principal',
  officiel: 'Partenaires officiels',
  soutien: 'Ils nous soutiennent aussi',
};

export const partenaire = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{2,40}$/, 'identifiant : minuscules, chiffres, tirets'),
    nom: z.string().min(2).max(60),
    niveau: z.enum(NIVEAUX_PARTENAIRES).describe('principal : grande carte ; officiel : logo moyen ; soutien : petit logo'),
    logo: z
      .string()
      .regex(/^\/img\/partenaires\/[A-Za-z0-9._-]+\.(png|webp|jpe?g)$/i, 'logo attendu dans media/partenaires/ (png de préférence, fond transparent)')
      .optional()
      .describe('Sans logo, le nom est affiché à la place'),
    // https uniquement : ni javascript:, ni http en clair
    url: z.string().max(200).regex(/^https:\/\/[^\s"'<>]+$/, 'adresse https:// attendue').optional().describe('Site du partenaire (lien marqué « sponsorisé » pour Google)'),
    texte: z.string().max(140).optional().describe('Une phrase : métier, commune, lien avec le club (cartes « principal » seulement)'),
    actif: z.boolean().default(true).describe('Décocher pour masquer sans supprimer (fin de contrat, saison passée)'),
  })
  .strict();

export const partenaires = z
  .object({
    libelles: z
      .object({ principal: z.string().max(40), officiel: z.string().max(40), soutien: z.string().max(40) })
      .partial()
      .strict()
      .optional()
      .describe('Titres des niveaux, si les libellés par défaut ne conviennent pas'),
    devenir: lien.optional().describe('Case « Devenir partenaire » en fin de liste (ex. vers le formulaire de contact)'),
    liste: z.array(partenaire).max(60),
  })
  .strict()
  .superRefine((d, ctx) => {
    const ids = d.liste.map((p) => p.id);
    ids.forEach((id, i) => { if (ids.indexOf(id) !== i) ctx.addIssue({ code: 'custom', path: ['liste', i, 'id'], message: `identifiant « ${id} » en double` }); });
  });

export type Partenaire = z.infer<typeof partenaire>;
export type Partenaires = z.infer<typeof partenaires>;
export type NiveauPartenaire = (typeof NIVEAUX_PARTENAIRES)[number];
