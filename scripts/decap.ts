/**
 * Decap CMS (/admin/) :
 *  1. installe le bundle Decap (version figée, sans ses dépendances) dans public/admin/decap/ ;
 *  2. génère public/admin/config.yml à partir des schémas du site (mêmes champs, mêmes limites,
 *     mêmes listes de choix que la validation) : rien à maintenir à la main.
 *
 * Les champs techniques (requêtes des boucles, réglages des formulaires) sont conservés tels quels
 * mais masqués : on les modifie via l'espace client ou l'agence, pas dans Decap.
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stringify } from 'yaml';
import { z } from 'astro/zod';
import { blocs } from '../src/schemas/blocs';
import { collectionSchemas } from '../src/schemas/collections';
import { collectionsDuSite, blocDuSite, modeleSite } from '../src/schemas/modeles';
import { page } from '../src/schemas/page';
import { reglages } from '../src/lib/collections';
import taxonomies from '../data/taxonomies.json' with { type: 'json' };
import site from '../data/site.json' with { type: 'json' };
import { TYPES_ENTREPRISE, JOURS } from '../src/schemas/site';
import { TYPES_LABELS } from '../src/schemas/labels';
import icones from '../data/icones.json' with { type: 'json' };
import { tarifs as tarifsSchema } from '../src/schemas/tarifs';
import { temoignage as temoignageSchema } from '../src/schemas/temoignages';
import { carteRestaurant as carteRestaurantSchema } from '../src/schemas/carte-restaurant';

const VERSION_DECAP = '3.16.3';
// Dépôt GitHub du site : variable, sinon celui de la construction (GitHub Actions), sinon le dépôt git local
const depotGit = (): string => {
  try { return execSync('git remote get-url origin', { encoding: 'utf8' }).trim().replace(/^.*github\.com[/:]/, '').replace(/\.git$/, ''); } catch { return ''; }
};
const DEPOT = process.env.DECAP_DEPOT || process.env.GITHUB_REPOSITORY || depotGit();
if (!/^[\w.-]+\/[\w.-]+$/.test(DEPOT)) throw new Error('Dépôt GitHub du site introuvable : définir DECAP_DEPOT (ex. loopy117/monsite)');
const R = process.cwd();
const ADMIN = join(R, 'public/admin');

/* ------------------------------ 1. Bundle Decap ------------------------------ */
function installerDecap() {
  const dest = join(ADMIN, 'decap');
  const marqueur = join(dest, 'VERSION');
  if (existsSync(marqueur) && readFileSync(marqueur, 'utf8').trim() === VERSION_DECAP) return;
  const tmp = join(R, 'node_modules/.cache/decap');
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  execSync(`npm pack decap-cms@${VERSION_DECAP} --silent --pack-destination "${tmp}"`, { stdio: 'pipe' });
  execSync(`tar -xzf decap-cms-${VERSION_DECAP}.tgz`, { cwd: tmp });
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  const dist = join(tmp, 'package/dist');
  for (const f of readdirSync(dist)) if (f.includes('decap-cms') && !f.endsWith('.map')) cpSync(join(dist, f), join(dest, f));
  writeFileSync(marqueur, VERSION_DECAP + '\n');
  console.log(`Decap ${VERSION_DECAP} installé dans public/admin/decap/`);
}

/* ------------------------ 2. Schéma JSON → champs Decap ------------------------ */
const LIBELLES: Record<string, string> = {
  nom_court: 'Nom court', ages: 'Âges', championnat: 'Championnat', creneaux: 'Créneaux', jour: 'Jour', debut: 'Début (HH:MM)', fin: 'Fin (HH:MM)',
  encadrants: 'Encadrants (avec leur accord)', nom: 'Nom', role: 'Rôle', categories: 'Types', equipes: 'Équipes',
  titre: 'Titre', surtitre: 'Surtitre', texte: 'Texte', intro: 'Introduction', contenu: 'Contenu', variant: 'Variante',
  background: 'Fond', spacing: 'Espacement', id: 'Ancre (id)', image: 'Image', images: 'Images', ctas: 'Boutons', cta: 'Bouton',
  points: 'Points', items: 'Éléments', lien: 'Lien', label: 'Libellé', href: 'Lien (URL)', style: 'Style', src: 'Fichier', alt: 'Texte alternatif',
  focus: "Point d'intérêt", icone: 'Icône', question: 'Question', reponse: 'Réponse', valeur: 'Valeur', libelle: 'Libellé', source: 'Source',
  slides: 'Diapositives', note: 'Note', statut: 'Statut', date: 'Date', resume: 'Résumé', categorie: 'Métier', mis_en_avant: 'Mis en avant',
  ordre: 'Ordre', seo: 'Référencement', description: 'Description', noindex: 'Ne pas indexer', prestations: 'Prestations', badge: 'Badge',
  lien_label: 'Texte du lien', lieu: 'Commune', tags: 'Étiquettes', galerie: 'Galerie', ville: 'Ville', gabarit: 'Gabarit',
  fil_ariane: "Fil d'Ariane", brief: 'Demande d\'origine', sections: 'Sections', lien_tout_voir: 'Lien « tout voir »', bouton: 'Texte du bouton',
  sujet: "Objet de l'e-mail", champs: 'Champs', obligatoires: 'Champs obligatoires', body: 'Corps de la page',
  equipe: 'Équipe', adversaire: 'Adversaire', domicile: 'À domicile', heure: 'Heure', competition: 'Compétition', score_pour: 'Points marqués par le club', score_contre: 'Points de l\'adversaire', annulee: 'Annulée ou reportée', autorisations: 'Droit à l\'image vérifié', photos: 'Photos', legende: 'Légende', credit: 'Crédit photo', annee: 'Année',
  auteur: 'Nom affiché', precision: 'Qui est-ce', accord: 'Le client accepte d\'être publié', realisation: 'Réalisation concernée', photo: 'Photo',
};
const LIBELLES_BLOCS: Record<string, string> = {
  hero: 'Ouverture (hero)', texte: 'Texte', 'texte-image': 'Texte et image', features: 'Points forts / étapes', galerie: 'Galerie',
  slider: 'Diaporama', cta: "Appel à l'action", faq: 'Questions fréquentes', chiffres: 'Chiffres clés', formulaire: 'Formulaire de contact', tarifs: 'Tarifs', 'carte-restaurant': 'Carte du restaurant', partenaires: 'Partenaires', planning: 'Planning des entraînements',
  boucle: 'Liste automatique (boucle)', labels: 'Labels et certifications', temoignages: 'Témoignages clients', 'match-center': 'Prochaine rencontre et dernier résultat', frise: 'Frise chronologique',
};
/** Champs conservés mais non modifiables dans Decap. */
const MASQUES: Record<string, string[]> = {
  boucle: ['source', 'filtre', 'exclure', 'elements', 'ordre', 'nombre', 'decalage', 'carte', 'affichage', 'options', 'si_vide', 'message_vide'],
  formulaire: ['champs', 'obligatoires'],
};
const MARKDOWN = new Set(['contenu', 'reponse', 'body']);
const libelle = (n: string) => LIBELLES[n] ?? n.charAt(0).toUpperCase() + n.slice(1).replace(/_/g, ' ');

function estImage(s: any) {
  return s?.type === 'object' && s.properties?.src && s.properties?.alt;
}

function champ(nom: string, s: any, requis: boolean): any {
  const base: any = { name: nom, label: libelle(nom), required: requis };
  if (s.description) base.hint = s.description;
  if (s.default !== undefined && typeof s.default !== 'object') base.default = s.default;
  if (s.anyOf) {
    const sansNull = s.anyOf.filter((x: any) => x.type !== 'null');
    return champ(nom, { ...sansNull[0], description: s.description, default: s.default }, requis);
  }
  if (estImage(s)) {
    // Champ image avec le bouton « Choisir dans la photothèque » (public/admin/phototheque.js)
    return {
      ...base, widget: 'image_phototheque', collapsed: false,
      fields: [
        { name: 'src', label: 'Fichier', widget: 'image', required: requis, choose_url: false },
        { name: 'alt', label: 'Texte alternatif', widget: 'string', required: false, hint: "Ce qu'on voit sur l'image (125 caractères max). Vide seulement si décorative.", pattern: ['^[\\s\\S]{0,125}$', '125 caractères maximum'] },
        { name: 'focus', label: "Point d'intérêt", widget: 'select', required: false, options: ['centre', 'haut', 'bas', 'gauche', 'droite'] },
      ],
    };
  }
  if (s.enum) return { ...base, widget: 'select', options: s.enum };
  switch (s.type) {
    case 'boolean':
      return { ...base, widget: 'boolean' };
    case 'integer':
    case 'number':
      return { ...base, widget: 'number', value_type: s.type === 'integer' ? 'int' : 'float', ...(s.minimum != null && s.minimum > -1e12 ? { min: s.minimum } : {}), ...(s.maximum != null && s.maximum < 1e12 ? { max: s.maximum } : {}) };
    case 'string': {
      if (s.format === 'date-time' || s.format === 'date' || nom === 'date') return { ...base, widget: 'datetime', date_format: 'DD/MM/YYYY', time_format: false, format: 'YYYY-MM-DD', picker_utc: true };
      const w = MARKDOWN.has(nom) || /Markdown/.test(s.description ?? '') ? 'markdown' : (s.maxLength ?? 0) > 160 ? 'text' : 'string';
      const f: any = { ...base, widget: w };
      if (w === 'markdown') f.buttons = ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'bulleted-list', 'numbered-list'], f.editor_components = [], f.modes = ['rich_text'];
      const min = s.minLength ?? 0;
      if (s.maxLength || min) f.pattern = [`^[\\s\\S]{${min},${s.maxLength ?? ''}}$`, s.maxLength ? `${min ? `${min} à ` : ''}${s.maxLength} caractères maximum` : `${min} caractères minimum`];
      if (s.pattern && !f.pattern) f.pattern = [s.pattern, 'Format invalide'];
      return f;
    }
    case 'array': {
      const it = s.items ?? {};
      const lim = { ...(s.minItems ? { min: s.minItems } : {}), ...(s.maxItems ? { max: s.maxItems } : {}) };
      if (it.enum) return { ...base, widget: 'select', multiple: true, options: it.enum, ...lim };
      if (estImage(it)) return {
        ...base, widget: 'list', ...lim, summary: '{{fields.image.alt}}',
        field: {
          ...champ('image', it, true), label: 'Photo',
          fields: [
            ...champ('x', it, true).fields,
            ...Object.keys(it.properties).filter((k) => !['src', 'alt', 'focus'].includes(k)).map((k) => champ(k, it.properties[k], false)),
          ],
        },
      };
      if (it.type === 'object') return { ...base, widget: 'list', ...lim, collapsed: true, fields: champsObjet(it) };
      return { ...base, widget: 'list', ...lim, field: { ...champ('valeur', it, true), label: 'Valeur' } };
    }
    case 'object': {
      // Decap exige les sous-champs obligatoires même quand le groupe facultatif est absent :
      // dans un groupe facultatif, tout devient facultatif (la validation du site contrôle le reste).
      const champs = champsObjet(s);
      return { ...base, widget: 'object', collapsed: true, fields: requis ? champs : champs.map(facultatif) };
    }
    default:
      return { ...base, widget: 'hidden', required: false };
  }
}

function champsObjet(s: any, ignorer: string[] = [], masques: string[] = []): any[] {
  const req = new Set<string>(s.required ?? []);
  return Object.entries<any>(s.properties ?? {})
    .filter(([n]) => !ignorer.includes(n))
    .map(([n, p]) => (masques.includes(n) ? { name: n, label: libelle(n), widget: 'hidden', required: false } : champ(n, p, req.has(n) && p.default === undefined)));
}

function facultatif(f: any): any {
  const g = { ...f, required: false };
  if (g.fields && g.widget === 'object') g.fields = g.fields.map(facultatif);
  return g;
}

const js = (sch: any) => z.toJSONSchema(sch, { io: 'input', unrepresentable: 'any' }) as any;

function typesBlocs() {
  return Object.entries(blocs).filter(([nom]) => blocDuSite(nom)).map(([nom, sch]) => {
    const meta: any = (sch as any).meta?.() ?? {};
    return {
      name: nom, label: LIBELLES_BLOCS[nom] ?? nom, summary: '{{fields.titre}}', ...(meta.quand ? { hint: meta.quand } : {}),
      widget: 'object', fields: champsObjet(js(sch), ['block'], MASQUES[nom] ?? []),
    };
  });
}

const champSections = (requis: boolean) => ({
  name: 'sections', label: 'Sections', widget: 'list', required: requis, collapsed: false, typeKey: 'block', types: typesBlocs(),
  hint: 'Les sections de la page, dans l\'ordre. La première doit être une ouverture (hero).',
});

function champsPage() {
  const s = js(page);
  // « Demande d'origine » (brief) : mémoire de l'assistant, conservée mais jamais montrée dans l'éditeur
  return champsObjet(s, ['sections'], ['brief']).concat([champSections(true)]);
}

function champsCollection(nom: keyof typeof collectionSchemas) {
  const s = js(collectionSchemas[nom]);
  // Équipe : liste des pages équipes (jamais un identifiant à taper)
  const equipe = (f: any) => (f.name === 'equipe'
    ? { name: 'equipe', label: 'Équipe', widget: 'relation', collection: 'equipes', value_field: '{{slug}}', search_fields: ['titre', 'nom_court'], display_fields: ['nom_court'], required: f.required, ...(f.hint ? { hint: f.hint } : {}) }
    : f);
  return [
    ...champsObjet(s, ['sections']).map(equipe),
    { name: 'body', label: 'Corps de la page', widget: 'markdown', required: false, buttons: ['bold', 'italic', 'link', 'heading-two', 'heading-three', 'bulleted-list', 'numbered-list'], editor_components: [], modes: ['rich_text'] },
    { ...champSections(false), label: 'Sections supplémentaires', hint: 'Facultatif : sections ajoutées après le corps sur la page de détail.' },
  ];
}

/* ------------------------------ Réglages (data/*.json) ------------------------------ */
// niveaux : profondeur de sous-menus permise sous cette entrée (menu principal : 2, soit un sous-sous-menu ou les colonnes
// d'un méga-menu). menu : champs du menu principal (description, et disposition pour les entrées du premier niveau).
const entreeNav = (niveaux: number, menu = false, haut = menu): any[] => [
  { name: 'page', label: 'Page (chemin, ex. /contact ou /contact#formulaire)', widget: 'string', required: false },
  { name: 'element', label: 'Élément de collection (ex. services/climatisation)', widget: 'string', required: false },
  { name: 'collection', label: 'Archive de collection', widget: 'select', required: false, options: collectionsDuSite() },
  { name: 'label', label: menu ? 'Libellé (facultatif : titre de la page par défaut ; seul, sans page : intitulé de colonne de méga-menu)' : 'Libellé (facultatif : titre de la page par défaut)', widget: 'string', required: false },
  ...(menu && !haut ? [{ name: 'icone', label: 'Icône (intitulé de colonne de méga-menu)', widget: 'string', required: false, hint: 'Nom d’une icône du site (data/icones.json) : outil, eclair, check…' }] : []),
  ...(menu ? [{ name: 'description', label: 'Description (méga-menu : une ligne sous le lien, 90 caractères)', widget: 'string', required: false }] : []),
  ...(haut ? [{ name: 'disposition', label: 'Sous-menu affiché en', widget: 'select', required: false, default: 'liste', options: [{ label: 'Liste déroulante', value: 'liste' }, { label: 'Méga-menu (colonnes)', value: 'mega' }], hint: 'Méga-menu : chaque entrée du sous-menu qui a ses propres liens devient une colonne.' }] : []),
  ...(niveaux > 0 ? [{ name: 'enfants', label: niveaux > 1 ? 'Sous-menu' : 'Sous-sous-menu ou liens de la colonne', widget: 'list', required: false, collapsed: true, fields: entreeNav(niveaux - 1, menu, false) }] : []),
];

const reglagesSite = {
  name: 'reglages', label: 'Réglages du site', editor: { preview: false },
  files: [
    {
      name: 'site', label: 'Coordonnées et informations', file: 'data/site.json',
      fields: [
        { name: 'nom', label: "Nom de l'entreprise", widget: 'string' },
        { name: 'baseline', label: 'Accroche (sous le logo)', widget: 'string' },
        { name: 'description', label: 'Description courte (pied de page)', widget: 'text' },
        { name: 'url', label: 'Adresse du site', widget: 'hidden' },
        { name: 'types_schema', label: "Type d'entreprise pour Google (schema.org)", widget: 'select', multiple: true, min: 1, max: 3, options: [...TYPES_ENTREPRISE], hint: 'Le plus précis possible ; plusieurs si l\'activité est mixte.' },
        { name: 'telephone', label: 'Téléphone', widget: 'string' },
        { name: 'email', label: 'E-mail', widget: 'string' },
        { name: 'horaires', label: 'Horaires', widget: 'string' },
        { name: 'horaires_detail', label: 'Horaires pour Google', widget: 'list', required: false, summary: '{{fields.ouverture}}–{{fields.fermeture}}', fields: [
          { name: 'jours', label: 'Jours', widget: 'select', multiple: true, options: [...JOURS] },
          { name: 'ouverture', label: 'Ouverture (HH:MM)', widget: 'string', pattern: ['^([01]\\d|2[0-3]):[0-5]\\d$', 'format HH:MM'] },
          { name: 'fermeture', label: 'Fermeture (HH:MM)', widget: 'string', pattern: ['^([01]\\d|2[0-3]):[0-5]\\d$', 'format HH:MM'] }] },
        { name: 'adresse', label: 'Adresse', widget: 'object', fields: [
          { name: 'rue', label: 'Numéro et rue', widget: 'string', required: false },
          { name: 'ville', label: 'Ville', widget: 'string' }, { name: 'code_postal', label: 'Code postal', widget: 'string' }, { name: 'pays', label: 'Pays', widget: 'hidden' }] },
        { name: 'afficher_adresse', label: "Afficher l'adresse complète", widget: 'boolean', required: false, default: false },
        { name: 'siret', label: 'SIRET', widget: 'string' },
        { name: 'zone_resume', label: "Zone d'intervention (bandeau du haut)", widget: 'string' },
        { name: 'urgence', label: "Bandeau d'urgence", widget: 'object', fields: [
          { name: 'actif', label: 'Afficher', widget: 'boolean' }, { name: 'texte', label: 'Texte', widget: 'string' }] },
        { name: 'villes', label: 'Villes desservies (de la plus importante à la moins importante)', widget: 'list', required: false, field: { name: 'ville', label: 'Ville', widget: 'string' } },
        { name: 'reseaux', label: 'Réseaux sociaux', widget: 'list', required: false, field: { name: 'url', label: 'Adresse', widget: 'string' } },
        { name: 'fiche_google', label: 'Fiche Google (lien Google Maps)', widget: 'string', required: false },
        { name: 'logo', label: 'Logo', widget: 'image', required: false },
        { name: 'cta_defaut', label: "Appel à l'action des pages de détail", widget: 'object', collapsed: true, fields: [
          { name: 'titre', label: 'Titre', widget: 'string' }, { name: 'texte', label: 'Texte', widget: 'text' },
          { name: 'ctas', label: 'Boutons', widget: 'list', fields: [{ name: 'label', label: 'Libellé', widget: 'string' }, { name: 'href', label: 'Lien', widget: 'string' }, { name: 'style', label: 'Style', widget: 'select', options: ['primaire', 'secondaire'] }] },
          { name: 'note', label: 'Note', widget: 'string', required: false }] },
      ],
    },
    {
      name: 'menu', label: 'Menu principal', file: 'data/menu.json',
      fields: [
        { name: 'principal', label: 'Entrées (7 maximum)', widget: 'list', max: 7, summary: '{{fields.label}} {{fields.page}}{{fields.element}}{{fields.collection}}', fields: entreeNav(2, true) },
        { name: 'bouton', label: "Bouton d'action", widget: 'object', fields: [{ name: 'label', label: 'Libellé', widget: 'string' }, { name: 'href', label: 'Lien', widget: 'string' }] },
      ],
    },
    {
      name: 'labels', label: 'Labels et certifications', file: 'data/labels.json',
      description: 'Qualifications, labels, assurances et agréments. Un label disparaît du site après sa date de fin ; vous êtes prévenu 60 jours avant dans votre espace.',
      fields: [
        { name: 'labels', label: 'Labels', label_singular: 'Label', widget: 'list', required: false, max: 20, summary: '{{fields.nom}} {{fields.fin}}', fields: [
          { name: 'id', label: 'Identifiant (minuscules et tirets, ne pas changer ensuite)', widget: 'string', pattern: ['^[a-z0-9-]{2,40}$', 'minuscules, chiffres, tirets'] },
          { name: 'nom', label: 'Nom', widget: 'string', hint: 'Ex. QualiPAC, Garantie décennale', pattern: ['^[\\s\\S]{2,80}$', '80 caractères maximum'] },
          { name: 'type', label: 'Nature', widget: 'select', options: Object.entries(TYPES_LABELS).map(([value, label]) => ({ value, label })) },
          { name: 'organisme', label: 'Organisme ou assureur', widget: 'string', required: false },
          { name: 'numero', label: 'Numéro (facultatif)', widget: 'string', required: false },
          { name: 'fin', label: 'Valable jusqu\'au', widget: 'datetime', required: false, date_format: 'DD/MM/YYYY', time_format: false, format: 'YYYY-MM-DD', picker_utc: true, hint: 'Après cette date, le label disparaît du site.' },
          { name: 'texte', label: 'Ce que ça garantit au client', widget: 'text', required: false, pattern: ['^[\\s\\S]{0,200}$', '200 caractères maximum'] },
          { name: 'icone', label: 'Icône (si pas de logo)', widget: 'select', required: false, options: Object.keys(icones) },
          { name: 'logo', label: 'Logo officiel', widget: 'object', required: false, collapsed: true, fields: [
            { name: 'src', label: 'Fichier', widget: 'image', required: false, choose_url: false },
            { name: 'alt', label: 'Texte alternatif', widget: 'string', required: false, hint: 'Ex. Logo QualiPAC' }] },
          { name: 'document', label: 'Attestation (PDF)', widget: 'file', required: false, choose_url: false },
          { name: 'verification', label: 'Page officielle de vérification', widget: 'string', required: false, hint: 'Adresse https:// de l\'annuaire de l\'organisme' },
          { name: 'afficher_fin', label: 'Afficher la date de validité', widget: 'boolean', required: false, default: true },
        ] },
      ],
    },
    {
      name: 'footer', label: 'Pied de page', file: 'data/footer.json',
      fields: [
        { name: 'colonnes', label: 'Colonnes', widget: 'list', max: 3, summary: '{{fields.titre}}', fields: [
          { name: 'titre', label: 'Titre', widget: 'string' }, { name: 'liens', label: 'Liens', widget: 'list', fields: entreeNav(0) }] },
        { name: 'legal', label: 'Liens légaux', widget: 'list', fields: entreeNav(0) },
        { name: 'devise', label: 'Devise (après la baseline)', widget: 'string', required: false, hint: 'Facultatif, une courte phrase' },
        { name: 'logo_taille', label: 'Hauteur du logo (px)', widget: 'number', value_type: 'int', min: 24, max: 120, required: false, default: 52 },
        { name: 'adhesions', label: 'Membre de (logos)', widget: 'list', required: false, summary: '{{fields.nom}}', hint: 'Associations ou réseaux dont vous êtes membre, avec le droit d\'utiliser leur logo', fields: [
          { name: 'nom', label: 'Nom (texte alternatif)', widget: 'string', hint: 'Ex. « Membre de l\'association Green IT »' },
          { name: 'logo', label: 'Logo (SVG ou PNG, version pour fond sombre)', widget: 'image', choose_url: false, media_folder: '/public/logos', public_folder: '/logos' },
          { name: 'lien', label: 'Lien', widget: 'string', required: false, hint: 'Adresse https:// du réseau' },
          { name: 'hauteur', label: 'Hauteur (px)', widget: 'number', value_type: 'int', min: 24, max: 80, required: false, default: 40 },
        ] },
        { name: 'contact', label: 'Bandeau des coordonnées', widget: 'object', required: false, collapsed: true, hint: 'Téléphone en grand, e-mail, lieu et horaires en tête du pied de page (coordonnées et horaires : Réglages du site)', fields: [
          { name: 'titre', label: 'Titre', widget: 'string', required: false, hint: 'Ex. « Parlons de votre projet »' },
          { name: 'texte', label: 'Phrase', widget: 'string', required: false, hint: 'Ex. « Un interlocuteur direct, qui vous répond. »' },
          { name: 'ouvert', label: 'Mention pendant les horaires', widget: 'string', required: false, hint: 'Défaut : « Joignables maintenant » (ex. « Ouvert en ce moment » pour un restaurant)' },
        ] },
      ],
    },
    // Grille de prix : seulement pour les sites qui en ont une
    ...(existsSync(join(R, 'data/tarifs.json'))
      ? [{ name: 'tarifs', label: 'Tarifs', file: 'data/tarifs.json', fields: champsObjet(js(tarifsSchema)) }]
      : []),
    // Carte d'un restaurant : seulement pour les sites qui en ont une
    ...(existsSync(join(R, 'data/carte-restaurant.json'))
      ? [{ name: 'carte-restaurant', label: 'Carte du restaurant', file: 'data/carte-restaurant.json', fields: champsObjet(js(carteRestaurantSchema)) }]
      : []),
    // Témoignages de clients : seulement pour les sites qui en ont (l'assistant crée le fichier au premier témoignage)
    ...(existsSync(join(R, 'data/temoignages.json'))
      ? [{ name: 'temoignages', label: 'Témoignages clients', file: 'data/temoignages.json', fields: [
          { name: 'liste', label: 'Témoignages', widget: 'list', summary: '{{fields.auteur}} : {{fields.texte}}', fields: champsObjet(js(temoignageSchema)) },
        ] }]
      : []),
    // Partenaires : seulement pour les sites qui en ont (logos rangés dans media/partenaires/)
    ...(existsSync(join(R, 'data/partenaires.json'))
      ? [{
          name: 'partenaires', label: 'Partenaires', file: 'data/partenaires.json',
          fields: [
            { name: 'liste', label: 'Partenaires', widget: 'list', summary: '{{fields.nom}} ({{fields.niveau}})', fields: [
              { name: 'nom', label: 'Nom', widget: 'string', pattern: ['^.{2,60}$', '2 à 60 caractères'] },
              { name: 'id', label: 'Identifiant (minuscules, tirets)', widget: 'string', pattern: ['^[a-z0-9-]{2,40}$', 'minuscules, chiffres, tirets'] },
              { name: 'niveau', label: 'Niveau', widget: 'select', options: [
                { label: 'Partenaire principal', value: 'principal' }, { label: 'Partenaire officiel', value: 'officiel' }, { label: 'Soutien', value: 'soutien' }] },
              { name: 'logo', label: 'Logo (PNG, fond transparent de préférence)', widget: 'image', required: false, choose_url: false,
                media_folder: '/media/partenaires', public_folder: '/img/partenaires' },
              { name: 'url', label: 'Site du partenaire (https://…)', widget: 'string', required: false, pattern: ['^https://[^\\s"\'<>]+$', 'adresse https:// attendue'] },
              { name: 'texte', label: 'Une phrase (partenaire principal)', widget: 'string', required: false, pattern: ['^[\\s\\S]{0,140}$', '140 caractères maximum'] },
              { name: 'actif', label: 'Affiché sur le site', widget: 'boolean', default: true },
            ] },
            { name: 'devenir', label: 'Case « Devenir partenaire »', widget: 'object', required: false, collapsed: true, fields: [
              { name: 'label', label: 'Texte', widget: 'string' }, { name: 'href', label: 'Lien', widget: 'string' }] },
          ],
        }]
      : []),
  ],
};

/* ------------------------------------ Config ------------------------------------ */
function pagesImbriquees() {
  const racine = join(R, 'content/pages');
  const liste: string[] = [];
  const parcourir = (d: string) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) parcourir(p); else if (p.endsWith('.yaml') && relative(racine, p).includes('/')) liste.push(p); });
  parcourir(racine);
  return liste.map((p) => {
    const rel = relative(R, p);
    const id = relative(racine, p).replace(/\.yaml$/, '');
    const titre = (readFileSync(p, 'utf8').match(/^titre:\s*(.+)$/m)?.[1] ?? id).replace(/^["']|["']$/g, '');
    return {
      name: id.replace(/[^a-z0-9]+/gi, '-'), label: `${titre} (/${id})`, file: rel, fields: champsPage(),
      // Images de la page rangées dans media/pages/<chemin>/ (Decap ne garde que le nom du fichier)
      media_folder: `/media/pages/${id}`, public_folder: `/img/pages/${id}`,
    };
  });
}

function config() {
  const url = (process.env.SITE_URL || site.url).replace(/\/$/, '');
  const imbriquees = pagesImbriquees();
  return {
    backend: {
      // Sans compte GitHub : connexion par l'espace client, puis relais vers GitHub (code commun du serveur, /xmedia-ai/)
      name: 'github', repo: DEPOT, branch: 'main', base_url: url, auth_endpoint: 'xmedia-ai/decap-auth.php', api_root: `${url}/xmedia-ai/github.php`, squash_merges: true,
      commit_messages: { create: 'Decap : création de {{collection}} « {{slug}} »', update: 'Decap : modification de {{collection}} « {{slug}} »', delete: 'Decap : suppression de {{collection}} « {{slug}} »', uploadMedia: 'Decap : ajout de {{path}}', deleteMedia: 'Decap : suppression de {{path}}', openAuthoring: '{{message}}' },
    },
    local_backend: true,
    publish_mode: 'editorial_workflow',
    locale: 'fr',
    site_url: url,
    display_url: url,
    // /img/<chemin> dans le contenu = media/<chemin> dans le dépôt (résolu au build)
    media_folder: 'media',
    public_folder: '/img',
    slug: { encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' },
    collections: [
      {
        name: 'pages', label: 'Pages', label_singular: 'Page', folder: 'content/pages', extension: 'yaml', format: 'yaml', create: true,
        identifier_field: 'titre', summary: '{{titre}} — {{statut}}', slug: '{{slug}}', editor: { preview: false },
        media_folder: '/media/pages/{{filename}}', public_folder: '/img/pages/{{filename}}',
        description: 'Pages principales du site. Les pages rangées sous une rubrique (ex. /services/pompe-a-chaleur/piscine) sont dans « Sous-pages ». Les pages en brouillon ne sont pas publiées.', fields: champsPage(),
      },
      ...(imbriquees.length ? [{ name: 'sous_pages', label: 'Sous-pages', label_singular: 'Sous-page', description: 'Pages rangées sous une rubrique, ex. Services › Pompe à chaleur › Piscine (/services/pompe-a-chaleur/piscine).', editor: { preview: false }, files: imbriquees }] : []),
      // Albums : jamais dans l'éditeur, seulement dans l'espace client (vérification du droit à l'image avant publication)
      // Club : les albums ne passent jamais par l'éditeur (vérification du droit à l'image dans l'espace client)
      ...collectionsDuSite().filter((nom) => !(modeleSite === 'club' && nom === 'albums')).map((nom) => ({
        name: nom, label: reglages[nom].libelle, folder: `content/${nom}`, extension: 'md', format: 'frontmatter', create: true,
        identifier_field: 'titre', summary: '{{titre}}', slug: '{{slug}}', editor: { preview: false },
        media_folder: `/media/${nom}/{{filename}}`, public_folder: `/img/${nom}/{{filename}}`,
        sortable_fields: ['titre', 'date', 'ordre'], ...(nom === 'rencontres' ? { summary: '{{date}} · {{titre}}', view_groups: [{ label: 'Équipe', field: 'equipe' }] } : {}), ...(nom === 'realisations' ? { view_groups: [{ label: 'Métier', field: 'categorie' }] } : {}),
        fields: champsCollection(nom),
      })),
      ...collectionsTraductions(),
      reglagesSite,
    ],
  };
}

// Traductions (data/site.json › langues) : une collection par langue, une fiche par page, tenue par scripts/langues.mjs.
// Le client corrige la traduction d'un texte (jamais le français, qui sert à la retrouver) et marque la page relue.
const NOMS_LANGUES: Record<string, string> = { en: 'anglais', de: 'allemand', it: 'italien', es: 'espagnol', nl: 'néerlandais', pt: 'portugais' };
function collectionsTraductions(): any[] {
  let langues: string[] = [];
  try { langues = (JSON.parse(readFileSync(join(R, 'data/site.json'), 'utf8')).langues?.autres ?? []).filter((l: string) => /^[a-z]{2}$/.test(l) && l !== 'fr'); } catch { /* site.json illisible : validé ailleurs */ }
  return langues.map((l) => ({
    name: `traductions_${l}`, label: `Traductions (${NOMS_LANGUES[l] ?? l})`, label_singular: 'Page traduite',
    folder: `content/traductions/${l}/pages`, extension: 'yaml', format: 'yaml', create: false, delete: false,
    identifier_field: 'titre', summary: '{{titre}} — {{etat}}', editor: { preview: false }, sortable_fields: ['titre', 'etat'], view_groups: [{ label: 'État', field: 'etat' }],
    description: `Traductions faites par l'IA à chaque mise en ligne. Corrigez le texte ${NOMS_LANGUES[l] ?? l} si besoin (gardé tant que le français ne change pas), puis marquez la page « relue ». Les marqueurs <g1>…</g1> sont la mise en forme et les liens : gardez-les autour des mêmes mots.`,
    fields: [
      { name: 'page', label: 'Page française', widget: 'string', hint: 'Ne pas modifier.' },
      { name: 'titre', label: 'Titre', widget: 'hidden' },
      { name: 'etat', label: 'État', widget: 'select', options: [{ label: 'Traduite par l\'IA', value: 'auto' }, { label: 'Relue', value: 'relue' }, { label: 'Relue, nouveaux textes à revoir', value: 'a-revoir' }], default: 'auto' },
      { name: 'textes', label: 'Textes', widget: 'list', collapsed: false, allow_add: false, summary: '{{fields.fr}}', fields: [
        { name: 'fr', label: 'Français (ne pas modifier)', widget: 'text' },
        { name: l, label: `Traduction (${NOMS_LANGUES[l] ?? l})`, widget: 'text' },
      ] },
    ],
  }));
}

installerDecap();
const cfg = config();
writeFileSync(join(ADMIN, 'config.yml'), '# Généré par scripts/decap.ts — ne pas modifier à la main.\n' + stringify(cfg, { lineWidth: 0 }));
// Même configuration en JSON : l'éditeur la filtre pour un rédacteur (seulement ses rubriques), sans analyseur YAML
writeFileSync(join(ADMIN, 'config.json'), JSON.stringify(cfg));
console.log('public/admin/config.yml généré');
void taxonomies;
