# Clearwater Watch — Community Water Quality Reporting

Static site (Astro, GitHub Pages) + one Firebase Cloud Function for submissions. No accounts, no photos, no pre-moderation.
Name is a placeholder: change `SITE_NAME` in `src/lib/types.ts`.

```
Visitor ─► GitHub Pages (static, rebuilt hourly) ──► MapLibre map + feed (baked-in data)
Visitor ─► Turnstile ─► submitReport (Cloud Function) ─► Firestore
GitHub Action (hourly) ─► reads Firestore ─► astro build ─► deploy-pages
Admin ─► Google sign-in (custom claim) ─► adminApi (Cloud Function)
```

## Run locally (demo mode, no backend needed)
```bash
npm install
npm run dev          # http://localhost:4321 — demo data; the report form works but sends nothing
npm run build        # build + sitemap
```

## Connect the backend
1. `firebase use --add` (or copy `.firebaserc.example`), upgrade project to **Blaze**, create Firestore in `asia-southeast1`.
2. Secrets: `firebase functions:secrets:set IP_HASH_KEY` (random 32+ bytes) and `TURNSTILE_SECRET`.
3. Param `ALLOWED_ORIGINS` = your site origin(s), comma separated (prompted on deploy).
4. `firebase deploy --only firestore,functions` (then `firebase functions:artifacts:setpolicy --location asia-southeast1` once, to avoid image build-up)
5. TTL (automatic retention) is declared in `firestore.indexes.json` (`fieldOverrides`) and deployed with `firebase deploy --only firestore`.
6. GitHub repo → Settings → Pages → Source: GitHub Actions. Add **variables**: `SITE_URL`, `BASE_PATH` (`/repo-name/` for a project page), `PUBLIC_REPORT_API_URL`, `PUBLIC_ADMIN_API_URL`, `PUBLIC_TURNSTILE_SITE_KEY`, `PUBLIC_MAP_STYLE_URL`, `PUBLIC_FIREBASE_CONFIG`; and secret `FIREBASE_SERVICE_ACCOUNT` (read-only Firestore role).
7. Make yourself admin: `GOOGLE_APPLICATION_CREDENTIALS=key.json node scripts/set-admin.mjs you@example.com`

## Privacy design
- Public site only ever receives: type, lat/lng, province, time, optional description, status.
- Raw IP lives in `ip_raw` (TTL 30 d); HMAC-SHA256 hash + UA + risk in `submission_meta` (TTL 180 d). Rules deny all client access.
- IP is read from the last `X-Forwarded-For` entry (the one Google's frontend appends; earlier entries are spoofable).

## Spam policy (tune in `functions/src/constants.ts`)
1–3 reports/10 min ok · 4–5 add risk · >5 throttled (429) · ≥15 auto-block 24 h · duplicates, links in text, odd coordinates add risk · risk ≥ 70 ⇒ `flagged` (still public, reviewed later). Blocks are always temporary.

## Before going live
- Replace the default OSM raster basemap (`PUBLIC_MAP_STYLE_URL`) — OSM's tile policy forbids heavy use.

- Fill the privacy notice contact and have it reviewed for PDPA.
- Set a Google Cloud budget alert (Blaze has no hard cap).
