/**
 * Contraintes photo de chaque emplacement d'image, selon le bloc qui l'affiche.
 * Partie présentation : à mettre à jour quand un bloc change de mise en page.
 * Utilisé par scripts/photos.ts pour produire la liste de prises de vue.
 */
export interface Emplacement {
  format: 'paysage' | 'portrait' | 'carré' | 'libre';
  ratio: string;          // proportion affichée, pour le cadrage
  minLargeur: number;     // largeur minimale conseillée en pixels
  cadrage: string;        // consigne au photographe
  exigence: number;       // pour départager quand une photo sert à plusieurs endroits
}

const E = (e: Emplacement) => e;

export function emplacement(ctx: { bloc: string; variant?: string; champ: string; index?: number; nb?: number }): Emplacement {
  const { bloc, variant, champ, index = 0, nb = 1 } = ctx;
  switch (bloc) {
    case 'hero':
      if (variant === 'affiche')
        return E({ format: 'paysage', ratio: '16:10 sur ordinateur, vertical sur téléphone', minLargeur: 2400, exigence: 5,
          cadrage: 'Photo sur toute la hauteur de l\'écran, titre posé en bas à gauche : sujet au centre ou en haut, bas de l\'image calme (sol, table, ombre). Recadrée en hauteur sur téléphone : garder le sujet au centre.' });
      if (variant === 'plein-ecran')
        return E({ format: 'paysage', ratio: '16:9 (très large)', minLargeur: 2400, exigence: 5,
          cadrage: 'Photo en fond sur toute la largeur, avec le texte posé à gauche : placer le sujet dans le tiers droit, garder la moitié gauche calme (mur, ciel, flou). Pas de texte ni de logo important dans l\'image.' });
      return E({ format: 'paysage', ratio: '4:3', minLargeur: 1600, exigence: 4,
        cadrage: 'Sujet bien centré, avec de l\'air autour : l\'image est recadrée en 4:3 à côté du titre.' });
    case 'texte-image':
      if (nb === 3 && index === 0)
        return E({ format: 'portrait', ratio: '3:4 (vertical)', minLargeur: 1200, exigence: 4,
          cadrage: 'Grande image verticale de la mosaïque : idéale pour un portrait d\'équipe en pied ou à mi-corps, devant le fourgon ou sur un chantier.' });
      if (nb === 3)
        return E({ format: 'paysage', ratio: '4:3', minLargeur: 1000, exigence: 2,
          cadrage: 'Petite vignette de la mosaïque : un détail net et lisible de loin (un geste, une pièce, un logo sur le fourgon).' });
      return E({ format: 'paysage', ratio: '4:3', minLargeur: 1600, exigence: 3, cadrage: 'Sujet centré, lumière naturelle.' });
    case 'cta':
      return E({ format: 'paysage', ratio: '4:3', minLargeur: 1600, exigence: 3, cadrage: 'Image d\'ambiance à côté d\'un encadré vert : un intérieur fini, un client satisfait (avec son accord).' });
    case 'galerie':
      return E({ format: 'libre', ratio: 'libre', minLargeur: 1600, exigence: 2, cadrage: 'Varier les plans : vue d\'ensemble, détail, avant/après si possible.' });
    case 'slider':
      return E({ format: 'paysage', ratio: '16:7 (très large)', minLargeur: 2000, exigence: 4, cadrage: 'Bandeau très large avec légende en bas : garder le bas de l\'image sombre ou uni.' });
    case 'carte-service':
      return E({ format: 'paysage', ratio: '2:1 sur la carte, 4:3 sur la page du service', minLargeur: 1600, exigence: 4,
        cadrage: 'Sert à la fois de vignette très large et d\'image de page : sujet centré avec de la marge en haut et en bas. Montrer l\'équipement posé, propre, dans son environnement.' });
    case 'carte-realisation':
      return E({ format: 'paysage', ratio: '16:9 sur la carte, 4:3 sur la page', minLargeur: 1600, exigence: 4,
        cadrage: 'Photo du chantier terminé, pièce rangée, lumière du jour. Sujet centré avec de la marge : l\'image est recadrée différemment selon l\'endroit.' });
    default:
      return E({ format: 'paysage', ratio: '3:2', minLargeur: 1600, exigence: 1, cadrage: `Emplacement ${bloc}.${champ}` });
  }
}
