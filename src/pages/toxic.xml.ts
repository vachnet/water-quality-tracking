import type { APIRoute } from 'astro';
import { toxicFeed } from '../lib/toxicFeed';

export const GET: APIRoute = ({ site }) =>
  new Response(toxicFeed('th', site), { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
