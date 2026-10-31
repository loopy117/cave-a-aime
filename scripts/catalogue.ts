/**
 * Génère ai/catalogue.md à partir des schémas : blocs, champs, variantes,
 * limites, cartes, dispositions, collections. Ne jamais éditer à la main.
 * Propre à chaque site (modèle, taxonomies, icônes, valeurs par défaut tirées de data/) : régénéré à chaque
 * construction (npm run contexte) et avant chaque réalisation (workflow demande), jamais versionné.
 */
import { writeFileSync } from 'node:fs';
import { z } from 'astro/zod';
import { blocs } from '../src/schemas/blocs';
import { collectionSchemas } from '../src/schemas/collections';
import { cartes } from '../src/cards/cartes';
import { dispositions } from '../src/dispositions/dispositions';
import taxonomies from '../data/taxonomies.json' with { type: 'json' };
import icones from '../data/icones.json' with { type: 'json' };
import site from '../data/site.json' with { type: 'json' };

// Blocs et collections du modèle du site (src/schemas/modeles.ts ; absent de la variante collectivite : tout est proposé)
const modeles: any = await import('../src/schemas/modeles').catch(() => null);
const blocPropose = (nom: string): boolean => modeles?.blocDuSite?.(nom) ?? true;
const collectionsProposees = new Set<string>(modeles?.collectionsDuSite?.() ?? Object.keys(collectionSchemas));

const communs = new Set(['block', 'background', 'spacing', 'id']);

function typeDe(s: any): string {
  if (!s) return '?';
  if (s.$ref) return s.$ref.split('/').pop();
  if (s.enum) return s.enum.map((x: any) => `\`${x}\``).join(' · ');
  if (s.const !== undefined) return `\`${s.const}\``;
  if (s.anyOf) return s.anyOf.map(typeDe).join(' ou ');
  if (s.type === 'array') return `liste de ${typeDe(s.items)}`;
  if (s.type === 'object') {
    if (s.properties) return '{ ' + Object.entries(s.properties).map(([k, v]: any) => `${k}${(s.required ?? []).includes(k) ? '' : '?'}: ${typeDe(v)}`).join(', ') + ' }';
    return 'objet';
  }
  return s.type === 'string' ? 'texte' : s.type === 'integer' ? 'entier' : s.type === 'number' ? 'nombre' : s.type === 'boolean' ? 'oui/non' : s.type ?? 'valeur libre';
}
function limites(s: any): string {
  const t: string[] = [];
  if (s.minLength != null) t.push(`≥ ${s.minLength} car.`);
  if (s.maxLength != null) t.push(`≤ ${s.maxLength} car.`);
  if (s.minItems != null) t.push(`≥ ${s.minItems} éléments`);
  if (s.maxItems != null) t.push(`≤ ${s.maxItems} éléments`);
  if (s.minimum != null) t.push(`≥ ${s.minimum}`);
  if (s.maximum != null && s.maximum < 1e12) t.push(`≤ ${s.maximum}`);
  if (s.default !== undefined && JSON.stringify(s.default) !== '[]' && JSON.stringify(s.default) !== '{}') t.push(`défaut : ${JSON.stringify(s.default)}`);
  return t.join(', ');
}
function tableChamps(schema: any, ignorer = new Set<string>()): string {
  const js: any = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' });
  const req = new Set(js.required ?? []);
  const lignes = Object.entries(js.properties ?? {})
    .filter(([k]) => !ignorer.has(k))
    .map(([k, v]: any) => `| \`${k}\` | ${req.has(k) && v.default === undefined ? 'oui' : 'non'} | ${typeDe(v).replace(/\|/g, '/')} | ${[limites(v), v.description].filter(Boolean).join(' — ')} |`);
  return ['| Champ | Obligatoire | Type | Limites et notes |', '| --- | --- | --- | --- |', ...lignes].join('\n');
}

let md = `# Catalogue du site — pour l'IA

> Site : ${(site as any).nom ?? '?'} — modèle \`${(site as any).modele ?? 'entreprise'}\`. Généré par \`npm run catalogue\` à partir des schémas et de \`data/\` ; ne pas modifier à la main.
> À lire avec \`ai/regles.md\`. Tout ce qui n'est pas dans ce catalogue n'existe pas.

## Options communes à tous les blocs

| Option | Valeurs | Défaut |
| --- | --- | --- |
| \`background\` | \`clair\` · \`alt\` · \`sombre\` · \`accent\` | \`clair\` |
| \`spacing\` | \`compact\` · \`normal\` · \`large\` | \`normal\` |
| \`id\` | ancre HTML (minuscules, chiffres, tirets) | aucune |

**Types partagés** — image : \`{ src: /img/<dossier>/<nom>.jpg, alt, focus?: centre|haut|bas|gauche|droite }\` · bouton (cta) : \`{ label, href, style: primaire|secondaire }\` · lien : \`{ label, href }\`.

**Icônes disponibles** : ${Object.keys(icones).map((i) => `\`${i}\``).join(', ')}.

## Blocs
`;

for (const [nom, schema] of Object.entries(blocs)) {
  if (!blocPropose(nom)) continue;
  const meta: any = (schema as any).meta?.() ?? {};
  const js: any = z.toJSONSchema(schema as any, { io: 'input', unrepresentable: 'any' });
  const variantes = js.properties?.variant?.enum;
  md += `\n### \`${nom}\`\n\n${meta.role ?? ''}\n\n`;
  if (variantes) md += `- **Variantes** : ${variantes.map((v: string) => `\`${v}\``).join(' · ')} (défaut \`${js.properties.variant.default}\`)\n`;
  if (meta.quand) md += `- **Quand l'utiliser** : ${meta.quand}\n`;
  if (meta.eviter) md += `- **À éviter** : ${meta.eviter}\n`;
  md += '\n' + tableChamps(schema, new Set([...communs, 'variant'])) + '\n';
}

md += `\n## Boucle : cartes, dispositions, requêtes

### Cartes

| Carte | Collection | Rendu |
| --- | --- | --- |
${Object.entries(cartes).filter(([, v]) => collectionsProposees.has(v.collection)).map(([k, v]) => `| \`${k}\` | \`${v.collection}\` | ${v.description} |`).join('\n')}

### Dispositions (\`affichage\`) et leurs \`options\`

| Disposition | Options | Rendu |
| --- | --- | --- |
${Object.entries(dispositions).map(([k, v]) => { const js: any = z.toJSONSchema(v.options as any, { io: 'input' }); const o = Object.entries(js.properties ?? {}).map(([n, s]: any) => `\`${n}\` (${typeDe(s)}${s.minimum != null ? `, ${s.minimum}–${s.maximum}` : ''}${s.default !== undefined ? `, défaut ${s.default}` : ''})`).join(', ') || '—'; return `| \`${k}\` | ${o} | ${v.description} |`; }).join('\n')}

### Opérateurs de \`filtre\` (conditions cumulées)

| Écriture | Sens |
| --- | --- |
| \`champ: valeur\` | égal à (ou, pour une liste, la contient) |
| \`champ: [a, b]\` | l'une des valeurs |
| \`champ: { different: v }\` | différent de |
| \`champ: { contient: [a, b] }\` | liste contenant au moins une valeur |
| \`champ: { contient_tous: [a, b] }\` | liste contenant toutes les valeurs |
| \`champ: { apres: AAAA-MM-JJ, avant: AAAA-MM-JJ }\` | plage de dates, bornes incluses |
| \`champ: { depuis: 6 mois }\` | date relative au build (jours, mois, ans) |
| \`champ: { min: n, max: n }\` | plage numérique |
| \`champ: { existe: true }\` | champ renseigné |

Tri : \`ordre: date desc\` ou liste \`[mis_en_avant desc, date desc]\`, ou \`aleatoire\` (figé au build). Sélection manuelle : \`elements: [id1, id2]\`. Dans une page de détail uniquement : \`$courant.<champ>\` et \`$courant.id\`.

## Collections
`;

for (const [nom, schema] of Object.entries(collectionSchemas)) {
  if (!collectionsProposees.has(nom)) continue;
  md += `\n### \`${nom}\` — dossier \`content/${nom}/\`, un fichier \`<id>.md\`\n\n${(schema as any).description ?? ''}\n\n${tableChamps(schema, new Set(['sections']))}\n\nCorps Markdown facultatif après le frontmatter (affiché sur la page de détail). \`sections\` facultatif : blocs ajoutés après le corps.\n`;
}

md += `\n## Taxonomies (\`data/taxonomies.json\`)

- **Métiers** (\`categorie\`) : ${Object.entries(taxonomies.metiers).map(([k, v]) => `\`${k}\` (${v})`).join(', ')}
${Object.entries(taxonomies.tags).map(([c, t]) => `- **Tags de \`${c}\`** : ${Object.keys(t).map((k) => `\`${k}\``).join(', ')}`).join('\n')}

Une valeur absente de ces listes est refusée. Pour en ajouter une, la proposer dans le rapport.
`;

writeFileSync('ai/catalogue.md', md);
console.log(`ai/catalogue.md généré (${md.split('\n').length} lignes)`);
