/** Tests du maillage contextuel (npm run test). */
import assert from 'node:assert/strict';
import { construireCibles, lierTexte, type EtatPage } from '../src/lib/maillage';

const index = new Map<string, any>([
  ['/services/pompe-a-chaleur', { url: '/services/pompe-a-chaleur', titre: 'Pompe à chaleur', publie: true, type: 'element', ancres: ['pompe à chaleur'] }],
  ['/services/pompe-a-chaleur/piscine', { url: '/services/pompe-a-chaleur/piscine', titre: 'Pompe à chaleur piscine', publie: true, type: 'page', ancres: ['pompe à chaleur de piscine', "chauffage de l'eau"] }],
  ['/depannage', { url: '/depannage', titre: 'Dépannage électrique', publie: true, type: 'page' }],
  ['/contact', { url: '/contact', titre: 'Contact et devis', publie: true, type: 'page', ancres: ['devis gratuit'] }],
  ['/brouillon', { url: '/brouillon', titre: 'Page brouillon', publie: false, type: 'page', ancres: ['climatisation'] }],
  ['/', { url: '/', titre: 'Accueil', publie: true, type: 'page', ancres: ['accueil'] }],
]);
const cibles = construireCibles(index);
const etat = (url: string): EtatPage => ({ lies: new Set([url]), ajoutes: 0 });
const liens = (h: string) => [...h.matchAll(/<a href="([^"]+)" class="lien-contexte">([^<]+)<\/a>/g)].map((m) => `${m[2]}→${m[1]}`);

// L'ancre la plus longue gagne ; une seule fois par cible
let h = lierTexte('<p>Une pompe à chaleur de piscine, puis une autre pompe à chaleur de piscine.</p>', cibles, etat('/x'));
assert.deepEqual(liens(h), ['pompe à chaleur de piscine→/services/pompe-a-chaleur/piscine']);

// Jamais vers la page elle-même ; titre implicite (« Dépannage électrique ») ; majuscules indifférentes
h = lierTexte('<p>Notre Dépannage électrique et la pompe à chaleur.</p>', cibles, etat('/services/pompe-a-chaleur'));
assert.deepEqual(liens(h), ['Dépannage électrique→/depannage']);

// Pas dans un titre, un lien existant ou du code ; lien déjà présent = cible déjà servie
h = lierTexte('<h2>Devis gratuit</h2><p><a href="/depannage">ici</a> <code>devis gratuit</code> et un devis gratuit, un dépannage électrique.</p>', cibles, etat('/x'));
assert.deepEqual(liens(h), ['devis gratuit→/contact']);

// Apostrophe échappée par Markdown (&#39;) et mots entiers seulement
h = lierTexte('<p>Le chauffage de l&#39;eau et une pompe à chaleurisation.</p>', cibles, etat('/x'));
assert.deepEqual(liens(h), ["chauffage de l&#39;eau→/services/pompe-a-chaleur/piscine"]);

// Brouillons et accueil exclus ; tout le texte est parcouru (avant et après un lien) ;
// 3 liens au plus par page, état partagé entre blocs, l'ancre la plus précise d'abord
const e = etat('/x');
h = lierTexte('<p>climatisation, accueil, pompe à chaleur, dépannage électrique</p>', cibles, e);
assert.deepEqual(liens(h), ['pompe à chaleur→/services/pompe-a-chaleur', 'dépannage électrique→/depannage']);
h = lierTexte('<p>devis gratuit et pompe à chaleur de piscine</p>', cibles, e);
assert.equal(e.ajoutes, 3);
assert.deepEqual(liens(h), ['pompe à chaleur de piscine→/services/pompe-a-chaleur/piscine']);

// Pluriel accepté
h = lierTexte('<p>Nous posons des pompes à chaleur de piscine.</p>', cibles, etat('/x'));
assert.deepEqual(liens(h), ['pompes à chaleur de piscine→/services/pompe-a-chaleur/piscine']);

console.log('✔ maillage : 6 scénarios vérifiés');
