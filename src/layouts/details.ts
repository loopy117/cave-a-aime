/**
 * Gabarits de détail des collections, écrits comme des compositions de
 * sections (spec §5). Les boucles « similaires » utilisent $courant.
 * Partie présentation : l'IA ne modifie pas ce fichier.
 */
import site from '../../data/site.json';
import taxonomies from '../../data/taxonomies.json';
import type { NomCollection } from '../schemas/collections';
import { jourRencontre, heureFr, intitule, score, issue, libelleIssue, lieu, typeRencontre, aScore } from '../lib/rencontres';

const ctaFin = { block: 'cta', variant: 'carte', spacing: 'compact', ...site.cta_defaut };
// Libellés des pages de détail, réglables par site (data/site.json, « libelles »)
const L = { services: 'Nos métiers', devis: 'Demander un devis gratuit', temoignages: 'Ce qu\'en disent nos clients', temoignage_realisation: 'L\'avis du client', ...((site as any).libelles ?? {}) };
const devis = { label: L.devis, href: '/contact', style: 'primaire' };
const dateFr = (d?: Date) => (d ? new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' }).format(d) : undefined);

/** Sections placées avant le corps Markdown, et après. */
export function gabaritDetail(collection: NomCollection, e: { id: string; data: any }): { avant: any[]; apres: any[] } {
  const d = e.data;
  const metier = (taxonomies.metiers as Record<string, string>)[d.categorie];
  switch (collection) {
    case 'services':
      return {
        avant: [
          { block: 'hero', variant: d.image ? 'split' : 'minimal', surtitre: L.services, titre: d.titre, texte: d.resume, image: d.image, ctas: [devis] },
          { block: 'features', variant: 'grille-icones', titre: 'Nos prestations', items: d.prestations.map((p: any) => ({ icone: 'check', titre: p.label })) },
        ],
        apres: [
          { block: 'boucle', background: 'alt', titre: `Nos chantiers en ${metier.toLowerCase()}`, source: 'realisations', filtre: { categorie: '$courant.categorie' }, ordre: 'date desc', nombre: 3, carte: 'realisation-carte', affichage: 'grid', lien_tout_voir: { label: 'Tous les chantiers', href: '/realisations' } },
          { block: 'boucle', titre: 'Où nous intervenons', source: 'zones', filtre: { categorie: '$courant.categorie' }, ordre: 'ordre asc', nombre: 24, carte: 'zone-pastille', affichage: 'flux' },
          // Témoignages du métier (rien ne s'affiche s'il n'y en a pas)
          { block: 'temoignages', background: 'alt', titre: L.temoignages, categorie: '$courant.categorie', nombre: 3 },
          ctaFin,
        ],
      };
    case 'articles': {
      const maj = d.date ? new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d.date)) : undefined;
      return {
        avant: [
          { block: 'hero', variant: d.image ? 'split' : 'minimal', surtitre: [maj ? `Mis à jour le ${maj}` : 'À savoir', d.auteur && `par ${d.auteur}`].filter(Boolean).join(' · '), titre: d.titre, texte: d.resume, image: d.image },
          { block: 'partage', spacing: 'compact' },
        ],
        apres: [
          { block: 'partage', spacing: 'compact' },
          { block: 'boucle', background: 'alt', titre: 'À lire aussi', source: 'articles', filtre: { theme: '$courant.theme' }, exclure: ['$courant.id'], ordre: 'date desc', nombre: 3, carte: 'article-carte', affichage: 'grid', si_vide: 'masquer', lien_tout_voir: { label: 'Toute la rubrique À savoir', href: '/a-savoir' } },
        ],
      };
    }
    case 'realisations':
      return {
        avant: [
          { block: 'hero', variant: d.image ? 'split' : 'minimal', surtitre: [d.lieu, dateFr(d.date)].filter(Boolean).join(' · '), titre: d.titre, texte: d.resume, image: d.image },
          ...(d.galerie?.length >= 2 ? [{ block: 'galerie', variant: 'mosaique', titre: 'En images', images: d.galerie }] : []),
        ],
        apres: [
          // Le mot du client de ce chantier, s'il en a laissé un
          { block: 'temoignages', variant: 'citation', titre: L.temoignage_realisation, realisation: '$courant.id' },
          { block: 'boucle', titre: 'Le service', source: 'services', filtre: { categorie: '$courant.categorie' }, ordre: 'ordre asc', nombre: 1, carte: 'service-carte', affichage: 'grid' },
          { block: 'boucle', titre: 'Nous intervenons aussi près de chez vous', source: 'zones', filtre: { categorie: '$courant.categorie', ville: '$courant.lieu' }, ordre: 'ordre asc', nombre: 4, carte: 'zone-pastille', affichage: 'flux' },
          { block: 'boucle', background: 'alt', titre: 'Chantiers similaires', source: 'realisations', filtre: { categorie: '$courant.categorie' }, exclure: ['$courant.id'], ordre: 'date desc', nombre: 3, carte: 'realisation-carte', affichage: 'grid' },
          ctaFin,
        ],
      };
    case 'equipes': {
      const encadrants = (d.encadrants ?? []) as { nom: string; role?: string }[];
      return {
        avant: [
          { block: 'hero', variant: d.image ? 'split' : 'minimal', surtitre: [metier, d.ages ?? d.championnat].filter(Boolean).join(' · '), titre: d.titre, texte: d.resume, image: d.image,
            ctas: [{ label: 'Venir essayer', href: '/#inscription', style: 'primaire' }] },
          { block: 'planning', variant: 'semaine', titre: 'Les entraînements', equipes: ['$courant.id'] },
          ...(encadrants.length >= 2
            ? [{ block: 'features', variant: 'liste', titre: "L'encadrement", items: encadrants.map((x) => ({ icone: 'check', titre: x.nom, texte: x.role })) }]
            : encadrants.length === 1
              ? [{ block: 'texte', titre: "L'encadrement", contenu: `**${encadrants[0].nom}**${encadrants[0].role ? `, ${encadrants[0].role}` : ''}` }]
              : []),
        ],
        apres: [
          { block: 'boucle', titre: 'Prochaines rencontres', source: 'rencontres', filtre: { equipe: '$courant.id', date: { apres: 'aujourdhui' } }, ordre: ['date asc', 'heure asc'], nombre: 6, carte: 'rencontre-ligne', affichage: 'liste' },
          { block: 'boucle', titre: 'Derniers résultats', source: 'rencontres', filtre: { equipe: '$courant.id', date: { avant: 'aujourdhui' } }, ordre: 'date desc', nombre: 6, carte: 'rencontre-ligne', affichage: 'liste', lien_tout_voir: { label: 'Tout le calendrier', href: '/calendrier' } },
          { block: 'boucle', background: 'alt', titre: `Actualités : ${d.nom_court}`, source: 'actualites', filtre: { equipe: '$courant.id' }, ordre: 'date desc', nombre: 3, carte: 'actualite-carte', affichage: 'grid', options: { colonnes: 3 } },
          { block: 'boucle', titre: 'En photos', source: 'albums', filtre: { equipe: '$courant.id' }, ordre: 'date desc', nombre: 3, carte: 'album-carte', affichage: 'grid', options: { colonnes: 3 } },
          { block: 'boucle', background: 'alt', titre: `${metier} : les autres catégories`, source: 'equipes', filtre: { categorie: '$courant.categorie' }, exclure: ['$courant.id'], ordre: 'ordre asc', nombre: 6, carte: 'equipe-carte', affichage: 'grid' },
          ctaFin,
        ],
      };
    }
    case 'rencontres': {
      const r = { id: e.id, data: d };
      const res = issue(r);
      const infos = [
        `**${(([c, ...x]) => c.toUpperCase() + x.join(''))(jourRencontre(d.date, true))}**${d.heure ? `, ${heureFr(d.heure)}` : ''}`,
        `${d.domicile ? 'À domicile' : 'À l\'extérieur'}${lieu(r) ? ` : ${lieu(r)}` : ''}`,
        d.competition,
        d.annulee ? '**Rencontre annulée ou reportée.**' : '',
      ].filter(Boolean).join('\n\n');
      return {
        avant: [
          { block: 'hero', variant: d.image ? 'split' : 'minimal', surtitre: typeRencontre(d.type), titre: intitule(r), image: d.image,
            texte: aScore(r) ? `${score(r)} · ${libelleIssue[res!]}` : d.resume },
          { block: 'texte', spacing: 'compact', titre: 'La rencontre', contenu: infos },
        ],
        apres: [
          { block: 'boucle', background: 'alt', titre: 'Les autres rencontres de l\'équipe', source: 'rencontres', filtre: { equipe: '$courant.equipe' }, exclure: ['$courant.id'], ordre: 'date desc', nombre: 5, carte: 'rencontre-ligne', affichage: 'liste', lien_tout_voir: { label: 'Tout le calendrier', href: '/calendrier' } },
          { block: 'boucle', titre: 'En photos', source: 'albums', filtre: { equipe: '$courant.equipe' }, ordre: 'date desc', nombre: 3, carte: 'album-carte', affichage: 'grid', options: { colonnes: 3 } },
        ],
      };
    }
    case 'actualites':
      return {
        avant: [{ block: 'hero', variant: d.image ? 'split' : 'minimal', surtitre: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d.date)), titre: d.titre, texte: d.resume, image: d.image }],
        apres: [
          { block: 'boucle', background: 'alt', titre: 'Les autres actualités', source: 'actualites', exclure: ['$courant.id'], ordre: 'date desc', nombre: 3, carte: 'actualite-carte', affichage: 'grid', options: { colonnes: 3 }, lien_tout_voir: { label: 'Toutes les actualités', href: '/actualites' } },
          ctaFin,
        ],
      };
    case 'albums':
      return {
        avant: [{ block: 'hero', variant: 'minimal', surtitre: new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(d.date)), titre: d.titre, texte: d.resume }],
        apres: [{ block: 'boucle', background: 'alt', titre: 'Autres albums', source: 'albums', exclure: ['$courant.id'], ordre: 'date desc', nombre: 3, carte: 'album-carte', affichage: 'grid', options: { colonnes: 3 }, lien_tout_voir: { label: 'Tous les albums', href: '/albums' } }],
      };
    case 'zones':
      return {
        avant: [{ block: 'hero', variant: 'minimal', surtitre: d.ville, titre: d.titre, texte: d.resume, ctas: [devis] }],
        apres: [
          { block: 'boucle', titre: 'Le service', source: 'services', filtre: { categorie: '$courant.categorie' }, ordre: 'ordre asc', nombre: 3, carte: 'service-carte', affichage: 'grid' },
          { block: 'boucle', background: 'alt', titre: `Nos chantiers à ${d.ville}`, source: 'realisations', filtre: { categorie: '$courant.categorie', lieu: '$courant.ville' }, ordre: 'date desc', nombre: 3, carte: 'realisation-carte', affichage: 'grid' },
          ctaFin,
        ],
      };
  }
}
