// Apres un build reussi, retire les anciens fichiers hashes du dossier assets/
// du webroot. On ne touche a rien d'autre : les dossiers d'origine du serveur
// Eco (js/, css/, Layers/, graph_composer/...) doivent rester intacts.
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';

const WEBROOT =
  process.env.ECO_WEBROOT ??
  (process.env.ECO_SERVER_DIR ? `${process.env.ECO_SERVER_DIR.replace(/[\/]+$/, '')}/WebClient/WebBin` : null);
// Build dans dist/ : le dossier est vide a chaque fois, rien a nettoyer.
if (!WEBROOT) process.exit(0);

const ASSETS = join(WEBROOT, 'assets');

const started = Number(await readFile('.build-start', 'utf8').catch(() => '0'));
if (!started) {
  console.log('pas d horodatage de build, nettoyage ignore');
  process.exit(0);
}

// On garde les anciens fichiers pendant 3 jours : un onglet deja ouvert continue
// de charger ses morceaux de code au lieu d'echouer apres un deploiement.
const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
const cutoff = started - GRACE_MS;

let removed = 0;
let kept = 0;
for (const name of await readdir(ASSETS)) {
  const path = join(ASSETS, name);
  const info = await stat(path);
  if (info.mtimeMs < cutoff) {
    await rm(path, { force: true, recursive: true });
    removed += 1;
  } else if (info.mtimeMs < started - 1000) {
    kept += 1;
  }
}
console.log(
  `assets/ : ${removed} fichier(s) retire(s), ${kept} ancien(s) conserve(s) 3 jours`,
);
