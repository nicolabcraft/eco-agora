// Genere src/styles/decor.css : une tuile SVG de feuilles semees en filigrane,
// en filigrane du fond.
// Usage : node scripts/build-decor.mjs
import { writeFile } from 'node:fs/promises';

/** Feuille en trait, repere 100x100 : contour, nervure centrale, tige, nervures laterales. */
const LEAF = [
  'M86 14C46 18 18 36 18 60c0 14 10 24 24 24 26 0 40-28 44-70z',
  'M82 18 22 78',
  'M22 78 8 92',
  'M63 37 78 33',
  'M63 37 60 22',
  'M48 52 70 48',
  'M48 52 45 33',
  'M34 66 52 63',
].join(' ');

/** Feuilles disposees a la main : position, taille, rotation, opacite. */
const LEAVES = [
  { x: 40, y: 30, s: 1.15, r: -12, o: 0.13 },
  { x: 300, y: 90, s: 0.8, r: 28, o: 0.09 },
  { x: 175, y: 215, s: 0.95, r: 160, o: 0.11 },
  { x: 420, y: 250, s: 1.3, r: -35, o: 0.1 },
  { x: 60, y: 380, s: 0.85, r: 74, o: 0.09 },
  { x: 300, y: 430, s: 1.05, r: -140, o: 0.12 },
  { x: 470, y: 470, s: 0.75, r: 15, o: 0.08 },
  { x: 205, y: 555, s: 1.2, r: 200, o: 0.1 },
  { x: 460, y: 20, s: 0.9, r: 118, o: 0.08 },
];

const TILE = 620;

const shapes = LEAVES.map(
  ({ x, y, s, r, o }) =>
    `<g transform='translate(${x} ${y}) rotate(${r}) scale(${s})' opacity='${o}'>` +
    `<path d='${LEAF}'/></g>`,
).join('');

const svg =
  `<svg xmlns='http://www.w3.org/2000/svg' width='${TILE}' height='${TILE}' ` +
  `viewBox='0 0 ${TILE} ${TILE}' fill='none' stroke='#eeedf0' stroke-width='6' ` +
  `stroke-linecap='round' stroke-linejoin='round'>${shapes}</svg>`;

// Encodage minimal pour une url() CSS : on garde les apostrophes lisibles.
const encoded = svg
  .replace(/%/g, '%25')
  .replace(/#/g, '%23')
  .replace(/</g, '%3C')
  .replace(/>/g, '%3E')
  .replace(/"/g, '%22');

const css = `/*
 * Motif de feuilles en filigrane, genere par scripts/build-decor.mjs.
 * Filigrane de feuilles, discret : des feuilles en
 * trait, semees et tres discretes, visibles entre les cartes.
 */
body::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  background-image: url("data:image/svg+xml,${encoded}");
  background-size: ${TILE}px ${TILE}px;
  background-position: center top;
}
`;

await writeFile('src/styles/decor.css', css, 'utf8');
console.log(`decor.css genere (${LEAVES.length} feuilles, tuile ${TILE}px, ${css.length} octets)`);
