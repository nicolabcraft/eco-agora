// Assemble les traductions : locales/<langue>/<domaine>.json -> public/lang/<langue>.json
// (un fichier par langue, chaque domaine sous sa cle). Vite copie public/lang/
// dans le webroot ; le francais est aussi embarque dans le bundle.
// Usage : node scripts/build-locales.mjs   (lance automatiquement par dev et build)
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE = 'locales';
const SORTIE = 'public/lang';
await mkdir(SORTIE, { recursive: true });

const langues = (await readdir(SOURCE, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
const reference = {};
for (const langue of langues) {
  const out = {};
  for (const f of (await readdir(join(SOURCE, langue))).filter((n) => n.endsWith('.json')).sort()) {
    const domaine = f.replace(/\.json$/, '');
    try {
      out[domaine] = JSON.parse(await readFile(join(SOURCE, langue, f), 'utf8'));
    } catch (e) {
      throw new Error(`${SOURCE}/${langue}/${f} : JSON invalide (${e.message})`);
    }
  }
  if (langue === 'fr') Object.assign(reference, out);
  await writeFile(join(SORTIE, `${langue}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(`lang/${langue}.json : ${Object.keys(out).length} domaine(s)`);
}

// Cles du francais absentes des autres langues : affichees en francais, a traduire.
const cles = (o, p = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? cles(v, `${p}${k}.`) : [`${p}${k}`]));
const ref = new Set(cles(reference));
for (const langue of langues.filter((l) => l !== 'fr')) {
  const m = JSON.parse(await readFile(join(SORTIE, `${langue}.json`), 'utf8'));
  const manque = [...ref].filter((k) => !new Set(cles(m)).has(k));
  if (manque.length) console.log(`  ${langue} : ${manque.length} cle(s) non traduite(s), ex. ${manque.slice(0, 3).join(', ')}`);
}
