/**
 * Déclaration d'écoconception selon le RGESN 2024 (Arcep / Arcom / ADEME), générée comme les mentions légales :
 * bloc « legal », variant « ecoconception » (page /declaration-ecoconception).
 *
 * - Les 78 critères et leur priorité viennent du référentiel (rgesn-2024.json, libellés repris mot pour mot).
 * - L'évaluation commune à tous les sites (ce que le socle et l'hébergement garantissent) est dans SOCLE ci-dessous.
 * - Un site peut compléter ou corriger un critère dans data/ecoconception.json (facultatif) :
 *     { "date_evaluation": "2026-11-02", "criteres": { "1.1": { "statut": "valide", "texte": "…" } } }
 * - Score d'avancement : méthode de l'Arcep, somme des poids des critères validés / somme des poids des critères
 *   applicables × 100 (Prioritaire 1,5 · Recommandé 1,25 · Modéré 1). Un critère « à évaluer » compte comme non validé.
 * - Les mesures EcoIndex des pages sont écrites dans la page à la mise en ligne (scripts/ecoindex.mjs,
 *   élément [data-ecoconception-mesures]) : seuils ci-dessous (SEUILS), repris en attributs de l'élément.
 */
import { existsSync, readFileSync } from 'node:fs';
import { z } from 'astro/zod';
import referentiel from './rgesn-2024.json';
import { PRESTATAIRE } from './legal';

export type Statut = 'valide' | 'non_valide' | 'na' | 'a_evaluer';
type Priorite = 'Prioritaire' | 'Recommandé' | 'Modéré';
export const POIDS: Record<Priorite, number> = { Prioritaire: 1.5, Recommandé: 1.25, Modéré: 1 };
export const LIBELLES_STATUT: Record<Statut, string> = { valide: 'Validé', non_valide: 'Non validé', na: 'Non applicable', a_evaluer: 'En cours d’évaluation' };

/** Seuils par page (critère 6.1), contrôlés à chaque mise en ligne par scripts/ecoindex.mjs. */
export const SEUILS = { poids_ko: 1000, requetes: 40, note: 'B' as const };

/** Date de l'évaluation commune (socle + hébergement) : à changer quand SOCLE change. */
export const DATE_EVALUATION_SOCLE = '2026-10-28';

const SCALEWAY = '[Scaleway](https://www.scaleway.com/fr/leadership-environnemental/)';

/**
 * Évaluation commune aux sites (modèles entreprise, club, collectivité), hébergés sur le serveur de l'agence.
 * [statut, texte publié] — pour « non_valide » et « a_evaluer », le texte est l'action prévue (plan d'action).
 */
const SOCLE: Record<string, [Statut, string]> = {
  '1.1': ['a_evaluer', 'Décrire l’utilité du site pour l’activité et son public (propre à chaque site).'],
  '1.2': ['a_evaluer', 'Décrire les publics visés et leurs besoins (propre à chaque site).'],
  '1.3': ['valide', `Référent écoconception : ${PRESTATAIRE.societe}, qui conçoit et maintient le site ([${PRESTATAIRE.email}](mailto:${PRESTATAIRE.email})).`],
  '1.4': ['valide', 'À chaque mise en ligne, le site est construit, validé et contrôlé automatiquement, et chaque page est mesurée selon la méthode EcoIndex (éléments, requêtes, poids transféré). Les performances sont relevées chaque semaine. Cette déclaration est revue à chaque évolution du code commun des sites.'],
  '1.5': ['valide', 'Chaque page est mesurée à chaque mise en ligne selon la méthode EcoIndex. Objectifs : aucune page sous la note B, et un score d’avancement RGESN d’au moins 80 % d’ici fin 2027.'],
  '1.6': ['valide', 'Le site ne collecte que ce que le visiteur écrit dans le formulaire de contact, conservé 3 ans après le dernier échange. Aucun cookie ni traceur : la fréquentation est mesurée à partir des journaux du serveur, avec des adresses IP tronquées.'],
  '1.7': ['valide', 'Seul le chiffrement des échanges (HTTPS) est utilisé, avec redirection automatique depuis HTTP.'],
  '1.8': ['valide', 'Le code commun des sites n’est pas publié : il fait partie du service. Il est construit sur des logiciels libres : Astro (génération du site), Decap CMS (éditeur de contenu), Pagefind (recherche sans service extérieur), Leaflet (cartes, fonds IGN), Node.js ; contrôles avec Playwright, axe-core, Lighthouse et la méthode EcoIndex ; serveur sous Debian avec Caddy, PHP-FPM, GoAccess, age, zstd, rclone, Git et systemd ; surveillance avec Uptime Kuma. Le contenu de chaque site est stocké dans des fichiers ouverts (YAML, Markdown), réutilisables sans nous.'],
  '1.9': ['valide', 'Site web standard (HTML, CSS, JavaScript en amélioration progressive) : la même interface sert l’ordinateur, la tablette et le téléphone, sans application à installer.'],
  '1.10': ['na', 'Le site ne pilote aucun objet connecté ni périphérique.'],
  '2.1': ['valide', 'Le site fonctionne avec un ordinateur, une tablette ou un téléphone équipé d’un navigateur de moins de trois ans, y compris sur un ordinateur portable de dix ans.'],
  '2.2': ['a_evaluer', 'Tester les fonctions essentielles sur un ordinateur portable équipé d’un processeur de dix ans ou plus.'],
  '2.3': ['a_evaluer', 'Mesurer l’affichage en connexion lente (3G et 512 kbit/s).'],
  '2.4': ['a_evaluer', 'Lister les versions minimales des navigateurs pris en charge (versions d’au moins deux ans).'],
  '2.5': ['valide', 'Mise en page adaptative, contrôlée à 390 et 1 280 pixels de large ; menus utilisables au toucher, à la souris et au clavier.'],
  '2.6': ['valide', 'Chaque modification est relue avant publication et passe des contrôles automatiques (contenus, liens, accessibilité, poids des pages). Le CSS des blocs absents est retiré de chaque page.'],
  '2.7': ['valide', 'Les mises à jour du code commun sont incluses dans l’abonnement, et les fonctions inutilisées en sont retirées. À la résiliation, après un préavis d’un mois, le client récupère une version complète de son site en fichiers standards, prête à être hébergée ailleurs ; l’espace client et le suivi s’arrêtent.'],
  '2.8': ['valide', 'Hébergement choisi pour son électricité renouvelable et ses indicateurs publiés (Scaleway). Services tiers réduits au strict nécessaire (cartes et avis Google), jamais chargés sans action du visiteur.'],
  '2.9': ['valide', 'Aucune bibliothèque de composants prête à l’emploi ni framework JavaScript côté navigateur : les blocs d’interface sont développés pour ces sites.'],
  '2.10': ['valide', 'Les services tiers sont réduits et ne chargent rien par défaut : la carte Google Maps ne s’affiche qu’au clic, les avis Google sont intégrés aux pages à la construction, sans appel depuis le navigateur.'],
  '3.1': ['valide', 'Site statique : les pages sont générées une fois, à la mise en ligne, puis servies comme de simples fichiers, sans base de données ni calcul à chaque visite. Chaque page n’embarque que le CSS de ses blocs.'],
  '3.2': ['a_evaluer', 'Justifier le dimensionnement du serveur, partagé entre les sites de l’agence.'],
  '3.3': ['valide', 'HTTPS obligatoire avec redirection automatique, TLS 1.3, HTTP/2 et HTTP/3, IPv6 en place.'],
  '3.4': ['na', 'Le site n’est pas vendu avec un terminal.'],
  '3.5': ['a_evaluer', 'Distinguer correctifs et évolutions dans le journal des versions du code commun.'],
  '3.6': ['valide', 'Les mises à jour ne transfèrent au serveur que les fichiers modifiés.'],
  '3.7': ['valide', 'Aucun serveur de préproduction permanent : le site est construit à la demande, lors d’une modification, puis l’environnement de construction est libéré.'],
  '4.1': ['valide', 'Aucune lecture automatique de vidéo ou de son, aucun défilement automatique ; la seule animation (indicateur « ouvert ») s’arrête après trois cycles et n’est pas jouée si le visiteur a demandé à réduire les animations.'],
  '4.2': ['valide', 'Aucun défilement infini.'],
  '4.3': ['a_evaluer', 'Vérifier les parcours principaux (contact, devis) à l’aide de la mesure d’audience (propre à chaque site).'],
  '4.4': ['valide', 'Aucun service tiers n’est activé sans action du visiteur : la carte se charge au clic sur « Afficher la carte ».'],
  '4.5': ['valide', 'Formulaires, listes déroulantes et boutons natifs du navigateur.'],
  '4.6': ['valide', 'Aucune vidéo, aucun son, aucune animation décorative.'],
  '4.7': ['valide', 'Le texte et l’image sont privilégiés ; aucune vidéo ni aucun son.'],
  '4.8': ['valide', 'Polices hébergées avec le site, au format WOFF2 et découpées par alphabet : moins de 400 Ko par page.'],
  '4.9': ['valide', 'Aucune autocomplétion interrogeant le serveur pendant la saisie.'],
  '4.10': ['valide', 'Les formats attendus sont indiqués et vérifiés dans le navigateur avant l’envoi du formulaire.'],
  '4.11': ['valide', 'Le nombre et les formats de photos acceptés sont indiqués avant l’envoi ; les photos sont réduites dans le navigateur avant l’envoi.'],
  '4.12': ['valide', 'Le site ne propose aucune fonction à fort impact environnemental.'],
  '4.13': ['valide', 'Le site n’envoie aucune notification.'],
  '4.14': ['valide', 'Ni fenêtre surgissante, ni bandeau de consentement, ni case pré-cochée, ni compte à rebours.'],
  '4.15': ['valide', 'Chaque page affiche dans son pied de page son empreinte estimée par visite (CO2.js de la Green Web Foundation, modèle Sustainable Web Design v4) et, si elle vaut A ou B, sa note EcoIndex. Le site est sobre par défaut, sans réglage à activer : ni vidéo ni son, images chargées à l’approche, polices limitées, aucun traceur. Mesures et méthode sont détaillées sur cette page.'],
  '5.1': ['valide', 'Les photos sont converties en AVIF et WebP à la construction du site.'],
  '5.2': ['valide', 'Les photos sont compressées à la construction et déclinées en plusieurs largeurs.'],
  '5.3': ['na', 'Aucune vidéo.'],
  '5.4': ['na', 'Aucune vidéo.'],
  '5.5': ['na', 'Aucune vidéo.'],
  '5.6': ['na', 'Aucun contenu audio.'],
  '5.7': ['a_evaluer', 'Vérifier la compression des documents mis en ligne (PDF).'],
  '5.8': ['valide', 'Les actualités de plus de deux ans sont retirées ou archivées ; les réalisations restent en ligne tant qu’elles sont représentatives.'],
  '6.1': ['valide', `Seuils par page : ${SEUILS.poids_ko.toLocaleString('fr-FR')} Ko transférés et ${SEUILS.requetes} requêtes au plus, note EcoIndex ${SEUILS.note} au minimum. Chaque page est mesurée à chaque mise en ligne (voir « Mesures » ci-dessus).`],
  '6.2': ['valide', 'Les fichiers statiques (CSS, JavaScript, images, polices) portent un nom versionné et sont gardés un an en cache par le navigateur ; les pages sont revalidées à chaque visite.'],
  '6.3': ['valide', 'Les fichiers texte (HTML, CSS, JavaScript, SVG) sont compressés par le serveur.'],
  '6.4': ['valide', 'Chaque photo est générée en plusieurs largeurs et le navigateur charge celle qui correspond à l’affichage ; les images importées sont redimensionnées.'],
  '6.5': ['valide', 'Seuls le CSS et les scripts utiles à la page sont chargés ; les images hors de l’écran sont chargées à l’approche.'],
  '6.6': ['na', 'Le site n’utilise aucun capteur de l’appareil.'],
  '6.7': ['valide', 'Toutes les ressources du site, polices comprises, viennent de son propre domaine, en HTTP/2.'],
  '7.1': ['valide', 'Les pages sont générées à l’avance : chaque visite reçoit un fichier prêt, sans calcul côté serveur.'],
  '7.2': ['valide', 'Les demandes reçues par le formulaire sont conservées trois ans après le dernier échange, puis supprimées ; les journaux du serveur, douze mois.'],
  '7.3': ['valide', 'Pendant l’envoi du formulaire, le bouton est désactivé et le message « Envoi en cours… » s’affiche.'],
  '7.4': ['na', 'Aucune blockchain.'],
  '8.1': ['valide', `Serveur hébergé par ${SCALEWAY} à Paris (centre de données DC2, région PAR1). L’hébergeur publie ses indicateurs (PUE, WUE, rDCE) et vise un PUE inférieur à 1,15 pour ses nouveaux centres de données et à 1,3 pour les existants.`],
  '8.2': ['valide', 'Scaleway conçoit ses serveurs, vise jusqu’à dix ans de durée de vie et réemploie ou recycle les composants en fin de vie.'],
  '8.3': ['non_valide', 'Le centre de données DC2 de Scaleway affiche un PUE de 1,50, à la limite du seuil de 1,5. Piste : migrer le serveur vers un centre plus efficace de la région (DC3 : 1,39 ; DC5 : 1,23).'],
  '8.4': ['valide', 'WUE publié par Scaleway pour le centre DC2 : 0,012 L/kWh, sous l’objectif de 0,4 L/kWh.'],
  '8.5': ['valide', 'Électricité 100 % renouvelable (hydraulique pour le centre DC2), avec garanties d’origine, selon Scaleway.'],
  '8.6': ['valide', 'Serveur en France, où l’électricité est faiblement carbonée (moins de 100 g CO₂e/kWh), près des visiteurs du site.'],
  '8.7': ['non_valide', 'Scaleway ne publie pas de récupération de chaleur pour ces centres de données : information demandée à l’hébergeur.'],
  '8.8': ['na', 'Le site héberge bien moins de 10 To de données.'],
  '8.9': ['valide', 'Sauvegarde quotidienne, compressée (zstd) et chiffrée (age), sur un volume Scaleway puis copiée sur un serveur OVH avec une conservation dégressive ; les dépôts Git sont aussi copiés. Les fichiers publiés et les certificats ne sont pas sauvegardés : ils se reconstruisent. Environ 7 Mo par archive.'],
  '8.10': ['valide', 'Les traitements planifiés (sauvegardes, copies, mesures) tournent la nuit, hors des pics de consommation électrique.'],
  '9.1': ['valide', 'Le site n’utilise pas de modèle d’intelligence artificielle : aucune phase d’entraînement n’est nécessaire.'],
  '9.2': ['na', 'Aucune phase d’entraînement.'],
  '9.3': ['na', 'Aucune phase d’entraînement.'],
  '9.4': ['na', 'Aucune phase d’entraînement.'],
  '9.5': ['na', 'Aucune phase d’entraînement.'],
  '9.6': ['na', 'Aucune phase d’entraînement.'],
  '9.7': ['na', 'Aucune inférence de modèle.'],
};

/** data/ecoconception.json (facultatif, propre au site). */
export const schemaEcoconception = z
  .object({
    date_evaluation: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe('Date de la dernière évaluation propre au site (AAAA-MM-JJ)'),
    objectif: z.string().max(300).optional().describe('Objectif de score ou d’amélioration, ex. « 85 % d’ici fin 2027 »'),
    criteres: z
      .record(z.string().regex(/^\d\.\d{1,2}$/), z.object({ statut: z.enum(['valide', 'non_valide', 'na', 'a_evaluer']), texte: z.string().min(3).max(800) }).strict())
      .default({})
      .describe('Critères complétés ou corrigés pour ce site (identifiant RGESN : statut et texte publié)'),
  })
  .strict();
export type DonneesEcoconception = z.infer<typeof schemaEcoconception>;

/** Lit data/ecoconception.json s'il existe ; erreur claire si le fichier est invalide (le build s'arrête). */
export function lireDonnees(fichier = 'data/ecoconception.json'): DonneesEcoconception {
  if (!existsSync(fichier)) return { criteres: {} };
  const r = schemaEcoconception.safeParse(JSON.parse(readFileSync(fichier, 'utf8')));
  if (!r.success) throw new Error(`${fichier} : ${r.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join(' ; ')}`);
  const inconnus = Object.keys(r.data.criteres).filter((id) => !referentiel.criteres.some((c) => c.id === id));
  if (inconnus.length) throw new Error(`${fichier} : critère(s) inconnu(s) du RGESN 2024 : ${inconnus.join(', ')}`);
  return r.data;
}

export interface CritereEvalue { id: string; theme: string; libelle: string; priorite: Priorite; poids: number; statut: Statut; texte: string; propre: boolean }
export interface Score { valides: number; applicables: number; pourcent: number | null }

const score = (l: CritereEvalue[]): Score => {
  const app = l.filter((c) => c.statut !== 'na');
  const applicables = app.reduce((s, c) => s + c.poids, 0);
  const valides = app.filter((c) => c.statut === 'valide').reduce((s, c) => s + c.poids, 0);
  return { valides, applicables, pourcent: applicables ? Math.round((valides / applicables) * 100) : null };
};

export function evaluer(donnees: DonneesEcoconception = lireDonnees()) {
  const criteres: CritereEvalue[] = referentiel.criteres.map((c) => {
    const priorite = c.priorite as Priorite;
    const propre = donnees.criteres[c.id];
    const [statut, texte] = propre ? [propre.statut, propre.texte] : SOCLE[c.id];
    return { id: c.id, theme: c.id.split('.')[0], libelle: c.libelle, priorite, poids: POIDS[priorite], statut, texte, propre: !!propre };
  });
  const themes = Object.entries(referentiel.themes).map(([n, nom]) => {
    const l = criteres.filter((c) => c.theme === n);
    return { numero: n, nom, criteres: l, score: score(l) };
  });
  const date = [DATE_EVALUATION_SOCLE, donnees.date_evaluation].filter(Boolean).sort().pop()!;
  return { criteres, themes, global: score(criteres), date, objectif: donnees.objectif };
}

const dateFr = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const pct = (s: Score) => (s.pourcent === null ? 'non applicable' : `${s.pourcent} %`);
const nombre = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 });

/**
 * Texte de la déclaration, en deux parties autour de l'encart des mesures EcoIndex (écrit à la mise en ligne).
 * `nomSite` : nom affiché du site ; `hote` : domaine.
 */
export function declarationEcoconception(nomSite: string, hote: string, donnees?: DonneesEcoconception) {
  const e = evaluer(donnees);
  const compte = (s: Statut) => e.criteres.filter((c) => c.statut === s).length;
  const avant = [
    `${nomSite} s’engage dans une démarche d’écoconception pour réduire l’empreinte environnementale de son site. Cette déclaration s’applique au site ${hote}, évalué selon le [référentiel général de l’écoconception des services numériques (RGESN), version 2024](${referentiel.url}), publié par l’Arcep et l’Arcom en lien avec l’ADEME.`,
    '',
    '## Score d’avancement',
    '',
    `Score d’avancement : **${pct(e.global)}** (évaluation du ${dateFr(e.date)}).`,
    '',
    `Sur les 78 critères du référentiel, ${compte('valide')} sont validés, ${compte('non_valide')} ne le sont pas encore, ${compte('a_evaluer')} sont en cours d’évaluation et ${compte('na')} ne s’appliquent pas à ce site.`,
    ...(e.objectif ? ['', `Objectif : ${e.objectif}`] : []),
    '',
    `Le score suit la méthode de l’Arcep : somme des points des critères validés (${nombre(e.global.valides)}) divisée par la somme des points des critères applicables (${nombre(e.global.applicables)}), multipliée par 100. Un critère prioritaire vaut 1,5 point, un critère recommandé 1,25 et un critère modéré 1. Un critère en cours d’évaluation compte comme non validé. Il s’agit d’une autoévaluation.`,
    '',
    '| Thématique | Score |',
    '| --- | --- |',
    ...e.themes.map((t) => `| ${t.numero}. ${t.nom} | ${pct(t.score)} |`),
    '',
    '## Mesures des pages',
  ].join('\n');
  const plan = e.criteres.filter((c) => c.statut === 'non_valide' || c.statut === 'a_evaluer');
  const apres = [
    `Chaque page est mesurée à chaque mise en ligne selon la méthode [EcoIndex](https://www.ecoindex.fr/) : nombre d’éléments, nombre de requêtes et poids transféré. Seuils fixés pour chaque page : ${SEUILS.poids_ko.toLocaleString('fr-FR')} Ko et ${SEUILS.requetes} requêtes au plus, note ${SEUILS.note} au minimum.`,
    '',
    '## Plan d’action',
    '',
    ...(plan.length ? plan.map((c) => `- ${c.id} : ${c.texte}`) : ['Tous les critères applicables sont validés.']),
    '',
    '## Détail des critères',
    '',
    // Sobre en éléments HTML (la note EcoIndex compte surtout leur nombre) : un élément de liste et un seul gras par
    // critère, et les critères non applicables d'une thématique regroupés en une phrase.
    ...e.themes.flatMap((t) => {
      const app = t.criteres.filter((c) => c.statut !== 'na');
      const na = t.criteres.filter((c) => c.statut === 'na');
      return [
        `### ${t.numero}. ${t.nom} (${pct(t.score)})`,
        '',
        ...app.map((c) => `- **${c.id} · ${LIBELLES_STATUT[c.statut]}.** ${c.libelle} (${c.priorite.toLowerCase()}) ${c.texte}`),
        ...(na.length ? ['', `Non applicables : ${na.map((c) => `${c.id} (${c.texte.replace(/\.$/, '').replace(/^./, (x) => x.toLowerCase())})`).join(' ; ')}.`] : []),
        '',
      ];
    }),
    '## Contact',
    '',
    `Pour toute question sur cette déclaration : [${PRESTATAIRE.email}](mailto:${PRESTATAIRE.email}).`,
    '',
    `Source des critères : ${referentiel.source}, réutilisés sans modification. Les textes d’évaluation et les mesures sont ceux de ${PRESTATAIRE.societe}.`,
  ].join('\n');
  return { avant, apres, evaluation: e };
}
