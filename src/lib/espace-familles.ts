/**
 * Espace des familles d'un club, affiché dans une page du site (/espace-familles/, src/pages/[espace].astro) :
 * même en-tête, menu, pied de page et couleurs que le reste du site. Les données viennent de l'API du serveur
 * (/xmedia-ai/famille/api.php) : connexion par lien e-mail, droit à l'image, annonces, albums et documents réservés.
 * Le cookie de session reste limité à /xmedia-ai/famille/ : il accompagne les appels à l'API et les photos.
 */
const API = '/xmedia-ai/famille/api.php';
const racine = document.getElementById('ef') as HTMLElement | null;

if (racine) {
  const $ = <T extends HTMLElement = HTMLElement>(s: string) => racine.querySelector(s) as T | null;
  const app = racine.querySelector('#ef-app') as HTMLElement;
  const qui = racine.querySelector('#ef-qui') as HTMLElement;
  const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
  const jour = (d: string) => new Date(d.length === 10 ? d + 'T12:00:00' : d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const titrePage = document.title;
  let S: any = null;

  async function api(action: string, corps: unknown = null, params = ''): Promise<any> {
    const o: RequestInit = corps ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Famille': '1' }, body: JSON.stringify(corps), credentials: 'same-origin' } : { credentials: 'same-origin' };
    let j: any;
    try { const r = await fetch(API + '?action=' + action + params, o); j = await r.json(); } catch { j = { ok: false, message: 'Le serveur ne répond pas : réessayez dans un instant.' }; }
    if (j.connexion && S) { S.connecte = false; afficher(); }
    return j;
  }
  const photo = (id: string, f: string) => `${API}?action=photo&id=${encodeURIComponent(id)}&f=${encodeURIComponent(f)}`;
  const statut = (r: any) => r.ok ? `<p class="ef-ok">${esc(r.message)}</p>` : `<p class="ef-erreur">${esc(r.message)}</p>`;
  // Focus sur le titre à chaque changement d'écran (lecteurs d'écran), jamais au premier affichage de la page
  let premier = true;
  const titre = (t: string) => {
    document.title = t === 'Espace des familles' ? titrePage : `${t} — ${titrePage}`;
    if (premier) { premier = false; return; }
    const h = app.querySelector('h2');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
  };

  async function demarrer() {
    S = await api('session');
    if (!S.ok && S.club === undefined) { app.innerHTML = `<p class="ef-erreur">${esc(S.message || 'Espace momentanément indisponible.')}</p>`; return; }
    const jeton = new URLSearchParams(location.search).get('jeton');
    if (jeton) return ecranJeton(jeton);
    afficher();
  }
  // Ancres de la page (Droit à l'image, Annonces…) : pas de nouvel affichage
  window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && document.getElementById(h)) return; afficher(); });

  function afficher() {
    qui.innerHTML = S.connecte ? `<button type="button" class="btn btn--secondaire btn--sm" id="ef-sortir">Se déconnecter</button>` : '';
    const sortir = $('#ef-sortir');
    if (sortir) sortir.onclick = async () => { await api('deconnexion', {}); S.connecte = false; history.replaceState(null, '', location.pathname); afficher(); };
    if (!S.connecte) return ecranConnexion();
    const h = location.hash.slice(1);
    if (h.startsWith('album/')) return ecranAlbum(h.slice(6));
    if (h === 'ecrire') return ecranMessage();
    return ecranAccueil();
  }

  /** Lien reçu par e-mail : un bouton confirme (les antivirus de messagerie qui ouvrent les liens ne le consomment pas). */
  function ecranJeton(jeton: string) {
    app.innerHTML = `<h2>Bienvenue</h2><div class="ef-carte"><p>Vous entrez dans l'espace des familles de ${esc(S.club)}.</p>
      <button type="button" class="btn btn--primaire" id="ef-entrer">Entrer</button><p class="ef-erreur" id="ef-err" role="alert"></p></div>`;
    titre('Bienvenue');
    $('#ef-entrer')!.onclick = async () => {
      const r = await api('connexion', { jeton });
      history.replaceState(null, '', location.pathname);
      if (!r.ok) { $('#ef-err')!.textContent = r.message; setTimeout(() => { S.connecte = false; afficher(); }, 2500); return; }
      S = await api('session'); afficher();
    };
  }

  function ecranConnexion() {
    app.innerHTML = `<p class="ef-intro">Albums photos réservés aux familles, annonces et documents du club, autorisation du droit à l'image.</p>
      <form class="ef-carte" id="ef-f-lien"><h2>Recevoir mon lien de connexion</h2>
        <div class="ef-champ"><label for="ef-email">Votre adresse e-mail (celle donnée au club à l'inscription)</label><input id="ef-email" type="email" autocomplete="email" required></div>
        <button class="btn btn--primaire">Recevoir le lien</button><div id="ef-msg-lien" role="status"></div></form>
      <details class="ef-carte"><summary>Vous n'êtes pas sur la liste du club ? Demander un accès</summary>
        <form id="ef-f-demande"><p class="ef-aide">Le club vérifie votre demande, puis vous recevez votre lien par e-mail.</p>
          <div class="ef-champ"><label for="ef-d-parent">Votre nom</label><input id="ef-d-parent" required autocomplete="name"></div>
          <div class="ef-champ"><label for="ef-d-email">Votre e-mail</label><input id="ef-d-email" type="email" required autocomplete="email"></div>
          <div class="ef-champ"><label for="ef-d-prenom">Prénom du licencié</label><input id="ef-d-prenom" required></div>
          <div class="ef-champ"><label for="ef-d-nom">Nom du licencié</label><input id="ef-d-nom" required></div>
          <div class="ef-champ"><label for="ef-d-equipe">Équipe</label><select id="ef-d-equipe"><option value="">Je ne sais pas</option>${Object.entries(S.equipes || {}).map(([k, l]) => `<option value="${esc(k)}">${esc(l)}</option>`).join('')}</select></div>
          <div class="ef-champ"><label for="ef-d-message">Message (facultatif)</label><textarea id="ef-d-message" rows="2" maxlength="500"></textarea></div>
          <div class="ef-piege" aria-hidden="true"><label for="ef-d-site">Ne pas remplir</label><input id="ef-d-site" tabindex="-1" autocomplete="off"></div>
          <button class="btn btn--secondaire">Envoyer la demande</button><div id="ef-msg-demande" role="status"></div></form></details>`;
    titre('Espace des familles');
    const val = (id: string) => ($(id) as HTMLInputElement).value;
    $('#ef-f-lien')!.onsubmit = async (e: SubmitEvent) => {
      e.preventDefault(); const b = e.submitter as HTMLButtonElement; b.disabled = true;
      const r = await api('lien', { email: val('#ef-email') });
      b.disabled = false; $('#ef-msg-lien')!.innerHTML = statut(r);
    };
    $('#ef-f-demande')!.onsubmit = async (e: SubmitEvent) => {
      e.preventDefault(); const b = e.submitter as HTMLButtonElement; b.disabled = true;
      const r = await api('demande_acces', { parent: val('#ef-d-parent'), email: val('#ef-d-email'), prenom: val('#ef-d-prenom'), nom: val('#ef-d-nom'), equipe: val('#ef-d-equipe'), message: val('#ef-d-message'), site_web: val('#ef-d-site') });
      b.disabled = false; $('#ef-msg-demande')!.innerHTML = statut(r);
      if (r.ok) (e.target as HTMLFormElement).reset();
    };
  }

  /** Seul le choix qui change quelque chose est proposé : accord donné → le retirer ; refus → autoriser ; sans réponse → les deux. */
  const boutonsDroit = (e: any) => {
    const b = (etat: string, libelle: string, primaire: boolean) => `<button type="button" class="btn btn--sm ${primaire ? 'btn--primaire' : 'btn--secondaire'}" data-id="${esc(e.id)}" data-etat="${etat}">${libelle}</button>`;
    if (e.droit === 'accord') return b('refus', 'Retirer mon accord', false);
    if (e.droit === 'refus') return b('accord', "Finalement, j'autorise", true);
    return b('accord', "J'autorise", true) + b('refus', "Je n'autorise pas", false);
  };
  const LIBELLE_DROIT: Record<string, string> = { accord: 'Accord donné', refus: 'Refus', sans_reponse: 'Sans réponse' };
  async function ecranAccueil(message = '') {
    const r = await api('accueil');
    if (!r.ok) { app.innerHTML = `<p class="ef-erreur">${esc(r.message || 'Espace momentanément indisponible.')}</p>`; return; }
    const texte = (e: any) => String(S.texte_droit).replaceAll('{club}', S.club).replaceAll('{prenom}', e.prenom).replaceAll('{saison}', S.saison);
    app.innerHTML = `<div id="ef-msg" role="status">${message ? `<p class="ef-ok">${esc(message)}</p>` : ''}</div>
      <nav class="ef-raccourcis" aria-label="Dans cette page"><a href="#ef-droit">Droit à l'image</a>${r.annonces.length ? '<a href="#ef-annonces">Annonces</a>' : ''}${r.albums.length ? '<a href="#ef-albums">Albums</a>' : ''}${r.documents.length ? '<a href="#ef-documents">Documents</a>' : ''}<a href="#ecrire">Écrire au club</a></nav>
      <h2 id="ef-droit">Droit à l'image</h2>
      ${S.enfants.map((e: any) => `<section class="ef-carte ef-enfant" aria-labelledby="ef-e-${esc(e.id)}"><div class="ef-haut"><h3 id="ef-e-${esc(e.id)}">${esc(e.prenom)} ${esc(e.nom)}${e.equipe ? ` <span class="ef-meta">· ${esc(e.equipe)}</span>` : ''}</h3>
          <span class="ef-puce ef-p-${esc(e.droit)}">${LIBELLE_DROIT[e.droit] ?? ''}${e.source === 'papier' ? ' (fiche papier)' : ''}</span></div>
        <p class="ef-texte">${esc(texte(e))}</p>
        ${e.droit === 'sans_reponse' ? `<p class="ef-aide">Sans réponse, aucune photo où ${esc(e.prenom)} apparaît n'est publiée.</p>` : ''}
        <div class="ef-actions">${boutonsDroit(e)}</div></section>`).join('')}
      ${r.annonces.length ? `<h2 id="ef-annonces">Annonces</h2>${r.annonces.map((a: any) => `<article class="ef-carte ef-annonce"><h3>${esc(a.titre)}</h3><p class="ef-meta">${jour(a.date)}${a.equipe ? ' · ' + esc(a.equipe) : ' · tout le club'}${a.nom ? ' · ' + esc(a.nom) : ''}</p><p class="ef-texte-annonce">${esc(a.texte)}</p></article>`).join('')}` : ''}
      ${r.albums.length ? `<h2 id="ef-albums">Albums réservés aux familles</h2><ul class="ef-albums">${r.albums.map((a: any) => `<li><a href="#album/${esc(a.id)}">${a.couverture ? `<img src="${photo(a.id, 'v-' + a.couverture)}" alt="" loading="lazy">` : ''}<span>${esc(a.titre)}<small class="ef-meta">${jour(a.date)} · ${a.nombre} photo${a.nombre > 1 ? 's' : ''}</small></span></a></li>`).join('')}</ul>` : ''}
      ${r.documents.length ? `<h2 id="ef-documents">Documents</h2><ul class="ef-docs">${r.documents.map((d: any) => `<li><a href="${API}?action=document&id=${encodeURIComponent(d.id)}" target="_blank" rel="noopener">${esc(d.titre)}<span class="ef-meta">${esc(String(d.ext).toUpperCase())}, ${Math.max(1, Math.round(d.taille / 1024))} Ko</span></a></li>`).join('')}</ul>` : ''}
      <h2>Une question ?</h2><p><a class="btn btn--secondaire btn--sm" href="#ecrire">Écrire au club</a></p>
      <p class="ef-aide">Connecté avec ${esc(S.email)}.</p>`;
    titre('Espace des familles');
    racine.querySelectorAll<HTMLButtonElement>('[data-etat]').forEach((b) => b.onclick = async () => {
      const e = S.enfants.find((x: any) => x.id === b.dataset.id);
      if (b.dataset.etat === 'refus' && e.droit === 'accord' && !confirm(`Retirer votre accord pour ${e.prenom} ? Le club sera prévenu pour retirer les photos déjà publiées.`)) return;
      const x = await api('droit_image', { id: b.dataset.id, etat: b.dataset.etat });
      S = await api('session');
      ecranAccueil(x.ok ? x.message : '');
    });
  }

  async function ecranAlbum(id: string) {
    const r = await api('album', null, '&id=' + encodeURIComponent(id));
    if (!r.ok) { app.innerHTML = `<p><a href="#">← Retour</a></p><p class="ef-erreur">${esc(r.message)}</p>`; return; }
    const a = r.album;
    app.innerHTML = `<p><a href="#">← Retour</a></p><h2>${esc(a.titre)}</h2><p class="ef-meta">${jour(a.date)} · ${a.photos.length} photos. Réservées aux familles du club : merci de ne pas les diffuser.</p>
      <ul class="ef-photos">${a.photos.map((p: any, i: number) => `<li><a href="${photo(a.id, p.fichier)}" target="_blank" rel="noopener"><img src="${photo(a.id, 'v-' + p.fichier)}" alt="${esc(p.legende || 'Photo ' + (i + 1))}" loading="lazy"></a></li>`).join('')}</ul>`;
    titre(a.titre);
  }

  function ecranMessage() {
    app.innerHTML = `<p><a href="#">← Retour</a></p><h2>Écrire au club</h2>
      <form class="ef-carte" id="ef-f-msg">${S.enfants.length > 1 ? `<div class="ef-champ"><label for="ef-m-lic">Au sujet de</label><select id="ef-m-lic">${S.enfants.map((e: any) => `<option value="${esc(e.id)}">${esc(e.prenom)} ${esc(e.nom)}</option>`).join('')}</select></div>` : ''}
        <div class="ef-champ"><label for="ef-m-texte">Votre message</label><textarea id="ef-m-texte" rows="6" maxlength="3000" required></textarea></div>
        <button class="btn btn--primaire">Envoyer</button><div id="ef-m-res" role="status"></div></form>`;
    titre('Écrire au club');
    $('#ef-f-msg')!.onsubmit = async (e: SubmitEvent) => {
      e.preventDefault(); const b = e.submitter as HTMLButtonElement; b.disabled = true;
      const r = await api('message', { texte: ($('#ef-m-texte') as HTMLTextAreaElement).value, licencie: ($('#ef-m-lic') as HTMLSelectElement | null)?.value || '' });
      b.disabled = false; $('#ef-m-res')!.innerHTML = statut(r);
      if (r.ok) ($('#ef-m-texte') as HTMLTextAreaElement).value = '';
    };
  }

  demarrer();
}
