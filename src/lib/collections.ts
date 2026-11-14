/**
 * Réglages de routage et d'affichage des collections (spec §5).
 * Partie « présentation » : l'IA ne modifie pas ce fichier.
 */
import type { NomCollection } from '../schemas/collections';
import site from '../../data/site.json' with { type: 'json' };
import { collectionsSite } from '../site/collections';

export interface ReglagesCollection {
  base: string;               // préfixe d'URL
  libelle: string;            // nom affiché (menu, fil d'Ariane, archive)
  detail: boolean;            // une page par élément
  archive?: {
    titre: string;
    intro?: string;
    carte: string;
    affichage: 'grid' | 'slider' | 'liste' | 'masonry' | 'flux';
    options?: Record<string, unknown>;
    ordre: string | string[];
    parPage: number;
    parCategorie: boolean;    // pages /<base>/categorie/<slug>
    /** Collection propre au site : liste filtrable (FicheListe) au lieu de la grille paginée. */
    fiches?: boolean;
  };
}

const reglagesSocle: Record<string, ReglagesCollection> = {
  services: { base: '/services', libelle: 'Services', detail: true },
  // Articles « À savoir » : pages de détail /a-savoir/<id>, sans archive
  // (la page /a-savoir reste une page « aimant » maison, qui liste via le bloc « boucle »).
  articles: { base: '/a-savoir', libelle: 'À savoir', detail: true },
  realisations: {
    base: '/realisations',
    libelle: 'Réalisations',
    detail: true,
    archive: {
      titre: 'Nos réalisations',
      intro: 'Chantiers de climatisation, pompe à chaleur et électricité autour de Pertuis et dans le Pays d\'Aix.',
      carte: 'realisation-carte',
      affichage: 'grid',
      options: { colonnes: 3 },
      ordre: 'date desc',
      parPage: 12,
      parCategorie: true,
    },
  },
  equipes: {
    base: '/equipes',
    libelle: 'Équipes',
    detail: true,
    archive: {
      titre: 'Nos équipes',
      intro: 'Toutes les catégories du club, du baby rugby au rugby loisir, avec leurs créneaux d\'entraînement.',
      carte: 'equipe-carte',
      affichage: 'grid',
      options: { colonnes: 3 },
      ordre: 'ordre asc',
      parPage: 30,
      parCategorie: false,
    },
  },
  rencontres: { base: '/rencontres', libelle: 'Rencontres', detail: true },
  actualites: {
    base: '/actualites',
    libelle: 'Actualités',
    detail: true,
    archive: { titre: 'Actualités du club', intro: `Les nouvelles de ${(site as any).nom} : rencontres, tournois, vie du club.`, carte: 'actualite-carte', affichage: 'grid', options: { colonnes: 3 }, ordre: 'date desc', parPage: 12, parCategorie: false },
  },
  albums: {
    base: '/albums',
    libelle: 'Albums photo',
    detail: true,
    archive: { titre: 'Albums photo', intro: 'Les photos des rencontres, des tournois et de la vie du club.', carte: 'album-carte', affichage: 'grid', options: { colonnes: 3 }, ordre: 'date desc', parPage: 12, parCategorie: false },
  },
  zones: {
    base: '/zones',
    libelle: "Zones d'intervention",
    detail: true,
    archive: {
      titre: "Zones d'intervention",
      intro: "Autour de Pertuis, jusqu'au Pays d'Aix.",
      carte: 'zone-pastille',
      affichage: 'flux',
      ordre: 'ordre asc',
      parPage: 60,
      parCategorie: false,
    },
  },
};

// Collections propres au site (1.46.0) : une page par fiche et une liste filtrable, sans pagination.
export const reglages: Record<NomCollection, ReglagesCollection> = {
  ...reglagesSocle,
  ...Object.fromEntries(collectionsSite.map((d) => [d.nom, {
    base: d.base,
    libelle: d.libelle,
    detail: true,
    archive: {
      titre: d.rendu?.titre_liste ?? d.libelle,
      intro: d.rendu?.intro_liste,
      carte: `${d.nom}-carte`,
      affichage: 'grid',
      ordre: d.rendu?.ordre ?? 'titre asc',
      parPage: 100000,
      parCategorie: false,
      fiches: true,
    },
  } satisfies ReglagesCollection])),
};
