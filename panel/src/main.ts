import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { router } from './router';
import { useSessionStore } from './stores/session';
import { useServerStore } from './stores/server';
import { useAnnoncesStore } from './stores/annonces';
import { useMeteorStore } from './stores/meteor';
import { useSiteStore } from './stores/site';
import { chargerHorloge } from './utils/horloge';
import { demarrerLangue, t } from './i18n';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/decor.css';

/** Langue par defaut choisie dans la personnalisation (lue brute : la langue passe avant tout). */
async function langueServeur(): Promise<string | undefined> {
  try {
    const r = await fetch('/api/agora/site', { cache: 'no-cache' });
    const j = (await r.json()) as { config?: { identite?: { langue?: unknown } } };
    const l = j?.config?.identite?.langue;
    return typeof l === 'string' ? l : undefined;
  } catch {
    return undefined;
  }
}

async function boot(): Promise<void> {
  // Langue d'abord : tous les textes en dependent. Bornee a 2 s.
  await Promise.race([
    langueServeur().then((l) => demarrerLangue(l)),
    new Promise((r) => setTimeout(r, 2000)),
  ]);

  const app = createApp(App);
  app.config.globalProperties.$t = t;
  const pinia = createPinia();
  app.use(pinia);

  // La session doit etre resolue avant le routeur : les gardes lisent isAdmin.
  const session = useSessionStore(pinia);
  await session.bootstrap();

  // Personnalisation avant tout affichage (nom, couleur, rideau d'ouverture),
  // bornee a 2 s comme l'horloge : sans reponse, le panel part avec les defauts.
  await Promise.race([useSiteStore(pinia).charger(), new Promise((r) => setTimeout(r, 2000))]);

  useServerStore(pinia).startPolling();
  // Borne a 2 s : une horloge lente ne doit pas retarder l'affichage du panel.
  await Promise.race([chargerHorloge(), new Promise((r) => setTimeout(r, 2000))]);
  window.setInterval(() => void chargerHorloge(), 10 * 60 * 1000);
  useMeteorStore(pinia).demarrer();
  void useAnnoncesStore(pinia).load();

  app.use(router);
  await router.isReady();
  app.mount('#app');
}

void boot();
