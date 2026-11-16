// Unattended version of the skill's Haiku step: ONE small API call for all candidates.
// Needs ANTHROPIC_API_KEY. Model defaults to Haiku (override with SCOUT_MODEL).
import { readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const { candidates } = JSON.parse(readFileSync(new URL('data/scout/candidates.json', root), 'utf8'));
if (!candidates.length) { console.log('scout-llm: no candidates, skipping API call'); process.exit(0); }

const items = candidates.map((c) => ({ id: c.id, title: c.title, snippet: c.snippet }));
const prompt = `For EACH item below, using ONLY its title and snippet (no outside knowledge), decide whether it reports a concrete water-pollution incident or official water-quality finding in Thailand (fish kill, foul/black water, discolouration, oil slick, illegal discharge, algae bloom, official measurements). Opinion pieces, celebrity commentary, policy-only talk and pieces without a concrete incident are not relevant.
Return ONLY a JSON array, one object per item, exactly:
{"id": same id, "relevant": true|false, "type": one of "fish-kill"|"discoloration"|"odor"|"oil-foam"|"trash"|"discharge"|"algae"|"other", "title": Thai 10-90 chars, "description": Thai 30-280 chars in your own words (no copied sentences, no URLs, no opinions), "metrics": {}}.
"metrics" may contain ONLY numbers literally written in the snippet, short English keys (e.g. {"DO_mgL":0.3}); otherwise {}. For not-relevant items output only {"id":..., "relevant": false}. Never invent places, numbers, causes or dates; if the cause is not stated, say it is not yet confirmed.

${JSON.stringify(items)}`;

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model: process.env.SCOUT_MODEL || 'claude-haiku-5-5', max_tokens: 400 * candidates.length + 200, messages: [{ role: 'user', content: prompt }] }),
});
if (!res.ok) { console.error('scout-llm: API error', res.status, (await res.text()).slice(0, 300)); process.exit(1); }
const j = await res.json();
const text = j.content?.[0]?.text ?? '';
const arr = JSON.parse(text.slice(text.indexOf('['), text.lastIndexOf(']') + 1));
writeFileSync(new URL('data/scout/extracted.json', root), JSON.stringify(arr, null, 1));
console.log(`scout-llm: ${arr.length} item(s) extracted (${j.usage?.input_tokens} in / ${j.usage?.output_tokens} out tokens)`);
