// Horodatage de debut de build : sert au nettoyage post-build.
import { writeFile } from 'node:fs/promises';
await writeFile('.build-start', String(Date.now()), 'utf8');
