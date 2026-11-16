import ServiceCarte from './ServiceCarte.astro';
import RealisationCarte from './RealisationCarte.astro';
import ArticleCarte from './ArticleCarte.astro';
import ZonePastille from './ZonePastille.astro';
import EquipeCarte from './EquipeCarte.astro';
import RencontreLigne from './RencontreLigne.astro';
import ActualiteCarte from './ActualiteCarte.astro';
import AlbumCarte from './AlbumCarte.astro';
import FicheCarte from './FicheCarte.astro';
import type { NomCarte } from './cartes';
// Collections propres au site (1.46.0) : carte générée, ou carte du site (src/site/collections/rendus.ts)
import { collectionsSite } from '../site/collections';
import { rendusSite } from '../site/collections/rendus';

export const composantsCartes: Record<NomCarte, any> = {
  ...Object.fromEntries(collectionsSite.map((d) => [`${d.nom}-carte`, rendusSite[d.nom]?.Carte ?? FicheCarte])),
  'service-carte': ServiceCarte,
  'realisation-carte': RealisationCarte,
  'article-carte': ArticleCarte,
  'zone-pastille': ZonePastille,
  'equipe-carte': EquipeCarte,
  'rencontre-ligne': RencontreLigne,
  'actualite-carte': ActualiteCarte,
  'album-carte': AlbumCarte,
};
