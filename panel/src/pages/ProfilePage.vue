<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import Icon from '@/components/Icon.vue';
import { civics } from '@/api/eco';
import type { Election } from '@/api/types';
import { useSessionStore } from '@/stores/session';
import { useServerStore } from '@/stores/server';
import { dateTime, stripMarkup } from '@/utils/format';

const session = useSessionStore();
const srv = useServerStore();
const elections = ref<Election[]>([]);
const loading = ref(true);

const pending = computed(() => elections.value.filter((e) => e.PendingVote));
const isOnline = computed(() =>
  Boolean(session.username && srv.info?.OnlinePlayersNames?.includes(session.username)),
);

onMounted(async () => {
  try {
    elections.value = await civics.elections(true);
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="prof">
    <SectionTitle :level="1" title="Mon profil" hint="Votre identité de citoyen telle que le serveur la connaît." />

    <StateBlock
      v-if="!session.isLoggedIn"
      kind="locked"
      title="Vous n'êtes pas connecté"
      text="Ouvrez ce panel depuis le jeu pour voir votre profil, vos votes en attente et, si vous êtes administrateur, l'espace d'administration."
    >
      <RouterLink to="/connexion" class="btn btn--primary btn--sm">Comment se connecter</RouterLink>
    </StateBlock>

    <template v-else>
      <div class="prof__grid">
        <section class="card">
          <div class="card__head"><h3 class="card__title">Identité</h3></div>
          <div class="prof__id">
            <div class="prof__avatar">{{ (session.username ?? '?').slice(0, 2).toUpperCase() }}</div>
            <div>
              <div class="prof__name">{{ session.username }}</div>
              <div class="u-row-tight u-wrap prof__badges">
                <span class="badge" :class="isOnline ? 'badge--success' : ''">
                  {{ isOnline ? 'En jeu' : 'Hors ligne' }}
                </span>
                <span v-if="session.isAdmin" class="badge badge--primary">Administrateur</span>
              </div>
            </div>
          </div>
          <dl class="kv prof__kv">
            <dt>Serveur</dt>
            <dd>{{ srv.name }}</dd>
            <dt>Session valable jusqu'au</dt>
            <dd>{{ dateTime(session.expiration) }}</dd>
          </dl>
          <div class="card__foot">
            <button class="btn btn--ghost btn--sm" @click="session.signOut()">
              <Icon name="close" :size="14" /><span>Se déconnecter</span>
            </button>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">Votes en attente</h3>
              <p class="card__sub">Élections en cours sur lesquelles vous ne vous êtes pas exprimé.</p>
            </div>
            <span class="badge" :class="pending.length ? 'badge--warning' : 'badge--success'">
              {{ pending.length }}
            </span>
          </div>

          <StateBlock v-if="loading" kind="loading" title="Chargement" />
          <StateBlock
            v-else-if="pending.length === 0"
            kind="empty"
            title="Rien à voter"
            text="Vous êtes à jour sur toutes les élections en cours."
          />
          <ul v-else class="prof__list">
            <li v-for="e in pending" :key="e.Id">
              <RouterLink :to="`/gouvernance/election/${e.Id}`" class="prof__link">
                <Icon name="landmark" :size="15" />
                <span class="u-fill u-ellipsis">{{ stripMarkup(e.Name) || 'Élection ' + e.Id }}</span>
                <Icon name="chevron" :size="14" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <div v-if="session.isAdmin" class="card card--warm prof__admin">
        <Icon name="shield" :size="18" />
        <div class="u-fill">
          <strong>Vous disposez des droits d'administration</strong>
          <p class="u-muted">
            L'espace d'administration donne accès aux journaux, à la modération, à la console de
            commandes et aux exports. Chaque action sensible demande une confirmation.
          </p>
        </div>
        <RouterLink to="/admin" class="btn btn--primary btn--sm">Ouvrir l'administration</RouterLink>
      </div>
    </template>
  </div>
</template>

<style scoped>
.prof { display: grid; gap: var(--sp-5); }
.prof__grid { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
.prof__id { display: flex; align-items: center; gap: var(--sp-4); }
.prof__avatar {
  display: grid; place-items: center; width: 54px; height: 54px; flex: none;
  border-radius: 50%; background: var(--primary); color: var(--text-on-primary);
  font-weight: 800; font-size: 18px;
}
.prof__name { font-size: 18px; font-weight: 700; }
.prof__badges { margin-top: 6px; }
.prof__kv { margin-top: var(--sp-4); }
.prof__list { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }
.prof__link {
  display: flex; align-items: center; gap: var(--sp-3); color: var(--text);
  background: var(--surface-2); border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4);
  font-size: 13.5px;
}
.prof__link:hover { background: var(--surface-3); color: var(--text); }
.prof__admin { display: flex; gap: var(--sp-4); align-items: center; flex-wrap: wrap; color: #e8b79a; }
.prof__admin p { margin: 4px 0 0; font-size: 13px; }
</style>
