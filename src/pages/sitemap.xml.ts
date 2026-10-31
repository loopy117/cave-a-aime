import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { indexSite } from '../lib/site';

/** Sitemap : toutes les URL publiées de l'index du site, sauf celles en noindex. */
export const GET: APIRoute = async ({ site }) => {
  const index = await indexSite();
  const noindex = new Set<string>();
  for (const p of await getCollection('pages')) if (p.data.seo?.noindex) noindex.add(p.id === 'index' ? '/' : '/' + p.id.replace(/\/index$/, ''));
  const base = site!.href.replace(/\/$/, '');
  const urls = [...index.values()].filter((e) => e.publie && !noindex.has(e.url)).map((e) => `  <url><loc>${base}${e.url === '/' ? '/' : e.url}</loc></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
