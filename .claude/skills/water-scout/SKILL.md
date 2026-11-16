---
name: water-scout
description: Scout for NEW Thai water-pollution news (trusted outlets, with reference links) and official PCD dataset updates, then add them to the water-quality map's Firestore data at minimum token cost. Runs a zero-LLM prefilter first and only calls Haiku for new relevant articles. Use when the user says scout, update data sources, "run the scout", or when invoked on the 12-hourly schedule.
---

# water-scout — cheap scouting for the water quality map

Project root: the repo containing `scripts/scout.mjs`. All paths below are relative to it.
Goal: keep token spend near zero. Scripts do the searching, fetching, filtering, de-duplication, location and
validation. The LLM only writes a short title/description for each *new, relevant* article.

## Steps (do them in order, do not improvise)

1. **Prefilter (no LLM).** Run `node scripts/scout.mjs`. It prints one summary line and writes
   `data/scout/candidates.json` (max 10 candidates, each ≤1,100 chars of article text).
2. **Stop early.** If the summary says `0 candidate(s)` AND `gov datasets changed: 0`, reply with that one line and
   STOP. Do not spawn anything. (This is the normal case most runs.)
3. **Official data changed?** If `govChanged` in the file is non-empty, tell the user which dataset changed (title + URL).
   Do not ingest it automatically: the yearly CSV layout may change and needs a human look.
4. **Extract with Haiku (only if candidates exist).** Spawn exactly ONE subagent with `model: "haiku"`
   (subagent_type `general-purpose`). Prompt it with the block below, verbatim. Do not read the candidates yourself.
5. **Ingest.** Run `node scripts/scout-ingest.mjs --seed` (needs `FIREBASE_SERVICE_ACCOUNT` in the environment; if it is
   missing, run without `--seed` and tell the user the Firestore upsert was skipped). The script validates everything
   the LLM returned, merges articles about the same event as extra references, and rejects bad output.
6. **Report in ≤5 lines:** counts (new / merged / rejected), the titles added with their publisher, and anything the
   user must do. The public site picks up the new Firestore data on its next hourly deploy.

## Haiku prompt (verbatim)

> Read `data/scout/candidates.json`. For EACH item in `candidates`, using ONLY the item's `title` and `snippet`
> (do not browse, do not use outside knowledge), decide whether it reports a concrete water-pollution incident or
> official water-quality finding in Thailand (fish kill, foul/black water, discolouration, oil slick, illegal
> discharge, algae bloom, official measurements). Opinion pieces, celebrity commentary, policy-only talk and
> pieces with no concrete incident are not relevant.
> Write `data/scout/extracted.json`: a JSON array with one object per candidate, exactly:
> `{"id": <same id>, "relevant": true|false, "type": one of "fish-kill"|"discoloration"|"odor"|"oil-foam"|"trash"|"discharge"|"algae"|"other",
>   "title": Thai, 10-90 chars, "description": Thai, 30-280 chars, your own words (no copying sentences, no URLs, no opinions),
>   "metrics": {} }`.
> `metrics` may contain ONLY numbers that are literally written in the snippet, with short English keys, e.g.
> `{"DO_mgL": 0.3, "pH": 6.9}`; otherwise `{}`. For not-relevant items output only `{"id":..., "relevant": false}`.
> Never invent places, numbers, causes or dates. If the cause is not stated, say it is not yet confirmed.
> Output nothing else and reply with just the count written.

## Guard rails
- Never edit `data/curated-reports.json` by hand and never write to Firestore except via `scout-ingest.mjs --seed`.
- Never add a source that is not in the allow-list inside `scripts/scout.mjs` (trusted national media, public
  broadcasters, government). To add one, edit the list deliberately.
- News items are labelled "news" on the site with reference links; they are not official findings. Do not upgrade
  them to `government`.
