/**
 * Moteur de requête du bloc boucle (spec §7). Pur TypeScript : utilisé au
 * build par Astro et par scripts/validate.ts.
 */
export interface Element { id: string; data: Record<string, any>; }

export interface Requete {
  filtre?: Record<string, any>;
  exclure?: string[];
  elements?: string[];
  ordre?: string | string[];
  nombre?: number;
  decalage?: number;
}

/** Un élément est visible s'il est publié, ou programmé à une date atteinte. */
export function estPublie(e: Element, maintenant = new Date()): boolean {
  const s = e.data.statut ?? 'publie';
  if (s === 'publie') return true;
  if (s === 'programme') return !!e.data.date && new Date(e.data.date) <= maintenant;
  return false;
}

/** Remplace « $courant.champ » par la valeur de l'élément affiché. */
function resoudre(v: any, courant?: Element): any {
  if (typeof v === 'string' && v.startsWith('$courant.')) {
    const champ = v.slice('$courant.'.length);
    if (!courant) throw new Error(`« ${v} » utilisé hors d'une page de détail`);
    return champ === 'id' ? courant.id : courant.data[champ];
  }
  if (Array.isArray(v)) return v.map((x) => resoudre(x, courant));
  if (v && typeof v === 'object' && !(v instanceof Date)) return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, resoudre(x, courant)]));
  return v;
}

function valeur(e: Element, champ: string) { return champ === 'id' ? e.id : e.data[champ]; }
const egal = (a: any, b: any) => (a instanceof Date ? a.toISOString().slice(0, 10) : a) === b;
const temps = (x: any) => new Date(x).getTime();
/** « aujourdhui » (début du jour) ou une date. */
const borne = (x: any, maintenant: Date) => (x === 'aujourdhui' ? new Date(maintenant.toISOString().slice(0, 10)).getTime() : temps(x));

function depuis(expr: string, maintenant: Date): number {
  const [, n, unite] = expr.match(/^(\d+)\s*(\w+)$/)!;
  const d = new Date(maintenant);
  if (unite.startsWith('jour')) d.setDate(d.getDate() - +n);
  else if (unite === 'mois') d.setMonth(d.getMonth() - +n);
  else d.setFullYear(d.getFullYear() - +n);
  return d.getTime();
}

function correspond(e: Element, champ: string, cond: any, maintenant: Date): boolean {
  const v = valeur(e, champ);
  if (Array.isArray(cond)) return Array.isArray(v) ? v.some((x) => cond.includes(x)) : cond.some((c) => egal(v, c));
  if (cond === null || typeof cond !== 'object') return Array.isArray(v) ? v.includes(cond) : egal(v, cond);
  const liste = Array.isArray(v) ? v : v == null ? [] : [v];
  if ('different' in cond && egal(v, cond.different)) return false;
  if (cond.contient && !cond.contient.some((c: any) => liste.includes(c))) return false;
  if (cond.contient_tous && !cond.contient_tous.every((c: any) => liste.includes(c))) return false;
  if (cond.apres && !(v && temps(v) >= borne(cond.apres, maintenant))) return false;
  if (cond.avant && !(v && temps(v) < borne(cond.avant, maintenant))) return false;
  if (cond.depuis && !(v && temps(v) >= depuis(cond.depuis, maintenant))) return false;
  if (cond.min != null && !(typeof v === 'number' && v >= cond.min)) return false;
  if (cond.max != null && !(typeof v === 'number' && v <= cond.max)) return false;
  if (cond.existe != null) {
    const present = v != null && v !== '' && !(Array.isArray(v) && v.length === 0);
    if (present !== cond.existe) return false;
  }
  return true;
}

function comparer(a: any, b: any): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date || b instanceof Date) return temps(a) - temps(b);
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (typeof a === 'boolean') return Number(a) - Number(b);
  return String(a).localeCompare(String(b), 'fr');
}

/** Graine stable : « aleatoire » donne le même ordre pour un même build. */
function melanger<T>(t: T[], graine: string): T[] {
  let h = 0;
  for (const c of graine) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const r = [...t];
  for (let i = r.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) >>> 0;
    const j = h % (i + 1);
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export function executer(tous: Element[], req: Requete, opts: { courant?: Element; maintenant?: Date; tout?: boolean } = {}): Element[] {
  const maintenant = opts.maintenant ?? new Date();
  const r = resoudre(req, opts.courant) as Requete;
  let liste = tous.filter((e) => estPublie(e, maintenant));
  const exclus = new Set(r.exclure ?? []);

  if (r.elements) {
    const parId = new Map(liste.map((e) => [e.id, e]));
    return r.elements.map((id) => parId.get(id)).filter((e): e is Element => !!e && !exclus.has(e.id));
  }

  liste = liste.filter((e) => !exclus.has(e.id));
  for (const [champ, cond] of Object.entries(r.filtre ?? {})) liste = liste.filter((e) => correspond(e, champ, cond, maintenant));

  const criteres = [r.ordre ?? 'date desc'].flat();
  if (criteres[0] === 'aleatoire') liste = melanger(liste, JSON.stringify(req));
  else {
    liste.sort((a, b) => {
      for (const c of criteres) {
        const [champ, sens = 'asc'] = c.trim().split(/\s+/);
        const d = comparer(valeur(a, champ), valeur(b, champ));
        if (d) return sens === 'desc' ? -d : d;
      }
      return a.id.localeCompare(b.id);
    });
  }
  const debut = r.decalage ?? 0;
  return opts.tout ? liste.slice(debut) : liste.slice(debut, debut + (r.nombre ?? 6));
}
