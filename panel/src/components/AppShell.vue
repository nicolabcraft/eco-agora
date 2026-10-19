<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import Icon from './Icon.vue';
import AnnonceBanner from './AnnonceBanner.vue';
import { useServerStore } from '@/stores/server';
import MeteorCountdown from '@/components/MeteorCountdown.vue';
import { useSessionStore } from '@/stores/session';
import { num } from '@/utils/format';
import { useSiteStore } from '@/stores/site';
import { lienSur } from '@/site/schema';
import { choisirLangue, langue, langues } from '@/i18n';

const route = useRoute();
const srv = useServerStore();
const session = useSessionStore();
const site = useSiteStore();
const mobileOpen = ref(false);

/**
 * Interface d'origine d'Eco, si l'installation l'a rangee dans legacy/ : les
 * mods qui s'integrent a l'interface d'origine restent ainsi accessibles. Sans
 * ce fichier, le serveur renvoie notre propre panel : on le reconnait a sa
 * balise generator.
 */
const interfaceOrigine = ref(false);
onMounted(async () => {
  try {
    const r = await fetch('/legacy/', { cache: 'no-cache' });
    const html = r.ok ? await r.text() : '';
    interfaceOrigine.value = html.includes('<div id="app">') && !html.includes('content="Eco Agora"');
  } catch {
    interfaceOrigine.value = false;
  }
});

/** Liens de la personnalisation, filtres : seuls http(s) et chemins locaux passent. */
const lienSite = computed(() => lienSur(site.config.liens.site));
const lienHebergeur = computed(() => lienSur(site.config.liens.hebergeurUrl));

interface NavItem { to: string; icon: string; label: string; }

const citizenNav: NavItem[] = [
  { to: '/', icon: 'grid', label: 'Tableau de bord' },
  { to: '/carte', icon: 'map', label: 'Carte du monde' },
  { to: '/statistiques', icon: 'activity', label: 'Statistiques' },
  { to: '/ecologie', icon: 'leaf', label: 'Écologie et climat' },
  { to: '/marche', icon: 'coins', label: 'Marché' },
  { to: '/economie', icon: 'chart', label: 'Économie' },
  { to: '/gouvernance', icon: 'landmark', label: 'Gouvernance' },
];

/** Reglement et Eco Gnome n'apparaissent que s'ils sont actives dans la personnalisation. */
const guideNav = computed<NavItem[]>(() => [
  ...(site.config.reglement.actif ? [{ to: '/reglement', icon: 'gavel', label: 'Règlement' }] : []),
  { to: '/wiki', icon: 'book', label: 'Wiki' },
  ...(site.config.ecoGnome.actif ? [{ to: '/eco-gnome', icon: 'calculate', label: 'Eco Gnome' }] : []),
]);

const adminNav: NavItem[] = [
  { to: '/admin', icon: 'server', label: 'Santé du serveur' },
  { to: '/admin/joueurs', icon: 'users', label: 'Joueurs et modération' },
  { to: '/admin/console', icon: 'terminal', label: 'Console' },
  { to: '/admin/chat', icon: 'message', label: 'Chat' },
  { to: '/admin/annonces', icon: 'campaign', label: 'Annonces du site' },
  { to: '/admin/journal', icon: 'search', label: 'Journal d’activité' },
  { to: '/admin/journaux', icon: 'file', label: 'Journaux techniques' },
  { to: '/admin/exports', icon: 'download', label: 'Exports' },
  { to: '/admin/personnalisation', icon: 'edit', label: 'Personnalisation' },
  { to: '/admin/configuration', icon: 'settings', label: 'Configuration' },
];

/** Visibilité du serveur dans le navigateur de serveurs d'Eco. */
const accessLabel = computed(() => {
  const a = srv.info?.Access;
  if (a === 'public') {
    return { text: 'Public', tone: 'badge--success', help: 'Le serveur est listé publiquement dans le navigateur de serveurs d’Eco.' };
  }
  if (a === 'private') {
    return { text: 'Privé', tone: 'badge--danger', help: 'Accès restreint : le serveur n’accepte que les joueurs autorisés.' };
  }
  return { text: 'Masqué', tone: 'badge--warning', help: 'Le serveur est accessible mais n’apparaît pas dans le navigateur de serveurs d’Eco.' };
});

function isActive(to: string): boolean {
  return to === '/' || to === '/admin' ? route.path === to : route.path.startsWith(to);
}
</script>

<template>
  <div class="shell" :class="{ 'shell--nav-open': mobileOpen }">
    <!-- Navigation laterale -->
    <aside class="nav">
      <RouterLink to="/" class="brand" @click="mobileOpen = false">
        <img :src="site.logo" alt="" class="brand__logo" width="34" height="34" />
        <span class="brand__text">
          <strong>{{ site.nom }}</strong>
          <small>Panel Eco</small>
        </span>
      </RouterLink>

      <div class="nav__scroll">
        <div class="nav__group">
          <div class="nav__group-title">Espace citoyen</div>
          <RouterLink
            v-for="item in citizenNav"
            :key="item.to"
            :to="item.to"
            class="nav__item"
            :class="{ 'is-active': isActive(item.to) }"
            @click="mobileOpen = false"
          >
            <Icon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>

        <div class="nav__group">
          <div class="nav__group-title">Guides</div>
          <RouterLink
            v-for="item in guideNav"
            :key="item.to"
            :to="item.to"
            class="nav__item"
            :class="{ 'is-active': isActive(item.to) }"
            @click="mobileOpen = false"
          >
            <Icon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>

        <div v-if="session.isAdmin" class="nav__group">
          <div class="nav__group-title">
            Administration
            <span class="badge badge--primary">Admin</span>
          </div>
          <RouterLink
            v-for="item in adminNav"
            :key="item.to"
            :to="item.to"
            class="nav__item"
            :class="{ 'is-active': isActive(item.to) }"
            @click="mobileOpen = false"
          >
            <Icon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
          <a v-if="interfaceOrigine" href="/legacy/" target="_blank" rel="noopener" class="nav__item">
            <Icon name="layers" />
            <span>Interface d’origine d’Eco</span>
            <Icon name="link" :size="13" class="nav__item-ext" />
          </a>
        </div>

        <div class="nav__group">
          <div class="nav__group-title">Communauté</div>
          <a v-if="site.rejoindrePossible" :href="site.lienJeu()" class="nav__item nav__item--jeu" :title="site.lienJeu()">
            <Icon name="play" />
            <span>Rejoindre le serveur</span>
          </a>
          <a
            v-if="srv.info?.DiscordAddress"
            :href="srv.info.DiscordAddress"
            target="_blank"
            rel="noopener"
            class="nav__item"
          >
            <Icon name="discord" />
            <span>Discord</span>
            <Icon name="link" :size="13" class="nav__item-ext" />
          </a>
          <a v-if="lienSite" :href="lienSite" target="_blank" rel="noopener" class="nav__item">
            <Icon name="globe" />
            <span>{{ site.config.liens.siteLibelle || lienSite.replace(/^https?:\/\//, '').replace(/\/$/, '') }}</span>
            <Icon name="link" :size="13" class="nav__item-ext" />
          </a>
        </div>
      </div>

      <footer class="nav__foot">
        <div class="nav__foot-row">
          <span class="nav__foot-label">Serveur</span>
          <span class="nav__foot-value">
            <span class="dot" :class="srv.reachable ? 'dot--on' : 'dot--off'" />
            {{ srv.reachable ? 'En ligne' : 'Injoignable' }}
          </span>
        </div>
        <div class="nav__foot-row">
          <span class="nav__foot-label">Visibilité</span>
          <span :class="['badge', accessLabel.tone]" :title="accessLabel.help">
            {{ accessLabel.text }}
          </span>
        </div>
        <div class="nav__foot-row">
          <span class="nav__foot-label">Version</span>
          <span class="u-faint nav__foot-version">{{ srv.info?.Version ?? '--' }}</span>
        </div>

        <a
          v-if="site.config.liens.hebergeurMention && lienHebergeur"
          :href="lienHebergeur"
          target="_blank"
          rel="noopener"
          class="nav__host"
        >
          <span>{{ site.config.liens.hebergeurMention }}</span>
          <Icon name="link" :size="12" class="nav__host-ext" />
        </a>
        <span v-else-if="site.config.liens.hebergeurMention" class="nav__host nav__host--plain">
          {{ site.config.liens.hebergeurMention }}
        </span>
      </footer>
    </aside>

    <!-- Barre superieure et contenu -->
    <div class="main">
      <header class="topbar">
        <button class="btn btn--ghost btn--icon topbar__burger" title="Menu" @click="mobileOpen = !mobileOpen">
          <Icon :name="mobileOpen ? 'close' : 'menu'" />
        </button>

        <div class="topbar__live">
          <span class="dot" :class="srv.online > 0 ? 'dot--on' : 'dot--off'" />
          <strong>{{ num(srv.online) }}</strong>
          <span class="u-muted">en ligne</span>
          <span class="u-faint topbar__sep">|</span>
          <span class="u-muted">Jour</span>
          <strong>{{ num(srv.info?.DaysRunning ?? 0) }}</strong>
          <MeteorCountdown variante="compact" class="topbar__meteor" />
        </div>

        <div class="u-fill" />

        <label v-if="langues.length > 1" class="topbar__langue" :title="$t('commun.langue')">
          <Icon name="globe" :size="15" />
          <select class="select select--sm" :value="langue" :aria-label="$t('commun.langue')" @change="choisirLangue(($event.target as HTMLSelectElement).value)">
            <option v-for="l in langues" :key="l.code" :value="l.code">{{ l.nom }}</option>
          </select>
        </label>

        <button class="btn btn--ghost btn--sm" title="Rafraîchir" @click="srv.refresh()">
          <Icon name="refresh" :size="15" />
          <span class="topbar__hide-sm">Rafraîchir</span>
        </button>

        <div v-if="session.hasSession" class="topbar__user">
          <Icon name="user" :size="15" />
          <span class="u-ellipsis">{{ session.username }}</span>
          <span v-if="session.isAdmin" class="badge badge--primary">Admin</span>
        </div>
        <RouterLink v-else to="/connexion" class="btn btn--primary btn--sm">
          <Icon name="user" :size="15" />
          <span>Se connecter</span>
        </RouterLink>
      </header>

      <main class="content">
        <AnnonceBanner />
        <slot />
      </main>
    </div>

    <button v-if="mobileOpen" class="scrim" aria-label="Fermer le menu" @click="mobileOpen = false" />
  </div>
</template>

<style scoped>
.shell { min-height: 100vh; }

/* --- Navigation laterale --- */
.nav {
  position: fixed; inset: 0 auto 0 0; width: var(--nav-w); z-index: 40;
  display: flex; flex-direction: column;
  background: var(--surface); border-right: 1px solid var(--hairline);
}
.brand {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: 0 var(--sp-4); height: var(--topbar-h); flex: none;
  border-bottom: 1px solid var(--hairline); color: var(--text);
}
.brand:hover { color: var(--text); }
.brand__logo { width: 34px; height: 34px; flex: none; border-radius: 8px; object-fit: contain; }
.brand__text { display: flex; flex-direction: column; line-height: 1.2; min-width: 0; }
.brand__text strong { font-size: 13.5px; text-transform: uppercase; letter-spacing: 1.4px; }
.brand__text small { font-size: 11px; color: var(--text-muted); }

.nav__scroll { flex: 1 1 auto; overflow-y: auto; padding: var(--sp-4) var(--sp-3); }
.nav__group + .nav__group { margin-top: var(--sp-5); }
.nav__group-title {
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-2);
  font-size: 10.5px; font-weight: 700; letter-spacing: 1.1px; text-transform: uppercase;
  color: var(--text-faint); padding: 0 var(--sp-3) var(--sp-2);
}
.nav__item {
  display: flex; align-items: center; gap: var(--sp-3);
  padding: 9px var(--sp-3); border-radius: var(--r-md); margin-bottom: 2px;
  color: var(--text-muted); font-size: 13.5px; font-weight: 500;
  transition: background 0.14s var(--ease), color 0.14s var(--ease);
}
.nav__item:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
.nav__item.is-active { background: rgb(var(--primary-rgb) / 0.13); color: #ffa163; font-weight: 600; }
.nav__item.is-active :deep(.icon) { color: var(--primary); }
.nav__item span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nav__item-ext { margin-left: auto; opacity: 0.5; }
/* L'entree « Rejoindre » est la seule action principale du groupe : on la distingue. */
.nav__item--jeu { color: var(--primary); font-weight: 600; }
.nav__item--jeu:hover { background: rgb(var(--primary-rgb) / 0.1); }

.nav__foot {
  flex: none; padding: var(--sp-3) var(--sp-4);
  border-top: 1px solid var(--hairline-warm); font-size: 12px;
}
.nav__foot-row {
  display: flex; align-items: center; justify-content: space-between;
  gap: var(--sp-2); min-height: 22px;
}
.nav__foot-label { color: var(--text-faint); font-size: 11px; }
.nav__foot-value { display: flex; align-items: center; gap: 6px; font-weight: 600; }
.nav__foot-version { font-size: 10.5px; text-align: right; }

/* Credit d'hebergement : discret par defaut, il s'allume au survol. */
.nav__host {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  margin-top: var(--sp-3); padding: 7px var(--sp-3);
  border: 1px solid var(--hairline); border-radius: var(--r-md);
  color: var(--text-faint); font-size: 11px; text-decoration: none;
  transition: color 0.15s ease, border-color 0.15s ease, background-color 0.15s ease;
}
.nav__host:hover {
  color: var(--text); border-color: rgb(var(--primary-rgb) / 0.35);
  background: rgb(var(--primary-rgb) / 0.07);
}
.nav__host-ext { opacity: 0.55; }
.nav__host--plain { cursor: default; }
.nav__host--plain:hover { color: var(--text-faint); border-color: var(--hairline); background: none; }

/* --- Zone principale --- */
.main { margin-left: var(--nav-w); min-height: 100vh; display: flex; flex-direction: column; }
.topbar {
  position: sticky; top: 0; z-index: 30; flex: none;
  display: flex; align-items: center; gap: var(--sp-3);
  height: var(--topbar-h); padding: 0 var(--sp-5);
  background: rgba(22, 20, 25, 0.9); backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--hairline);
}
.topbar__burger { display: none; }
.topbar__live { display: flex; align-items: center; gap: 7px; font-size: 13px; }
.topbar__meteor { margin-left: var(--sp-2); }
.topbar__sep { margin: 0 2px; }
.topbar__langue { display: inline-flex; align-items: center; gap: 6px; color: var(--text-muted); }
.topbar__langue .select { padding: 4px 26px 4px 8px; font-size: 13px; width: auto; }
.topbar__user {
  display: flex; align-items: center; gap: var(--sp-2); max-width: 220px;
  padding: 6px 12px; border-radius: var(--r-ghost); font-size: 13px;
  background: var(--surface-2); box-shadow: inset 0 0 0 1px var(--hairline);
}
.content { flex: 1 1 auto; padding: var(--sp-5); width: 100%; max-width: var(--content-max); margin: 0 auto; }

.scrim { display: none; }

/* --- Reactivite --- */
@media (max-width: 1080px) {
  .nav { transform: translateX(-100%); transition: transform 0.22s var(--ease); box-shadow: var(--shadow-pop); }
  .shell--nav-open .nav { transform: none; }
  .main { margin-left: 0; }
  .topbar__burger { display: inline-flex; }
  .shell--nav-open .scrim {
    display: block; position: fixed; inset: 0; z-index: 35;
    background: rgba(10, 9, 12, 0.6); border: 0; cursor: pointer;
  }
}
@media (max-width: 720px) {
  .content { padding: var(--sp-4) var(--sp-3); }
  .topbar { padding: 0 var(--sp-3); }
  .topbar__hide-sm { display: none; }
  .topbar__user { max-width: 130px; }
}
</style>
