/**
 * Mentions légales et politique de confidentialité, générées à partir de data/site.json (champ « legal »).
 * Bloc « legal » (variant mentions | confidentialite) : rien à rédiger à la main, tout reste à jour avec les
 * coordonnées du site. Le validateur bloque la publication si une information obligatoire manque.
 */
import type { Site } from '../schemas/site';
import { ficheGoogle } from './avisGoogle';
/** Adresse e-mail du site en lien, ou le formulaire de contact si le site n'affiche pas d'e-mail. */
const courriel = (s: { email?: string }) => (s.email ? `[${s.email}](mailto:${s.email})` : 'le [formulaire de contact](/contact)');

/** Prestataire : créateur du site et hébergeur (au sens de la LCEN), sur un serveur Scaleway. */
export const PRESTATAIRE = {
  marque: 'Sillaya',
  societe: 'Xmediacreation',
  url: 'https://www.sillaya.fr',
  email: 'contact@sillaya.fr',
  adresse: "Parc d'activités le Revol, 128 chemin des Vieilles Vignes, 84240 La Tour-d'Aigues",
  telephone: '',
};
export const SERVEUR = "Scaleway SAS, 8 rue de la Ville-l'Évêque, 75008 Paris, France (RCS Paris 433 115 904)";

/** Informations obligatoires manquantes (vide = mentions complètes). */
export function manquesLegal(site: Site): string[] {
  const l = site.legal;
  const m: string[] = [];
  if (!l) return ['legal (éditeur du site : raison sociale, forme, directeur de la publication…)'];
  if (!l.raison_sociale) m.push('legal.raison_sociale');
  if (!l.forme) m.push('legal.forme');
  if (!l.directeur_publication) m.push('legal.directeur_publication');
  if (!site.siret && !l.immatriculation) m.push('siret ou legal.immatriculation');
  if (!l.adresse && !site.adresse.rue) m.push('legal.adresse (ou adresse.rue) : adresse du siège');
  if (/À COMPLÉTER/.test(PRESTATAIRE.adresse)) m.push('adresse du prestataire (src/lib/legal.ts)');
  return m;
}

const adresseSiege = (s: Site) =>
  s.legal?.adresse || [s.adresse.rue, `${s.adresse.code_postal} ${s.adresse.ville}`].filter(Boolean).join(', ');

export function mentionsLegales(s: Site, confidentialite: string | null): string {
  const l = s.legal!;
  const estPrestataire = new URL(s.url).host === new URL(PRESTATAIRE.url).host;
  const lignes = [
    '## Éditeur du site',
    '',
    `**${l.raison_sociale}**, ${l.forme}${l.capital ? `, au capital de ${l.capital}` : ''}  `,
    `Siège : ${adresseSiege(s)}  `,
    ...(l.immatriculation ? [`Immatriculation : ${l.immatriculation}  `] : []),
    ...(s.siret ? [`SIRET : ${s.siret}  `] : []),
    ...(l.tva_intra ? [`TVA intracommunautaire : ${l.tva_intra}  `] : []),
    ...(s.telephone ? [`Téléphone : ${s.telephone}  `] : []),
    `E-mail : ${courriel(s)}`,
    '',
    `Directeur de la publication : ${l.directeur_publication}`,
    ...(l.profession ? ['', l.profession] : []),
    ...(l.assurance ? ['', `Assurance professionnelle : ${l.assurance}`] : []),
    '',
    '## Création et hébergement',
    '',
    estPrestataire
      ? `Site conçu et maintenu par ${PRESTATAIRE.societe}.`
      : `Site conçu et maintenu par [${PRESTATAIRE.marque}](${PRESTATAIRE.url}), service de ${PRESTATAIRE.societe}.`,
    '',
    `Hébergement : ${PRESTATAIRE.societe}, ${PRESTATAIRE.adresse}, [${PRESTATAIRE.email}](mailto:${PRESTATAIRE.email})${PRESTATAIRE.telephone ? `, ${PRESTATAIRE.telephone}` : ''}, sur un serveur de ${SERVEUR}.`,
    '',
    `Hébergement vert : électricité 100 % renouvelable selon Scaleway, et serveur reconnu comme hébergement vert par la [Green Web Foundation](https://www.thegreenwebfoundation.org/green-web-check/?url=${new URL(s.url).host}).`,
    '',
    "## Conditions d'utilisation",
    '',
    `**Propriété intellectuelle.** Les textes, photos, illustrations, logos et la mise en page de ce site appartiennent à ${l.raison_sociale} ou à leurs auteurs, qui l'ont autorisé à les utiliser. Toute reproduction, représentation ou réutilisation, totale ou partielle, sans autorisation écrite préalable est interdite.`,
    '',
    "**Informations.** Les informations publiées sont données à titre indicatif et peuvent évoluer sans préavis. Les prix, délais et caractéristiques présentés n'ont pas de valeur contractuelle : seul un devis signé engage l'éditeur. L'éditeur ne peut être tenu responsable d'une erreur, d'une omission ou d'une indisponibilité du site.",
    '',
    "**Liens.** Les liens vers d'autres sites sont proposés à titre d'information ; leur contenu relève de la seule responsabilité de leurs éditeurs. Un lien vers ce site est autorisé, sans l'afficher dans le cadre d'un autre site.",
    ...(l.credits_photos ? ['', `**Crédits photos.** ${l.credits_photos}`] : []),
    ...(l.mediateur
      ? ['', `**Médiation de la consommation.** En cas de litige, après une réclamation écrite restée sans réponse satisfaisante, le consommateur peut recourir gratuitement au médiateur de la consommation : [${l.mediateur.nom}](${l.mediateur.url}).`]
      : []),
    '',
    `**Données personnelles.** ${confidentialite ? `Voir la [politique de confidentialité](${confidentialite}).` : `Pour toute question sur vos données : ${courriel(s)}.`}`,
    '',
    '**Droit applicable.** Le présent site et ses conditions d\'utilisation sont soumis au droit français.',
  ];
  return lignes.join('\n');
}

export function politiqueConfidentialite(s: Site, polices: string | null): string {
  const l = s.legal!;
  return [
    '## Qui est responsable de vos données',
    '',
    `${l.raison_sociale}, ${adresseSiege(s)}. Contact : ${courriel(s)}.`,
    '',
    '## Les données que nous recevons',
    '',
    "Quand vous nous écrivez avec le formulaire du site, nous recevons ce que vous y indiquez : nom, coordonnées, commune, message et, le cas échéant, vos photos. Elles servent uniquement à répondre à votre demande, à établir un devis et à suivre votre projet. Base légale : les mesures précontractuelles prises à votre demande (article 6.1.b du RGPD).",
    '',
    `Elles sont conservées 3 ans après notre dernier échange, puis supprimées. Elles ne sont ni vendues ni cédées. Seuls ${l.raison_sociale} et son prestataire technique, ${PRESTATAIRE.marque} (${PRESTATAIRE.societe}), qui héberge le site en France, y ont accès.`,
    '',
    '## Statistiques et cookies',
    '',
    "Ce site ne dépose aucun cookie publicitaire ni traceur, et n'enregistre rien dans votre navigateur. La fréquentation est mesurée à partir des journaux du serveur, avec des adresses IP tronquées. Quand une page s'affiche, votre navigateur envoie au serveur du site un signal vide, sans identifiant, qui permet d'écarter les robots des statistiques ; certaines actions (lancer un test, afficher un résultat, envoyer un formulaire) envoient de la même façon leur nom et la page concernée, jamais ce que vous avez saisi. Ces informations ne servent qu'à des statistiques globales sur le site, ne sont ni croisées avec d'autres données ni transmises à quiconque : aucun visiteur n'est identifié.",
    ...(polices ? ['', polices] : []),
    ...(ficheGoogle() ? ['', "Les avis clients affichés proviennent de notre fiche Google : ils y sont publiés et signés par leurs auteurs. Ils sont intégrés aux pages du site, sans aucun appel à Google depuis votre navigateur."] : []),
    ...(process.env.GOOGLE_MAPS_CLE ? ['', "Les cartes Google Maps ne se chargent que si vous cliquez sur « Afficher la carte » : Google reçoit alors votre adresse IP et peut déposer ses propres cookies, selon sa politique de confidentialité."] : []),
    '',
    '## Vos droits',
    '',
    `Vous pouvez accéder à vos données, les faire rectifier ou effacer, vous opposer à leur utilisation, en demander la limitation ou la portabilité, en écrivant à ${courriel(s)}. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la [CNIL](https://www.cnil.fr).`,
  ].join('\n');
}

/**
 * Déclaration d'accessibilité (RGAA 4.1, modèle de la DINUM simplifié). Sans audit renseigné dans
 * site.legal.accessibilite, la déclaration le dit honnêtement : site non audité, contrôles automatiques effectués.
 */
export function declarationAccessibilite(s: Site, plan: string | null): string {
  const l = s.legal!;
  const a = l.accessibilite;
  const etat = a?.taux === undefined ? null : a.taux >= 100 ? 'totalement conforme' : a.taux >= 50 ? 'partiellement conforme' : 'non conforme';
  return [
    `${l.raison_sociale} s'engage à rendre son site internet accessible, conformément à l'article 47 de la loi n° 2005-102 du 11 février 2005.`,
    '',
    `Cette déclaration d'accessibilité s'applique au site ${new URL(s.url).host}.`,
    '',
    '## État de conformité',
    '',
    etat
      ? `Le site est **${etat}** avec le référentiel général d'amélioration de l'accessibilité (RGAA), version 4.1 : ${a!.taux} % des critères applicables sont respectés (audit du ${a!.date_audit}${a!.auditeur ? `, réalisé par ${a!.auditeur}` : ''}).`
      : "Le site n'a pas encore fait l'objet d'un audit de conformité au RGAA 4.1. Il est construit pour être accessible (structure des titres, alternatives aux images, contrastes, navigation au clavier, lien d'évitement, formulaires étiquetés) et vérifié automatiquement à chaque évolution.",
    ...(a?.non_conformites?.length ? ['', '## Contenus non accessibles', '', ...a.non_conformites.map((x) => `- ${x}`)] : []),
    '',
    '## Établissement de cette déclaration',
    '',
    `Déclaration établie le ${a?.date_declaration ?? new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}. Technologies utilisées : HTML, CSS, JavaScript (amélioration progressive, le site reste utilisable sans).`,
    ...(plan ? ['', `Le site propose deux moyens de navigation : le menu principal et le [plan du site](${plan}).`] : []),
    '',
    '## Retour d\'information et contact',
    '',
    `Si vous n'arrivez pas à accéder à un contenu ou à un service, contactez-nous à ${courriel(s)}${s.telephone ? ` ou au ${s.telephone}` : ''} : nous vous indiquerons une autre façon d'y accéder ou vous transmettrons le contenu sous une autre forme.`,
    '',
    '## Voies de recours',
    '',
    "Si vous avez signalé un défaut d'accessibilité qui vous empêche d'accéder à un contenu ou à un service et n'avez pas obtenu de réponse satisfaisante, vous pouvez saisir le Défenseur des droits : par le [formulaire en ligne](https://formulaire.defenseurdesdroits.fr/), en contactant le délégué du Défenseur des droits de votre région, ou par courrier gratuit, sans affranchissement : Défenseur des droits, Libre réponse 71120, 75342 Paris CEDEX 07.",
  ].join('\n');
}
