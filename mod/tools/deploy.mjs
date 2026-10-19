// Recopie le mod compile dans le dossier Mods du serveur.
// Usage : node tools/deploy.mjs   (apres « dotnet build -c Release »)
//
// Le script prend le binaire le plus recent entre Release et Debug et refuse de
// deployer un binaire plus vieux que les sources : une copie perimee ressemble a
// un correctif qui « ne marche pas ».
import { copyFile, mkdir, readdir, stat } from 'node:fs/promises';
import { statSync } from 'node:fs';
import path from 'node:path';

const CANDIDATES = ['bin/Release/EcoAgoraMod.dll', 'bin/Debug/EcoAgoraMod.dll'];

// Destination : « node tools/deploy.mjs <racine du serveur> », ou ECO_SERVER_DIR.
const SERVEUR = (process.argv[2] ?? process.env.ECO_SERVER_DIR ?? '').replace(/[\/]+$/, '');
if (!SERVEUR) {
  console.error('Indiquez la racine du serveur : node tools/deploy.mjs "D:/MonServeurEco" (ou ECO_SERVER_DIR).');
  process.exit(1);
}
const DEST_DIR = `${SERVEUR}/Mods/EcoAgora`;

async function newestSource(dir) {
  let newest = 0;
  for (const entry of await readdir(dir, { withFileTypes: true, recursive: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.cs')) continue;
    const { mtimeMs } = await stat(path.join(entry.parentPath ?? dir, entry.name));
    if (mtimeMs > newest) newest = mtimeMs;
  }
  return newest;
}

const builds = [];
for (const candidate of CANDIDATES) {
  try { builds.push({ file: candidate, mtimeMs: (await stat(candidate)).mtimeMs }); } catch { /* absent */ }
}
if (builds.length === 0) {
  console.error('Aucun binaire trouve. Lancez : dotnet build -c Release');
  process.exit(1);
}
builds.sort((a, b) => b.mtimeMs - a.mtimeMs);
const build = builds[0];

const sourceTime = await newestSource('src');
if (sourceTime > build.mtimeMs) {
  console.error(`${build.file} est plus ancien que les sources : recompilez avant de deployer.`);
  process.exit(1);
}

await mkdir(DEST_DIR, { recursive: true });
await copyFile(build.file, `${DEST_DIR}/EcoAgoraMod.dll`);
const { size, mtime } = statSync(`${DEST_DIR}/EcoAgoraMod.dll`);
console.log(`${build.file} -> Mods/EcoAgora (${size} octets, ${mtime.toLocaleString('fr-FR')})`);
console.log('Le mod est charge au demarrage : redemarrez le serveur pour l activer.');
