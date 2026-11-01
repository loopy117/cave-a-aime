/**
 * Crée ou met à jour des fiches d'une collection propre au site (1.46.0), à partir d'un JSON déjà validé par le client
 * (saisie ou import dans l'espace client, ou préparé à la main). Écrit seulement dans content/<collection>/ et media/.
 *
 *   npm run fiches -- <fichier.json> [--simulation]
 *
 * Fichier :
 *   { "collection": "vins",
 *     "fiches": [ { "valeurs": { "nom": "…", "domaine": "…", "prix": 13.9 },
 *                   "provenance": { "degustation": "contre-etiquette" },
 *                   "photo": { "fichier": "_demande/photos/photo-01.jpg", "alt": "Bouteille de …" },
 *                   "statut": "publie", "id": "facultatif : fiche à mettre à jour",
 *                   "nouvelle": true (facultatif : ajouter à côté d'une fiche de même clé, ex. un second millésime) } ] }
 *
 * Rapprochement : par id s'il est donné, sinon par les champs « cle » de la collection. Une fiche existante n'est
 * modifiée que pour les champs présents (un import de prix ne touche pas aux textes). Rien n'est jamais supprimé.
 * Une fiche nouvelle à laquelle il manque un champ obligatoire est écrite en brouillon. Rapport JSON sur stdout.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml, stringify } from 'yaml';
import sharp from 'sharp';
import { collectionSchemas, declarationsSite } from '../src/schemas/collections';
import { cleFiche, identifiantFiche, titreFiche, slug } from '../src/lib/collections-site';

const args = process.argv.slice(2);
const simulation = args.includes('--simulation');
const fichier = args.find((a) => !a.startsWith('--'));
if (!fichier || !existsSync(fichier)) { console.error('Usage : npm run fiches -- <fichier.json> [--simulation]'); process.exit(1); }
const entree = JSON.parse(readFileSync(fichier, 'utf8'));
const decl = declarationsSite[entree.collection];
if (!decl) { console.error(`collection « ${entree.collection} » inconnue (collections du site : ${Object.keys(declarationsSite).join(', ') || 'aucune'})`); process.exit(1); }
const schema = collectionSchemas[decl.nom];
const dossier = join('content', decl.nom);

// Fiches existantes
interface Fiche { id: string; data: Record<string, any>; corps: string }
const existantes = new Map<string, Fiche>();
if (existsSync(dossier)) for (const f of readdirSync(dossier).filter((x) => x.endsWith('.md'))) {
  const m = readFileSync(join(dossier, f), 'utf8').match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (m) existantes.set(f.replace(/\.md$/, ''), { id: f.replace(/\.md$/, ''), data: parseYaml(m[1]) ?? {}, corps: m[2] });
}
const parCle = new Map([...existantes.values()].map((f) => [cleFiche(decl, f.data), f.id]));

const champImage = decl.rendu?.image ?? Object.entries(decl.champs).find(([, c]) => c.type === 'image')?.[0];
const ordreCles = ['titre', 'statut', ...Object.keys(decl.champs), 'epuise', 'resume', 'mis_en_avant', 'ordre', 'seo', 'ancres', 'role', 'provenance'];
const ordonner = (d: Record<string, any>) => Object.fromEntries([...ordreCles.filter((k) => d[k] !== undefined).map((k) => [k, d[k]]), ...Object.entries(d).filter(([k]) => !ordreCles.includes(k))]);
const egal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const rapport = { collection: decl.nom, simulation, crees: [] as any[], mis_a_jour: [] as any[], inchangees: [] as string[], refusees: [] as any[] };

for (const [i, f] of (entree.fiches ?? []).entries()) {
  const valeurs: Record<string, any> = { ...(f.valeurs ?? {}) };
  const inconnus = Object.keys(valeurs).filter((k) => !(k in decl.champs) && !['epuise', 'resume', 'statut', 'ordre', 'mis_en_avant', 'ancres', 'role', 'seo'].includes(k));
  if (inconnus.length) { rapport.refusees.push({ index: i, erreurs: inconnus.map((k) => `champ inconnu : ${k}`) }); continue; }
  // « nouvelle » : fiche ajoutée à côté d'une fiche de même clé (deux millésimes d'une cuvée vendus en même temps)
  const idExistant = f.nouvelle ? undefined : f.id && existantes.has(f.id) ? f.id : parCle.get(cleFiche(decl, valeurs));
  const ancienne = idExistant ? existantes.get(idExistant) : undefined;

  // Identifiant d'une fiche nouvelle ; pris par une autre fiche : suffixe (année si la collection en a une, sinon numéro)
  let id = ancienne?.id ?? (f.id ? slug(f.id) : identifiantFiche(decl, valeurs));
  if (!id) { rapport.refusees.push({ index: i, erreurs: [`identifiant vide : renseigner ${decl.identifiant.join(', ')}`] }); continue; }
  if (!ancienne && existantes.has(id)) {
    const annee = Object.entries(decl.champs).find(([, c]) => c.type === 'annee')?.[0];
    const base = id;
    if (annee && valeurs[annee] != null) id = `${base}-${valeurs[annee] === 'sans' ? 'nm' : valeurs[annee]}`;
    for (let n = 2; existantes.has(id); n++) id = `${base}-${n}`;
  }

  const data: Record<string, any> = { ...(ancienne?.data ?? {}), ...valeurs };
  if (f.provenance) data.provenance = { ...(ancienne?.data.provenance ?? {}), ...f.provenance };
  if (!ancienne) data.statut = f.statut ?? 'publie';
  else if (f.statut) data.statut = f.statut;

  // Photo : redressée, réduite, sans métadonnées, comme npm run import-media
  if (f.photo?.fichier && champImage) {
    if (!existsSync(f.photo.fichier)) { rapport.refusees.push({ index: i, id, erreurs: [`photo introuvable : ${f.photo.fichier}`] }); continue; }
    const cible = `${decl.nom}/${id}.jpg`;
    if (!simulation) {
      mkdirSync(join('media', decl.nom), { recursive: true });
      await sharp(f.photo.fichier).rotate().resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85, mozjpeg: true }).toFile(join('media', cible));
    }
    data[champImage] = { src: `/img/${cible}`, alt: String(f.photo.alt ?? '').slice(0, 125) };
  }
  data.titre = titreFiche(decl, data);

  // Validation : une fiche nouvelle incomplète passe en brouillon ; toute autre erreur la refuse
  let r = schema.safeParse(data);
  if (!r.success && !ancienne && data.statut === 'publie' && r.error.issues.every((x) => /obligatoire pour publier/.test(x.message))) {
    data.statut = 'brouillon';
    r = schema.safeParse(data);
  }
  if (!r.success) { rapport.refusees.push({ index: i, id, erreurs: r.error.issues.map((x) => `${x.path.join('.')} : ${x.message}`) }); continue; }

  if (ancienne) {
    const changements = Object.keys(data).filter((k) => k !== 'titre' && !egal(data[k], ancienne.data[k])).map((k) => ({ champ: k, avant: ancienne.data[k], apres: data[k] }));
    if (!changements.length) { rapport.inchangees.push(id); continue; }
    rapport.mis_a_jour.push({ id, changements });
  } else {
    const manquants = Object.entries(decl.champs).filter(([n, c]) => c.obligatoire && (data[n] == null || data[n] === '')).map(([, c]) => c.libelle);
    rapport.crees.push({ id, statut: data.statut, ...(manquants.length ? { manquants } : {}) });
  }
  if (!simulation) {
    mkdirSync(dossier, { recursive: true });
    writeFileSync(join(dossier, `${id}.md`), `---\n${stringify(ordonner(data), { lineWidth: 0 }).trimEnd()}\n---\n${ancienne?.corps ?? ''}`);
  }
  existantes.set(id, { id, data, corps: ancienne?.corps ?? '' });
  parCle.set(cleFiche(decl, data), id);
}

console.log(JSON.stringify(rapport, null, 1));
console.error(`${simulation ? '[simulation] ' : ''}${decl.libelle} : ${rapport.crees.length} créée(s), ${rapport.mis_a_jour.length} mise(s) à jour, ${rapport.inchangees.length} inchangée(s), ${rapport.refusees.length} refusée(s)`);
if (rapport.refusees.length) process.exitCode = 1;
