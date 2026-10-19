// Regenere les declinaisons du logo par defaut depuis brand/logo-source.png,
// dans public/brand/ : Vite les copie a chaque build.
// Usage : node scripts/build-logos.mjs
// (Pour un logo propre a votre serveur, inutile de reconstruire : indiquez son
// adresse dans Administration > Personnalisation.)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const DIR = 'public/brand/';
await mkdir(DIR, { recursive: true });
for (const size of [48, 64, 192, 512]) {
  await sharp('brand/logo-source.png')
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(`${DIR}logo-${size}.png`);
  console.log(`logo-${size}.png`);
}
