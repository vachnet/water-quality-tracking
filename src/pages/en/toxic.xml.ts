import type { APIRoute } from 'astro';
import { toxicFeed } from '../../lib/toxicFeed';

export const GET: APIRoute = ({ site }) =>
  new Response(toxicFeed('en', site), { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
