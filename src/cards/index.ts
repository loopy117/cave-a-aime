import ServiceCarte from './ServiceCarte.astro';
import RealisationCarte from './RealisationCarte.astro';
import ArticleCarte from './ArticleCarte.astro';
import ZonePastille from './ZonePastille.astro';
import EquipeCarte from './EquipeCarte.astro';
import RencontreLigne from './RencontreLigne.astro';
import ActualiteCarte from './ActualiteCarte.astro';
import AlbumCarte from './AlbumCarte.astro';
import type { NomCarte } from './cartes';

export const composantsCartes: Record<NomCarte, any> = {
  'service-carte': ServiceCarte,
  'realisation-carte': RealisationCarte,
  'article-carte': ArticleCarte,
  'zone-pastille': ZonePastille,
  'equipe-carte': EquipeCarte,
  'rencontre-ligne': RencontreLigne,
  'actualite-carte': ActualiteCarte,
  'album-carte': AlbumCarte,
};
