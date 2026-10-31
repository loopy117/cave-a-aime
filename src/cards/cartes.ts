/** Registre des cartes : quelle carte sait afficher quelle collection (spec §3). */
import type { NomCollection } from '../schemas/collections';

export const cartes = {
  'service-carte': { collection: 'services', description: 'Grande carte : image, trait de couleur du métier, titre, résumé, prestations, lien.' },
  'realisation-carte': { collection: 'realisations', description: 'Image, commune en surtitre, titre du chantier.' },
  'article-carte': { collection: 'articles', description: 'Article « À savoir » : visuel facultatif, thème et date, titre, résumé.' },
  'equipe-carte': { collection: 'equipes', description: 'Type d\'équipe en badge, nom, âges, créneaux de la semaine, lien vers la page de l\'équipe.' },
  'rencontre-ligne': { collection: 'rencontres', description: 'Date, équipe, intitulé (domicile – extérieur), lieu, score et issue, ou « À venir ». Avec la disposition « liste ».' },
  'actualite-carte': { collection: 'actualites', description: 'Image, date, titre, résumé.' },
  'album-carte': { collection: 'albums', description: 'Photo de couverture, nombre de photos, date, titre.' },
  'zone-pastille': { collection: 'zones', description: 'Pastille cliquable colorée selon le métier. À utiliser avec la disposition « flux ».' },
} as const satisfies Record<string, { collection: NomCollection; description: string }>;

export type NomCarte = keyof typeof cartes;
export const nomsCartes = Object.keys(cartes) as NomCarte[];
