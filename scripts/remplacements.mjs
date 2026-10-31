/**
 * Remplacements propres à un site (plugin Vite) : un fichier placé dans src/site/remplacements/<chemin> remplace
 * src/<chemin> du socle (ex. src/site/remplacements/partials/Footer.astro remplace src/partials/Footer.astro).
 * Sert à garder l'allure d'un site plus ancien sans copier tout le socle ; à éviter pour un nouveau site
 * (préférer les variables de src/styles/tokens.css et src/site/site.css). Les imports relatifs d'un fichier de
 * remplacement se résolvent comme s'il était à sa place d'origine dans src/.
 */
import { existsSync, statSync } from 'node:fs';
import { resolve, dirname, relative, sep } from 'node:path';

export function remplacements(racine = process.cwd()) {
  const SRC = resolve(racine, 'src');
  const REMP = resolve(SRC, 'site/remplacements');
  const actif = existsSync(REMP);
  return {
    name: 'xm-remplacements',
    enforce: 'pre',
    async resolveId(source, importer, options) {
      if (!actif || !importer || !source.startsWith('.')) return null;
      const imp = importer.split('?')[0];
      // Le fichier qui importe est un remplacement : ses chemins relatifs partent de sa place d'origine
      const base = imp.startsWith(REMP + sep) ? resolve(SRC, relative(REMP, dirname(imp))) : dirname(imp);
      const [chemin, requete] = source.split('?');
      const cible = resolve(base, chemin);
      if (!cible.startsWith(SRC + sep) || cible.startsWith(REMP + sep)) return imp.startsWith(REMP + sep) ? this.resolve(cible + (requete ? '?' + requete : ''), importer, { ...options, skipSelf: true }) : null;
      const remplace = resolve(REMP, relative(SRC, cible));
      if (existsSync(remplace) && statSync(remplace).isFile()) return remplace + (requete ? '?' + requete : '');
      if (imp.startsWith(REMP + sep)) return this.resolve(cible + (requete ? '?' + requete : ''), importer, { ...options, skipSelf: true });
      return null;
    },
  };
}
