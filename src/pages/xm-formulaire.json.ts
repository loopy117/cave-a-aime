import type { APIRoute } from 'astro';

/**
 * Signale au serveur que le formulaire de ce site envoie le jeton anti-robots (src/lib/jeton-formulaire.ts) :
 * dès que ce fichier est en ligne, /formulaire/envoi.php l'exige. Un site au socle plus ancien ne le publie pas
 * et son formulaire fonctionne comme avant.
 */
export const GET: APIRoute = () =>
  new Response(JSON.stringify({ jeton: true, version: 1 }), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
