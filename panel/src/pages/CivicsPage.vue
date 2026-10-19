<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import ChartCard from '@/components/ChartCard.vue';
import Icon from '@/components/Icon.vue';
import { civics } from '@/api/eco';
import type { ElectedTitle, Election, Law } from '@/api/types';
import { days, num, stripMarkup } from '@/utils/format';
import { t } from '@/i18n';

type Tab = 'running' | 'past' | 'titles' | 'laws';
const tab = ref<Tab>('running');

const running = ref<Election[]>([]);
const past = ref<Election[]>([]);
const titles = ref<ElectedTitle[]>([]);
const laws = ref<Law[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const counts = computed(() => ({
  running: running.value.length,
  past: past.value.length,
  titles: titles.value.length,
  laws: laws.value.length,
}));

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const [r, p, ti, l] = await Promise.all([
      civics.elections(true),
      civics.elections(false),
      civics.titles(),
      civics.laws(),
    ]);
    running.value = r;
    past.value = p;
    titles.value = ti;
    laws.value = l;
    if (r.length === 0 && p.length > 0) tab.value = 'past';
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('civics.dataUnavailableFull');
  } finally {
    loading.value = false;
  }
}

function holdersOf(title: ElectedTitle): string {
  const list = title.OccupantNames ?? [];
  return list.length ? list.map((n) => stripMarkup(n)).join(', ') : t('civics.vacant');
}

onMounted(() => void load());
</script>

<template>
  <div class="civ">
    <SectionTitle
      :level="1"
      :title="$t('civics.title')"
      :hint="$t('civics.hint')"
    >
      <template #actions>
        <button class="btn btn--ghost btn--sm" @click="load()">
          <Icon name="refresh" :size="15" /><span>{{ $t('civics.refresh') }}</span>
        </button>
      </template>
    </SectionTitle>

    <StateBlock v-if="error" kind="error" :title="$t('civics.dataUnavailable')" :text="error">
      <button class="btn btn--primary btn--sm" @click="load()">{{ $t('civics.retry') }}</button>
    </StateBlock>

    <template v-else>
      <nav class="tabs">
        <button :class="{ 'is-active': tab === 'running' }" @click="tab = 'running'">
          {{ $t('civics.tabs.running') }} <span class="badge">{{ counts.running }}</span>
        </button>
        <button :class="{ 'is-active': tab === 'past' }" @click="tab = 'past'">
          {{ $t('civics.tabs.past') }} <span class="badge">{{ counts.past }}</span>
        </button>
        <button :class="{ 'is-active': tab === 'titles' }" @click="tab = 'titles'">
          {{ $t('civics.tabs.titles') }} <span class="badge">{{ counts.titles }}</span>
        </button>
        <button :class="{ 'is-active': tab === 'laws' }" @click="tab = 'laws'">
          {{ $t('civics.tabs.laws') }} <span class="badge">{{ counts.laws }}</span>
        </button>
      </nav>

      <StateBlock v-if="loading" kind="loading" :title="$t('civics.loading')" />

      <!-- Élections -->
      <div v-else-if="tab === 'running' || tab === 'past'" class="civ__grid">
        <StateBlock
          v-if="(tab === 'running' ? running : past).length === 0"
          kind="empty"
          :title="tab === 'running' ? $t('civics.noRunning') : $t('civics.noPast')"
          :text="$t('civics.noElectionText')"
        />
        <RouterLink
          v-for="e in tab === 'running' ? running : past"
          :key="e.Id"
          :to="`/gouvernance/election/${e.Id}`"
          class="card civ__item"
        >
          <div class="civ__item-head">
            <h3 class="civ__item-title">{{ stripMarkup(e.Name) || $t('civics.electionFallback', { id: e.Id }) }}</h3>
            <span
              class="badge"
              :class="e.Finished ? (e.Passed ? 'badge--success' : 'badge--danger') : 'badge--primary'"
            >
              {{ e.Finished ? (e.Passed ? $t('civics.passed') : $t('civics.rejected')) : $t('civics.ongoing') }}
            </span>
          </div>
          <p v-if="stripMarkup(e.UserDescription)" class="u-muted civ__item-desc">
            {{ stripMarkup(e.UserDescription) }}
          </p>
          <dl class="kv civ__item-kv">
            <dt>{{ $t('civics.votes') }}</dt>
            <dd>{{ num(e.TotalVotes) }}</dd>
            <dt>{{ $t('civics.initiator') }}</dt>
            <dd>{{ stripMarkup(e.Creator) || '--' }}</dd>
            <dt>{{ e.Finished ? $t('civics.endedSince') : $t('civics.endsIn') }}</dt>
            <dd>{{ days(Math.abs(e.TimeEndAgo ?? 0) / 86400) }}</dd>
          </dl>
          <div v-if="e.PendingVote" class="civ__pending">
            <Icon name="alert" :size="14" /> {{ $t('civics.notVotedYet') }}
          </div>
        </RouterLink>
      </div>

      <!-- Élus -->
      <div v-else-if="tab === 'titles'" class="civ__grid">
        <StateBlock
          v-if="titles.length === 0"
          kind="empty"
          :title="$t('civics.noTitle')"
          :text="$t('civics.noTitleText')"
        />
        <article v-for="t in titles" :key="t.Id" class="card civ__item">
          <div class="civ__item-head">
            <h3 class="civ__item-title">{{ stripMarkup(t.Name) || $t('civics.titleFallback') }}</h3>
            <span class="badge badge--info">{{ t.State || '--' }}</span>
          </div>
          <p class="u-muted">{{ holdersOf(t) }}</p>
        </article>
      </div>

      <!-- Lois -->
      <div v-else class="civ__grid">
        <StateBlock
          v-if="laws.length === 0"
          kind="empty"
          :title="$t('civics.noLaw')"
          :text="$t('civics.noLawText')"
        />
        <article v-for="l in laws" :key="l.Id" class="card civ__item">
          <div class="civ__item-head">
            <h3 class="civ__item-title">{{ stripMarkup(l.Name) }}</h3>
            <span class="badge" :class="l.State === 'Active' ? 'badge--success' : ''">{{ l.State }}</span>
          </div>
          <p v-if="stripMarkup(l.UserDescription || l.Description)" class="u-muted civ__item-desc">
            {{ stripMarkup(l.UserDescription || l.Description) }}
          </p>
          <dl class="kv civ__item-kv">
            <dt>{{ $t('civics.author') }}</dt>
            <dd>{{ stripMarkup(l.Creator) || '--' }}</dd>
          </dl>
        </article>
      </div>

      <ChartCard
        :title="$t('civics.chart')"
        :hint="$t('civics.chartHint')"
        :names="['Vote', 'DidntVote', 'StartElection', 'Laws']"
        height="280px"
      />
    </template>
  </div>
</template>

<style scoped>
.civ { display: grid; gap: var(--sp-5); }
.civ__grid { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
.civ__item { display: grid; gap: var(--sp-3); align-content: start; color: var(--text); }
.civ__item:hover { border-color: rgb(var(--primary-rgb) / 0.35); color: var(--text); }
.civ__item-head { display: flex; align-items: flex-start; justify-content: space-between; gap: var(--sp-3); }
.civ__item-title { font-size: 15px; font-weight: 700; }
.civ__item-desc { font-size: 13px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.civ__item-kv { border-top: 1px solid var(--hairline); padding-top: var(--sp-3); }
.civ__pending { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: #f5c45f; }
.civ__grid > .state { grid-column: 1 / -1; }
</style>
