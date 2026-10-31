/**
 * Maintenance éditoriale : les informations du site à vérifier (après le build), dans dist/admin/verifications.json.
 * L'espace client en tire l'écran « À vérifier » et le rapport mensuel (« 8 informations à vérifier ») ; c'est le
 * client qui confirme qu'une information est à jour ou demande sa mise à jour : rien n'est modifié ici.
 *
 * Points relevés (selon ce que le site contient) :
 *  - complement   : « [À COMPLÉTER] » resté dans un contenu ou un réglage ;
 *  - lien         : lien interne cassé (audit du maillage, ai/maillage.json) ;
 *  - annee        : année passée dans un contenu qui ne vieillit pas (« tarifs 2025 », « saison 2025-2026 ») ;
 *  - ancien       : contenu durable (démarche, info pratique, service, lieu…) non modifié depuis plus d'un an ;
 *  - ferie        : jour férié à venir (45 jours) un jour d'ouverture de la mairie, sans horaires exceptionnels ;
 *  - alerte       : alerte affichée depuis longtemps sans date de fin, ou expirée mais restée active ;
 *  - projet       : travaux dont la date de fin est passée, ou projet en travaux sans nouvelles depuis 6 mois ;
 *  - actualites   : pas d'actualité depuis 45 jours (mairie) ; agenda : aucun rendez-vous dans les 30 jours.
 * Priorité : 1 à traiter, 2 à vérifier, 3 conseil. Identifiant stable : il change quand le contenu en cause change,
 * ce qui fait réapparaître un point déjà confirmé.
 */
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { reglages } from '../src/lib/collections';
import { urlPage, urlElement } from '../src/lib/urls';
import { estPublie } from '../src/lib/requete';
import site from '../data/site.json' with { type: 'json' };

const DIST = process.argv[2] || 'dist';
const MAINTENANT = process.env.XM_AUJOURDHUI ? new Date(process.env.XM_AUJOURDHUI + 'T12:00:00') : new Date();
const JOUR = 86400000;
const ANNEE = MAINTENANT.getFullYear();
const mairie = (site as any).modele === 'collectivite';

export interface Point { id: string; type: string; priorite: 1 | 2 | 3; titre: string; detail: string; url?: string; editer?: string; depuis?: string; masquer_jours?: number }
const points: Point[] = [];
const empreinte = (t: string) => createHash('sha256').update(t).digest('hex').slice(0, 10);
const jourISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const dateLisible = (d: Date, jour = false) => `${jour ? JOURS[d.getDay()] + ' ' : ''}${d.getDate() === 1 ? '1er' : d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
const duree = (jours: number) => (jours >= 730 ? `${Math.floor(jours / 365)} ans` : jours >= 365 ? 'plus d\'un an' : jours >= 60 ? `${Math.floor(jours / 30)} mois` : `${jours} jours`);

// --- Contenus du site --------------------------------------------------------------------------
const lister = (d: string): string[] => (!existsSync(d) ? [] : readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? lister(p) : [p]; }));

/** Date de la dernière modification publiée de chaque fichier (un seul passage dans l'historique Git). */
function datesGit(): Map<string, Date> | null {
  try {
    if (execFileSync('git', ['rev-parse', '--is-shallow-repository'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() === 'true') return null;
    const sortie = execFileSync('git', ['log', '--format=@%cI', '--name-only', '--', 'content', 'data'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 200 * 1024 * 1024 });
    const m = new Map<string, Date>(); let d: Date | null = null;
    for (const l of sortie.split('\n')) { if (l.startsWith('@')) d = new Date(l.slice(1)); else if (l && d && !m.has(l)) m.set(l, d); }
    return m;
  } catch { return null; }
}
const dates = datesGit();
const modifie = (f: string) => dates?.get(f);

interface Contenu { fichier: string; collection: string; id: string; url: string; titre: string; data: any; texte: string; editer: string }
/** Texte lisible d'un contenu : sans adresses, cibles de liens, identifiants (« programme-voirie-2025 ») ni balisage. */
const lisible = (t: string) => t.replace(/\]\([^)]*\)/g, ']').replace(/https?:\/\/\S+/g, ' ').replace(/(^|\s)\/[^\s)]*/g, ' ').replace(/[*_#>`|[\]]/g, '');
const textes = (v: any, acc: string[] = []): string[] => {
  if (typeof v === 'string') { if (!/^[a-z0-9]+(?:[-_/][a-z0-9]+)*$/.test(v)) acc.push(lisible(v)); }
  else if (Array.isArray(v)) v.forEach((x) => textes(x, acc));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['image', 'images', 'src', 'href', 'brief', 'ancres', 'focus', 'icone', 'sujets', 'fichier', 'pdf', 'document', 'lien', 'url', 'elements'].includes(k)) textes(x, acc);
  return acc;
};
const contenus: Contenu[] = [];
for (const f of lister('content/pages').filter((x) => x.endsWith('.yaml'))) {
  const d = parseYaml(readFileSync(f, 'utf8')) ?? {};
  if (d.statut === 'brouillon') continue;
  const id = relative('content/pages', f).replace(/\.yaml$/, '');
  contenus.push({ fichier: f, collection: 'pages', id, url: urlPage(id), titre: d.titre ?? id, data: d, texte: textes([d.titre, d.seo, d.sections]).join('\n'), editer: `/admin/#/collections/pages/entries/${id}` });
}
for (const [nom, r] of Object.entries(reglages)) {
  for (const f of lister(join('content', nom)).filter((x) => x.endsWith('.md'))) {
    const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(readFileSync(f, 'utf8'));
    if (!m) continue;
    const d = parseYaml(m[1]) ?? {};
    const id = relative(join('content', nom), f).replace(/\.md$/, '');
    if (!estPublie({ id, data: d } as any, MAINTENANT)) continue;
    contenus.push({ fichier: f, collection: nom, id, url: (r as any).detail ? urlElement(nom as any, id) : (r as any).base, titre: d.titre ?? id, data: d, texte: textes(d).join('\n') + '\n' + lisible(m[2]), editer: `/admin/#/collections/${nom}/entries/${id}` });
  }
}
/** Collections datées par nature (une actualité de 2024 n'est pas « à mettre à jour ») ; le reste doit rester juste. */
const DATEES = new Set(['actualites', 'agenda', 'actes', 'albums', 'documents', 'realisations', 'rencontres', 'projets']);
const PAGES_TECHNIQUES = /^(mentions-legales|confidentialite|accessibilite|declaration-ecoconception|merci|lettre-confirmee|plan-du-site|404)$/;
const durable = (c: Contenu) => !DATEES.has(c.collection) && !(c.collection === 'pages' && PAGES_TECHNIQUES.test(c.id));

// --- 1. [À COMPLÉTER] -----------------------------------------------------------------------------
const RE_COMPLETER = /\[\s*[àa]\s+compl[ée]ter[^\]]*\]/i;
for (const c of contenus) {
  const m = RE_COMPLETER.exec(c.texte);
  if (m) points.push({ id: `complement:${c.fichier}:${empreinte(m[0])}`, type: 'complement', priorite: 1, titre: `Information à compléter : ${c.titre}`, detail: `La page contient encore « ${m[0]} » : une information manque.`, url: c.url, editer: c.editer });
}
/** Chemins des valeurs d'un réglage qui contiennent « [À COMPLÉTER] » (ex. site.json › telephone). */
const chemins = (v: any, ch: string[] = [], acc: string[][] = []): string[][] => {
  if (typeof v === 'string') { if (RE_COMPLETER.test(v)) acc.push(ch); }
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) chemins(x, [...ch, Array.isArray(v) ? String(+k + 1) : k], acc);
  return acc;
};
const NOMS_REGLAGES: Record<string, string> = { 'site.json': 'Coordonnées et informations', 'footer.json': 'Pied de page', 'menu.json': 'Menu', 'alerte.json': 'Alerte' };
for (const f of lister('data').filter((x) => x.endsWith('.json') && !x.includes('/traductions/'))) {
  let d: any; try { d = JSON.parse(readFileSync(f, 'utf8')); } catch { continue; }
  const nom = relative('data', f);
  for (const ch of chemins(d).slice(0, 5)) points.push({ id: `complement:${f}:${ch.join('.')}`, type: 'complement', priorite: 1, titre: `Réglage à compléter : ${NOMS_REGLAGES[nom] ?? nom}`, detail: `Le champ « ${ch.join(' › ')} » contient encore « [À COMPLÉTER] » : il s'affiche tel quel sur le site s'il est utilisé.`, editer: '/admin/#/collections/reglages' });
}

// --- 2. Liens internes cassés (audit du maillage, lancé juste avant) ---------------------------------
try {
  const audit = JSON.parse(readFileSync('ai/maillage.json', 'utf8'));
  for (const e of (audit.erreurs ?? []).slice(0, 15)) points.push({ id: `lien:${empreinte(String(e))}`, type: 'lien', priorite: 1, titre: 'Lien cassé', detail: String(e) });
} catch { /* pas d'audit : rien à signaler */ }

// --- 3. Années passées dans un contenu durable ----------------------------------------------------
const RE_PLAGE = /\b(20\d\d)\s*[-–/]\s*(20\d\d)\b/g;
const RE_MOT = /\b(tarifs?|prix|horaires?|saison|calendrier|programme|planning|inscriptions?|rentrée|année scolaire|cotisations?|édition|budget)\b[^.\n]{0,30}?\b(20\d\d)\b/gi;
const extrait = (t: string, i: number, n: number) => (i > 30 ? '…' : '') + t.slice(Math.max(0, i - 30), i + n + 30).replace(/\s+/g, ' ').trim() + (i + n + 30 < t.length ? '…' : '');
for (const c of contenus.filter(durable)) {
  const trouves: string[] = [];
  for (const m of c.texte.matchAll(RE_PLAGE)) {
    const fin = +m[2];
    if (fin === +m[1] + 1 && (fin < ANNEE || (fin === ANNEE && MAINTENANT.getMonth() >= 8))) trouves.push(extrait(c.texte, m.index!, m[0].length));
  }
  // « Depuis la rentrée 2023 », « dès 2024 » : un point de départ, pas une date dépassée
  for (const m of c.texte.matchAll(RE_MOT)) if (+m[2] < ANNEE && +m[2] >= ANNEE - 6 && !/\b(depuis|dès|des|créée?s? en|fondée?s? en)\b[^.\n]{0,20}$/i.test(c.texte.slice(Math.max(0, m.index! - 25), m.index!))) trouves.push(extrait(c.texte, m.index!, m[0].length));
  if (trouves.length) {
    const uniques = [...new Set(trouves)].slice(0, 3);
    points.push({ id: `annee:${c.fichier}:${empreinte(uniques.join('|'))}`, type: 'annee', priorite: 2, titre: `Date dépassée ? ${c.titre}`, detail: `Le texte parle d'une année passée : ${uniques.map((x) => `« ${x} »`).join(' ; ')}`, url: c.url, editer: c.editer, masquer_jours: 3650 });
  }
}

// --- 4. Contenus durables non modifiés depuis plus d'un an ------------------------------------------
if (dates) {
  const anciens = contenus.filter(durable).map((c) => ({ c, d: modifie(c.fichier) })).filter((x) => x.d && MAINTENANT.getTime() - x.d.getTime() > 365 * JOUR)
    .sort((a, b) => a.d!.getTime() - b.d!.getTime());
  for (const { c, d } of anciens) {
    const jours = Math.floor((MAINTENANT.getTime() - d!.getTime()) / JOUR);
    points.push({ id: `ancien:${c.fichier}`, type: 'ancien', priorite: jours > 730 ? 2 : 3, titre: `Toujours juste ? ${c.titre}`, detail: `Pas modifié depuis ${duree(jours)} (${dateLisible(d!)}) : coordonnées, horaires, tarifs et pièces à fournir sont-ils toujours valables ?`, url: c.url, editer: c.editer, depuis: d!.toISOString(), masquer_jours: 365 });
  }
}

// --- 5. Mairie : jours fériés, alerte, projets, actualités, agenda -------------------------------
function paques(a: number): Date {
  const g = a % 19, c = Math.floor(a / 100), h = (c - Math.floor(c / 4) - Math.floor((8 * c + 13) / 25) + 19 * g + 15) % 30;
  const i = h - Math.floor(h / 28) * (1 - Math.floor(29 / (h + 1)) * Math.floor((21 - g) / 11));
  const j = (a + Math.floor(a / 4) + i + 2 - c + Math.floor(c / 4)) % 7;
  const l = i - j, mois = 3 + Math.floor((l + 40) / 44), jour = l + 28 - 31 * Math.floor(mois / 4);
  return new Date(a, mois - 1, jour, 12);
}
export function joursFeries(a: number): { date: Date; nom: string }[] {
  const p = paques(a), plus = (n: number) => new Date(p.getTime() + n * JOUR);
  const d = (m: number, j: number) => new Date(a, m - 1, j, 12);
  return [
    { date: d(1, 1), nom: 'Jour de l\'an' }, { date: plus(1), nom: 'Lundi de Pâques' }, { date: d(5, 1), nom: 'Fête du Travail' },
    { date: d(5, 8), nom: 'Victoire 1945' }, { date: plus(39), nom: 'Ascension' }, { date: plus(50), nom: 'Lundi de Pentecôte' },
    { date: d(7, 14), nom: 'Fête nationale' }, { date: d(8, 15), nom: 'Assomption' }, { date: d(11, 1), nom: 'Toussaint' },
    { date: d(11, 11), nom: 'Armistice' }, { date: d(12, 25), nom: 'Noël' },
  ];
}
if (mairie) {
  const plages: { jours: string[] }[] = (site as any).horaires_detail ?? [];
  let periodes: { du: string; au?: string }[] = [];
  try { periodes = JSON.parse(readFileSync('data/horaires-exceptionnels.json', 'utf8')).periodes ?? []; } catch {}
  const couvert = (j: string) => periodes.some((p) => p.du <= j && j <= (p.au || p.du));
  const limite = MAINTENANT.getTime() + 45 * JOUR;
  for (const f of [...joursFeries(ANNEE), ...joursFeries(ANNEE + 1)]) {
    const j = jourISO(f.date);
    if (f.date.getTime() < MAINTENANT.getTime() - JOUR / 2 || f.date.getTime() > limite) continue;
    if (!plages.some((p) => p.jours.includes(JOURS[f.date.getDay()])) || couvert(j)) continue;
    const dans = Math.max(0, Math.round((f.date.getTime() - MAINTENANT.getTime()) / JOUR));
    points.push({ id: `ferie:${j}`, type: 'ferie', priorite: dans <= 15 ? 1 : 2, titre: `${f.nom} : la mairie sera-t-elle fermée ?`, detail: `Le ${dateLisible(f.date, true)} est férié et la mairie est habituellement ouverte ce jour-là. Indiquez la fermeture (et un éventuel pont) dans les horaires exceptionnels : le site affichera « fermée » ce jour-là.`, editer: '/admin/#/collections/reglages/entries/horaires_exceptionnels', masquer_jours: 3650 });
  }

  try {
    const a = JSON.parse(readFileSync('data/alerte.json', 'utf8'));
    const d = modifie('data/alerte.json');
    if (a.actif && a.jusqu_au && a.jusqu_au < jourISO(MAINTENANT)) points.push({ id: `alerte:expiree:${empreinte(a.message + a.jusqu_au)}`, type: 'alerte', priorite: 3, titre: 'Alerte terminée à désactiver', detail: `L'alerte « ${String(a.message).slice(0, 80)} » n'est plus affichée depuis le ${a.jusqu_au.split('-').reverse().join('/')} ; décochez « Afficher » pour la ranger.`, editer: '/admin/#/collections/reglages/entries/alerte', masquer_jours: 3650 });
    else if (a.actif && !a.jusqu_au && d && MAINTENANT.getTime() - d.getTime() > 30 * JOUR) points.push({ id: `alerte:longue:${empreinte(a.message)}`, type: 'alerte', priorite: 2, titre: 'Alerte toujours d\'actualité ?', detail: `L'alerte « ${String(a.message).slice(0, 80)} » est affichée en haut de toutes les pages depuis ${duree(Math.floor((MAINTENANT.getTime() - d.getTime()) / JOUR))}, sans date de fin.`, editer: '/admin/#/collections/reglages/entries/alerte', masquer_jours: 30 });
  } catch {}

  for (const c of contenus.filter((x) => x.collection === 'projets' && x.data.avancement === 'travaux')) {
    const fin = c.data.date_fin ? new Date(c.data.date_fin) : null;
    const d = modifie(c.fichier);
    if (fin && fin.getTime() < MAINTENANT.getTime() - JOUR) points.push({ id: `projet:fin:${c.fichier}:${jourISO(fin)}`, type: 'projet', priorite: 2, titre: `Travaux terminés ? ${c.titre}`, detail: `La fin des travaux était prévue le ${dateLisible(fin)}. Si c'est fini, passez le projet à « Terminé » (avec une photo, c'est encore mieux) ; sinon, indiquez la nouvelle date.`, url: c.url, editer: c.editer, masquer_jours: 3650 });
    else if (d && MAINTENANT.getTime() - d.getTime() > 180 * JOUR) points.push({ id: `projet:nouvelles:${c.fichier}`, type: 'projet', priorite: 3, titre: `Où en sont les travaux ? ${c.titre}`, detail: `Projet en travaux sans nouvelles depuis ${duree(Math.floor((MAINTENANT.getTime() - d.getTime()) / JOUR))} : un point d'avancement rassure les habitants.`, url: c.url, editer: c.editer, masquer_jours: 90 });
  }

  const actus = contenus.filter((x) => x.collection === 'actualites' && x.data.date).map((x) => new Date(x.data.date).getTime()).filter((t) => t <= MAINTENANT.getTime());
  if (reglages.actualites && actus.length) {
    const derniere = Math.max(...actus), jours = Math.floor((MAINTENANT.getTime() - derniere) / JOUR);
    if (jours > 45) points.push({ id: `actualites:${jourISO(new Date(derniere))}`, type: 'actualites', priorite: 3, titre: 'Pas d\'actualité récente', detail: `La dernière actualité date du ${dateLisible(new Date(derniere))} (${duree(jours)}). Une nouvelle courte (conseil, travaux, événement passé) montre que le site est suivi.`, url: '/actualites', masquer_jours: 30 });
  }
  if ((reglages as any).agenda) {
    const auj = new Date(MAINTENANT.getFullYear(), MAINTENANT.getMonth(), MAINTENANT.getDate()).getTime();
    const aVenir = contenus.filter((x) => x.collection === 'agenda' && x.data.date).some((x) => { const fin = new Date(x.data.date_fin ?? x.data.date).getTime(); return fin >= auj && new Date(x.data.date).getTime() <= auj + 30 * JOUR; });
    if (!aVenir) points.push({ id: `agenda:${jourISO(MAINTENANT).slice(0, 7)}`, type: 'agenda', priorite: 3, titre: 'Agenda vide pour le mois à venir', detail: 'Aucun rendez-vous dans les 30 prochains jours : conseil municipal, marché, fête, réunion publique… même un seul rendez-vous fait vivre la page.', url: '/agenda', masquer_jours: 30 });
  }
}

// --- Écriture -----------------------------------------------------------------------------------
points.sort((a, b) => a.priorite - b.priorite || (a.depuis ?? '9').localeCompare(b.depuis ?? '9'));
mkdirSync(join(DIST, 'admin'), { recursive: true });
writeFileSync(join(DIST, 'admin/verifications.json'), JSON.stringify({ genere: MAINTENANT.toISOString(), historique: !!dates, points }) + '\n');
const parP = [1, 2, 3].map((p) => points.filter((x) => x.priorite === p).length);
console.log(`Vérifications : ${points.length} point(s) (${parP[0]} à traiter, ${parP[1]} à vérifier, ${parP[2]} conseil(s))${dates ? '' : ', historique Git absent : contenus anciens non relevés'} → ${DIST}/admin/verifications.json`);
