import type { APIRoute } from 'astro';
import { indexSite } from '../lib/site';
import { evaluer } from '../lib/ecoconception';

/**
 * carbon.txt (Green Web Foundation, syntaxe 0.6) : où trouver les informations environnementales du site et
 * sur quel fournisseur il repose. Permet aux outils de la Green Web Foundation de rattacher le domaine à
 * Scaleway (serveurs privés virtuels), au lieu du revendeur qui a déclaré la plage d'adresses IP.
 * Divulgation : la déclaration d'écoconception RGESN du site si elle est publiée, sinon les mentions légales. last_updated : date de
 * la dernière évaluation (socle ou site). Valider avec le validateur carbon.txt de la Green Web Foundation.
 */
export const GET: APIRoute = async ({ site }) => {
  // Au moins une divulgation (exigé par la syntaxe) : la déclaration d'écoconception, sinon les mentions légales
  // (hébergeur et hébergement vert), sinon l'accueil.
  const index = await indexSite();
  const [chemin, type, titre] = index.get('/declaration-ecoconception')?.publie
    ? ['/declaration-ecoconception', 'sustainability-page', "Déclaration d'écoconception (RGESN 2024)"]
    : index.get('/mentions-legales')?.publie
      ? ['/mentions-legales', 'web-page', 'Mentions légales : hébergeur et hébergement vert']
      : ['/', 'web-page', 'Site'];
  const disclosures = [`    { doc_type='${type}', url='${new URL(chemin, site).href}', title="${titre}" }`];
  const corps = [
    'version="0.6"',
    `last_updated="${evaluer().date}"`,
    '',
    '[org]',
    `disclosures = [\n${disclosures.join(',\n')}\n]`,
    '',
    '[upstream]',
    'services = [',
    "    { domain='www.scaleway.com', service_type='virtual-private-servers' }",
    ']',
    '',
  ].join('\n');
  return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
