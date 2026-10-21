// Verifie les traductions du panel : locales/<langue>/<domaine>.json face au francais.
//   node scripts/check-locales.mjs
// Echoue (code 1) sur : JSON invalide, cle inconnue du francais, parametres {nom}
// differents, ou anglais incomplet. Les autres langues peuvent etre partielles :
// leur couverture est seulement affichee (et ecrite dans le resume GitHub Actions).
import { appendFile, readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE = 'locales';
const REFERENCE = 'fr';
const COMPLETES = ['en']; // langues qui doivent etre completes

async function charger(langue) {
  const out = {};
  for (const f of (await readdir(join(SOURCE, langue))).filter((n) => n.endsWith('.json'))) {
    const texte = await readFile(join(SOURCE, langue, f), 'utf8');
    try {
      out[f.replace(/\.json$/, '')] = JSON.parse(texte);
    } catch (e) {
      throw new Error(`${SOURCE}/${langue}/${f} : JSON invalide (${e.message})`);
    }
  }
  return out;
}

const aplatir = (o, p = '') =>
  Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v !== null ? aplatir(v, `${p}${k}.`) : [[`${p}${k}`, String(v)]]));
const params = (t) => [...t.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

const langues = (await readdir(SOURCE, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name);
const ref = new Map(aplatir(await charger(REFERENCE)));
let erreurs = 0;
const lignes = [`| Langue | Traduit | Couverture |`, `|---|---|---|`];

for (const langue of langues.filter((l) => l !== REFERENCE).sort()) {
  const m = new Map(aplatir(await charger(langue)));
  for (const [k, v] of m) {
    if (!ref.has(k)) { console.error(`${langue} : cle inconnue du francais « ${k} »`); erreurs++; continue; }
    if (params(v) !== params(ref.get(k))) { console.error(`${langue} : parametres differents pour « ${k} » (${params(ref.get(k))} attendu, ${params(v)} trouve)`); erreurs++; }
  }
  const manque = [...ref.keys()].filter((k) => !m.has(k));
  const pct = Math.round(((ref.size - manque.length) / ref.size) * 100);
  console.log(`${langue} : ${ref.size - manque.length}/${ref.size} (${pct} %)`);
  lignes.push(`| ${langue} | ${ref.size - manque.length}/${ref.size} | ${pct} % |`);
  if (COMPLETES.includes(langue) && manque.length) {
    for (const k of manque.slice(0, 20)) console.error(`${langue} : cle manquante « ${k} »`);
    console.error(`${langue} doit etre complet : ${manque.length} cle(s) manquante(s).`);
    erreurs++;
  }
}

// Chaque dossier de langue doit etre propose dans locales/langues.json (et inversement).
const liste = JSON.parse(await readFile(join(SOURCE, 'langues.json'), 'utf8'));
const codes = new Set(liste.map((l) => l.code));
for (const l of langues) if (!codes.has(l)) { console.error(`locales/langues.json : ajoutez la langue « ${l} » ({ "code", "nom", "intl" })`); erreurs++; }
for (const c of codes) if (!langues.includes(c)) { console.error(`locales/langues.json : « ${c} » n'a pas de dossier locales/${c}/`); erreurs++; }

if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `### Traductions du panel\n\n${lignes.join('\n')}\n\n`);
}
if (erreurs) process.exit(1);
console.log(`Traductions valides (${ref.size} cles en francais).`);
