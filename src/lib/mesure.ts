/**
 * Mesure d'audience sans cookie ni identifiant : à l'affichage réel d'une page (onglet visible), un signal vide
 * part vers /xm-vu (réponse 204 de Caddy, aucun PHP, rien d'enregistré à part la ligne du journal d'accès).
 * xm-stats ne compte ensuite que les visiteurs qui ont envoyé ce signal : les robots qui n'exécutent pas
 * le JavaScript (ou qui pilotent un navigateur, navigator.webdriver) ne sont plus comptés.
 * Événements (outil lancé, résultat affiché…) : src/lib/evenements.ts. Ici, un seul automatique : la page /merci
 * (demande envoyée par un formulaire) envoie « contact-envoye ».
 */
import { evenement, mesureActive, poster } from './evenements';

function envoyer() {
  poster('/xm-vu');
  if (location.pathname.replace(/\/$/, '') === '/merci') evenement('contact-envoye');
}

if (mesureActive()) {
  if (document.visibilityState === 'visible') envoyer();
  else {
    const attendre = () => {
      if (document.visibilityState !== 'visible') return;
      document.removeEventListener('visibilitychange', attendre);
      envoyer();
    };
    document.addEventListener('visibilitychange', attendre);
  }
}
