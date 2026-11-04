/**
 * Collections propres au site (1.46.0) : un site déclare son type de fiche dans src/site/collections/,
 * le socle en tire le schéma, l'éditeur, le catalogue de l'IA, les pages et les données structurées.
 * Spécification : docs/specifications/collections-propres.md (dépôt socle-sites).
 *
 * Pur TypeScript (pas d'import .astro) : utilisé au build, par la validation, le catalogue, l'éditeur et npm run fiches.
 * Le contenu ne connaît que des champs ; ce que le site en fait à l'écran est dans « rendu », côté design.
 */
import { z } from 'astro/zod';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { image, markdown } from '../schemas/communs';

/* --------------------------------- Déclaration --------------------------------- */

interface ChampCommun {
  /** Nom affiché (éditeur, fiche, aperçu). */
  libelle: string;
  /** Ce que contient le champ, pour l'IA et l'aide de l'éditeur : une phrase, avec un exemple. */
  description: string;
  /** Mots du client et intitulés de colonnes qui désignent ce champ (saisie libre, import d'un tableur). */
  synonymes?: string[];
  /** Sans cette valeur, la fiche ne peut pas être publiée. */
  obligatoire?: boolean;
  /** Champ facultatif que l'assistant propose une fois s'il manque. */
  demander?: boolean;
  /** lu (défaut) : lu (étiquette, tableur) ou dit par le client, jamais deviné. deductible : peut être déduit d'un autre champ par une règle sûre. */
  origine?: 'lu' | 'deductible';
  /** 1 à 3 valeurs valides. */
  exemples?: unknown[];
}
export interface ValeurChoix { libelle: string; synonymes?: string[] }
export type Champ = ChampCommun & (
  | { type: 'texte'; max?: number }
  | { type: 'texte_long'; max?: number }
  | { type: 'entier' | 'nombre'; min?: number; max?: number; unite?: string; decimales?: number }
  | { type: 'prix' }
  | { type: 'annee'; sans_valeur?: string }
  | { type: 'choix'; valeurs: Record<string, ValeurChoix> }
  | { type: 'choix_multiple'; valeurs: Record<string, ValeurChoix>; max?: number }
  | { type: 'liste'; max?: number; max_element?: number }
  | { type: 'oui_non' }
  | { type: 'image' }
  | { type: 'images'; max?: number }
  | { type: 'reference'; vers: { collection: string } | { pages: string }; multiple?: boolean }
  | { type: 'date' }
);

export interface RenduCollection {
  /** Titre et introduction de la liste (/<base>). */
  titre_liste?: string;
  intro_liste?: string;
  /** Champs qui deviennent des filtres de la liste (choix, choix_multiple, reference, oui_non) ; le premier regroupe les fiches. */
  filtres?: string[];
  /** Tri de la liste et des boucles par défaut (« nom asc »). */
  ordre?: string;
  /** Champ image de la carte et du hero (défaut : premier champ image). */
  image?: string;
  /** titre : champs du titre de la carte (défaut : titre de la fiche), utile quand le surtitre en reprend une partie. */
  carte?: { surtitre?: string[]; titre?: string[]; details?: string[] };
  detail?: {
    surtitre?: string[];
    /** Champs listés dans le bloc « caractéristiques », dans cet ordre (défaut : tous les champs courts renseignés). */
    caracteristiques?: string[];
    /** Champs texte_long affichés en texte, avec leur titre. */
    textes?: { champ: string; titre: string }[];
    /** Champs liste affichés en liste, avec leur titre. */
    listes?: { champ: string; titre: string }[];
    /** Titre de la section qui liste les pages visées par un champ référence (« Où le trouver »). */
    references?: { champ: string; titre: string }[];
    /** Boucles « dans le même esprit » : fiches qui partagent la valeur d'un champ. */
    voisins?: { champ: string; titre: string }[];
  };
  /** Page aimant vers laquelle chaque fiche renvoie (obligatoire si le site a engagement.aimant_obligatoire). */
  aimant?: { href: string; label: string };
  /** Mention d'une fiche épuisée (défaut : « Épuisé »). */
  libelle_epuise?: string;
  /** Mention réglementaire affichée sous la liste et chaque fiche (ex. message sanitaire de la loi Évin). */
  mention?: string;
}

export interface DeclarationCollection {
  /** Nom de la collection (dossier content/<nom>/). Minuscules, chiffres, tirets. */
  nom: string;
  /** « Vins » (menu, fil d'Ariane, éditeur). */
  libelle: string;
  /** « vin » : « Nouveau vin », « 3 vins importés ». */
  element: string;
  /** Préfixe d'adresse : « /vins ». */
  base: string;
  /** Ce qu'est une fiche, pour l'IA. */
  description: string;
  /** Champ qui porte le titre, ou champs qui le composent (« Cuvée des Garrigues — Domaine X »). */
  titre: string | string[];
  /** Champs qui identifient une fiche (import, doublons). */
  cle: string[];
  /** Composition de l'id, donc de l'adresse. Par cuvée : sans le millésime ; par millésime : avec. */
  identifiant: string[];
  champs: Record<string, Champ>;
  /** Champ prix soumis à l'option « afficher les prix » (data/collections/<nom>.json › prix_affiches). */
  prix?: string;
  /** Condition pour qu'une fiche soit indexée : textes propres (provenance hors des sources exclues) d'au moins « mots » mots. */
  indexable?: { textes: string[]; mots: number; provenances_exclues?: string[] };
  /** Données structurées : type et correspondance des champs. */
  schema_org?: { type: 'Product'; marque?: string; categorie?: string; proprietes?: string[]; /** champs ajoutés au nom (ex. millésime) */ complement_nom?: string[] };
  rendu?: RenduCollection;
}

/** Aide de déclaration : vérifie la cohérence et rend la déclaration telle quelle. */
export function definirCollection(d: DeclarationCollection): DeclarationCollection {
  const err = (m: string) => { throw new Error(`src/site/collections : collection « ${d.nom} » : ${m}`); };
  if (!/^[a-z][a-z0-9-]{1,40}$/.test(d.nom)) err('nom attendu en minuscules, chiffres et tirets');
  if (!/^\/[a-z0-9-]+(\/[a-z0-9-]+)*$/.test(d.base)) err(`base « ${d.base} » invalide (ex. /vins)`);
  const reserves = new Set(Object.keys(champsCommuns));
  for (const n of Object.keys(d.champs)) {
    if (!/^[a-z][a-z0-9_]{0,40}$/.test(n)) err(`nom de champ « ${n} » invalide`);
    if (reserves.has(n)) err(`le champ « ${n} » est un champ commun du socle`);
  }
  const existe = (c: string, ou: string) => { if (!d.champs[c]) err(`${ou} : champ « ${c} » inconnu`); };
  [d.titre].flat().forEach((c) => existe(c, 'titre'));
  d.cle.forEach((c) => existe(c, 'cle'));
  d.identifiant.forEach((c) => existe(c, 'identifiant'));
  if (d.prix) { existe(d.prix, 'prix'); if (d.champs[d.prix].type !== 'prix') err(`prix : « ${d.prix} » n'est pas de type prix`); }
  d.indexable?.textes.forEach((c) => existe(c, 'indexable'));
  const r = d.rendu ?? {};
  for (const c of r.filtres ?? []) {
    existe(c, 'rendu.filtres');
    if (!['choix', 'choix_multiple', 'reference', 'oui_non'].includes(d.champs[c].type)) err(`rendu.filtres : « ${c} » ne peut pas filtrer (choix, choix_multiple, reference ou oui_non)`);
  }
  [...(r.carte?.surtitre ?? []), ...(r.carte?.titre ?? []), ...(r.carte?.details ?? []), ...(r.detail?.surtitre ?? []), ...(r.detail?.caracteristiques ?? [])].forEach((c) => existe(c, 'rendu'));
  [...(r.detail?.textes ?? []), ...(r.detail?.listes ?? []), ...(r.detail?.references ?? []), ...(r.detail?.voisins ?? [])].forEach((x) => existe(x.champ, 'rendu.detail'));
  if (r.image) existe(r.image, 'rendu.image');
  return d;
}

/* --------------------------------- Options du client --------------------------------- */

export interface OptionsCollection { prix_affiches: boolean }
/** Options réglées par le client (data/collections/<nom>.json), hors des zones de l'IA. */
export function optionsCollection(nom: string): OptionsCollection {
  const f = join(process.cwd(), 'data/collections', `${nom}.json`);
  let o: Partial<OptionsCollection> = {};
  try { if (existsSync(f)) o = JSON.parse(readFileSync(f, 'utf8')); } catch { throw new Error(`data/collections/${nom}.json : JSON invalide`); }
  return { prix_affiches: o.prix_affiches !== false };
}

/* --------------------------------- Schéma --------------------------------- */

const seo = z
  .object({
    titre: z.string().max(60).optional(),
    description: z.string().min(120).max(160).optional(),
    noindex: z.boolean().default(false),
  })
  .strict()
  .default({ noindex: false });

/** Champs ajoutés par le socle à toute collection propre (sans « categorie » : un métier n'a pas de sens pour un vin). */
const champsCommuns = {
  titre: z.string().min(3).max(120).optional().describe('Composé automatiquement à partir des champs du titre (ne pas saisir)'),
  statut: z.enum(['brouillon', 'publie']).default('publie'),
  epuise: z.boolean().default(false).describe('Épuisé : la fiche reste en ligne avec la mention « épuisé »'),
  ordre: z.number().int().default(100),
  mis_en_avant: z.boolean().default(false),
  resume: z.string().max(300).optional(),
  seo,
  ancres: z.array(z.string().min(3).max(60)).max(6).optional()
    .describe("Expressions qui, dans le texte des autres pages, deviennent un lien vers cette fiche. Précises, 2 à 6 mots."),
  role: z.enum(['aimant', 'seo']).optional(),
  provenance: z.record(z.string(), z.string().max(40)).optional()
    .describe("Origine de chaque valeur ou texte (champ : etiquette, contre-etiquette, client, caviste, liste-prix…). Jamais affichée."),
  sections: z.array(z.any()).optional(),
};

const descr = (c: Champ) => `${c.libelle} : ${c.description}${c.synonymes?.length ? ` (aussi : ${c.synonymes.join(', ')})` : ''}`;

function schemaChamp(c: Champ): z.ZodTypeAny {
  let s: z.ZodTypeAny;
  switch (c.type) {
    case 'texte': s = z.string().min(1).max(c.max ?? 120); break;
    case 'texte_long': s = markdown.max(c.max ?? 2000); break;
    case 'entier': case 'nombre': {
      let n = c.type === 'entier' ? z.number().int() : z.number();
      if (c.min != null) n = n.min(c.min);
      if (c.max != null) n = n.max(c.max);
      s = n; break;
    }
    case 'prix': s = z.number().min(0).max(1_000_000).refine((x) => Math.round(x * 100) === x * 100 || Math.abs(Math.round(x * 100) - x * 100) < 1e-6, 'deux décimales au plus'); break;
    case 'annee': {
      // L'éditeur peut l'enregistrer en texte (« 2022 ») : converti en nombre
      const a = z.coerce.number().int().min(1800).max(2100);
      s = c.sans_valeur ? z.union([z.literal('sans'), a]).describe(`année, ou « sans » (${c.sans_valeur})`) : a;
      break;
    }
    case 'choix': s = z.enum(Object.keys(c.valeurs) as [string, ...string[]]); break;
    case 'choix_multiple': s = z.array(z.enum(Object.keys(c.valeurs) as [string, ...string[]])).max(c.max ?? Object.keys(c.valeurs).length); break;
    case 'liste': s = z.array(z.string().min(1).max(c.max_element ?? 80)).max(c.max ?? 10); break;
    case 'oui_non': s = z.boolean(); break;
    case 'image': s = image; break;
    case 'images': s = z.array(image).max(c.max ?? 12); break;
    case 'reference': {
      const id = z.string().regex(/^[a-z0-9][a-z0-9/-]*$/, 'identifiant attendu (minuscules, chiffres, tirets)');
      s = c.multiple ? z.array(id).max(20) : id; break;
    }
    case 'date': s = z.coerce.date(); break;
  }
  return s.optional().describe(descr(c));
}

const vide = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0);

/** Titre composé : « Cuvée des Garrigues — Domaine X ». */
export function titreFiche(d: DeclarationCollection, data: Record<string, any>): string {
  if (typeof d.titre === 'string') return String(data[d.titre] ?? '');
  return d.titre.map((c) => data[c]).filter((v) => !vide(v)).map(String).join(' — ');
}

/** Schéma Zod d'une collection propre : champs communs + champs déclarés ; obligatoires contrôlés sur les fiches publiées. */
export function schemaCollection(d: DeclarationCollection) {
  const options = optionsCollection(d.nom);
  const champs = Object.fromEntries(Object.entries(d.champs).map(([n, c]) => [n, schemaChamp(c)]));
  return z
    .object({ ...champsCommuns, ...champs })
    .strict()
    .overwrite((x: any) => ({ ...x, titre: titreFiche(d, x) || x.titre }))
    .superRefine((x: any, ctx) => {
      if (x.statut !== 'publie') return;
      for (const [n, c] of Object.entries(d.champs)) {
        if (!c.obligatoire || !vide(x[n])) continue;
        if (n === d.prix && !options.prix_affiches) continue;   // prix non affiché : pas exigé
        ctx.addIssue({ code: 'custom', path: [n], message: `${c.libelle} : obligatoire pour publier (ou laisser la fiche en brouillon)` });
      }
      if (!x.titre || String(x.titre).length < 3) ctx.addIssue({ code: 'custom', path: ['titre'], message: 'titre vide : renseigner les champs qui le composent' });
    })
    .describe(d.description + ` Page de détail : ${d.base}/<id>.`);
}

/* --------------------------------- Valeurs affichées --------------------------------- */

const nf = (decimales?: number) => new Intl.NumberFormat('fr-FR', { maximumFractionDigits: decimales ?? 2 });
export const prixFr = (x: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: Number.isInteger(x) ? 0 : 2 }).format(x);

/** Valeur d'un champ telle qu'elle s'affiche (sans les références, résolues par le rendu). */
export function valeurAffichee(c: Champ, v: any): string {
  if (vide(v)) return '';
  switch (c.type) {
    case 'choix': return c.valeurs[v]?.libelle ?? String(v);
    case 'choix_multiple': return (v as string[]).map((x) => c.valeurs[x]?.libelle ?? x).join(', ');
    case 'liste': return (v as string[]).join(', ');
    case 'entier': case 'nombre': return `${nf(c.decimales).format(v)}${c.unite ? ` ${c.unite}` : ''}`;
    case 'prix': return prixFr(v);
    case 'annee': return v === 'sans' ? (c.sans_valeur ?? '') : String(v);
    case 'oui_non': return v ? 'Oui' : 'Non';
    case 'date': return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(v));
    case 'image': case 'images': return '';
    default: return String(v);
  }
}

/** Valeurs d'un champ pour les filtres : liste de [clé, libellé]. */
export function valeursFiltre(c: Champ, v: any): [string, string][] {
  if (vide(v)) return [];
  if (c.type === 'choix') return [[v, c.valeurs[v]?.libelle ?? v]];
  if (c.type === 'choix_multiple') return (v as string[]).map((x) => [x, c.valeurs[x]?.libelle ?? x]);
  if (c.type === 'oui_non') return v ? [['oui', c.libelle]] : [];
  if (c.type === 'reference') return [v].flat().map((x: string) => [x, x]);
  return [];
}

/** Image de la fiche (carte, hero, partage) : rendu.image ou premier champ image. */
export function imageFiche(d: DeclarationCollection, data: Record<string, any>) {
  const n = d.rendu?.image ?? Object.entries(d.champs).find(([, c]) => c.type === 'image')?.[0];
  return n ? data[n] : undefined;
}

/** Une fiche est-elle indexable ? (seuil propre à la collection, au lieu des 300 mots de la consigne n° 10) */
export function estIndexable(d: DeclarationCollection, data: Record<string, any>): boolean {
  if (data.seo?.noindex) return false;
  const regle = d.indexable;
  if (!regle) return true;
  const exclues = new Set(regle.provenances_exclues ?? []);
  let mots = 0;
  for (const c of regle.textes) {
    const v = data[c];
    if (vide(v)) return false;   // tous les textes demandés doivent exister
    if (exclues.has(data.provenance?.[c])) return false;
    mots += [v].flat().join(' ').split(/\s+/).filter(Boolean).length;
  }
  return mots >= regle.mots;
}

/** Données structurées d'une fiche (schema.org Product), sans note ni avis. */
export function produitFiche(d: DeclarationCollection, data: Record<string, any>, o: { base: string; url: string; idEntreprise: string; image?: string; description?: string }): Record<string, unknown> | undefined {
  const s = d.schema_org;
  if (!s) return undefined;
  const nom = [data.titre, ...(s.complement_nom ?? []).map((c) => valeurAffichee(d.champs[c], data[c]))].filter(Boolean).join(' ');
  const j: Record<string, unknown> = { '@context': 'https://schema.org', '@type': s.type, name: nom, url: o.base + o.url };
  if (o.image) j.image = o.image;
  if (o.description) j.description = o.description;
  if (s.marque && data[s.marque]) j.brand = { '@type': 'Brand', name: valeurAffichee(d.champs[s.marque], data[s.marque]) };
  if (s.categorie && data[s.categorie]) j.category = valeurAffichee(d.champs[s.categorie], data[s.categorie]);
  const props = (s.proprietes ?? []).filter((c) => !vide(data[c]) && d.champs[c].type !== 'reference')
    .map((c) => ({ '@type': 'PropertyValue', name: d.champs[c].libelle, value: valeurAffichee(d.champs[c], data[c]) }));
  if (props.length) j.additionalProperty = props;
  if (d.prix && optionsCollection(d.nom).prix_affiches && typeof data[d.prix] === 'number') {
    j.offers = {
      '@type': 'Offer', price: data[d.prix].toFixed(2), priceCurrency: 'EUR', url: o.base + o.url,
      availability: data.epuise ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStoreOnly',
      seller: { '@id': o.idEntreprise },
    };
  }
  return j;
}

/* --------------------------------- Identifiants --------------------------------- */

export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/œ/g, 'oe').replace(/æ/g, 'ae')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');

/** id d'une fiche à partir des champs de « identifiant » (contenance 75 → « 75cl » si l'unité est donnée). */
export function identifiantFiche(d: DeclarationCollection, data: Record<string, any>): string {
  return slug(d.identifiant.map((c) => {
    const ch = d.champs[c]; const v = data[c];
    if (vide(v)) return '';
    if ((ch.type === 'nombre' || ch.type === 'entier') && ch.unite) return `${String(v).replace('.', '-')}${ch.unite}`;
    if (ch.type === 'choix') return v;
    if (ch.type === 'annee' && v === 'sans') return 'nm';
    return String(v);
  }).filter(Boolean).join(' '));
}

/** Clé de rapprochement (import, doublons) : valeurs normalisées des champs de « cle ». */
export function cleFiche(d: DeclarationCollection, data: Record<string, any>): string {
  return d.cle.map((c) => slug(String(data[c] ?? ''))).join('|');
}

/* --------------------------------- Export pour le serveur --------------------------------- */

/** Description d'une collection pour l'espace client (saisie, aperçu, import) : jamais de fonction, que des données. */
export function exportCollection(d: DeclarationCollection) {
  return {
    nom: d.nom, libelle: d.libelle, element: d.element, base: d.base, description: d.description,
    titre: d.titre, cle: d.cle, identifiant: d.identifiant, prix: d.prix ?? null, options: optionsCollection(d.nom),
    champs: Object.entries(d.champs).map(([nom, c]) => ({ nom, ...c, origine: c.origine ?? 'lu', obligatoire: !!c.obligatoire, demander: !!c.demander })),
    json_schema: z.toJSONSchema(schemaCollection(d), { io: 'input', unrepresentable: 'any' }),
  };
}
