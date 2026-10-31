/**
 * Publie les redirections du site (data/redirections.txt, vérifiées par npm run validate) dans dist/.redirections,
 * nettoyées : une ligne « ancienne nouvelle » par redirection. Le serveur les applique (sudo xm-site redirections <nom>).
 * Fichier caché : envoyé avec le site mais jamais servi aux visiteurs.
 */
import { existsSync, writeFileSync } from 'node:fs';
import { lireRedirections } from '../src/lib/redirections';

if (!existsSync('dist')) throw new Error('dist/ absent : lancer astro build avant.');
const liste = lireRedirections();
const erreurs = liste.filter((r) => r.probleme);
if (erreurs.length) { console.error(erreurs.map((r) => `data/redirections.txt ligne ${r.ligne} : ${r.probleme}`).join('\n')); process.exit(1); }
if (liste.length) {
  writeFileSync('dist/.redirections', liste.map((r) => `${r.source} ${r.cible}`).join('\n') + '\n');
  console.log(`${liste.length} redirection(s) publiée(s) dans dist/.redirections (serveur : sudo xm-site redirections <nom>)`);
}
