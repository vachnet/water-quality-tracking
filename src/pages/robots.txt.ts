import type { APIRoute } from 'astro';
import { url } from '../lib/url';

export const GET: APIRoute = ({ site }) => {
  const map = new URL(url('/sitemap-index.xml'), site).href;
  return new Response(`User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${map}\n`, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
