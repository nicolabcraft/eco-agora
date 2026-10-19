<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import EChart from '@/components/EChart.vue';
import Icon from '@/components/Icon.vue';
import { stats } from '@/api/eco';
import type { DataSet, StatInfo, StatTree } from '@/api/types';
import { lineOption, type Serie } from '@/utils/chart';
import { loadCatalog } from '@/composables/useSeries';
import { dateMonde, num, stripMarkup, unitLabel } from '@/utils/format';
import { useToastStore } from '@/stores/toasts';
import { t } from '@/i18n';

const MAX_SERIES = 6;
const toasts = useToastStore();

const catalog = ref<StatInfo[]>([]);
const tree = shallowRef<StatTree | null>(null);
const bounds = ref<[number, number]>([0, 1]);
const loadingMeta = ref(true);
const metaError = ref<string | null>(null);

const search = ref('');
const openCategories = ref<Set<string>>(new Set());
const selected = ref<string[]>(['CitizenPopulation']);

const from = ref(0);
const to = ref(1);
const loadingData = ref(false);
const dataError = ref<string | null>(null);
const series = ref<Serie[]>([]);
const chart = ref<InstanceType<typeof EChart> | null>(null);

/** Categories du serveur, aplaties en deux niveaux pour la navigation. */
interface Group { key: string; label: string; items: StatInfo[]; }

const groups = computed<Group[]>(() => {
  const root = tree.value;
  if (!root) return [];
  const out: Group[] = [];
  const walk = (node: StatTree, prefix: string): void => {
    const label = prefix ? `${prefix} / ${node.DisplayName ?? node.Name}` : (node.DisplayName ?? node.Name ?? '');
    if (node.ChildrenStats?.length) {
      // On affiche les libellés du catalogue fusionné (traductions complétées).
      const items = node.ChildrenStats.map(
        (s) => catalog.value.find((c) => c.Name === s.Name) ?? s,
      );
      out.push({ key: label, label, items });
    }
    for (const child of node.ChildrenCategories ?? []) {
      walk(child, node === root ? '' : label);
    }
  };
  for (const child of root.ChildrenCategories ?? []) walk(child, '');
  return out;
});

const filteredGroups = computed<Group[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return groups.value;
  return groups.value
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (s) =>
          s.DisplayName.toLowerCase().includes(q) ||
          s.Name.toLowerCase().includes(q) ||
          g.label.toLowerCase().includes(q),
      ),
    }))
    .filter((g) => g.items.length > 0);
});

const selectedInfos = computed(() =>
  selected.value.map((n) => catalog.value.find((s) => s.Name === n)).filter(Boolean) as StatInfo[],
);

const option = computed(() => (series.value.length ? lineOption(series.value) : null));
const hasData = computed(() => series.value.some((s) => s.values.length > 1));
const spanDays = computed(() => Math.max(0, bounds.value[1] - bounds.value[0]));
function toggleCategory(key: string): void {
  const next = new Set(openCategories.value);
  next.has(key) ? next.delete(key) : next.add(key);
  openCategories.value = next;
}

function toggleStat(name: string): void {
  const i = selected.value.indexOf(name);
  if (i >= 0) {
    selected.value = selected.value.filter((n) => n !== name);
    return;
  }
  if (selected.value.length >= MAX_SERIES) {
    toasts.warn(t('statsPage.maxSeries'), t('statsPage.maxSeriesText'));
    return;
  }
  selected.value = [...selected.value, name];
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

type Preset = 'all' | 'last1' | 'last7' | 'last30';
const LARGEUR: Record<Exclude<Preset, 'all'>, number> = { last1: 1, last7: 7, last30: 30 };

function preset(kind: Preset): void {
  const [min, max] = bounds.value;
  if (kind === 'all') { from.value = min; to.value = max; return; }
  from.value = round2(Math.max(min, max - LARGEUR[kind]));
  to.value = max;
}

/** Bouton correspondant a la plage affichee, pour le mettre en evidence. */
const presetActif = computed<Preset | null>(() => {
  const [min, max] = bounds.value;
  if (to.value !== max) return null;
  if (from.value === min) return 'all';
  for (const k of ['last1', 'last7', 'last30'] as const) {
    if (Math.abs(from.value - round2(Math.max(min, max - LARGEUR[k]))) < 0.011) return k;
  }
  return null;
});

/** Le monde est trop jeune pour cette plage : elle se confondrait avec « Tout ». */
function tropCourt(jours: number): string | undefined {
  return spanDays.value < jours
    ? t('statsPage.tooShort', { n: num(spanDays.value, 1) })
    : undefined;
}

async function loadMeta(): Promise<void> {
  loadingMeta.value = true;
  metaError.value = null;
  try {
    const [merged, treeData, range] = await Promise.all([
      loadCatalog(),
      stats.tree(),
      stats.timeRange(),
    ]);
    tree.value = treeData;
    catalog.value = merged;
    bounds.value = [round2(range[0]), round2(range[1])];
    from.value = bounds.value[0];
    to.value = bounds.value[1];
    // On ouvre la premiere categorie pour ne pas afficher un panneau vide.
    const first = groups.value[0];
    if (first) openCategories.value = new Set([first.key]);
  } catch (err) {
    metaError.value = err instanceof Error ? err.message : t('statsPage.catalogUnavailable');
  } finally {
    loadingMeta.value = false;
  }
}

async function loadData(): Promise<void> {
  if (selected.value.length === 0) { series.value = []; return; }
  loadingData.value = true;
  dataError.value = null;
  try {
    const names = [...selected.value];
    const res: DataSet[] = await stats.getMany(names, from.value, to.value);
    series.value = names.map((name, i) => {
      const info = catalog.value.find((s) => s.Name === name);
      return {
        name: info?.DisplayName ?? name,
        unit: res[i]?.Unit ?? info?.Unit ?? '',
        times: (res[i]?.Times ?? []).map((x) => x / 86400),
        values: res[i]?.Values ?? [],
        area: names.length === 1,
      };
    });
  } catch (err) {
    dataError.value = err instanceof Error ? err.message : t('statsPage.seriesUnavailable');
    series.value = [];
  } finally {
    loadingData.value = false;
  }
}

function exportCsv(): void {
  if (!hasData.value) return;
  const header = [t('statsPage.csvDay'), ...series.value.map((s) => s.name)].join(';');
  const times = series.value[0].times;
  const lines = times.map((t, i) =>
    [t, ...series.value.map((s) => s.values[i] ?? '')].join(';'),
  );
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${t('statsPage.fileName')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toasts.ok(t('statsPage.csvDone'));
}

function exportPng(): void {
  const url = chart.value?.toDataURL();
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `${t('statsPage.fileName')}.png`;
  a.click();
  toasts.ok(t('statsPage.pngDone'));
}

onMounted(() => void loadMeta().then(() => loadData()));
watch([selected, from, to], () => void loadData(), { deep: true });
</script>

<template>
  <div class="stats">
    <SectionTitle
      :level="1"
      :title="$t('statsPage.title')"
      :hint="$t('statsPage.hint', { n: num(catalog.length), max: MAX_SERIES })"
    >
      <template #actions>
        <div class="u-row-tight u-wrap">
          <button class="btn btn--ghost btn--sm" :disabled="!hasData" @click="exportCsv">
            <Icon name="download" :size="15" /><span>CSV</span>
          </button>
          <button class="btn btn--ghost btn--sm" :disabled="!hasData" @click="exportPng">
            <Icon name="download" :size="15" /><span>PNG</span>
          </button>
        </div>
      </template>
    </SectionTitle>

    <StateBlock v-if="metaError" kind="error" :title="$t('statsPage.catalogUnavailable')" :text="metaError">
      <button class="btn btn--primary btn--sm" @click="loadMeta()">{{ $t('statsPage.retry') }}</button>
    </StateBlock>

    <div v-else class="stats__layout">
      <!-- Colonne de sélection -->
      <aside class="card card--tight stats__picker">
        <div class="field">
          <div class="select-wrap stats__search">
            <input v-model="search" class="input" type="search" :placeholder="$t('statsPage.searchPlaceholder')" />
          </div>
        </div>

        <StateBlock v-if="loadingMeta" kind="loading" :title="$t('statsPage.loadingCatalog')" />

        <div v-else class="stats__tree">
          <StateBlock
            v-if="filteredGroups.length === 0"
            kind="empty"
            :title="$t('statsPage.noResult')"
            :text="$t('statsPage.noResultText')"
          />
          <section v-for="g in filteredGroups" :key="g.key" class="stats__group">
            <button class="stats__group-head" @click="toggleCategory(g.key)">
              <Icon
                name="chevron"
                :size="14"
                :class="['stats__caret', { 'is-open': openCategories.has(g.key) || search.length > 0 }]"
              />
              <span class="u-fill u-ellipsis">{{ g.label }}</span>
              <span class="badge">{{ g.items.length }}</span>
            </button>
            <ul v-if="openCategories.has(g.key) || search.length > 0" class="stats__list">
              <li v-for="s in g.items" :key="s.Name">
                <label class="checkbox stats__stat" :title="stripMarkup(s.Description)">
                  <input
                    type="checkbox"
                    :checked="selected.includes(s.Name)"
                    @change="toggleStat(s.Name)"
                  />
                  <span class="u-fill u-ellipsis">{{ s.DisplayName }}</span>
                  <span class="u-faint stats__unit">{{ unitLabel(s.Unit) }}</span>
                </label>
              </li>
            </ul>
          </section>
        </div>
      </aside>

      <!-- Colonne graphique -->
      <div class="stats__main">
        <section class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">{{ $t('statsPage.selectedCurves') }}</h3>
              <p class="card__sub">
                {{ dateMonde(from) }} &rarr; {{ dateMonde(to) }} &middot; {{ $t('statsPage.daysOfData', { n: num(spanDays, 2) }) }}
              </p>
            </div>
            <div class="segmented">
              <button :class="{ 'is-active': presetActif === 'all' }" @click="preset('all')">{{ $t('statsPage.all') }}</button>
              <button
                :class="{ 'is-active': presetActif === 'last1' && spanDays > 1 }"
                :disabled="spanDays <= 1"
                :title="tropCourt(1.0001)"
                @click="preset('last1')"
              >{{ $t('statsPage.last24h') }}</button>
              <button
                :class="{ 'is-active': presetActif === 'last7' && spanDays > 7 }"
                :disabled="spanDays <= 7"
                :title="tropCourt(7.0001)"
                @click="preset('last7')"
              >{{ $t('statsPage.last7d') }}</button>
              <button
                :class="{ 'is-active': presetActif === 'last30' && spanDays > 30 }"
                :disabled="spanDays <= 30"
                :title="tropCourt(30.0001)"
                @click="preset('last30')"
              >{{ $t('statsPage.last30d') }}</button>
            </div>
          </div>

          <div class="stats__range">
            <label class="field stats__range-field">
              <span class="field__label">{{ $t('statsPage.start') }}</span>
              <input v-model.number="from" class="input" type="number" :min="bounds[0]" :max="to" step="0.5" />
            </label>
            <label class="field stats__range-field">
              <span class="field__label">{{ $t('statsPage.end') }}</span>
              <input v-model.number="to" class="input" type="number" :min="from" :max="bounds[1]" step="0.5" />
            </label>
          </div>

          <StateBlock v-if="dataError" kind="error" :title="$t('statsPage.seriesUnavailable')" :text="dataError" />
          <StateBlock
            v-else-if="selected.length === 0"
            kind="empty"
            :title="$t('statsPage.noneSelected')"
            :text="$t('statsPage.noneSelectedText')"
          />
          <StateBlock
            v-else-if="!loadingData && !hasData"
            kind="empty"
            :title="$t('statsPage.noHistory')"
            :text="$t('statsPage.noHistoryText')"
          />
          <EChart v-else ref="chart" :option="option" height="420px" :loading="loadingData" />
        </section>

        <section v-if="selectedInfos.length" class="card">
          <div class="card__head"><h3 class="card__title">{{ $t('statsPage.details') }}</h3></div>
          <div class="table-wrap">
            <table class="table table--compact">
              <thead>
                <tr>
                  <th>{{ $t('statsPage.cols.stat') }}</th><th>{{ $t('statsPage.cols.unit') }}</th><th>{{ $t('statsPage.cols.type') }}</th><th class="u-right">{{ $t('statsPage.cols.points') }}</th>
                  <th class="u-right">{{ $t('statsPage.cols.last') }}</th><th>{{ $t('statsPage.cols.description') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(s, i) in selectedInfos" :key="s.Name">
                  <td><strong>{{ s.DisplayName }}</strong></td>
                  <td>{{ unitLabel(s.Unit) }}</td>
                  <td>
                    <span class="badge" :class="s.StatType === 'ContinuousValue' ? 'badge--info' : 'badge--primary'">
                      {{ s.StatType === 'ContinuousValue' ? $t('statsPage.continuous') : $t('statsPage.event') }}
                    </span>
                  </td>
                  <td class="u-right">{{ num(series[i]?.values.length ?? 0) }}</td>
                  <td class="u-right">
                    {{ num(series[i]?.values[series[i].values.length - 1] ?? 0, 2) }}
                  </td>
                  <td class="u-muted">{{ stripMarkup(s.Description) || '--' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats { display: grid; gap: var(--sp-5); }
.stats__layout { display: grid; gap: var(--sp-4); grid-template-columns: 320px minmax(0, 1fr); align-items: start; }
.stats__picker { position: sticky; top: calc(var(--topbar-h) + var(--sp-4)); max-height: calc(100vh - var(--topbar-h) - var(--sp-6)); display: flex; flex-direction: column; }
.stats__search { margin-bottom: var(--sp-3); }
.stats__search::after { display: none; }
.stats__tree { overflow-y: auto; margin: 0 calc(-1 * var(--sp-2)); padding: 0 var(--sp-2); }
.stats__group + .stats__group { margin-top: 2px; }
.stats__group-head {
  display: flex; align-items: center; gap: var(--sp-2); width: 100%;
  background: transparent; border: 0; cursor: pointer; color: var(--text);
  padding: 7px var(--sp-2); border-radius: var(--r-sm); font-size: 12.5px; font-weight: 600;
  text-align: left;
}
.stats__group-head:hover { background: rgba(255, 255, 255, 0.05); }
.stats__caret { transition: transform 0.16s var(--ease); opacity: 0.6; }
.stats__caret.is-open { transform: rotate(90deg); }
.stats__list { list-style: none; margin: 0 0 var(--sp-2); padding: 0 0 0 var(--sp-4); display: grid; gap: 1px; }
.stats__stat { padding: 5px var(--sp-2); border-radius: var(--r-sm); width: 100%; font-size: 12.5px; }
.stats__stat:hover { background: rgba(255, 255, 255, 0.04); }
.stats__unit { font-size: 10.5px; white-space: nowrap; }
.stats__main { display: grid; gap: var(--sp-4); min-width: 0; }
.stats__range { display: grid; gap: var(--sp-3); grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); margin-bottom: var(--sp-4); }
.stats__range-field { max-width: 220px; }

@media (max-width: 1080px) {
  .stats__layout { grid-template-columns: 1fr; }
  .stats__picker { position: static; max-height: 420px; }
}
</style>
