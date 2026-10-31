import type { APIRoute } from 'astro';

/** robots.txt : tout est bloqué sur une recette ou une démo (NOINDEX=1). */
export const GET: APIRoute = ({ site }) => {
  const bloque = process.env.NOINDEX === '1';
  const corps = bloque
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nAllow: /\n\nSitemap: ${new URL('/sitemap.xml', site).href}\n`;
  return new Response(corps, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
