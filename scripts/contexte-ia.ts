/**
 * Contexte fourni à l'assistant de l'espace client (xmedia·ai) : ce que le site
 * contient, les règles et le catalogue. Régénéré à chaque build, jamais servi au public
 * (public/xmedia-ai/contexte/, jamais servi : lu par le code commun de l'espace client via XMEDIA_SITE).
 */
import { readFileSync, readdirSync, existsSync, statSync, mkdirSync, writeFileSync, copyFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { parse as parseYaml } from 'yaml';
import { urlPage, urlElement } from '../src/lib/urls';
import { nomsCollections, declarationsSite } from '../src/schemas/collections';
import { exportCollection, titreFiche, cleFiche } from '../src/lib/collections-site';
import { collectionsDuSite, modeleSite } from '../src/schemas/modeles';
import site from '../data/site.json' with { type: 'json' };
import menu from '../data/menu.json' with { type: 'json' };
import taxonomies from '../data/taxonomies.json' with { type: 'json' };

const R = process.cwd();
const lister = (dir: string, ext: string): string[] =>
  !existsSync(dir) ? [] : readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? lister(p, ext) : p.endsWith(ext) ? [p] : []; });

const pages = lister(join(R, 'content/pages'), '.yaml').map((f) => {
  const d = parseYaml(readFileSync(f, 'utf8'));
  const id = relative(join(R, 'content/pages'), f).replace(/\.yaml$/, '');
  return {
    url: urlPage(id), fichier: relative(R, f), titre: d.titre, statut: d.statut ?? 'publie', role: d.role,
    sections: (d.sections ?? []).map((s: any) => [s.block, s.variant, s.titre].filter(Boolean).join(' · ')),
  };
});
// Collections du modèle du site (et toute autre qui aurait des contenus)
const collectionsSite = nomsCollections.filter((nom) => collectionsDuSite().includes(nom) || lister(join(R, 'content', nom), '.md').length > 0);
const collections = Object.fromEntries(collectionsSite.map((nom) => [nom, lister(join(R, 'content', nom), '.md').map((f) => {
  const m = readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const d = m ? parseYaml(m[1]) : {};
  const id = relative(join(R, 'content', nom), f).replace(/\.md$/, '');
  const decl = declarationsSite[nom];
  // Collection propre au site : titre composé, et valeurs qui l'identifient (doublons, mises à jour d'un import)
  if (decl) return { id, url: urlElement(nom, id), titre: titreFiche(decl, d) || d.titre, statut: d.statut ?? 'publie', epuise: !!d.epuise, cle: cleFiche(decl, d), ...Object.fromEntries(decl.cle.map((c) => [c, d[c]])) };
  return { id, url: urlElement(nom, id), titre: d.titre, statut: d.statut ?? 'publie', categorie: d.categorie, lieu: d.lieu ?? d.ville, date: d.date, resume: d.resume, role: d.role ?? (nom === 'zones' ? 'seo' : undefined) };
})]));

const sortie = join(R, 'public/xmedia-ai/contexte');
mkdirSync(sortie, { recursive: true });
// Grille de prix : l'assistant peut répondre sur les tarifs sans les inventer
const tarifs = existsSync(join(R, 'data/tarifs.json')) ? JSON.parse(readFileSync(join(R, 'data/tarifs.json'), 'utf8')) : undefined;
// Carte du restaurant : l'assistant répond sur les plats, les prix et les allergènes sans les inventer
const carte_restaurant = existsSync(join(R, 'data/carte-restaurant.json')) ? JSON.parse(readFileSync(join(R, 'data/carte-restaurant.json'), 'utf8')) : undefined;
// Partenaires : l'assistant sait qui figure sur le site et à quel niveau
const partenaires = existsSync(join(R, 'data/partenaires.json')) ? JSON.parse(readFileSync(join(R, 'data/partenaires.json'), 'utf8')) : undefined;
// Témoignages : l'assistant sait lesquels existent (rattachement, doublons) sans jamais en écrire
const temoignages = existsSync(join(R, 'data/temoignages.json')) ? JSON.parse(readFileSync(join(R, 'data/temoignages.json'), 'utf8')) : undefined;
writeFileSync(join(sortie, 'site.json'), JSON.stringify({ infos: site, menu, taxonomies, tarifs, carte_restaurant, partenaires, temoignages, pages, collections }, null, 1));
copyFileSync(join(R, 'ai/regles.md'), join(sortie, 'regles.md'));
// Formulaires métier : le serveur vérifie les envois avec cette copie (spec partie 5)
if (existsSync(join(R, 'data/formulaires.json'))) copyFileSync(join(R, 'data/formulaires.json'), join(sortie, 'formulaires.json'));
// Labels et certifications : l'espace client prévient avant leur date de fin
if (existsSync(join(R, 'data/labels.json'))) copyFileSync(join(R, 'data/labels.json'), join(sortie, 'labels.json'));
copyFileSync(join(R, 'ai/catalogue.md'), join(sortie, 'catalogue.md'));
// Collections propres au site (1.46.0) : types de fiches pour la saisie, l'aperçu et l'import dans l'espace client
const declarations = Object.values(declarationsSite);
if (declarations.length) writeFileSync(join(sortie, 'collections.json'), JSON.stringify(declarations.map(exportCollection), null, 1));
// Club : équipes et rencontres pour l'écran « Rencontres et scores » de l'espace client (saisie des entraîneurs).
// sha : empreinte git du fichier, pour savoir si une saisie récente est déjà dans le site en ligne.
if (modeleSite === 'club') {
  const fm = (f: string) => { const m = readFileSync(f, 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---/); return m ? parseYaml(m[1]) ?? {} : {}; };
  const shaGit = (f: string) => { const b = readFileSync(f); return createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex'); };
  const jour = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : undefined);
  const equipes = lister(join(R, 'content/equipes'), '.md').map((f) => {
    const d = fm(f);
    return { id: relative(join(R, 'content/equipes'), f).replace(/\.md$/, ''), nom: d.nom_court ?? d.titre, categorie: d.categorie, ordre: d.ordre ?? 100, statut: d.statut ?? 'publie' };
  }).sort((a, b) => a.ordre - b.ordre);
  const rencontres = lister(join(R, 'content/rencontres'), '.md').map((f) => {
    const d = fm(f);
    return {
      id: relative(join(R, 'content/rencontres'), f).replace(/\.md$/, ''), sha: shaGit(f), titre: d.titre, statut: d.statut ?? 'publie',
      equipe: d.equipe, type: d.type ?? 'match', date: jour(d.date), heure: d.heure, adversaire: d.adversaire, domicile: d.domicile ?? true,
      lieu: d.lieu, competition: d.competition, score_pour: d.score_pour, score_contre: d.score_contre, annulee: d.annulee ?? false,
    };
  }).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  writeFileSync(join(sortie, 'rencontres.json'), JSON.stringify({ club: site.nom, stade: (site as any).club?.stade ?? '', equipes, rencontres }, null, 1));
}
console.log(`contexte xmedia·ai : ${pages.length} pages, ${Object.values(collections).flat().length} éléments`);
