/**
 * Widget Decap « image_phototheque » : le champ image habituel (envoyer une photo, texte alternatif, point
 * d'intérêt), plus un bouton « Choisir dans la photothèque » qui ouvre toutes les images déjà publiées sur le site
 * (dist/admin/phototheque.json, généré par scripts/phototheque.mjs) : filtre par endroit, recherche, un clic pour
 * reprendre la photo et son texte alternatif. Rien n'est renvoyé ni dupliqué : la page pointe vers l'image existante.
 */
(function () {
  const CMS = window.CMS, h = window.h, createClass = window.createClass;
  if (!CMS || !h || !createClass) return;
  const Objet = CMS.getWidget('object');
  if (!Objet) return;

  let promesse = null;
  const charger = () => (promesse ??= fetch('/admin/phototheque.json', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : { photos: [] }))
    .then((d) => (d.photos || []).map((p) => ({ ...p, groupe: p.ou[0] || `Non utilisée · ${p.dossier || 'médias'}`, texte: [p.alt, p.legende, p.src, ...p.ou].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() })))
    .catch(() => []));
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const nomFichier = (src) => src.split('/').pop();
  const PAR_PAGE = 120;

  if (!document.getElementById('xm-pt-style')) {
    const st = document.createElement('style');
    st.id = 'xm-pt-style';
    st.textContent = `
      .xm-pt-bouton{display:inline-flex;align-items:center;gap:6px;margin:0 0 10px;padding:8px 14px;border-radius:6px;border:1px solid #3a69c7;background:#e8f0fe;color:#1d4a9e;font:600 14px/1.2 system-ui,sans-serif;cursor:pointer}
      .xm-pt-bouton:hover{background:#d5e3fc}.xm-pt-bouton:focus-visible{outline:3px solid #f5b400;outline-offset:2px}
      .xm-pt{position:fixed;inset:0;z-index:10000;background:rgba(20,26,38,.6);display:flex;align-items:center;justify-content:center;padding:24px;font:15px/1.4 system-ui,sans-serif}
      .xm-pt__boite{background:#fff;color:#1d2230;border-radius:12px;width:min(1100px,100%);max-height:100%;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,.3)}
      .xm-pt__tete{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:16px 18px;border-bottom:1px solid #e3e6ec}
      .xm-pt__tete h2{margin:0 auto 0 0;font-size:18px}
      .xm-pt__tete input,.xm-pt__tete select{font:inherit;padding:8px 10px;border:1px solid #b9c1cf;border-radius:6px;min-width:0}
      .xm-pt__tete input{flex:1 1 220px}
      .xm-pt__fermer{font:inherit;font-weight:600;padding:8px 14px;border-radius:6px;border:1px solid #b9c1cf;background:#fff;cursor:pointer}
      .xm-pt__corps{overflow:auto;padding:16px 18px}
      .xm-pt__etat{margin:0 0 12px;color:#4a5160}
      .xm-pt__grille{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}
      .xm-pt__photo{width:100%;display:flex;flex-direction:column;gap:6px;padding:6px;border:2px solid transparent;border-radius:8px;background:#f4f6f9;cursor:pointer;text-align:left;font:inherit;color:inherit}
      .xm-pt__photo:hover{border-color:#9db6e8}.xm-pt__photo:focus-visible{outline:3px solid #f5b400;outline-offset:2px}
      .xm-pt__photo[aria-current=true]{border-color:#1d4a9e;background:#e8f0fe}
      .xm-pt__photo img{width:100%;aspect-ratio:1;object-fit:cover;border-radius:5px;background:#dde2ea}
      .xm-pt__nom{font-size:12.5px;font-weight:600;word-break:break-all}
      .xm-pt__ou{font-size:12px;color:#5b6271}
      .xm-pt__plus{margin:16px auto 0;display:block;font:inherit;padding:8px 16px;border-radius:6px;border:1px solid #b9c1cf;background:#fff;cursor:pointer}`;
    document.head.appendChild(st);
  }

  const Controle = createClass({
    getInitialState() { return { ouvert: false, photos: null, q: '', groupe: '', limite: PAR_PAGE }; },
    componentWillUnmount() { document.removeEventListener('keydown', this.touche); },
    ouvrir() {
      this.setState({ ouvert: true, limite: PAR_PAGE });
      document.addEventListener('keydown', this.touche);
      charger().then((photos) => this.setState({ photos }));
    },
    fermer() {
      this.setState({ ouvert: false });
      document.removeEventListener('keydown', this.touche);
      setTimeout(() => this.declencheur && this.declencheur.focus(), 0);
    },
    touche(e) { if (e.key === 'Escape') { e.stopPropagation(); this.fermer(); } },
    valeur() { const v = this.props.value; return v && v.get ? v : null; },
    choisir(p) {
      const v = this.valeur();
      let n = (v || this.props.field.clear()).set('src', p.src);
      if (!(v && v.get('alt'))) n = n.set('alt', p.alt || '');
      const champs = this.props.field.get('fields');
      if (p.legende && champs && champs.some((f) => f.get('name') === 'legende') && !(v && v.get('legende'))) n = n.set('legende', p.legende);
      this.props.onChange(n);
      this.fermer();
    },
    render() {
      const s = this.state;
      const actuel = this.valeur() && this.valeur().get('src');
      const bouton = h('button', {
        type: 'button', className: 'xm-pt-bouton', ref: (el) => { this.declencheur = el; },
        onClick: () => this.ouvrir(), 'aria-haspopup': 'dialog',
      }, '🖼 Choisir dans la photothèque');
      if (!s.ouvert) return h('div', null, bouton, h(Objet.control, this.props));

      const q = norm(s.q);
      const photos = s.photos || [];
      const groupes = [...new Set(photos.map((p) => p.groupe))].sort((a, b) => a.localeCompare(b, 'fr'));
      const trouvees = photos.filter((p) => (!s.groupe || p.groupe === s.groupe) && (!q || q.split(/\s+/).every((m) => p.texte.includes(m))));
      const visibles = trouvees.slice(0, s.limite);
      const etat = s.photos === null ? 'Chargement de la photothèque…'
        : !photos.length ? "La photothèque est vide, ou le site n'a pas encore été publié avec cette fonction. Utilisez « Choisir une image » pour envoyer une photo."
        : `${trouvees.length} photo${trouvees.length > 1 ? 's' : ''}${trouvees.length > visibles.length ? ` (${visibles.length} affichées)` : ''}. Les photos envoyées mais pas encore publiées apparaissent après la mise en ligne suivante.`;

      const modale = h('div', { className: 'xm-pt', onClick: (e) => { if (e.target === e.currentTarget) this.fermer(); } },
        h('div', { className: 'xm-pt__boite', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'xm-pt-titre' },
          h('div', { className: 'xm-pt__tete' },
            h('h2', { id: 'xm-pt-titre' }, 'Photothèque du site'),
            h('input', { type: 'search', placeholder: 'Rechercher (texte alternatif, légende, nom…)', 'aria-label': 'Rechercher une photo', autoFocus: true, value: s.q, onChange: (e) => this.setState({ q: e.target.value, limite: PAR_PAGE }) }),
            h('select', { 'aria-label': 'Où la photo est utilisée', value: s.groupe, onChange: (e) => this.setState({ groupe: e.target.value, limite: PAR_PAGE }) },
              h('option', { value: '' }, 'Toutes les photos'),
              groupes.map((g) => h('option', { key: g, value: g }, g))),
            h('button', { type: 'button', className: 'xm-pt__fermer', onClick: () => this.fermer() }, 'Fermer')),
          h('div', { className: 'xm-pt__corps' },
            h('p', { className: 'xm-pt__etat', role: 'status' }, etat),
            h('ul', { className: 'xm-pt__grille' },
              visibles.map((p) => h('li', { key: p.src },
                h('button', { type: 'button', className: 'xm-pt__photo', 'aria-current': p.src === actuel ? 'true' : 'false', onClick: () => this.choisir(p), title: p.src },
                  h('img', { src: p.vignette, alt: p.alt || '', loading: 'lazy', width: 150, height: 150 }),
                  h('span', { className: 'xm-pt__nom' }, p.alt || nomFichier(p.src)),
                  h('span', { className: 'xm-pt__ou' }, p.ou.length ? p.ou[0] + (p.ou.length > 1 ? ` (+${p.ou.length - 1})` : '') : 'Pas encore utilisée'),
                  h('span', { className: 'xm-pt__ou' }, `${p.largeur} × ${p.hauteur} px`))))),
            trouvees.length > visibles.length && h('button', { type: 'button', className: 'xm-pt__plus', onClick: () => this.setState({ limite: s.limite + PAR_PAGE }) }, 'Afficher plus de photos'))));
      return h('div', null, bouton, h(Objet.control, this.props), modale);
    },
  });

  CMS.registerWidget('image_phototheque', Controle, Objet.preview);
})();
