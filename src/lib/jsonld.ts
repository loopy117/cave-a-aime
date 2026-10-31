/**
 * Données structurées (schema.org) à placer dans <script type="application/ld+json" set:html={jsonLd(d)} />.
 * JSON.stringify n'échappe pas « </script> » : un titre ou une question de FAQ du type « </script><script>… »
 * fermerait le bloc et ferait exécuter la suite. <, > et & sont donc écrits en séquences \u, que tout lecteur
 * JSON (Google compris) relit à l'identique ; U+2028 et U+2029 aussi, pour les anciens moteurs JavaScript.
 */
export function jsonLd(donnees: unknown): string {
  return JSON.stringify(donnees)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
