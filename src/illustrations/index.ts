import Demande from './Demande.astro';
import Bilan from './Bilan.astro';
import TableauDemandes from './TableauDemandes.astro';
import PageSpeed from './PageSpeed.astro';
import type { nomsIllustrations } from './noms';

export const composantsIllustrations: Record<(typeof nomsIllustrations)[number], any> = {
  demande: Demande, bilan: Bilan, 'tableau-demandes': TableauDemandes, pagespeed: PageSpeed,
};
