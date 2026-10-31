/**
 * Validation du contenu (spec §11). Lancée par l'IA après chaque génération,
 * et avant chaque build. Messages : fichier › chemin : problème.
 *   npm run validate            → rapport lisible, code 1 si erreur bloquante
 *   npm run validate -- --json  → rapport JSON (pour l'IA)
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { problemesMarkdown } from '../src/lib/markdown-regles';
import { mediaPermis } from '../src/lib/medias';
import { page as pageSchema } from '../src/schemas/page';
import { section as sectionSchema } from '../src/schemas/blocs';
import { collectionSchemas, nomsCollections, type NomCollection } from '../src/schemas/collections';
import { construireIndex, resoudreEntree } from '../src/lib/index-site';
import { verifierMenuPrincipal, verifierLiensPied } from '../src/lib/menu-regles';
import { executer, estPublie, type Element } from '../src/lib/requete';
import { urlPage, urlElement } from '../src/lib/urls';
import taxonomies from '../data/taxonomies.json' with { type: 'json' };
import menu from '../data/menu.json' with { type: 'json' };
import footer from '../data/footer.json' with { type: 'json' };
import siteDonnees from '../data/site.json' with { type: 'json' };
import { site as siteSchema } from '../src/schemas/site';
import formulairesDonnees from '../data/formulaires.json' with { type: 'json' };
import { formulaires as formulairesSchema } from '../src/schemas/formulaires';
import labelsDonnees from '../data/labels.json' with { type: 'json' };
import { labelsFichier } from '../src/schemas/labels';
import { tarifs as tarifsSchema } from '../src/schemas/tarifs';
import { temoignages as temoignagesSchema } from '../src/schemas/temoignages';
import { carteRestaurant as carteRestaurantSchema, allergenesManquants, aujourdhuiParis } from '../src/schemas/carte-restaurant';
import { partenaires as partenairesSchema } from '../src/schemas/partenaires';
import { manquesLegal } from '../src/lib/legal';
import { lireRedirections } from '../src/lib/redirections';

type Niveau = 'erreur' | 'avertissement';
const rapport: { niveau: Niveau; fichier: string; chemin: string; message: string }[] = [];
const signaler = (niveau: Niveau, fichier: string, chemin: (string | number)[] | string, message: string) =>
  rapport.push({ niveau, fichier, chemin: Array.isArray(chemin) ? formater(chemin) : chemin, message });
const formater = (c: (string | number | symbol)[]) => c.map((x, i) => (typeof x === 'number' ? `[${x}]` : (i ? '.' : '') + String(x))).join('');

const RACINE = process.cwd();
const lister = (dir: string, ext: string): string[] =>
  !existsSync(dir) ? [] : readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? lister(p, ext) : p.endsWith(ext) ? [p] : []; });
const rel = (p: string) => relative(RACINE, p);

function lireYaml(fichier: string, texte: string): any {
  try { return parseYaml(texte, { prettyErrors: true }); }
  catch (e: any) { signaler('erreur', fichier, 'yaml', `YAML invalide : ${e.message.split('\n')[0]}`); return undefined; }
}

/* ------------------------------ 1. Schémas ------------------------------ */
const pages: (Element & { fichier: string })[] = [];
for (const f of lister(join(RACINE, 'content/pages'), '.yaml')) {
  const brut = lireYaml(rel(f), readFileSync(f, 'utf8'));
  if (brut === undefined) continue;
  const r = pageSchema.safeParse(brut);
  if (!r.success) { for (const i of r.error.issues) signaler('erreur', rel(f), i.path as any, i.message); continue; }
  pages.push({ id: relative(join(RACINE, 'content/pages'), f).replace(/\.yaml$/, ''), data: r.data, fichier: rel(f) });
}

const collections = {} as Record<NomCollection, (Element & { fichier: string; corps: string })[]>;
for (const nom of nomsCollections) {
  collections[nom] = [];
  for (const f of lister(join(RACINE, 'content', nom), '.md')) {
    const texte = readFileSync(f, 'utf8');
    const m = texte.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) { signaler('erreur', rel(f), 'frontmatter', 'frontmatter YAML absent (--- ... ---)'); continue; }
    const brut = lireYaml(rel(f), m[1]);
    if (brut === undefined) continue;
    const r = collectionSchemas[nom].safeParse(brut);
    if (!r.success) { for (const i of r.error.issues) signaler('erreur', rel(f), i.path as any, i.message); continue; }
    (r.data.sections ?? []).forEach((s: unknown, k: number) => {
      const rs = sectionSchema.safeParse(s);
      if (!rs.success) for (const i of rs.error.issues) signaler('erreur', rel(f), ['sections', k, ...(i.path as any)], i.message);
    });
    // Corps Markdown : mêmes règles que les champs markdown des blocs (pas de HTML brut, pas de lien javascript:…)
    for (const message of problemesMarkdown(m[2])) signaler('erreur', rel(f), 'corps', message);
    collections[nom].push({ id: relative(join(RACINE, 'content', nom), f).replace(/\.md$/, ''), data: r.data, fichier: rel(f), corps: m[2] });
  }
}

// data/site.json : coordonnées et données structurées de l'entreprise
{
  const r = siteSchema.safeParse(siteDonnees);
  if (!r.success) for (const i of r.error.issues) signaler('erreur', 'data/site.json', i.path as any, i.message);
  else {
    const s = r.data;
    if (s.types_schema.length === 1 && s.types_schema[0] === 'LocalBusiness') signaler('avertissement', 'data/site.json', 'types_schema', 'type générique « LocalBusiness » : choisir le type le plus précis du métier (liste dans src/schemas/site.ts)');
    if (!s.horaires_detail?.length) signaler('avertissement', 'data/site.json', 'horaires_detail', 'horaires non lisibles par Google : les déduire du champ « horaires »');
    if (!s.villes?.length) signaler('avertissement', 'data/site.json', 'villes', 'villes desservies non déclarées : seule la ville du siège est indiquée à Google');
  }
}

// data/formulaires.json : formulaires métier (spec partie 5)
{
  const r = formulairesSchema.safeParse(formulairesDonnees);
  if (!r.success) for (const i of r.error.issues) signaler('erreur', 'data/formulaires.json', i.path as any, i.message);
}

// data/labels.json : labels et certifications (expirés : masqués ; 60 jours avant : avertissement)
{
  const r = labelsFichier.safeParse(labelsDonnees);
  if (!r.success) for (const i of r.error.issues) signaler('erreur', 'data/labels.json', i.path as any, i.message);
  else {
    const jour = new Date().toISOString().slice(0, 10);
    const dans60 = new Date(Date.now() + 60 * 864e5).toISOString().slice(0, 10);
    r.data.labels.forEach((l, i) => {
      if (l.fin && l.fin < jour) signaler('avertissement', 'data/labels.json', ['labels', i, 'fin'], `« ${l.nom} » a expiré le ${l.fin} : il n'est plus affiché sur le site`);
      else if (l.fin && l.fin <= dans60) signaler('avertissement', 'data/labels.json', ['labels', i, 'fin'], `« ${l.nom} » expire le ${l.fin} : penser au renouvellement`);
      if (l.document && !existsSync(join(RACINE, 'media/' + l.document.slice(5)))) signaler('erreur', 'data/labels.json', ['labels', i, 'document'], `document introuvable : media/${l.document.slice(5)}`);
    });
  }
}

// data/carte-restaurant.json : carte d'un restaurant (facultative), obligatoire dès qu'une page utilise le bloc
{
  const fichier = join(RACINE, 'data/carte-restaurant.json');
  const F = 'data/carte-restaurant.json';
  if (existsSync(fichier)) {
    const r = carteRestaurantSchema.safeParse(JSON.parse(readFileSync(fichier, 'utf8')));
    if (!r.success) for (const i of r.error.issues) signaler('erreur', F, i.path as any, i.message);
    else {
      const auj = aujourdhuiParis();
      // Allergènes : information obligatoire au restaurant ; sur le site, un plat non renseigné affiche « nous consulter »
      const manquants: string[] = [];
      r.data.rubriques.forEach((ru, i) => ru.plats.forEach((p, j) => { if (allergenesManquants(p)) manquants.push(`${p.nom} (rubriques[${i}].plats[${j}])`); }));
      if (manquants.length) signaler('avertissement', F, 'rubriques', `${manquants.length} plat(s) sans allergènes renseignés (cocher les allergènes présents, ou « aucun ») : ${manquants.slice(0, 6).join(', ')}${manquants.length > 6 ? '…' : ''}`);
      r.data.menus.forEach((m, i) => {
        if (m.type === 'du-jour' && m.date && m.date < auj) signaler('avertissement', F, ['menus', i, 'date'], `menu du jour « ${m.titre} » du ${m.date} : passé, il n'est plus affiché (à retirer)`);
        if (m.type === 'evenement' && m.au && m.au < auj) signaler('avertissement', F, ['menus', i, 'au'], `menu « ${m.titre} » terminé le ${m.au} : il n'est plus affiché (à retirer)`);
      });
      const titres = new Set(r.data.rubriques.map((x) => x.titre).filter(Boolean));
      for (const p of pages) (p.data.sections ?? []).forEach((s: any, k: number) => {
        if (s?.block === 'carte-restaurant') for (const x of s.rubriques ?? []) if (!titres.has(x)) signaler('erreur', p.fichier, ['sections', k, 'rubriques'], `rubrique « ${x} » absente de ${F}`);
      });
    }
  } else {
    for (const p of pages) (p.data.sections ?? []).forEach((s: any, k: number) => {
      if (s?.block === 'carte-restaurant') signaler('erreur', p.fichier, ['sections', k], `bloc carte-restaurant sans ${F}`);
    });
  }
}

// data/temoignages.json : témoignages de clients (facultatif) ; réalisations et témoignages cités doivent exister
{
  const F = 'data/temoignages.json';
  const fichier = join(RACINE, F);
  let ids = new Set<string>();
  if (existsSync(fichier)) {
    const brut = JSON.parse(readFileSync(fichier, 'utf8'));
    const r = temoignagesSchema.safeParse(brut);
    if (!r.success) for (const i of r.error.issues) signaler('erreur', F, i.path as any, i.message);
    const liste: any[] = Array.isArray(brut?.liste) ? brut.liste : [];
    {
      ids = new Set(liste.map((t) => t.id));
      liste.forEach((t, i) => {
        if (t.realisation && !existsSync(join(RACINE, 'content/realisations', t.realisation + '.md'))) signaler('erreur', F, ['liste', i, 'realisation'], `réalisation « ${t.realisation} » introuvable dans content/realisations/`);
        if (/\[À COMPLÉTER/i.test(`${t.texte} ${t.auteur}`)) signaler('erreur', F, ['liste', i], 'témoignage à compléter : seulement les mots du client');
      });
    }
  }
  for (const p of pages) (p.data.sections ?? []).forEach((s: any, k: number) => {
    if (s?.block !== 'temoignages') return;
    if (!existsSync(fichier)) signaler('avertissement', p.fichier, ['sections', k], `bloc temoignages sans ${F} : il n'affiche rien`);
    for (const x of s.elements ?? []) if (!ids.has(x)) signaler('erreur', p.fichier, ['sections', k, 'elements'], `témoignage « ${x} » absent de ${F}`);
  });
}

// data/tarifs.json : grille de prix (facultative), obligatoire dès qu'une page utilise le bloc tarifs
{
  const fichier = join(RACINE, 'data/tarifs.json');
  if (existsSync(fichier)) {
    const r = tarifsSchema.safeParse(JSON.parse(readFileSync(fichier, 'utf8')));
    if (!r.success) for (const i of r.error.issues) signaler('erreur', 'data/tarifs.json', i.path as any, i.message);
  } else {
    for (const p of pages) (p.data.sections ?? []).forEach((s: any, k: number) => {
      if (s?.block === 'tarifs') signaler('erreur', p.fichier, ['sections', k], 'bloc tarifs sans data/tarifs.json');
    });
  }
}

// data/partenaires.json : partenaires (facultatif), obligatoire dès qu'une page utilise le bloc partenaires.
// Logos et marqueurs vérifiés plus bas, avec le reste du contenu (section 3).
let partenairesDonnees: any = null;
{
  const fichier = join(RACINE, 'data/partenaires.json');
  if (existsSync(fichier)) {
    partenairesDonnees = JSON.parse(readFileSync(fichier, 'utf8'));
    const r = partenairesSchema.safeParse(partenairesDonnees);
    if (!r.success) for (const i of r.error.issues) signaler('erreur', 'data/partenaires.json', i.path as any, i.message);
  } else {
    for (const p of pages) (p.data.sections ?? []).forEach((s: any, k: number) => {
      if (s?.block === 'partenaires') signaler('erreur', p.fichier, ['sections', k], 'bloc partenaires sans data/partenaires.json');
    });
  }
}

/* ------------------------ 2. Index et navigation ------------------------ */
const index = construireIndex(pages, collections as any, taxonomies);
const verifierNav = (fichier: string, liste: any[], chemin: string) =>
  liste.forEach((e, i) => {
    const r = resoudreEntree(e, index);
    if (r.probleme) signaler(r.probleme.grave ? 'erreur' : 'avertissement', fichier, `${chemin}[${i}]`, r.probleme.message);
    if (e.enfants) verifierNav(fichier, e.enfants, `${chemin}[${i}].enfants`);
  });
verifierNav('data/menu.json', menu.principal, 'principal');
{
  const f = join(RACINE, 'data/icones.json');
  const icones = new Set(existsSync(f) ? Object.keys(JSON.parse(readFileSync(f, 'utf8'))) : []);
  verifierMenuPrincipal(menu.principal, (n, c, m) => signaler(n, 'data/menu.json', c, m), icones);
}
if (menu.principal.length > 7) signaler('erreur', 'data/menu.json', 'principal', `7 entrées maximum (${menu.principal.length})`);
footer.colonnes.forEach((c, i) => verifierNav('data/footer.json', c.liens, `colonnes[${i}].liens`));
verifierNav('data/footer.json', footer.legal, 'legal');
footer.colonnes.forEach((c, i) => verifierLiensPied(c.liens, `colonnes[${i}].liens`, (n, ch, m) => signaler(n, 'data/footer.json', ch, m)));
verifierLiensPied(footer.legal, 'legal', (n, c, m) => signaler(n, 'data/footer.json', c, m));
{
  const c = (footer as { contact?: { titre?: unknown; texte?: unknown } }).contact;
  if (c !== undefined) {
    if (typeof c !== 'object' || c === null) signaler('erreur', 'data/footer.json', 'contact', 'objet attendu : { titre, texte }');
    else {
      if (c.titre !== undefined && (typeof c.titre !== 'string' || c.titre.length > 60)) signaler('erreur', 'data/footer.json', 'contact.titre', 'texte de 60 caractères maximum');
      if (c.texte !== undefined && (typeof c.texte !== 'string' || c.texte.length > 160)) signaler('erreur', 'data/footer.json', 'contact.texte', 'texte de 160 caractères maximum');
    }
  }
}
{
  // Adhésions : logos des réseaux dont l'entreprise est membre (fichier dans public/, lien https facultatif)
  const ad = (footer as { adhesions?: unknown }).adhesions;
  if (ad !== undefined) {
    if (!Array.isArray(ad) || ad.length > 6) signaler('erreur', 'data/footer.json', 'adhesions', 'liste de 6 adhésions au plus : { nom, logo, lien?, hauteur? }');
    else ad.forEach((a: any, i: number) => {
      if (typeof a?.nom !== 'string' || a.nom.length < 2 || a.nom.length > 80) signaler('erreur', 'data/footer.json', ['adhesions', i, 'nom'], 'nom attendu (texte alternatif du logo), 80 caractères maximum');
      if (typeof a?.logo !== 'string' || !/^\/[A-Za-z0-9/_.-]+\.(svg|png|webp)$/i.test(a.logo)) signaler('erreur', 'data/footer.json', ['adhesions', i, 'logo'], 'chemin attendu : /<dossier>/<nom>.svg (fichier dans public/)');
      else if (!existsSync(join(RACINE, 'public', a.logo))) signaler('erreur', 'data/footer.json', ['adhesions', i, 'logo'], `logo introuvable : public${a.logo}`);
      if (a?.lien !== undefined && (typeof a.lien !== 'string' || !a.lien.startsWith('https://'))) signaler('erreur', 'data/footer.json', ['adhesions', i, 'lien'], 'adresse https:// attendue');
      if (a?.hauteur !== undefined && (!Number.isInteger(a.hauteur) || a.hauteur < 24 || a.hauteur > 80)) signaler('erreur', 'data/footer.json', ['adhesions', i, 'hauteur'], 'hauteur en px, de 24 à 80');
    });
  }
}

/* ------------------- 3. Liens, images, marqueurs, boucles ------------------- */
const imagesUtilisees = new Set<string>();
const provisoires = new Set<string>();

function parcourir(v: any, chemin: (string | number)[], visite: (v: any, chemin: (string | number)[]) => void) {
  visite(v, chemin);
  if (Array.isArray(v)) v.forEach((x, i) => parcourir(x, [...chemin, i], visite));
  else if (v && typeof v === 'object' && !(v instanceof Date)) for (const [k, x] of Object.entries(v)) parcourir(x, [...chemin, k], visite);
}

function verifierLien(fichier: string, chemin: (string | number)[], href: string) {
  if (!href.startsWith('/')) return;
  const url = href.split('#')[0].replace(/\/$/, '') || '/';
  // Fichier servi tel quel (public/documents/plan.pdf, une image à ouvrir…) : il suffit qu'il existe
  if (/\.[a-z0-9]{2,5}$/i.test(url) && existsSync(join('public', decodeURIComponent(url)))) return;
  const cible = index.get(url);
  if (!cible) signaler('erreur', fichier, chemin, `lien cassé : ${href}`);
  else if (!cible.publie) signaler('erreur', fichier, chemin, `lien vers une page en brouillon : ${href} (« ${cible.titre} »)`);
}

function verifierContenu(fichier: string, donnees: any, publie: boolean, courant?: Element) {
  // Boucles vides masquées : rien n'est affiché, leurs liens (« tout voir ») ne sont pas vérifiés
  const masquees: string[] = [];
  const dansMasquee = (chemin: (string | number)[]) => masquees.some((m) => chemin.join('/').startsWith(m + '/'));
  parcourir(donnees, [], (v, chemin) => {
    const cle = chemin.at(-1);
    if (typeof v === 'string') {
      if (/\[À COMPLÉTER/i.test(v)) signaler(publie ? 'erreur' : 'avertissement', fichier, chemin, `marqueur à compléter : « ${v.match(/\[À COMPLÉTER[^\]]*\]/i)?.[0]} »${publie ? ' (bloque la publication)' : ''}`);
      if (publie && cle === 'href' && !dansMasquee(chemin)) verifierLien(fichier, chemin, v);
      if (publie) for (const m of v.matchAll(/\]\((\/[^)\s]*)\)/g)) verifierLien(fichier, chemin, m[1]);
    }
    if (v && typeof v === 'object' && typeof v.src === 'string' && v.src.startsWith('/img/')) {
      const f = 'media/' + v.src.slice(5);
      imagesUtilisees.add(f);
      if (!existsSync(join(RACINE, f))) signaler('erreur', fichier, [...chemin, 'src'], `image introuvable : ${f}`);
      if (/provisoire/.test(f) && publie) provisoires.add(f);
      if (v.alt === '' ) signaler('avertissement', fichier, [...chemin, 'alt'], 'image marquée décorative (alt vide) : à confirmer');
    }
    if (v && typeof v === 'object' && v.block === 'planning') {
      const ids = new Set((collections as any).equipes?.map((e: any) => e.id) ?? []);
      for (const [k, x] of (v.equipes ?? []).entries()) {
        if (x === '$courant.id') { if (!courant) signaler('erreur', fichier, [...chemin, 'equipes', k], '$courant.id n\'est utilisable que sur une page d\'équipe'); }
        else if (!ids.has(x)) signaler('erreur', fichier, [...chemin, 'equipes', k], `équipe « ${x} » absente de content/equipes/`);
      }
    }
    if (v && typeof v === 'object' && v.block === 'boucle') {
      const txt = JSON.stringify(v);
      if (!courant && txt.includes('$courant')) { signaler('erreur', fichier, chemin, '$courant n\'est utilisable que dans une page de détail'); return; }
      for (const [champ, cond] of Object.entries(v.filtre ?? {})) {
        const valeurs = [cond as any].flat().flatMap((c: any) => (c && typeof c === 'object' ? [c.different, c.contient, c.contient_tous].flat() : [c])).filter((x) => typeof x === 'string' && !x.startsWith('$'));
        const permis = champ === 'categorie' ? taxonomies.metiers : champ === 'tags' ? (taxonomies.tags as any)[v.source] : undefined;
        for (const x of valeurs) if (permis && !(x in permis)) signaler('erreur', fichier, [...chemin, 'filtre', champ], `valeur « ${x} » absente de data/taxonomies.json`);
      }
      if (publie) {
        const n = executer(collections[v.source as NomCollection] ?? [], v, { courant }).length;
        if (n === 0) signaler('avertissement', fichier, chemin, `la boucle sur « ${v.source} » ne renvoie aucun élément (si_vide : ${v.si_vide ?? 'masquer'})`);
        if (n === 0 && (v.si_vide ?? 'masquer') === 'masquer') masquees.push(chemin.join('/'));
      }
    }
  });
}

for (const p of pages) {
  const publie = p.data.statut === 'publie';
  verifierContenu(p.fichier, p.data, publie);
  if (!publie) continue;
  // Règles de composition (avertissements)
  const s = p.data.sections;
  const max = p.data.gabarit === 'landing' ? 12 : 8;
  if (s.length > max) signaler('avertissement', p.fichier, 'sections', `${s.length} sections : ${max} maximum recommandé pour ce gabarit`);
  const ctas = s.filter((x: any) => x.block === 'cta').length;
  if (ctas > 2) signaler('avertissement', p.fichier, 'sections', `${ctas} blocs cta : 2 maximum recommandé`);
  const fond = (x: any) => (x.block === 'hero' && (x.variant === 'plein-ecran' || x.variant === 'affiche') ? 'sombre' : x.block === 'cta' && x.variant !== 'bandeau' ? null : x.background ?? 'clair');
  for (let i = 1; i < s.length; i++) {
    const a = fond(s[i - 1]), b = fond(s[i]);
    if (a && b && a === b && a !== 'clair') signaler('avertissement', p.fichier, ['sections', i, 'background'], `deux sections consécutives sur fond « ${b} »`);
    if (a === 'clair' && b === 'clair' && s[i - 1].block === s[i].block && s[i].block !== 'texte') signaler('avertissement', p.fichier, ['sections', i], `deux blocs « ${s[i].block} » consécutifs sur fond clair : varier le fond ou la disposition`);
  }
}
// Club : rencontres, actualités et albums rattachés à une équipe existante ; album publié = droit à l'image vérifié
{
  const equipes = new Set(collections.equipes.map((e) => e.id));
  for (const nom of ['rencontres', 'actualites', 'albums'] as NomCollection[]) for (const e of collections[nom] ?? []) {
    const eq = (e.data as any).equipe;
    if (eq && !equipes.has(eq)) signaler('erreur', e.fichier, 'equipe', `équipe inconnue : « ${eq} » (identifiants : ${[...equipes].join(', ')})`);
  }
  for (const e of collections.albums ?? []) if (estPublie(e) && !(e.data as any).autorisations) signaler('erreur', e.fichier, 'autorisations', 'album publié sans vérification du droit à l\'image : cocher « Droit à l\'image vérifié » ou laisser en brouillon');
}
for (const nom of nomsCollections) for (const e of collections[nom]) verifierContenu(e.fichier, { ...e.data, corps: e.corps }, estPublie(e), e);

// Partenaires : marqueurs bloquants seulement si une page publiée affiche le bloc ; logos présents dans media/
if (partenairesDonnees && Array.isArray(partenairesDonnees.liste)) {
  const affiche = pages.some((p) => p.data.statut === 'publie' && (p.data.sections ?? []).some((x: any) => x?.block === 'partenaires'));
  verifierContenu('data/partenaires.json', { liste: partenairesDonnees.liste.map((x: any) => (x?.actif === false ? {} : x)) }, affiche);
  partenairesDonnees.liste.forEach((x: any, i: number) => {
    if (typeof x?.logo !== 'string' || !x.logo.startsWith('/img/')) return;
    const f = 'media/' + x.logo.slice(5);
    imagesUtilisees.add(f);
    if (!existsSync(join(RACINE, f))) signaler('erreur', 'data/partenaires.json', ['liste', i, 'logo'], `logo introuvable : ${f}`);
  });
}

// Redirections 301 de l'ancien site (data/redirections.txt, appliquées par le serveur : xm-site redirections)
for (const r of lireRedirections()) {
  const { ligne, source, cible, probleme } = r;
  const ou = `ligne ${ligne}`;
  if (probleme) { signaler('erreur', 'data/redirections.txt', ou, probleme); continue; }
  if (!source.endsWith('*') && index.get(source.replace(/\/$/, '') || '/'))
    signaler('erreur', 'data/redirections.txt', ou, `${source} est une page du site : elle ne serait plus jamais affichée`);
  if (cible.startsWith('/')) verifierLien('data/redirections.txt', [ou], cible);
}

// Doublons SEO
const vus = new Map<string, string>();
for (const p of pages.filter((p) => p.data.statut === 'publie')) {
  for (const [k, v] of [['titre', p.data.seo?.titre], ['description', p.data.seo?.description]] as const) {
    if (!v) continue;
    if (vus.has(k + v)) signaler('avertissement', p.fichier, `seo.${k}`, `identique à ${vus.get(k + v)}`);
    else vus.set(k + v, p.fichier);
  }
}

// Médias
for (const f of lister(join(RACINE, 'media'), '')) {
  const r = rel(f);
  if (!mediaPermis(r)) { signaler('erreur', r, '', 'type de fichier refusé dans media/ : images (jpg, png, webp, avif, gif) et PDF seulement'); continue; }
  if (/\.(jpe?g|png|webp)$/i.test(r) && !imagesUtilisees.has(r)) signaler('avertissement', r, '', 'image non référencée');
}
if (provisoires.size) signaler('avertissement', 'media/', '', `${provisoires.size} image(s) provisoire(s) sur des contenus publiés : à remplacer par les vraies photos`);

// Mentions légales et confidentialité (bloc legal, générées depuis data/site.json)
const siteLegal = siteSchema.safeParse(siteDonnees);
for (const p of pages) {
  if (p.data.statut === 'brouillon' || !(p.data.sections ?? []).some((b: any) => b?.block === 'legal' && b?.variant !== 'ecoconception') || !siteLegal.success) continue;
  const m = manquesLegal(siteLegal.data);
  if (m.length) signaler('erreur', p.fichier, 'sections', `informations légales manquantes : ${m.join(', ')}`);
}
// Site ouvert aux moteurs (production, NOINDEX=0) : mentions légales et confidentialité obligatoires.
// Avertissement (signalé aussi dans le résumé du déploiement) plutôt qu'erreur : un site déjà en ligne
// doit pouvoir être mis à jour en attendant les informations légales du client.
if (process.env.NOINDEX === '0') for (const u of ['/mentions-legales', '/confidentialite']) {
  if (!index.get(u)?.publie) {
    signaler('avertissement', 'content/pages', u, `OBLIGATOIRE : page à publier (site ouvert aux moteurs) : ${u} (bloc legal, statut publie)`);
    if (process.env.GITHUB_ACTIONS) console.log(`::warning::Mentions légales : la page ${u} n'est pas publiée (obligatoire pour un site en ligne)`);
  }
}

// Pages en brouillon (information)
const brouillons = pages.filter((p) => p.data.statut === 'brouillon').map((p) => urlPage(p.id));

/* ------------------------------- Rapport -------------------------------- */
const erreurs = rapport.filter((r) => r.niveau === 'erreur');
const avert = rapport.filter((r) => r.niveau === 'avertissement');
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ok: erreurs.length === 0, erreurs, avertissements: avert, brouillons }, null, 2));
} else {
  const ligne = (r: (typeof rapport)[number]) => `  ${r.fichier}${r.chemin ? ' › ' + r.chemin : ''} : ${r.message}`;
  if (erreurs.length) console.log(`\n✖ ${erreurs.length} erreur(s) bloquante(s)\n` + erreurs.map(ligne).join('\n'));
  if (avert.length) console.log(`\n▲ ${avert.length} avertissement(s)\n` + avert.map(ligne).join('\n'));
  if (brouillons.length) console.log(`\n· ${brouillons.length} page(s) en brouillon : ${brouillons.join(', ')}`);
  const nb = pages.length + nomsCollections.reduce((n, c) => n + collections[c].length, 0);
  console.log(`\n${erreurs.length ? '✖ Validation échouée' : '✔ Validation réussie'} — ${nb} fichiers de contenu vérifiés.\n`);
}
process.exit(erreurs.length ? 1 : 0);
