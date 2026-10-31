# Règles pour l'IA — site du client

Tu produis le contenu du site. Tu ne touches jamais au design : tu remplis des fichiers de données
qui sont validés par schéma, puis relus par un humain avant publication.
Lis toujours `ai/catalogue.md` avant de composer : tout ce qui n'y figure pas n'existe pas.

## Ce que tu peux modifier

| Dossier ou fichier | Contenu |
| --- | --- |
| `content/pages/**.yaml` | pages composées de sections (l'URL suit le chemin : `services/x.yaml` → `/services/x`) |
| `content/<collection>/<id>.md` | éléments de collection (frontmatter YAML + corps Markdown facultatif) |
| `data/menu.json`, `data/footer.json` | navigation |
| `data/formulaires.json` | formulaires métier (devis…) : prestations proposées, case urgence, précisions facultatives — schéma : `src/schemas/formulaires.ts` |
| `data/site.json` | coordonnées, horaires, bandeau urgence, données pour Google (`types_schema`, `horaires_detail`, `villes`, `fiche_google`) — schéma : `src/schemas/site.ts` |
| `data/temoignages.json` | témoignages de clients, seulement ceux transmis par l'entreprise (voir « Témoignages ») — schéma : `src/schemas/temoignages.ts` |
| `media/**` | images, via l'import (redimensionnées, renommées, sans EXIF) |

Interdit : `src/`, `data/taxonomies.json`, `data/icones.json`, `scripts/`, supprimer une page ou un élément sans demande explicite.

## Composition d'une page

- La première section est un `hero`, un seul par page. `plein-ecran` si une belle photo paysage est fournie (`affiche` pour une photo forte qui doit tout dire : lieu, restaurant, commerce), sinon `split` ou `minimal`.
- Page de contenu : 4 à 8 sections. Landing (`gabarit: landing`) : 6 à 12.
- Pas deux sections consécutives sur le même fond sombre ; varier `background` (`clair`, `alt`, `sombre`) pour rythmer.
- Page de conversion : un `cta` au milieu (souvent `bandeau` sombre) et un en fin de page (`carte`). Deux au maximum pour le contact, plus un CTA d'engagement (voir « Garder le visiteur »).
- Dès qu'un contenu existe dans une collection (services, réalisations, zones), l'afficher avec un bloc `boucle`, jamais le recopier.
- N'ajouter une boucle que si elle renvoie au moins un élément.
- Chaque image fournie est utilisée une fois, là où elle a le plus de sens. Aucune image inventée.
- Page de référence pour le ton et la composition : `content/pages/index.yaml`.

## Formulaire

- **Formulaire métier** (`formulaire: devis` dans le bloc) : à utiliser dès que `data/formulaires.json` en définit un. Les demandes arrivent qualifiées et suivies dans l'espace client ; les champs `champs` et `obligatoires` du bloc sont alors ignorés.
- `data/formulaires.json` : `prestations` = les services du site dans l'ordre d'importance, puis « Autre » ; `precisions` = 3 à 6 questions facultatives utiles au métier (délai, type de logement, surface, budget en fourchettes, photos). Les identifiants `delai` et `photos` sont reconnus par la qualification (délai « au plus vite » = urgente). Jamais de question sur des données sensibles (santé, revenus exacts, opinions).

- Un seul bloc `formulaire` par page. La page `/contact` en a un ; en ajouter un en fin de page de service seulement pour une offre à fort enjeu, avec un `sujet` précis (« Demande de devis PAC piscine »).
- Le moins de champs obligatoires possible : `nom`, `message`, et `telephone` ou `email`.
- Les destinataires et le SMTP ne sont pas dans le contenu : ne jamais écrire d'adresse de destination ni de mot de passe.

## Rédaction

- Vouvoiement. Ton direct, rassurant, concret. Phrases courtes. Pas de superlatifs creux.
- **Aucun fait inventé.** Prix, délais, puissances, marques, certifications, chiffres, avis clients : uniquement s'ils figurent dans la demande, dans `data/site.json`, `data/tarifs.json` ou dans une page existante. Sinon, écrire `[À COMPLÉTER : ce qu'il faut]` — ce marqueur bloque la publication, c'est voulu.
- Le titre du hero est le H1 ; les titres de sections sont des H2. Pas de `#` dans le Markdown.
- Liens internes : voir « Maillage interne » ci-dessous.
- SEO : `seo.titre` ≤ 60 caractères avec le métier et la ville ; `seo.description` 120 à 160 caractères.
- Texte alternatif : décrit l'image en contexte, ≤ 125 caractères ; `alt: ""` seulement pour une image décorative.
- Données structurées (schema.org) : générées automatiquement à partir de `data/site.json` et du contenu. Ne jamais
  écrire de JSON-LD à la main. Aucune note ni aucun avis déclaré tant que les avis ne sont pas affichés sur le site.

## Témoignages

- Un témoignage ne vient que de l'entreprise : message, courriel, carnet ou capture transmis dans la demande. Jamais inventé, jamais complété, jamais reformulé : orthographe et ponctuation corrigées, coupe signalée par « […] », rien d'autre. Un avis Google ne se recopie pas : il est déjà affiché par le bloc `avis-google`.
- `accord: true` seulement si la demande dit que le client accepte d'être publié ; sinon ne rien publier et poser la question. Le nom affiché (`auteur`) est celui que le client accepte : « Claire M. » par défaut, jamais un nom complet sans accord explicite.
- Rattacher le témoignage : `realisation` si un chantier ou une réalisation correspond (le contexte du site les liste), `categorie` pour le métier, sinon `lien` vers la page concernée (référence, événement). Ne pas créer de réalisation pour héberger un témoignage.
- Ajouter le témoignage à la fin de `liste` dans `data/temoignages.json` (créer le fichier avec `{ "liste": [] }` s'il n'existe pas) ; identifiant court en minuscules (`claire-manosque-2026`).
- Les pages de réalisation et de service les affichent d'elles-mêmes. Pour l'accueil : un bloc `temoignages` (cartes, 3) après la présentation des services, s'il y en a au moins deux et qu'il n'y en a pas déjà un.

## Maillage interne

- **Ancres** : toute page ou tout élément créé reçoit un champ `ancres` de 2 à 5 expressions précises (2 à 6 mots), telles qu'on les écrirait dans une autre page : `pompe à chaleur de piscine`, `mise aux normes électrique`. Jamais d'expression vague (« ici », « nos services », « en savoir plus »). Au build, la première occurrence d'une ancre dans le texte d'une autre page devient un lien (3 au plus par page) : écrire naturellement suffit.
- **Liens écrits à la main** : 1 ou 2 par texte, seulement quand une ancre ne peut pas faire l'affaire. Texte du lien descriptif (jamais « cliquez ici »), cible publiée.
- **Contrôle** : après `npm run build`, lire `ai/maillage.json`. Un lien cassé bloque le build. Pour les pages que tu modifies ou crées, corrige les avertissements qui les concernent : page orpheline ou moins de 2 liens entrants (ajouter l'expression dans un texte d'une page proche, ou une ancre plus naturelle), trop de clics depuis l'accueil (menu ou page parente).

## Garder le visiteur

Un visiteur qui lit plusieurs pages est un visiteur intéressé : il appelle plus souvent, et Google y voit une
recherche satisfaite. Chaque page doit donner envie d'en ouvrir une autre.

- **Pages aimants** (`role: aimant`) : celles que le visiteur a envie d'ouvrir parce qu'elles répondent à sa vraie
  question. Par exemple : combien ça coûte (fourchettes seulement si le client les a données), réalisations avec
  photos avant/après, guide pratique (choisir, entretenir, éviter une panne), aides et financements, questions
  fréquentes, comparatif. Leur sujet vient des besoins et des questions fréquentes du brief. Titre concret qui tient
  sa promesse, jamais racoleur ; réponse directe dès le premier écran ; photos réelles.
- **Pages d'entrée SEO** (`role: seo` ; toutes les pages de zones le sont) : pages utiles pour Google mais peu
  engageantes en elles-mêmes. Elles reçoivent **un CTA d'engagement** vers la page aimant la plus proche de leur
  sujet, placé après la première ou la deuxième section, avant que le visiteur décroche. Son texte est une promesse
  précise : « Combien coûte une clim gainable ? Nos chantiers et leurs prix », jamais « En savoir plus ».
- **Aucune impasse** : toute page, sauf contact, merci et pages légales, se termine par une suite logique (une
  page aimant, une page liée, puis le contact).
- **Le contact reste l'objectif** : le CTA d'engagement s'ajoute au CTA de devis, il ne le remplace pas.
  Au total, 3 blocs `cta` au plus par page (1 d'engagement, 2 de contact).
- **Premier écran** : il répond à la question de la page, sans introduction creuse. Ensuite, des intertitres qui
  donnent envie de continuer, des paragraphes courts, des listes, des photos.
- **Contrôle** : `ai/maillage.json` signale toute page SEO sans lien vers une page aimant, et l'absence de page
  aimant.

### Pages aimants : l'expertise du client

Le client est un spécialiste de son métier : c'est ce qui rend ses pages impossibles à copier. Une page aimant
ne se rédige jamais de mémoire ; elle se construit comme une interview.

1. **Chercher** les problèmes récurrents des clients de ce métier, dans cette région : questions fréquentes du
   brief, requêtes Search Console si elles sont fournies, recherche web (questions posées sur Google, forums,
   comparatifs, saisonnalité). Garder les 1 ou 2 sujets les plus demandés que le site ne couvre pas encore.
2. **Construire** la page en brouillon (`statut: brouillon`, `role: aimant`) : titre, plan, intertitres, ce qui
   est général et vérifiable. Tout ce qui relève de l'expérience du client reste un marqueur
   `[À COMPLÉTER : question]` : ses prix réels, les erreurs qu'il voit sur les chantiers, ses conseils, ses délais,
   ce qu'il recommande ou déconseille et pourquoi, un cas vécu.
3. **Interroger** le client : 5 questions au plus par page, dans `questions` du rapport. Des questions d'expert,
   précises, auxquelles on répond en deux ou trois phrases, sur sa pratique à lui : « D'après vos chantiers,
   quelle est l'erreur la plus fréquente sur une clim installée par un particulier ? », jamais « Parlez-nous de
   la climatisation ».
4. **Rédiger** avec ses réponses, dans ses mots autant que possible (« Chez nous, on déconseille… »). Une
   réponse chiffrée est reprise telle quelle, jamais arrondie ni extrapolée.

Rien de ce que la recherche web rapporte n'est présenté comme un fait sur l'entreprise ; un chiffre général
(aide publique, norme) n'est repris que s'il vient d'une source officielle, citée dans `hypotheses`.

## YAML

- Style bloc pour tout texte : une clé par ligne. Réserver `{ … }` aux valeurs courtes sans virgule ni deux-points.
- Mettre entre guillemets toute valeur qui contient `: ` ou commence par un caractère spécial.
- Markdown multi-lignes : `contenu: |` puis le texte indenté.

## Navigation

- Menu principal : 7 entrées maximum. Une entrée pointe vers `page`, `element` (`collection/id`) ou `collection` (archive).
  `page` accepte une ancre (`/agence-seo#test-seo`) : la page est vérifiée, l'ancre conservée.
- Sous-menu : liste déroulante par défaut, 2 niveaux au plus. Au-delà de 8 liens, ou dès que les liens se rangent
  naturellement en familles (services par métier, démarches par thème, outils), passer l'entrée en méga-menu :
  `"disposition": "mega"`. Chaque enfant qui a ses propres `enfants` devient une colonne (5 au plus, 8 liens chacune) ;
  son intitulé est une page ou un simple `label` sans cible (« Testez votre site »), avec une `icone`
  facultative (nom de `data/icones.json`), pour toutes les colonnes ou aucune. Chaque lien d'un méga-menu peut
  porter une `description` d'une ligne (90 caractères) qui dit ce que le visiteur y trouve, jamais une redite du libellé.
- Une entrée du menu principal mène toujours à une page (c'est elle qui s'ouvre au toucher) ; un intitulé sans lien
  n'existe que comme colonne de méga-menu.
- Une entrée vers une page en brouillon est masquée automatiquement : pas besoin de la retirer.

## Après chaque modification

1. Lancer `npm run validate -- --json`.
2. Corriger toutes les erreurs, puis relancer (3 tentatives au maximum).
3. Rendre le rapport : résumé, hypothèses prises, points `[À COMPLÉTER]`, propositions (nouvelle catégorie, nouveau bloc…).
