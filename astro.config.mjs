import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { readFileSync } from 'node:fs';

// Set SITE_URL (and BASE_PATH for a project page) in the deploy workflow.
const site = process.env.SITE_URL || 'https://example.github.io';
const base = process.env.BASE_PATH || '/';

// Province pages with no reports are noindex, so keep them out of the sitemap too.
let active = new Set();
try {
  const { reports } = JSON.parse(readFileSync(new URL('./src/data/reports.json', import.meta.url), 'utf8'));
  active = new Set(reports.map((r) => r.province));
} catch {}
// Provinces with toxic-substance measurements also have content (and are indexable).
try {
  const { measurements } = JSON.parse(readFileSync(new URL('./src/data/measurements.json', import.meta.url), 'utf8'));
  for (const m of measurements) active.add(m.province);
} catch {}

export default defineConfig({
  site,
  base,
  trailingSlash: 'always',
  integrations: [
    sitemap({
      // Thai is the default language at the existing URLs; English mirrors them under /en/.
      i18n: { defaultLocale: 'th', locales: { th: 'th', en: 'en' } },
      filter: (page) => {
        if (page.includes('/admin/')) return false;
        // Province pages (both languages) with no data are noindex, so keep them out too.
        const m = page.match(/\/province\/([^/]+)\/$/);
        return !m || active.has(m[1]);
      },
    }),
  ],
});
