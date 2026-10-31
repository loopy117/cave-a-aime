/**
 * Règles d'un texte Markdown de contenu (champs « markdown » des blocs, corps des collections) : pas de HTML brut
 * (seul <u> est permis, pour le souligné), pas de lien ou d'image vers javascript:, data:, vbscript: ou file:.
 * Les blocs de code (``` ou ~~~) et le code en ligne (`…`) sont ignorés : ils s'affichent tels quels.
 * Utilisé par les schémas (src/schemas/communs.ts) et par la validation du corps des collections (scripts/validate.ts) ;
 * le rendu (lib/markdown.ts) neutralise de toute façon ce qui passerait outre.
 */
export const MSG_HTML = 'pas de HTML brut dans le Markdown (seul <u> est permis, pour le souligné)';
export const MSG_LIEN = 'lien non permis : seuls http(s), mailto:, tel: et les adresses du site sont acceptés';

function sansCode(s: string): string {
  return s
    .replace(/^ {0,3}(`{3,}|~{3,})[^\n]*\n[\s\S]*?^ {0,3}\1[^\S\n]*$/gm, '')
    .replace(/(`+)[^`]*?\1/g, '');
}

const PROTOCOLE_INTERDIT = /^\s*<?\s*(javascript|data|vbscript|file)\s*:/i;

export function problemesMarkdown(texte: string | null | undefined): string[] {
  if (!texte) return [];
  const t = sansCode(String(texte));
  const p: string[] = [];
  // Balise : nom suivi d'un espace, de / ou de > (une adresse entre chevrons, <https://…> ou <a@b.fr>, n'en est pas une)
  if (/<\/?(?!u>)[a-z][a-z0-9-]*(?=[\s/>])[^>]*>/i.test(t) || /<!--/.test(t)) p.push(MSG_HTML);
  const cibles = [
    ...[...t.matchAll(/\]\(([^)\n]*)\)/g)].map((m) => m[1]),          // [texte](cible) et ![alt](cible)
    ...[...t.matchAll(/^ {0,3}\[[^\]\n]+\]:\s*(\S+)/gm)].map((m) => m[1]), // [ref]: cible
    ...[...t.matchAll(/<([a-z][a-z0-9+.-]*:[^>\s]*)>/gi)].map((m) => m[1]), // <adresse>
  ];
  if (cibles.some((c) => PROTOCOLE_INTERDIT.test(c.replace(/[\u0000-\u001f\u007f]/g, '')))) p.push(MSG_LIEN);
  return p;
}
