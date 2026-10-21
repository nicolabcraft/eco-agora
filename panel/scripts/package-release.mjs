// Fabrique le paquet Eco Agora pret a copier sur un serveur Eco.
//
//   npm run package            (build du panel dans dist/, puis paquet)
//   node scripts/package-release.mjs [dossier-de-sortie]
//
// Le paquet contient uniquement ce qui vient de nous : le panel (index.html,
// assets/, brand/) et le mod. Les dossiers d'origine du serveur
// (Layers/, css/, js/, i18n/, images/, graph_composer/, fonts/, data/) ne sont
// PAS inclus : ils doivent rester ceux du serveur cible, le panel s'appuie
// dessus (textures de la carte, tuiles de couches).
import { cp, mkdir, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

// Panel construit par « npm run build » (dist/), ou un webroot deja construit.
const WEBROOT = process.env.ECO_WEBROOT ?? 'dist';
const MOD_DLL = process.env.AGORA_MOD_DLL ?? '../mod/bin/Release/EcoAgoraMod.dll';
const SORTIE = (process.argv[2] ?? 'release').replace(/[\/]+$/, '');
// Version : celle du tag en CI (AGORA_VERSION=1.2.0), sinon package.json.
const VERSION = process.env.AGORA_VERSION ?? JSON.parse(await readFile('package.json', 'utf8')).version;

/**
 * Le dossier assets/ conserve les fragments des builds precedents pendant trois
 * jours (pour les onglets restes ouverts). On ne veut pas les embarquer : on part
 * d'index.html et on suit les references de fichier en fichier.
 */
async function fragmentsAtteignables() {
  const html = await readFile(join(WEBROOT, 'index.html'), 'utf8');
  const vus = new Set();
  const aVisiter = [];

  const collecter = (texte) => {
    for (const [, nom] of texte.matchAll(/assets\/([A-Za-z0-9._-]+\.(?:js|css|woff2?|ttf|png|jpe?g|svg|webp|json))/g)) {
      if (!vus.has(nom)) { vus.add(nom); aVisiter.push(nom); }
    }
  };

  collecter(html);
  while (aVisiter.length > 0) {
    const nom = aVisiter.shift();
    if (!/\.(js|css)$/.test(nom)) continue;
    const chemin = join(WEBROOT, 'assets', nom);
    if (!existsSync(chemin)) {
      console.warn(`  reference manquante : assets/${nom}`);
      continue;
    }
    collecter(await readFile(chemin, 'utf8'));
  }
  return vus;
}

console.log(`Webroot source : ${WEBROOT}`);
await rm(SORTIE, { recursive: true, force: true });
await mkdir(join(SORTIE, 'WebClient/WebBin/assets'), { recursive: true });
await mkdir(join(SORTIE, 'Mods/EcoAgora'), { recursive: true });

// 1. index.html + fragments atteignables
await cp(join(WEBROOT, 'index.html'), join(SORTIE, 'WebClient/WebBin/index.html'));
const fragments = await fragmentsAtteignables();
let octets = 0;
for (const nom of fragments) {
  const source = join(WEBROOT, 'assets', nom);
  if (!existsSync(source)) continue;
  await cp(source, join(SORTIE, 'WebClient/WebBin/assets', nom));
  octets += statSync(source).size;
}
const total = (await readdir(join(WEBROOT, 'assets'))).length;
console.log(`assets/ : ${fragments.size} fragment(s) retenu(s) sur ${total} presents (${(octets / 1048576).toFixed(1)} Mo)`);

// 2. dossiers entierement a nous
for (const dossier of ['brand', 'lang']) {
  const source = join(WEBROOT, dossier);
  if (!existsSync(source)) { console.warn(`  ${dossier}/ absent, ignore`); continue; }
  await cp(source, join(SORTIE, 'WebClient/WebBin', dossier), { recursive: true });
  console.log(`${dossier}/ : copie`);
}

// 3. traductions des textes en jeu (lues par Eco dans Mods/Translations/)
const CSV = '../mod/translations/EcoAgora.csv';
if (existsSync(CSV)) {
  await mkdir(join(SORTIE, 'Mods/Translations'), { recursive: true });
  await cp(CSV, join(SORTIE, 'Mods/Translations/EcoAgora.csv'));
  console.log('Mods/Translations/EcoAgora.csv : copie');
}

// 4. le mod
if (existsSync(MOD_DLL)) {
  await cp(MOD_DLL, join(SORTIE, 'Mods/EcoAgora/EcoAgoraMod.dll'));
  const { size, mtime } = statSync(MOD_DLL);
  console.log(`mod : EcoAgoraMod.dll (${size} octets, ${mtime.toLocaleString('fr-FR')})`);
} else {
  console.warn(`mod introuvable (${MOD_DLL}) : compilez-le dans ../mod avec « dotnet build -c Release »`);
}

// Guides d'installation (racine du depot), en francais et en anglais.
await cp('../INSTALLATION.md', join(SORTIE, 'INSTALLATION.md'));
await cp('../INSTALL.en.md', join(SORTIE, 'INSTALL.en.md'));
// Licence et mentions : obligatoires dans toute copie (PolyForm Noncommercial).
await cp('../LICENSE.md', join(SORTIE, 'LICENSE.md'));
await cp('../NOTICE.md', join(SORTIE, 'NOTICE.md'));

// 5. archive : zip (Linux, macOS, GitHub Actions), sinon PowerShell (Windows)
const zip = `eco-agora-${VERSION}.zip`;
await rm(zip, { force: true });
try {
  try {
    execFileSync('zip', ['-qr', join('..', zip), '.'], { cwd: SORTIE, stdio: 'pipe' });
  } catch {
    execFileSync('powershell', ['-NoProfile', '-Command', `Compress-Archive -Path '${SORTIE}/*' -DestinationPath '${zip}' -Force`], { stdio: 'pipe' });
  }
  console.log(`archive : ${zip} (${(statSync(zip).size / 1048576).toFixed(1)} Mo)`);
} catch {
  console.log(`archive non creee : copiez le dossier ${SORTIE}/ tel quel`);
  process.exitCode = 1;
}
