import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

/**
 * Sortie du build : dist/ par defaut (puis « npm run package » fabrique le
 * paquet a copier). Pour construire directement dans un serveur Eco, indiquez
 * sa racine ; le webroot n'est alors jamais vide (les dossiers d'origine
 * Layers/, i18n/, js/, css/, graph_composer/ doivent rester en place) :
 *   ECO_SERVER_DIR="D:/MonServeurEco" npm run build
 * ECO_WEBROOT donne le chemin complet si le webroot n'est pas a l'endroit habituel.
 */
const ECO_WEBROOT =
  process.env.ECO_WEBROOT ??
  (process.env.ECO_SERVER_DIR ? `${process.env.ECO_SERVER_DIR.replace(/[\/]+$/, '')}/WebClient/WebBin` : null);
const SORTIE = ECO_WEBROOT ?? 'dist';

// Cible du proxy en developpement. ECO_DEV_TARGET permet de lire un serveur distant,
// par exemple ECO_DEV_TARGET=http://mon-serveur:3001 npm run dev
const ECO_SERVER = process.env.ECO_DEV_TARGET ?? 'http://localhost:3001';

// Routes servies par le serveur de jeu et proxifiées pendant le dev.
const PROXIED = [
  '/api',
  '/datasets',
  '/info',
  '/frontpage',
  '/isadmin',
  '/admins',
  '/swagger',
  '/Layers',
  '/i18n',
  '/images',
  '/data',
  '/plugins',
];

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    port: 5180,
    strictPort: false,
    // release/ est recree a chaque « npm run package » : sans cette exclusion,
    // l'observateur de fichiers plante sur les fragments qui disparaissent.
    watch: { ignored: ['**/release/**', '**/release.zip'] },
    proxy: Object.fromEntries(
      PROXIED.map((p) => [p, { target: ECO_SERVER, changeOrigin: true }]),
    ),
  },
  build: {
    outDir: SORTIE,
    // dist/ est a nous : on le vide. Un webroot de serveur, jamais.
    emptyOutDir: ECO_WEBROOT === null,
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          echarts: ['echarts'],
          vendor: ['vue', 'vue-router', 'pinia', 'axios'],
        },
      },
    },
  },
});
