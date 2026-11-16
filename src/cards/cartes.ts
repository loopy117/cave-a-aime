/** Registre des cartes : quelle carte sait afficher quelle collection (spec §3). */
import type { NomCollection } from '../schemas/collections';
import { collectionsSite } from '../site/collections';

const cartesSocle = {
  'service-carte': { collection: 'services', description: 'Grande carte : image, trait de couleur du métier, titre, résumé, prestations, lien.' },
  'realisation-carte': { collection: 'realisations', description: 'Image, commune en surtitre, titre du chantier.' },
  'article-carte': { collection: 'articles', description: 'Article « À savoir » : visuel facultatif, thème et date, titre, résumé.' },
  'equipe-carte': { collection: 'equipes', description: 'Type d\'équipe en badge, nom, âges, créneaux de la semaine, lien vers la page de l\'équipe.' },
  'rencontre-ligne': { collection: 'rencontres', description: 'Date, équipe, intitulé (domicile – extérieur), lieu, score et issue, ou « À venir ». Avec la disposition « liste ».' },
  'actualite-carte': { collection: 'actualites', description: 'Image, date, titre, résumé.' },
  'album-carte': { collection: 'albums', description: 'Photo de couverture, nombre de photos, date, titre.' },
  'zone-pastille': { collection: 'zones', description: 'Pastille cliquable colorée selon le métier. À utiliser avec la disposition « flux ».' },
} as const satisfies Record<string, { collection: NomCollection; description: string }>;

// Collections propres au site (1.46.0) : une carte générée par collection, « <nom>-carte »
export const cartes = {
  ...cartesSocle,
  ...Object.fromEntries(collectionsSite.map((d) => [`${d.nom}-carte`, { collection: d.nom, description: `Fiche « ${d.element} » : image, ${[...(d.rendu?.carte?.surtitre ?? []), 'titre', ...(d.rendu?.carte?.details ?? [])].join(', ')}${d.prix ? ', prix' : ''}.` }])),
} as typeof cartesSocle & Record<string, { collection: NomCollection; description: string }>;

export type NomCarte = keyof typeof cartesSocle | (string & {});
export const nomsCartes = Object.keys(cartes) as NomCarte[];
