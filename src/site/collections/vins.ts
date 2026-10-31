/**
 * Vins de La Cave à Aimé : collection propre au site (socle 1.46.0).
 * Spécification : socle-sites, docs/specifications/collections-propres.md §7.
 * Les fiches : content/vins/<id>.md, une par cuvée (un nouveau millésime met la fiche à jour).
 */
import { definirCollection } from '../../lib/collections-site';

export default definirCollection({
  nom: 'vins',
  libelle: 'Vins',
  element: 'vin',
  base: '/vins',
  description: 'Un vin vendu par la cave : une cuvée d\'un domaine, dans une contenance.',
  titre: ['nom', 'domaine'],
  cle: ['domaine', 'nom', 'type', 'contenance'],
  identifiant: ['domaine', 'nom', 'contenance'],
  prix: 'prix',
  champs: {
    nom: { type: 'texte', max: 80, libelle: 'Cuvée', description: 'Nom de la cuvée, tel qu\'il est sur l\'étiquette (ex. « Les Garrigues »).', synonymes: ['cuvée', 'désignation', 'libellé', 'produit', 'article', 'vin'], obligatoire: true },
    domaine: { type: 'texte', max: 80, libelle: 'Domaine', description: 'Domaine, château ou maison qui produit le vin (ex. « Domaine de la Citadelle »).', synonymes: ['château', 'producteur', 'vigneron', 'maison', 'propriété', 'cave coopérative'], obligatoire: true },
    type: {
      type: 'choix', libelle: 'Type', description: 'Couleur ou type du vin.', synonymes: ['couleur'], obligatoire: true,
      valeurs: {
        rouge: { libelle: 'Rouge', synonymes: ['rge', 'red'] },
        blanc: { libelle: 'Blanc', synonymes: ['blc', 'white'] },
        rose: { libelle: 'Rosé', synonymes: ['rosé', 'rse'] },
        effervescent: { libelle: 'Effervescent', synonymes: ['crémant', 'champagne', 'pétillant', 'pétillant naturel', 'pet nat', 'bulles', 'mousseux'] },
        orange: { libelle: 'Orange', synonymes: ['macération', 'vin orange'] },
        moelleux: { libelle: 'Moelleux ou liquoreux', synonymes: ['liquoreux', 'doux', 'vendanges tardives'] },
      },
    },
    appellation: { type: 'texte', max: 80, libelle: 'Appellation', description: 'Appellation ou indication géographique, sans « AOP » si l\'étiquette ne le dit pas (ex. « Luberon », « IGP Méditerranée », « Vin de France »).', synonymes: ['AOP', 'AOC', 'IGP', 'dénomination'], demander: true },
    region: {
      type: 'choix', libelle: 'Région', description: 'Grande région viticole. Peut se déduire de l\'appellation (Luberon, Ventoux : Vallée du Rhône).', synonymes: ['région', 'vignoble', 'origine'], origine: 'deductible',
      valeurs: {
        'vallee-du-rhone': { libelle: 'Vallée du Rhône', synonymes: ['rhône', 'côtes du rhône', 'luberon', 'ventoux'] },
        provence: { libelle: 'Provence' },
        'languedoc-roussillon': { libelle: 'Languedoc-Roussillon', synonymes: ['languedoc', 'roussillon'] },
        'sud-ouest': { libelle: 'Sud-Ouest' },
        bordeaux: { libelle: 'Bordeaux' },
        bourgogne: { libelle: 'Bourgogne' },
        beaujolais: { libelle: 'Beaujolais' },
        loire: { libelle: 'Vallée de la Loire', synonymes: ['loire'] },
        alsace: { libelle: 'Alsace' },
        champagne: { libelle: 'Champagne' },
        'jura-savoie': { libelle: 'Jura et Savoie', synonymes: ['jura', 'savoie'] },
        corse: { libelle: 'Corse' },
        etranger: { libelle: 'Hors de France', synonymes: ['étranger', 'italie', 'espagne'] },
      },
    },
    cepages: { type: 'liste', max: 8, max_element: 40, libelle: 'Cépages', description: 'Cépages, noms seuls (ex. « Grenache », « Syrah »).', synonymes: ['encépagement', 'variété', 'raisin'], demander: true },
    millesime: { type: 'annee', sans_valeur: 'Non millésimé', libelle: 'Millésime', description: 'Année de la récolte, lue sur l\'étiquette ; « sans » pour un vin non millésimé. Jamais déduite.', synonymes: ['année', 'vintage'], obligatoire: true },
    contenance: { type: 'nombre', unite: 'cl', min: 10, max: 600, decimales: 1, libelle: 'Contenance', description: 'Contenance en centilitres (37,5 · 50 · 75 · 150 magnum · 300).', synonymes: ['format', 'volume', 'bouteille', 'magnum', 'cl'], obligatoire: true, exemples: [75, 150] },
    prix: { type: 'prix', libelle: 'Prix', description: 'Prix de vente en cave, TTC, en euros.', synonymes: ['tarif', 'PVC', 'prix public', 'prix de vente', 'prix TTC'], obligatoire: true },
    labels: {
      type: 'choix_multiple', libelle: 'Bio ou nature', description: 'Seulement si le logo ou la mention est sur l\'étiquette, ou si la cave le dit. Jamais déduit du domaine.', synonymes: ['bio', 'AB', 'agriculture biologique', 'nature', 'biodynamie', 'label'], demander: true,
      valeurs: {
        bio: { libelle: 'Bio', synonymes: ['AB', 'agriculture biologique', 'eurofeuille'] },
        biodynamie: { libelle: 'Biodynamie', synonymes: ['demeter', 'biodyvin'] },
        nature: { libelle: 'Nature', synonymes: ['vin nature', 'méthode nature', 'sans sulfites ajoutés'] },
        conversion: { libelle: 'En conversion bio', synonymes: ['conversion'] },
      },
    },
    corps: {
      type: 'choix', libelle: 'Corps', description: 'Avis de la cave sur la structure du vin.', synonymes: ['structure', 'puissance'], demander: true,
      valeurs: { leger: { libelle: 'Léger', synonymes: ['souple', 'fruité'] }, equilibre: { libelle: 'Équilibré', synonymes: ['moyen'] }, corse: { libelle: 'Corsé', synonymes: ['puissant', 'charpenté'] } },
    },
    degustation: { type: 'texte_long', max: 600, libelle: 'Dégustation', description: 'Description objective : arômes, bouche, finale (loi Évin : jamais de fête, de séduction ni de réussite). Noter la provenance (caviste, contre-etiquette, domaine).', synonymes: ['notes', 'commentaire', 'description', 'notes de dégustation'], demander: true },
    accords: { type: 'liste', max: 6, max_element: 60, libelle: 'Accords', description: 'Plats ou fromages avec lesquels le servir (ex. « agneau de Sisteron »).', synonymes: ['accords mets', 'à servir avec', 'accompagnement'], demander: true },
    caves: { type: 'reference', vers: { pages: '/caves/' }, multiple: true, libelle: 'Où le trouver', description: 'Caves où le vin est vendu (merindol, lauris, salon-de-provence, cheval-blanc). Jamais toutes par défaut : demander.', synonymes: ['boutique', 'magasin', 'cave', 'disponible à', 'point de vente'], obligatoire: true },
    photo: { type: 'image', libelle: 'Photo', description: 'Photo de la bouteille, fond neutre. La photo d\'étiquette envoyée pour la saisie n\'est utilisée que si la cave l\'accepte.', synonymes: ['photo', 'bouteille', 'image'] },
  },
  indexable: { textes: ['degustation', 'accords'], mots: 60, provenances_exclues: ['contre-etiquette', 'domaine'] },
  schema_org: { type: 'Product', marque: 'domaine', categorie: 'type', proprietes: ['appellation', 'region', 'cepages', 'millesime', 'contenance', 'labels'], complement_nom: ['millesime'] },
  rendu: {
    titre_liste: 'Nos vins',
    intro_liste: 'Les vins de nos caves de Mérindol, Lauris, Salon-de-Provence et Cheval-Blanc : du Luberon et de la Vallée du Rhône, de Provence et d\'ailleurs.',
    filtres: ['type', 'region', 'labels', 'corps', 'caves'],
    ordre: 'titre asc',
    carte: { surtitre: ['domaine'], titre: ['nom'], details: ['appellation', 'millesime', 'contenance', 'labels'] },
    detail: {
      surtitre: ['type', 'appellation'],
      caracteristiques: ['domaine', 'type', 'appellation', 'region', 'cepages', 'millesime', 'contenance', 'labels', 'corps', 'caves'],
      textes: [{ champ: 'degustation', titre: 'Dégustation' }],
      listes: [{ champ: 'accords', titre: 'À servir avec' }],
      voisins: [{ champ: 'domaine', titre: 'Du même domaine' }, { champ: 'type', titre: 'Dans la même couleur' }],
    },
    libelle_epuise: 'Épuisé, demandez en cave',
  },
});
