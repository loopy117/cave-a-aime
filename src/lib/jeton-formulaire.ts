/**
 * Jeton anti-robots du formulaire de contact (serveur : /formulaire/jeton.php et antispam.php de xmedia-serveur).
 *
 * Le serveur remet un jeton daté et signé, à usage unique, et n'accepte l'envoi que 5 s au moins après l'avoir remis.
 * Les robots qui envoient le formulaire sans exécuter la page, ou dans la seconde, sont écartés sans captcha.
 * Le jeton est demandé au premier contact avec le formulaire (pas de requête pour qui ne fait que lire la page) ; à
 * l'envoi, s'il est trop récent, on attend le reste : aucun visiteur n'est refusé pour être allé trop vite.
 */
const DELAI_MIN_MS = 5000 + 400;      // délai du serveur + marge (horloge, trajet)
const AGE_MAX_MS = 3 * 3600 * 1000;   // au-delà, on en redemande un (le serveur l'accepte 24 h)

type Jeton = { valeur: string; recu: number };
const jetons = new WeakMap<HTMLFormElement, Promise<Jeton | null>>();

async function demander(): Promise<Jeton | null> {
  try {
    const r = await fetch('/formulaire/jeton.php', { cache: 'no-store', headers: { Accept: 'application/json' } });
    const d = await r.json();
    return typeof d?.jeton === 'string' ? { valeur: d.jeton, recu: Date.now() } : null;
  } catch {
    return null;
  }
}

/** À appeler une fois par formulaire : le jeton est demandé au premier focus, toucher ou clic dans le formulaire. */
export function preparerJeton(form: HTMLFormElement): void {
  const premier = () => { if (!jetons.has(form)) jetons.set(form, demander()); };
  for (const e of ['focusin', 'pointerdown', 'keydown']) form.addEventListener(e, premier, { once: true, passive: true });
}

/**
 * Jeton à joindre à l'envoi (chaîne vide si le serveur ne répond pas : l'envoi part quand même et sera relu).
 * Attend si besoin la fin du délai minimum, puis prépare le jeton suivant (nouvel essai après une erreur de saisie).
 */
export async function jetonPourEnvoi(form: HTMLFormElement): Promise<string> {
  let j = await (jetons.get(form) ?? demander());
  if (!j || Date.now() - j.recu > AGE_MAX_MS) j = await demander();
  jetons.set(form, demander());
  if (!j) return '';
  const reste = DELAI_MIN_MS - (Date.now() - j.recu);
  if (reste > 0) await new Promise((ok) => setTimeout(ok, reste));
  return j.valeur;
}

/**
 * Formulaires écrits par un site (hors bloc « formulaire ») qui envoient à /formulaire/envoi.php sans script :
 * le jeton est ajouté dans un champ caché avant l'envoi. Un formulaire dont le site gère déjà l'envoi en JavaScript
 * (événement annulé avant le nôtre) n'est pas touché.
 */
export function equiperFormulairesNatifs(): void {
  for (const form of document.querySelectorAll<HTMLFormElement>('form[action$="/formulaire/envoi.php"]:not([data-formulaire])')) {
    preparerJeton(form);
    let pret = false;
    form.addEventListener('submit', async (ev) => {
      if (pret || ev.defaultPrevented) return;
      ev.preventDefault();
      const valeur = await jetonPourEnvoi(form);
      let champ = form.querySelector<HTMLInputElement>('input[name="jeton"]');
      if (!champ) {
        champ = document.createElement('input');
        champ.type = 'hidden'; champ.name = 'jeton';
        form.append(champ);
      }
      champ.value = valeur;
      pret = true;
      form.submit();
    });
  }
}
