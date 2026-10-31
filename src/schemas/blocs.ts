/**
 * Schémas des blocs (spec §4). Chaque bloc : un composant dans src/blocks/,
 * ce schéma, et une fiche générée dans ai/catalogue.md (npm run catalogue).
 * .meta({ role, quand, eviter }) alimente le catalogue lu par l'IA.
 */
import { z } from 'astro/zod';
import formulairesSite from '../../data/formulaires.json' with { type: 'json' };
import { NIVEAUX_PARTENAIRES } from './partenaires';
import { image, cta, lien, icone, markdown, optionsCommunes, entete, metier } from './communs';
import { collectionSchemas, nomsCollections, type NomCollection } from './collections';
import { cartes, nomsCartes } from '../cards/cartes';
import { illustration } from '../illustrations/noms';
import { dispositions, nomsDispositions } from '../dispositions/dispositions';
// Blocs propres au site (fichier du site, src/site/blocs/schemas.ts)
import { schemasSite } from '../site/blocs/schemas';

const sansH1 = (s: string) => !/^#\s/m.test(s);

export const hero = z
  .object({
    block: z.literal('hero'),
    variant: z.enum(['plein-ecran', 'affiche', 'split', 'minimal', 'scene']).default('plein-ecran').describe('plein-ecran : photo en fond, texte à gauche · affiche : photo sur toute la hauteur de l\'écran, grand titre en bas à gauche · split : texte et image côte à côte · minimal : sans image · scene : illustration'),
    ...optionsCommunes,
    surtitre: z.string().max(40).optional().describe('Pastille au-dessus du titre (ex. « Artisan installateur · Pertuis »)'),
    titre: z.string().min(10).max(70).describe('Titre principal de la page (H1)'),
    texte: z.string().max(220).optional(),
    image: image.optional().describe('Obligatoire sauf variante minimal (ou illustration en variante split)'),
    illustration: illustration.optional().describe('Variante split : illustration codée à la place de la photo'),
    diaporama: z
      .object({
        cadre: z.enum(['telephone', 'arrondi']).default('telephone').describe('telephone : captures d\'écran de mobile dans un cadre de téléphone ; arrondi : photos aux coins arrondis'),
        vues: z.array(z.object({ image, legende: z.string().min(3).max(60).describe('Courte légende de l\'étape, affichée sous l\'image') }).strict()).min(2).max(6),
      })
      .strict()
      .optional()
      .describe('Variante split : images qui défilent à la place de la photo (ex. une démarche étape par étape). Pause possible, immobile si l\'utilisateur réduit les animations.'),
    scene: z
      .object({
        svg: z.string().regex(/^\/[A-Za-z0-9/_.-]+\.svg$/, 'chemin attendu : /<dossier>/<nom>.svg (fichier de public/)')
          .describe('Illustration en SVG, fichier de public/ (ex. /illustrations/agence.svg). Disposition fond : sa partie gauche doit rester libre, le texte s\'y pose sur grand écran.'),
        alt: z.string().max(125).default('').describe('Description de l\'illustration ; vide si elle est décorative'),
        fond: image.optional().describe('Photo placée derrière l\'illustration, visible par ses zones transparentes (ex. la ville derrière une baie vitrée)'),
        fond_largeur: z.number().int().min(10).max(100).default(100).describe('Largeur de la photo en % de l\'illustration, calée à droite (ex. 50 : la photo couvre la moitié droite, derrière la baie vitrée)'),
        disposition: z.enum(['fond', 'cote']).default('fond').describe('fond : illustration large, texte posé sur sa partie gauche libre · cote : illustration entière à droite du texte (formats carrés ou hauts)'),
        cadrage_mobile: z.enum(['gauche', 'centre', 'droite']).default('droite').describe('fond : partie de l\'illustration gardée sur téléphone, sous le texte'),
      })
      .strict()
      .optional()
      .describe('Variante scene : illustration pleine largeur, le texte posé sur sa partie gauche (sous le texte sur téléphone)'),
    ctas: z.array(cta).max(2).default([]),
    points: z.array(z.string().max(40)).max(4).default([]).describe('Garanties courtes affichées sous les boutons'),
    note_google: z.boolean().default(false).describe('Affiche la note de la fiche Google sous les boutons (ex. ★ 4,8 · 37 avis), actualisée chaque jour ; rien ne s\'affiche tant que la fiche n\'est pas reliée'),
  })
  .strict()
  .refine((b) => b.variant === 'minimal' || b.variant === 'scene' || !!b.image || (b.variant === 'split' && (!!b.illustration || !!b.diaporama)), { message: 'image obligatoire (plein-ecran, affiche), image, illustration ou diaporama (split)', path: ['image'] })
  .refine((b) => (b.variant === 'scene') === !!b.scene, { message: 'scene obligatoire pour la variante scene, et seulement pour elle', path: ['scene'] })
  .refine((b) => b.variant !== 'scene' || (!b.image && !b.illustration && !b.diaporama), { message: 'variante scene : ni image, ni illustration, ni diaporama (la scène les remplace)', path: ['scene'] })
  .refine((b) => !b.diaporama || (b.variant === 'split' && !b.image && !b.illustration), { message: 'diaporama : variante split seulement, sans image ni illustration', path: ['diaporama'] })
  .meta({
    role: 'Ouverture de page, message principal.',
    quand: 'Toujours en première section, un seul par page. plein-ecran : accueil et pages de service avec une belle photo. split : photo moins forte ou texte plus long ; diaporama pour montrer une démarche en quelques écrans. minimal : pages utilitaires (contact, mentions). scene : une illustration large fournie en SVG, éventuellement avec une photo derrière ses parties transparentes.',
    eviter: 'Titre générique (« Bienvenue ») ; plus de deux boutons.',
  });

export const texte = z
  .object({
    block: z.literal('texte'),
    variant: z.enum(['standard', 'etroit', 'deux-colonnes']).default('etroit'),
    ...optionsCommunes,
    ...entete,
    contenu: markdown.max(4000).refine(sansH1, 'pas de titre de niveau 1 (#) dans le contenu'),
  })
  .strict()
  .meta({
    role: 'Contenu rédactionnel libre en Markdown.',
    quand: 'Explications détaillées, mentions légales, contenus longs. etroit pour la lecture, deux-colonnes pour un texte long découpé.',
    eviter: 'Plus de deux blocs texte à la suite : alterner avec texte-image ou features.',
  });

export const texteImage = z
  .object({
    block: z.literal('texte-image'),
    variant: z.enum(['image-droite', 'image-gauche', 'visuel-dessous']).default('image-droite')
      .describe('visuel-dessous : texte et points côte à côte, visuel en pleine largeur dessous'),
    ...optionsCommunes,
    surtitre: entete.surtitre,
    titre: z.string().max(90),
    contenu: markdown.max(1200).refine(sansH1, 'pas de titre de niveau 1 (#)').optional(),
    citation: z.boolean().default(false).describe('Contenu affiché comme une citation (police de titre, plus grand)'),
    points: z
      .array(z.object({ icone: icone.optional(), titre: z.string().max(60).optional(), texte: z.string().max(200).optional() }).strict()
        .refine((p) => !!(p.titre || p.texte), 'titre ou texte'))
      .max(5)
      .default([])
      .describe('Arguments courts'),
    points_style: z.enum(['traits', 'icones', 'encarts']).default('traits').describe('traits : trait de couleur · icones : icône devant le texte · encarts : petites cartes (2 colonnes)'),
    signature: z.object({ nom: z.string().max(60).optional(), role: z.string().max(90) }).strict().optional().describe('Sous une citation : nom et fonction'),
    images: z.array(image).max(3).default([]).describe('1 image, ou 3 pour une mosaïque (la 1re en hauteur)'),
    image_entiere: z.boolean().default(false).describe('Une seule image : affichée entière, dans ses proportions d\'origine, sans recadrage (photo d\'équipe avec légende, document, capture)'),
    illustration: illustration.optional().describe('Illustration codée à la place des images'),
    lien: lien.optional(),
  })
  .strict()
  .refine((b) => !(b.images.length && b.illustration), { message: 'images ou illustration, pas les deux', path: ['illustration'] })
  .meta({
    role: 'Explication illustrée : un texte ou des arguments à côté d\'une ou trois images.',
    quand: 'Présenter l\'entreprise, un argument, une méthode. 3 images = mosaïque (portrait d\'équipe + deux détails).',
    eviter: 'Deux texte-image consécutifs du même côté : alterner image-droite / image-gauche.',
  });

export const features = z
  .object({
    block: z.literal('features'),
    variant: z.enum(['grille-icones', 'liste', 'etapes-numerotees', 'comparatif', 'paires']).default('grille-icones')
      .describe('comparatif : cartes titrées en petites capitales (options comparées) · paires : items regroupés deux par carte'),
    ...optionsCommunes,
    ...entete,
    items: z
      .array(z.object({
        icone: icone.optional(), titre: z.string().max(60), texte: z.string().max(200).optional(), lien: lien.optional(),
        mis_en_avant: z.boolean().optional().describe('Carte mise en valeur (fond de couleur) : une seule par bloc, grille uniquement'),
        badge: z.string().max(24).optional().describe('Pastille sur la carte mise en avant (ex. « Recommandé »)'),
      }).strict())
      .min(2)
      .max(8),
    illustration: illustration.optional().describe('Illustration codée en première case de la grille (ex. pagespeed)'),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (b.items.filter((i) => i.mis_en_avant).length > 1) ctx.addIssue({ code: 'custom', path: ['items'], message: 'une seule carte mise en avant par bloc' });
  })
  .meta({
    role: 'Points forts, garanties, étapes d\'un processus.',
    quand: 'grille-icones : 3 à 6 avantages. etapes-numerotees : un déroulé (devis, pose, mise en service). liste : points plus longs.',
    eviter: 'Items sans texte en variante liste ; plus de 8 items.',
  });

export const galerie = z
  .object({
    block: z.literal('galerie'),
    variant: z.enum(['grille', 'mosaique', 'carrousel', 'tirages']).default('grille').describe('tirages : photos posées comme des tirages papier à bord blanc, légèrement de travers'),
    ...optionsCommunes,
    ...entete,
    images: z.array(image).min(2).max(24),
  })
  .strict()
  .meta({
    role: 'Ensemble d\'images.',
    quand: 'Photos d\'un chantier ou d\'une réalisation. mosaique pour 5+ images de formats variés, carrousel pour une page déjà longue, tirages pour 3 à 8 photos d\'ambiance (restaurant, commerce, lieu).',
    eviter: 'Galerie de 2 images : préférer texte-image.',
  });

export const slider = z
  .object({
    block: z.literal('slider'),
    variant: z.enum(['plein-large', 'contenu']).default('contenu'),
    ...optionsCommunes,
    ...entete,
    slides: z
      .array(z.object({ image, titre: z.string().max(60).optional(), texte: z.string().max(160).optional(), cta: cta.optional() }).strict())
      .min(2)
      .max(6),
  })
  .strict()
  .meta({
    role: 'Défilement d\'images légendées (scroll horizontal, sans JavaScript).',
    quand: 'Montrer plusieurs visuels forts avec une légende chacun.',
    eviter: 'Messages importants cachés dans les slides suivantes.',
  });

export const ctaBloc = z
  .object({
    block: z.literal('cta'),
    variant: z.enum(['bandeau', 'carte', 'split-image']).default('carte'),
    ...optionsCommunes,
    icone: icone.optional().describe('Pastille d\'icône (variante bandeau)'),
    titre: z.string().max(80),
    texte: z.string().max(220).optional(),
    ctas: z.array(cta).min(1).max(2),
    note: z.string().max(80).optional().describe('Ligne discrète sous les boutons (ex. « ou appelez le … »)'),
    image: image.optional().describe('Obligatoire pour split-image'),
  })
  .strict()
  .refine((b) => b.variant !== 'split-image' || !!b.image, { message: 'image obligatoire pour la variante split-image', path: ['image'] })
  .meta({
    role: 'Appel à l\'action.',
    quand: 'carte (encadré vert) en fin de page de conversion. bandeau (pleine largeur, souvent fond sombre) pour un message court en milieu de page (urgence, téléphone).',
    eviter: 'Plus de deux cta par page.',
  });

export const faq = z
  .object({
    block: z.literal('faq'),
    variant: z.enum(['accordeon', 'deux-colonnes', 'titre-gauche']).default('accordeon').describe('titre-gauche : titre à gauche, questions ouvertes à droite'),
    ...optionsCommunes,
    ...entete,
    items: z.array(z.object({ question: z.string().max(150), reponse: markdown.max(800) }).strict()).min(3).max(15),
  })
  .strict()
  .meta({
    role: 'Questions-réponses (balisage FAQPage automatique).',
    quand: 'Lever les objections avant la prise de contact : prix, délais, aides, entretien.',
    eviter: 'Réponses inventées (prix, délais) : utiliser [À COMPLÉTER : …].',
  });

export const chiffres = z
  .object({
    block: z.literal('chiffres'),
    variant: z.enum(['ligne', 'cartes']).default('ligne'),
    ...optionsCommunes,
    ...entete,
    items: z.array(z.object({ valeur: z.string().max(12), libelle: z.string().max(60), source: z.string().max(80).optional() }).strict()).min(2).max(4),
  })
  .strict()
  .meta({
    role: 'Statistiques clés.',
    quand: 'Uniquement avec des chiffres fournis par le client ou présents sur le site.',
    eviter: 'Tout chiffre inventé ou arrondi « pour faire bien ».',
  });

/* -------------------------------- formulaire -------------------------------- */

export const champsFormulaire = ['nom', 'email', 'telephone', 'commune', 'service', 'message'] as const;
const champForm = z.enum(champsFormulaire);

export const formulaire = z
  .object({
    block: z.literal('formulaire'),
    variant: z.enum(['avec-coordonnees', 'simple', 'carte']).default('avec-coordonnees')
      .describe('carte : texte à gauche, formulaire dans une carte blanche à droite'),
    ...optionsCommunes,
    ...entete,
    note: z.string().max(120).optional().describe('Ligne sous le bouton (ex. « Sans engagement. »)'),
    champs: z.array(champForm).min(3).default([...champsFormulaire]).describe('Champs affichés, dans cet ordre'),
    obligatoires: z.array(champForm).default(['nom', 'message']).describe('Champs obligatoires (message toujours obligatoire)'),
    sujet: z.string().max(60).default('Demande depuis le site').describe("Objet de l'e-mail reçu (ex. « Demande de devis PAC piscine »)"),
    bouton: z.string().max(40).default('Envoyer ma demande'),
    formulaire: z
      .string()
      .optional()
      .describe("Formulaire métier de data/formulaires.json (ex. devis) : remplace champs et obligatoires, les demandes arrivent qualifiées dans l'espace client"),
  })
  .strict()
  .superRefine((b, ctx) => {
    if (b.formulaire && !(b.formulaire in formulairesSite)) ctx.addIssue({ code: 'custom', path: ['formulaire'], message: `formulaire « ${b.formulaire} » absent de data/formulaires.json (${Object.keys(formulairesSite).join(', ') || 'aucun'})` });
    if (new Set(b.champs).size !== b.champs.length) ctx.addIssue({ code: 'custom', path: ['champs'], message: 'champ en double' });
    if (!b.champs.includes('message')) ctx.addIssue({ code: 'custom', path: ['champs'], message: 'le champ message est obligatoire' });
    if (!b.champs.includes('email') && !b.champs.includes('telephone')) ctx.addIssue({ code: 'custom', path: ['champs'], message: 'il faut au moins email ou telephone pour pouvoir répondre' });
    for (const c of b.obligatoires) if (!b.champs.includes(c)) ctx.addIssue({ code: 'custom', path: ['obligatoires'], message: `« ${c} » est obligatoire mais absent de champs` });
  })
  .meta({
    role: 'Formulaire de contact ou de demande de devis. Avec « formulaire » (data/formulaires.json) : formulaire métier en deux étapes (la seconde facultative, photos comprises), demandes qualifiées et suivies dans l\'espace client. Sans : formulaire simple envoyé par e-mail.',
    quand: 'Page contact, et en fin de page de service à fort enjeu (avec un sujet précis). avec-coordonnees : formulaire + téléphone, e-mail, horaires à côté. simple : formulaire seul.',
    eviter: 'Plus d\'un formulaire par page ; des champs obligatoires inutiles (chaque champ en trop fait perdre des demandes).',
  });

/* ---------------------------------- boucle --------------------------------- */

const scalaire = z.union([z.string(), z.number(), z.boolean()]);
const operateurs = z
  .object({
    different: scalaire.optional(),
    contient: z.array(scalaire).optional(),
    contient_tous: z.array(scalaire).optional(),
    apres: z.string().optional(),
    avant: z.string().optional(),
    depuis: z.string().regex(/^\d+\s*(jours?|mois|ans?)$/, 'format : « 6 mois », « 30 jours », « 2 ans »').optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    existe: z.boolean().optional(),
  })
  .strict();
export const valeurFiltre = z.union([scalaire, z.array(scalaire), operateurs]);

export const boucle = z
  .object({
    block: z.literal('boucle'),
    ...optionsCommunes,
    ...entete,
    lien_tout_voir: lien.optional(),
    source: z.enum(nomsCollections as [NomCollection, ...NomCollection[]]),
    filtre: z.record(z.string(), valeurFiltre).optional().describe('Conditions cumulées (ET)'),
    exclure: z.array(z.string()).default([]),
    elements: z.array(z.string()).optional().describe('Sélection manuelle : remplace filtre, ordre et nombre'),
    ordre: z.union([z.string(), z.array(z.string())]).default('date desc'),
    nombre: z.number().int().min(1).max(24).default(6),
    decalage: z.number().int().min(0).default(0),
    carte: z.enum(nomsCartes as [string, ...string[]]),
    affichage: z.enum(nomsDispositions).default('grid'),
    options: z.record(z.string(), z.unknown()).default({}),
    si_vide: z.enum(['masquer', 'message']).default('masquer'),
    message_vide: z.string().max(120).optional(),
  })
  .strict()
  .superRefine((b, ctx) => {
    const carte = cartes[b.carte as keyof typeof cartes];
    if (carte && carte.collection !== b.source) {
      ctx.addIssue({ code: 'custom', path: ['carte'], message: `la carte « ${b.carte} » affiche la collection « ${carte.collection} », pas « ${b.source} »` });
    }
    const opts = dispositions[b.affichage].options.safeParse(b.options);
    if (!opts.success) {
      for (const i of opts.error.issues) ctx.addIssue({ code: 'custom', path: ['options', ...i.path.map(String)], message: `option invalide pour « ${b.affichage} » : ${i.message}` });
    }
    if (b.elements && b.filtre) ctx.addIssue({ code: 'custom', path: ['elements'], message: 'elements (sélection manuelle) et filtre sont exclusifs' });
    const champs = new Set(['id', ...Object.keys(collectionSchemas[b.source].shape)]);
    for (const c of Object.keys(b.filtre ?? {})) {
      if (!champs.has(c)) ctx.addIssue({ code: 'custom', path: ['filtre', c], message: `champ inconnu pour « ${b.source} » (champs : ${[...champs].join(', ')})` });
    }
    for (const o of [b.ordre].flat()) {
      const [c, sens = 'asc'] = o.trim().split(/\s+/);
      if (c === 'aleatoire') continue;
      if (!champs.has(c) || !['asc', 'desc'].includes(sens)) ctx.addIssue({ code: 'custom', path: ['ordre'], message: `tri invalide « ${o} » : attendu « <champ> asc|desc » ou « aleatoire »` });
    }
    if (b.si_vide === 'message' && !b.message_vide) ctx.addIssue({ code: 'custom', path: ['message_vide'], message: 'message_vide obligatoire quand si_vide = message' });
  })
  .meta({
    role: 'Affiche des éléments d\'une collection selon une requête, avec une carte et une disposition.',
    quand: 'Dès qu\'on montre des services, réalisations, zones… Les éléments ajoutés plus tard apparaissent automatiquement.',
    eviter: 'Une boucle dont le filtre ne renvoie rien ; recopier à la main des éléments qui existent dans une collection.',
  });

export const carteRestaurantBloc = z
  .object({
    block: z.literal('carte-restaurant'),
    ...optionsCommunes,
    ...entete,
    afficher: z.enum(['tout', 'menus', 'carte']).default('tout').describe('tout : menus puis carte · menus : seulement les menus (ex. accueil) · carte : seulement les rubriques'),
    rubriques: z.array(z.string().max(40)).max(20).optional().describe('Seulement ces rubriques (titres exacts), ex. ["Vins rouges", "Vins blancs"] pour une page des vins'),
    filtre_allergenes: z.boolean().default(true).describe('Filtre « Je suis allergique à… » au-dessus de la carte'),
    style: z.enum(['liste', 'ardoise']).default('liste').describe('liste : carte sobre sur le fond de la section · ardoise : carte écrite à la craie sur une ardoise (police --font-craie du site)'),
  })
  .strict()
  .meta({
    role: 'Carte d\'un restaurant : menus (permanents, du jour, d\'événement), rubriques et plats avec prix, allergènes et régimes, filtre allergies, données structurées Menu. Tout vient de data/carte-restaurant.json.',
    quand: 'Page Carte d\'un restaurant (cible du QR code des tables) ; « afficher: menus » sur l\'accueil pour le menu du jour. Modifier un plat ou un prix : data/carte-restaurant.json, jamais la page.',
    eviter: 'Site sans data/carte-restaurant.json ; recopier la carte dans un bloc texte ou un PDF.',
  });

export const tarifsBloc = z
  .object({
    block: z.literal('tarifs'),
    ...optionsCommunes,
    ...entete,
    creation: z.boolean().default(true).describe('Afficher le bloc création (prix, engagement)'),
    options: z.boolean().default(true).describe('Afficher les options'),
    cta: cta.optional().describe('Bouton sous chaque formule (ex. vers le formulaire d\'audit)'),
  })
  .strict()
  .meta({
    role: 'Grille de prix : création (niveaux, durée d\'engagement ou bande commune avec le prix dans chaque niveau), formules mensuelles (coût de la première année en option), options. Les prix viennent de data/tarifs.json.',
    quand: 'Page tarifs, ou en fin d\'accueil avant la FAQ. Modifier un prix : data/tarifs.json, jamais la page.',
    eviter: 'Site sans data/tarifs.json ; recopier des prix dans un autre bloc.',
  });

export const partenairesBloc = z
  .object({
    block: z.literal('partenaires'),
    variant: z.enum(['grille', 'bandeau']).default('grille'),
    ...optionsCommunes,
    ...entete,
    niveaux: z
      .array(z.enum(NIVEAUX_PARTENAIRES))
      .min(1)
      .max(3)
      .optional()
      .describe('Niveaux affichés, dans cet ordre (défaut : tous). Ex. ["principal"] pour un bandeau discret'),
    devenir: z.boolean().default(true).describe('Afficher la case « Devenir partenaire » (data/partenaires.json, champ devenir)'),
  })
  .strict()
  .meta({
    role: 'Partenaires et sponsors par niveau (principal, officiel, soutien), avec logo, phrase et lien. Les partenaires viennent de data/partenaires.json.',
    quand: 'grille : page ou section Partenaires (accueil d\'un club, page de mairie). bandeau : rangée de logos discrète en fin de page.',
    eviter: 'Recopier les partenaires dans un autre bloc ; plus d\'un bloc partenaires en grille par page.',
  });

export const planning = z
  .object({
    block: z.literal('planning'),
    variant: z.enum(['categories', 'semaine']).default('categories'),
    ...optionsCommunes,
    ...entete,
    categories: z.array(metier).max(6).optional().describe('Types d\'équipes affichés (défaut : tous)'),
    equipes: z
      .array(z.string().regex(/^(\$courant\.id|[a-z0-9-]+)$/, 'identifiant d\'équipe ou $courant.id'))
      .min(1)
      .max(20)
      .optional()
      .describe('Équipes précises (identifiants de content/equipes/), ou $courant.id sur une page d\'équipe'),
    lieu: z.string().max(60).optional().describe('Lieu habituel, rappelé sous le planning (ex. « Stade municipal »)'),
  })
  .strict()
  .meta({
    role: 'Créneaux d\'entraînement, tirés de la collection equipes. categories : une carte par type d\'équipe avec ses catégories et horaires. semaine : un tableau par jour.',
    quand: 'Accueil et page Équipes d\'un club (categories puis semaine), page d\'une équipe (semaine avec equipes: [$courant.id]). Modifier un horaire : content/equipes/, jamais la page.',
    eviter: 'Recopier des horaires dans un bloc texte ou features.',
  });

export const legal = z
  .object({
    block: z.literal('legal'),
    variant: z.enum(['mentions', 'confidentialite', 'accessibilite', 'ecoconception']).default('mentions'),
    ...optionsCommunes,
    ...entete,
    complement: markdown.max(2000).refine(sansH1, 'pas de titre de niveau 1 (#) dans le contenu').optional().describe('Texte ajouté à la fin (cas particuliers)'),
  })
  .strict()
  .meta({
    role: 'Mentions légales (éditeur, création, hébergeur, conditions d\'utilisation) ou politique de confidentialité, générées depuis data/site.json (champ legal).',
    quand: 'Pages /mentions-legales (variant mentions), /confidentialite (variant confidentialite), /accessibilite (variant accessibilite) et /declaration-ecoconception (variant ecoconception, RGESN 2024 ; compléments propres au site dans data/ecoconception.json) : rien à rédiger, compléter data/site.json.',
    eviter: 'Recopier ces informations dans un bloc texte : elles ne seraient plus mises à jour.',
  });

export const carte = z
  .object({
    block: z.literal('carte'),
    variant: z.enum(['avec-texte', 'seule']).default('avec-texte').describe('avec-texte : texte et communes à côté de la carte · seule : la carte en pleine largeur'),
    ...optionsCommunes,
    ...entete,
    lieu: z.string().max(160).optional().describe('Adresse ou lieu à montrer (par défaut : adresse du site, rue si affichée, sinon la ville)'),
    zoom: z.number().int().min(5).max(18).optional().describe('Zoom de la carte interactive (10 : une vallée, 14 : un quartier)'),
    texte: markdown.max(1500).refine(sansH1, 'pas de titre de niveau 1 (#) dans le contenu').optional(),
    communes: z.boolean().default(true).describe('Afficher les communes desservies (data/site.json, villes)'),
  })
  .strict()
  .meta({
    role: "Carte au clic : aperçu léger sans Google, carte Google Maps chargée seulement si le visiteur clique, lien Itinéraire.",
    quand: "Page contact ou zone d'intervention, quand le client veut une carte. Lieu et communes viennent de data/site.json.",
    eviter: "Plus d'une carte par page ; une carte sur une page de service (le lien Itinéraire du contact suffit).",
  });

export const matchCenter = z
  .object({
    block: z.literal('match-center'),
    ...optionsCommunes,
    ...entete,
    equipe: z.string().regex(/^[a-z0-9-]{2,60}$/).optional().describe('Une seule équipe (identifiant) ; vide = toutes les équipes'),
    lien_calendrier: z.boolean().default(true).describe('Lien « Tout le calendrier et les résultats »'),
  })
  .strict()
  .meta({
    role: 'Prochaine rencontre et dernier résultat, calculés depuis la collection rencontres ; invisible tant que le calendrier est vide.',
    quand: 'Accueil, page d\'une équipe.',
    eviter: 'Écrire la prochaine rencontre à la main dans un bloc texte : elle ne se mettrait pas à jour.',
  });

export const frise = z
  .object({
    block: z.literal('frise'),
    ...optionsCommunes,
    ...entete,
    items: z
      .array(z.object({ annee: z.string().min(2).max(12).describe('Ex. « 1987 », « 2023-2024 »'), titre: z.string().min(3).max(90), texte: z.string().max(300).optional(), image: image.optional() }).strict())
      .min(2)
      .max(30),
  })
  .strict()
  .meta({
    role: 'Frise chronologique : dates clés, titres, palmarès.',
    quand: 'Page « Le club », histoire d\'une association ou d\'une commune.',
    eviter: 'Des dates non confirmées par le client.',
  });

export const labelsBloc = z
  .object({
    block: z.literal('labels'),
    variant: z.enum(['cartes', 'logos', 'bandeau']).default('cartes').describe('cartes : détail (organisme, validité, attestation) · logos : logo en grand au-dessus du nom et de la phrase (labels qui font vendre) · bandeau : une ligne compacte'),
    ...optionsCommunes,
    ...entete,
    elements: z.array(z.string().regex(/^[a-z0-9-]{2,40}$/)).max(20).optional().describe('Identifiants des labels à montrer, dans l\'ordre (tous si vide)'),
  })
  .strict()
  .meta({
    role: 'Labels, qualifications, assurances et agréments de l\'entreprise (Réglages › Labels et certifications) ; les labels expirés ne s\'affichent jamais.',
    quand: 'Page certifications (cartes), accueil ou page service (bandeau).',
    eviter: 'Recopier un label dans un bloc texte : il ne disparaîtrait pas à son expiration.',
  });

export const avisGoogle = z
  .object({
    block: z.literal('avis-google'),
    variant: z.enum(['cartes', 'bandeau']).default('cartes').describe('cartes : la note et les avis ; bandeau : la note seule, sur une ligne'),
    ...optionsCommunes,
    ...entete,
    nombre: z.number().int().min(1).max(5).default(3).describe('Nombre d\'avis affichés (Google en fournit 5 au plus)'),
    note_min: z.number().int().min(1).max(5).default(4).describe('Seuls les avis ayant au moins cette note sont affichés'),
  })
  .strict()
  .meta({
    role: 'Note et derniers avis de la fiche Google de l\'entreprise, actualisés automatiquement chaque jour (rien à saisir).',
    quand: 'Accueil ou page de service, après la présentation, pour rassurer avant la prise de contact. bandeau : rappel discret de la note.',
    eviter: 'Recopier des avis à la main dans un bloc texte (ils ne seraient plus à jour) ; plus d\'un bloc avis par page. Le bloc ne s\'affiche pas tant que la fiche Google n\'est pas reliée par l\'agence.',
  });

export const temoignagesBloc = z
  .object({
    block: z.literal('temoignages'),
    variant: z.enum(['cartes', 'citation']).default('cartes').describe('cartes : plusieurs témoignages côte à côte ; citation : un seul, en grand'),
    ...optionsCommunes,
    ...entete,
    elements: z.array(z.string().regex(/^[a-z0-9-]{2,60}$/)).max(6).optional().describe('Témoignages précis (identifiants de data/temoignages.json), dans cet ordre'),
    realisation: z.string().regex(/^(\$courant\.id|[a-z0-9-]{2,90})$/).optional().describe('Seulement ceux d\'une réalisation ($courant.id sur sa page)'),
    categorie: z.string().regex(/^(\$courant\.categorie|[a-z0-9-]{2,60})$/).optional().describe('Seulement ceux d\'un métier ($courant.categorie sur une page de service)'),
    nombre: z.number().int().min(1).max(6).default(3).describe('Nombre affiché au plus (mis en avant d\'abord, puis les plus récents)'),
  })
  .strict()
  .meta({
    role: 'Témoignages de clients recueillis par l\'entreprise (data/temoignages.json), avec le nom accepté par le client, sa note s\'il en a donné une et un lien vers la réalisation concernée. Rien ne s\'affiche s\'il n\'y en a aucun.',
    quand: 'Accueil (cartes, 3), page d\'une référence ou d\'un événement (citation avec elements), page À propos. Les pages de réalisation et de service les affichent déjà d\'elles-mêmes.',
    eviter: 'Écrire ou reformuler un témoignage : seulement les mots du client, avec son accord ; recopier un témoignage dans un bloc texte ; plus d\'un bloc témoignages par page.',
  });

export const partage = z
  .object({
    block: z.literal('partage'),
    ...optionsCommunes,
  })
  .strict()
  .meta({
    role: 'Boutons de partage de la page (partage natif sur mobile, puis LinkedIn, Facebook, X, e-mail, copier le lien). Sans script tiers ni cookie.',
    quand: 'Articles « À savoir », sous le titre et/ou en fin d\'article.',
  });

/* -------------------------------- reservation -------------------------------- */

export const reservation = z
  .object({
    block: z.literal('reservation'),
    variant: z.enum(['carte', 'simple']).default('carte').describe('carte : texte à gauche, réservation dans une carte à droite · simple : réservation seule'),
    ...optionsCommunes,
    ...entete,
    mode: z.enum(['moteur', 'lien']).default('moteur')
      .describe('moteur : réservation en ligne du site (réglages sur le serveur, formules 99 et 149 €) · lien : bouton vers l\'outil de réservation du client (Zenchef, Planity…)'),
    lien: z.string().regex(/^https:\/\/[^\s]+$/, 'adresse https:// complète').optional().describe('Mode lien : adresse de la page de réservation de l\'outil du client'),
    outil: z.string().max(40).optional().describe('Mode lien : nom de l\'outil, affiché sous le bouton (ex. Zenchef)'),
    bouton: z.string().max(40).default('Réserver').describe('Texte du bouton final (mode moteur) ou du bouton (mode lien)'),
    note: z.string().max(160).optional().describe('Ligne sous la réservation (ex. « Au-delà de 6 personnes, appelez-nous. »)'),
  })
  .strict()
  .refine((b) => (b.mode === 'lien') === !!b.lien, { message: 'lien obligatoire en mode lien, et seulement en mode lien', path: ['lien'] })
  .meta({
    role: 'Réservation en ligne : nombre de personnes ou prestation, jour, heure, coordonnées, confirmation par e-mail avec lien d\'annulation. Sans iframe ni cookie. Si le serveur ne répond pas, se change en demande à confirmer. Mode lien : bouton vers l\'outil du client.',
    quand: 'Page /reserver (l\'e-mail de confirmation renvoie vers /reserver pour annuler), un seul par site en mode moteur. Le lien « Réserver » du menu et des CTA pointe vers /reserver.',
    eviter: 'Plusieurs blocs reservation ; un autre formulaire sur la même page ; écrire des horaires ou des capacités dans le texte (ils viennent des réglages du serveur).',
  });

const blocsSocle = { hero, texte, 'texte-image': texteImage, features, galerie, slider, cta: ctaBloc, faq, chiffres, formulaire, boucle, tarifs: tarifsBloc, 'carte-restaurant': carteRestaurantBloc, partenaires: partenairesBloc, planning, legal, carte, 'match-center': matchCenter, frise, labels: labelsBloc, 'avis-google': avisGoogle, temoignages: temoignagesBloc, partage, reservation } as const;

// Un bloc du site ne remplace jamais un bloc du socle
for (const nom of Object.keys(schemasSite)) if (nom in blocsSocle) throw new Error(`src/site/blocs/schemas.ts : « ${nom} » est déjà un bloc du socle, choisir un autre nom`);

export const blocs = { ...blocsSocle, ...schemasSite } as typeof blocsSocle & Record<string, z.ZodTypeAny>;
export type NomBloc = keyof typeof blocs;

export const section = z.discriminatedUnion('block', [hero, texte, texteImage, features, galerie, slider, ctaBloc, faq, chiffres, formulaire, boucle, tarifsBloc, carteRestaurantBloc, partenairesBloc, planning, legal, carte, matchCenter, frise, labelsBloc, avisGoogle, temoignagesBloc, partage, reservation, ...(Object.values(schemasSite) as any[])]);
export type Section = z.infer<typeof section>;
