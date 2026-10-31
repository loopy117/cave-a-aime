import { z } from 'astro/zod';
import { image, icone } from './communs';

/**
 * Labels, qualifications, assurances et agréments de l'entreprise : data/labels.json (Réglages › Labels et certifications).
 * Affichés par le bloc « labels ». Un label dont la date de fin est passée disparaît du site à la reconstruction suivante
 * (chaque nuit) ; l'espace client prévient 60 jours avant (copie publiée dans xmedia-ai/contexte/labels.json).
 */
export const TYPES_LABELS = {
  qualification: 'Qualification',
  label: 'Label',
  assurance: 'Assurance',
  agrement: 'Agrément',
  diplome: 'Diplôme',
} as const;

const dateIso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date attendue : AAAA-MM-JJ');

export const labelEntreprise = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{2,40}$/, 'identifiant : minuscules, chiffres, tirets').describe('Identifiant (ne pas changer)'),
    nom: z.string().min(2).max(80).describe('Ex. « QualiPAC », « Garantie décennale »'),
    type: z.enum(Object.keys(TYPES_LABELS) as [string, ...string[]]).describe('Nature'),
    organisme: z.string().max(80).optional().describe('Ex. Qualit\'EnR, nom de l\'assureur'),
    numero: z.string().max(40).optional().describe('Numéro de certificat ou de contrat (facultatif)'),
    fin: dateIso.optional().describe('Date de fin de validité : le label disparaît du site après cette date, et vous êtes prévenu 60 jours avant'),
    texte: z.string().max(200).optional().describe('Ce que ça garantit au client, en une phrase'),
    icone: icone.optional().describe('Icône si pas de logo'),
    logo: image.optional().describe('Logo officiel (avec le droit de l\'utiliser)'),
    document: z.string().regex(/^\/img\/[A-Za-z0-9/_.-]+\.pdf$/i, 'chemin attendu : /img/<dossier>/<nom>.pdf').optional().describe('Attestation en PDF (téléchargeable)'),
    verification: z.string().url().startsWith('https://').optional().describe('Page officielle où vérifier (annuaire de l\'organisme)'),
    afficher_fin: z.boolean().default(true).describe('Afficher « valable jusqu\'au … » sur le site'),
  })
  .strict();

export const labelsFichier = z
  .object({ labels: z.array(labelEntreprise).max(20) })
  .strict()
  .superRefine((f, ctx) => {
    const ids = f.labels.map((l) => l.id);
    ids.forEach((id, i) => { if (ids.indexOf(id) !== i) ctx.addIssue({ code: 'custom', path: ['labels', i, 'id'], message: `identifiant « ${id} » en double` }); });
  });

export type LabelEntreprise = z.infer<typeof labelEntreprise>;

/** Labels valides à une date (sans date de fin = toujours valide). */
export const labelsValides = (labels: LabelEntreprise[], jour = new Date().toISOString().slice(0, 10)) =>
  labels.filter((l) => !l.fin || l.fin >= jour);
