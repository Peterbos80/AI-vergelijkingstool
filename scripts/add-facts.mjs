// Usage: node scripts/add-facts.mjs <repoDir> <batch.json>   (research facts for the privacy and Dutch compass)
// batch.json: { "<slug>": { "<fact_key>": { value, status, sources, evidence, note } } }
// Appends facts as one-line entries at the end of the tool's "facts" object,
// in the file's existing style. Never touches an existing fact key.
import fs from 'node:fs';
import path from 'node:path';

const [repo, batchFile] = process.argv.slice(2);
const batch = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
const OBSERVED = process.env.OBSERVED ?? new Date().toISOString().slice(0, 10);
const ORDER = ['value', 'status', 'method', 'observed', 'sources', 'evidence', 'note'];
const ALLOWED = new Set(['supports_dutch', 'eu_data_residency', 'gdpr_dpa', 'trains_on_user_data']);

function ser(v) {
  if (Array.isArray(v)) return '[' + v.map(ser).join(', ') + ']';
  if (v && typeof v === 'object') return '{ ' + Object.entries(v).map(([k, x]) => JSON.stringify(k) + ': ' + ser(x)).join(', ') + ' }';
  return JSON.stringify(v);
}

let added = 0;
for (const [slug, facts] of Object.entries(batch)) {
  const file = path.join(repo, 'data/tools', slug + '.json');
  const text = fs.readFileSync(file, 'utf8');
  const parsed = JSON.parse(text);
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l === '  "facts": {');
  if (start < 0) throw new Error(slug + ': no facts block');
  let end = start + 1;
  while (lines[end] !== '  },' && lines[end] !== '  }') end++;
  const newLines = [];
  for (const [key, f] of Object.entries(facts)) {
    if (!ALLOWED.has(key)) throw new Error(`${slug}.${key}: key not allowed`);
    if (parsed.facts && key in parsed.facts) { console.log(`skip ${slug}.${key} (exists)`); continue; }
    if (f.status === 'verified') throw new Error(`${slug}.${key}: verified not allowed`);
    if (!f.sources?.length) throw new Error(`${slug}.${key}: no sources`);
    if (f.evidence && !f.evidence.startsWith('Web search summary: ')) throw new Error(`${slug}.${key}: evidence prefix`);
    if (f.evidence && f.evidence.length > 600) throw new Error(`${slug}.${key}: evidence too long`);
    if (f.note && f.note.length > 400) throw new Error(`${slug}.${key}: note too long (${f.note.length})`);
    if (key === 'trains_on_user_data' && !['yes', 'no', 'opt_out'].includes(f.value)) throw new Error(`${slug}.${key}: bad value`);
    if (key !== 'trains_on_user_data' && typeof f.value !== 'boolean') throw new Error(`${slug}.${key}: not boolean`);
    const full = { method: 'web_search', observed: OBSERVED, ...f };
    const ordered = {};
    for (const k of ORDER) if (full[k] !== undefined) ordered[k] = full[k];
    for (const k of Object.keys(full)) if (!(k in ordered)) throw new Error(`${slug}.${key}: unexpected field ${k}`);
    newLines.push('    ' + JSON.stringify(key) + ': ' + ser(ordered));
    added++;
  }
  if (!newLines.length) continue;
  const hasExisting = end > start + 1;
  if (hasExisting && !lines[end - 1].endsWith(',')) lines[end - 1] += ',';
  const joined = newLines.map((l, i) => (i < newLines.length - 1 ? l + ',' : l));
  lines.splice(end, 0, ...joined);
  const out = lines.join('\n');
  JSON.parse(out); // must still be valid JSON
  fs.writeFileSync(file, out);
  console.log(`${slug}: +${newLines.length}`);
}
console.log('added', added);
