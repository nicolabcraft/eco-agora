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
    <SectionTitle :level="1" :title="$t('profile.title')" :hint="$t('profile.hint')" />

    <StateBlock
      v-if="!session.isLoggedIn"
      kind="locked"
      :title="$t('profile.notLoggedIn')"
      :text="$t('profile.notLoggedInText')"
    >
      <RouterLink to="/connexion" class="btn btn--primary btn--sm">{{ $t('profile.howToSignIn') }}</RouterLink>
    </StateBlock>

    <template v-else>
      <div class="prof__grid">
        <section class="card">
          <div class="card__head"><h3 class="card__title">{{ $t('profile.identity') }}</h3></div>
          <div class="prof__id">
            <div class="prof__avatar">{{ (session.username ?? '?').slice(0, 2).toUpperCase() }}</div>
            <div>
              <div class="prof__name">{{ session.username }}</div>
              <div class="u-row-tight u-wrap prof__badges">
                <span class="badge" :class="isOnline ? 'badge--success' : ''">
                  {{ isOnline ? $t('profile.inGame') : $t('profile.offline') }}
                </span>
                <span v-if="session.isAdmin" class="badge badge--primary">{{ $t('profile.admin') }}</span>
              </div>
            </div>
          </div>
          <dl class="kv prof__kv">
            <dt>{{ $t('profile.server') }}</dt>
            <dd>{{ srv.name }}</dd>
            <dt>{{ $t('profile.sessionUntil') }}</dt>
            <dd>{{ dateTime(session.expiration) }}</dd>
          </dl>
          <div class="card__foot">
            <button class="btn btn--ghost btn--sm" @click="session.signOut()">
              <Icon name="close" :size="14" /><span>{{ $t('profile.signOut') }}</span>
            </button>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">{{ $t('profile.pendingVotes') }}</h3>
              <p class="card__sub">{{ $t('profile.pendingVotesHint') }}</p>
            </div>
            <span class="badge" :class="pending.length ? 'badge--warning' : 'badge--success'">
              {{ pending.length }}
            </span>
          </div>

          <StateBlock v-if="loading" kind="loading" :title="$t('profile.loading')" />
          <StateBlock
            v-else-if="pending.length === 0"
            kind="empty"
            :title="$t('profile.nothingToVote')"
            :text="$t('profile.nothingToVoteText')"
          />
          <ul v-else class="prof__list">
            <li v-for="e in pending" :key="e.Id">
              <RouterLink :to="`/gouvernance/election/${e.Id}`" class="prof__link">
                <Icon name="landmark" :size="15" />
                <span class="u-fill u-ellipsis">{{ stripMarkup(e.Name) || $t('profile.electionFallback', { id: e.Id }) }}</span>
                <Icon name="chevron" :size="14" />
              </RouterLink>
            </li>
          </ul>
        </section>
      </div>

      <div v-if="session.isAdmin" class="card card--warm prof__admin">
        <Icon name="shield" :size="18" />
        <div class="u-fill">
          <strong>{{ $t('profile.adminRights') }}</strong>
          <p class="u-muted">
            {{ $t('profile.adminRightsText') }}
          </p>
        </div>
        <RouterLink to="/admin" class="btn btn--primary btn--sm">{{ $t('profile.openAdmin') }}</RouterLink>
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
