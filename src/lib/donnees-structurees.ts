/**
 * Données structurées schema.org (JSON-LD), un graphe par page :
 *  - l'entreprise (sous-type de LocalBusiness), identifiant @id commun à toutes les pages ;
 *  - le site (WebSite) et la page (WebPage, ContactPage, AboutPage, CollectionPage), publiés par l'entreprise ;
 *  - un Service par page de service et par page de zone, rattaché à l'entreprise ;
 *  - un Article par article « À savoir » (BlogPosting par actualité), publié par l'entreprise.
 * Tout vient de data/site.json et du contenu : rien n'est déclaré qui ne soit visible sur le site.
 */
import type { Site } from '../schemas/site';

const JOURS_EN: Record<string, string> = { lundi: 'Monday', mardi: 'Tuesday', mercredi: 'Wednesday', jeudi: 'Thursday', vendredi: 'Friday', samedi: 'Saturday', dimanche: 'Sunday' };
const SIRET_FACTICE = /^[0\s]+$/;

export const idEntreprise = (base: string) => `${base}/#entreprise`;
const idSite = (base: string) => `${base}/#site`;
const ville = (nom: string) => ({ '@type': 'City', name: nom });

/** Villes desservies : liste déclarée, sinon ville du siège. */
export const villesDesservies = (s: Site) => (s.villes?.length ? s.villes : [s.adresse.ville]).map(ville);

export function entreprise(s: Site, base: string): Record<string, unknown> {
  const types = s.types_schema?.length ? s.types_schema : ['LocalBusiness'];
  const sameAs = [...(s.reseaux ?? []), ...(s.fiche_google ? [s.fiche_google] : [])];
  const j: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': types.length === 1 ? types[0] : types,
    '@id': idEntreprise(base),
    name: s.nom,
    description: s.description,
    url: base + '/',
    telephone: s.telephone,
    email: s.email || undefined,
    address: {
      '@type': 'PostalAddress',
      ...(s.afficher_adresse && s.adresse.rue ? { streetAddress: s.adresse.rue } : {}),
      addressLocality: s.adresse.ville,
      postalCode: s.adresse.code_postal,
      addressCountry: s.adresse.pays ?? 'FR',
    },
    areaServed: villesDesservies(s),
  };
  if (s.logo) { j.logo = base + s.logo; j.image = base + s.logo; }
  if (sameAs.length) j.sameAs = sameAs;
  if (s.fiche_google) j.hasMap = s.fiche_google;
  if (s.horaires_detail?.length) {
    j.openingHoursSpecification = s.horaires_detail.map((h) => ({
      '@type': 'OpeningHoursSpecification', dayOfWeek: h.jours.map((x) => JOURS_EN[x]), opens: h.ouverture, closes: h.fermeture,
    }));
  }
  if (s.siret && !SIRET_FACTICE.test(s.siret)) j.identifier = { '@type': 'PropertyValue', propertyID: 'SIRET', value: s.siret.replace(/\s/g, '') };
  return j;
}

/** Service proposé par l'entreprise (page de service ou page de zone). */
export function service(s: Site, base: string, o: { nom: string; url: string; description?: string; type?: string; villes?: string[] }): Record<string, unknown> {
  return {
    '@type': 'Service',
    '@id': `${base}${o.url}#service`,
    name: o.nom,
    ...(o.type ? { serviceType: o.type } : {}),
    ...(o.description ? { description: o.description } : {}),
    url: base + o.url,
    provider: { '@id': idEntreprise(base), name: s.nom },
    areaServed: o.villes?.length ? o.villes.map(ville) : villesDesservies(s),
  };
}

/** Article « À savoir » ou actualité : titre, résumé, date de mise à jour et auteur affichés sur la page. */
export function article(base: string, o: { type?: 'Article' | 'BlogPosting'; url: string; titre: string; description?: string; date?: Date; auteur?: string; image?: string }): Record<string, unknown> {
  const urlPage = base + o.url;
  return {
    '@type': o.type ?? 'Article',
    '@id': urlPage + '#article',
    headline: o.titre.length > 110 ? o.titre.slice(0, 109) + '…' : o.titre,
    ...(o.description ? { description: o.description } : {}),
    ...(o.date ? { dateModified: new Date(o.date).toISOString() } : {}),
    author: o.auteur ? { '@type': 'Person', name: o.auteur } : { '@id': idEntreprise(base) },
    publisher: { '@id': idEntreprise(base) },
    ...(o.image ? { image: o.image } : {}),
    mainEntityOfPage: { '@id': urlPage + '#page' },
    inLanguage: 'fr-FR',
  };
}

export type TypePage = 'WebPage' | 'ContactPage' | 'AboutPage' | 'CollectionPage' | 'FAQPage';

/** Graphe complet d'une page : entreprise, site, page, puis les données propres à la page (ex. Service). */
export function graphe(s: Site, base: string, o: { url: string; titre: string; description?: string; type?: TypePage; extras?: Record<string, unknown>[] }): Record<string, unknown> {
  const { '@context': _c, ...ent } = entreprise(s, base);
  const urlPage = base + (o.url === '/' ? '/' : o.url);
  const type = o.type ?? (o.url === '/contact' ? 'ContactPage' : o.url === '/a-propos' ? 'AboutPage' : 'WebPage');
  const extras = o.extras ?? [];
  return {
    '@context': 'https://schema.org',
    '@graph': [
      ent,
      { '@type': 'WebSite', '@id': idSite(base), url: base + '/', name: s.nom, inLanguage: 'fr-FR', publisher: { '@id': idEntreprise(base) } },
      {
        '@type': type, '@id': urlPage + '#page', url: urlPage, name: o.titre,
        ...(o.description ? { description: o.description } : {}),
        inLanguage: 'fr-FR', isPartOf: { '@id': idSite(base) },
        ...(o.url === '/' ? { about: { '@id': idEntreprise(base) } } : {}),
        ...(extras.length ? { mainEntity: extras.map((x) => ({ '@id': x['@id'] })).filter((x) => x['@id']) } : {}),
      },
      ...extras,
    ],
  };
}
