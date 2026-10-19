import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { useSessionStore } from '@/stores/session';
import { useSiteStore } from '@/stores/site';

const routes: RouteRecordRaw[] = [
  { path: '/', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { title: 'Tableau de bord' } },
  { path: '/carte', name: 'map', component: () => import('@/pages/MapPage.vue'), meta: { title: 'Carte du monde' } },
  { path: '/statistiques', name: 'stats', component: () => import('@/pages/StatsPage.vue'), meta: { title: 'Statistiques' } },
  { path: '/ecologie', name: 'ecology', component: () => import('@/pages/EcologyPage.vue'), meta: { title: 'Écologie et climat' } },
  { path: '/marche', name: 'market', component: () => import('@/pages/MarketPage.vue'), meta: { title: 'Marché' } },
  { path: '/economie', name: 'economy', component: () => import('@/pages/EconomyPage.vue'), meta: { title: 'Économie' } },
  { path: '/gouvernance', name: 'civics', component: () => import('@/pages/CivicsPage.vue'), meta: { title: 'Gouvernance' } },
  { path: '/gouvernance/election/:id', name: 'election', component: () => import('@/pages/ElectionPage.vue'), meta: { title: 'Election' } },
  { path: '/reglement', name: 'rules', component: () => import('@/pages/RulesPage.vue'), meta: { title: 'Règlement' } },
  { path: '/wiki', name: 'wiki', component: () => import('@/pages/WikiPage.vue'), meta: { title: 'Wiki' } },
  { path: '/eco-gnome', name: 'eco-gnome', component: () => import('@/pages/EcoGnomePage.vue'), meta: { title: 'Eco Gnome' } },
  { path: '/profil', name: 'profile', component: () => import('@/pages/ProfilePage.vue'), meta: { title: 'Mon profil' } },
  { path: '/connexion', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { title: 'Connexion' } },

  { path: '/admin', name: 'admin-health', component: () => import('@/pages/admin/HealthPage.vue'), meta: { title: 'Santé du serveur', admin: true } },
  { path: '/admin/joueurs', name: 'admin-players', component: () => import('@/pages/admin/PlayersPage.vue'), meta: { title: 'Joueurs et modération', admin: true } },
  { path: '/admin/console', name: 'admin-console', component: () => import('@/pages/admin/ConsolePage.vue'), meta: { title: 'Console', admin: true } },
  { path: '/admin/chat', name: 'admin-chat', component: () => import('@/pages/admin/ChatPage.vue'), meta: { title: 'Chat', admin: true } },
  { path: '/admin/annonces', name: 'admin-annonces', component: () => import('@/pages/admin/AnnouncementsPage.vue'), meta: { title: 'Annonces du site', admin: true } },
  { path: '/admin/journal', name: 'admin-audit', component: () => import('@/pages/admin/AuditPage.vue'), meta: { title: 'Journal d’activité', admin: true } },
  { path: '/admin/journaux', name: 'admin-logs', component: () => import('@/pages/admin/LogsPage.vue'), meta: { title: 'Journaux', admin: true } },
  { path: '/admin/exports', name: 'admin-exports', component: () => import('@/pages/admin/ExportsPage.vue'), meta: { title: 'Exports', admin: true } },
  { path: '/admin/personnalisation', name: 'admin-site', component: () => import('@/pages/admin/SitePage.vue'), meta: { title: 'Personnalisation', admin: true } },
  { path: '/admin/configuration', name: 'admin-config', component: () => import('@/pages/admin/ConfigPage.vue'), meta: { title: 'Configuration', admin: true } },

  // Adresses de l'ancien panel d'Eco : le jeu ouvre encore ces liens (par exemple
  // « /election/735105?username=...&worldTicket=... »). La session est lue avant le
  // routeur, donc le jeton est conserve.
  { path: '/election/:id', redirect: (to) => ({ path: `/gouvernance/election/${String(to.params.id)}` }) },
  { path: '/elections', redirect: '/gouvernance' },
  { path: '/officials', redirect: '/gouvernance' },
  { path: '/comparison', redirect: '/statistiques' },
  { path: '/profiling-results', redirect: '/admin' },
  { path: '/plugin/:plugin', redirect: '/admin/configuration' },

  { path: '/:pathMatch(.*)*', name: 'notfound', component: () => import('@/pages/NotFoundPage.vue'), meta: { title: 'Page introuvable' } },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
});

/** Les pages d administration exigent le claim IsAdmin verifie par le serveur. */
router.beforeEach((to) => {
  // Le jeu ouvre le panel avec ?username=...&worldTicket=... : la session les a deja
  // lus au demarrage. On les retire de l'adresse, sinon le jeton reste visible dans
  // la barre d'adresse, l'historique et les liens copies.
  if ('worldTicket' in to.query || 'username' in to.query) {
    const query = { ...to.query };
    delete query.worldTicket;
    delete query.username;
    return { path: to.path, query, hash: to.hash, replace: true };
  }

  // Pages desactivees dans la personnalisation : on revient a l'accueil.
  const site = useSiteStore();
  if ((to.name === 'rules' && !site.config.reglement.actif) || (to.name === 'eco-gnome' && !site.config.ecoGnome.actif)) {
    return { name: 'dashboard', replace: true };
  }

  const session = useSessionStore();
  if (to.meta.admin && !session.isAdmin) {
    return { name: 'login', query: { requis: 'admin', suite: to.fullPath } };
  }
  return true;
});

/**
 * Après un déploiement, les anciens fichiers `assets/*.js` disparaissent : un onglet
 * resté ouvert échoue à charger la page demandée et le menu semble figé.
 * On recharge alors une seule fois pour récupérer la nouvelle version.
 */
const RELOAD_FLAG = 'agora.reloadedAfterStaleChunk';

router.onError((error, to) => {
  const message = error instanceof Error ? error.message : String(error);
  const isStaleChunk =
    /dynamically imported module|Importing a module script failed|Failed to fetch/i.test(message);
  if (!isStaleChunk) return;

  let alreadyReloaded = false;
  try {
    alreadyReloaded = sessionStorage.getItem(RELOAD_FLAG) === '1';
    sessionStorage.setItem(RELOAD_FLAG, '1');
  } catch {
    /* mode privé : on tente le rechargement une fois de toute façon */
  }
  if (alreadyReloaded) return;
  location.assign(to.fullPath);
});

/**
 * Precharge le code des autres pages une fois la page courante affichee.
 *
 * Sans cela, changer de page exige un aller-retour reseau pour telecharger son
 * fragment JavaScript. En HTTP/1.1 ce fragment peut attendre derriere les
 * lectures en cours, et le menu semble alors ne pas repondre. Avec le
 * prechargement, la navigation ne demande plus rien au reseau.
 *
 * Le chargement est sequentiel et se fait pendant les temps morts du navigateur,
 * pour ne pas concurrencer les donnees de la page affichee.
 */
function prechargerLesPages(): void {
  const aCharger = routes
    .map((r) => r.component)
    .filter((c): c is () => Promise<unknown> => typeof c === 'function');

  const suivant = (): void => {
    const charger = aCharger.shift();
    if (!charger) return;
    // Un fragment absent (deploiement en cours) ne doit pas interrompre la file.
    void Promise.resolve()
      .then(charger)
      .catch(() => undefined)
      .then(() => auRepos(suivant));
  };

  auRepos(suivant);
}

/** requestIdleCallback n'existe pas partout : on retombe sur un delai simple. */
function auRepos(action: () => void): void {
  const idle = (window as unknown as {
    requestIdleCallback?: (cb: () => void, options?: { timeout: number }) => number;
  }).requestIdleCallback;
  if (typeof idle === 'function') idle(action, { timeout: 2000 });
  else window.setTimeout(action, 300);
}

let prechargementLance = false;

router.afterEach((to) => {
  // Une navigation réussie signifie que le bundle est à jour.
  try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* ignore */ }

  if (!prechargementLance) {
    prechargementLance = true;
    prechargerLesPages();
  }
  const title = (to.meta.title as string | undefined) ?? '';
  const nom = useSiteStore().nom;
  document.title = title ? `${title} - ${nom}` : `${nom} - Panel Eco`;
});
