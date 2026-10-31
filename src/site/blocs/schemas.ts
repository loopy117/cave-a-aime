/**
 * Blocs propres au site : leurs schémas (le composant de chaque bloc est dans ./index.ts).
 * Un bloc du site s'utilise dans les pages comme un bloc du socle ({ block: 'mon-bloc', … }) ; il est validé au
 * build, proposé dans l'éditeur et décrit à l'IA (.meta). Son nom ne doit pas reprendre celui d'un bloc du socle.
 *
 * Exemple :
 *   import { z } from 'astro/zod';
 *   import { optionsCommunes, entete } from '../../schemas/communs';
 *   export const schemasSite = {
 *     'mon-bloc': z.object({ block: z.literal('mon-bloc'), ...optionsCommunes, ...entete }).strict()
 *       .meta({ role: '…', quand: '…', eviter: '…' }),
 *   };
 */
import type { z } from 'astro/zod';

export const schemasSite: Record<string, z.ZodTypeAny> = {};
