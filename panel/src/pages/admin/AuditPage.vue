<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StatTile from '@/components/StatTile.vue';
import StateBlock from '@/components/StateBlock.vue';
import AdminGuardNotice from '@/components/AdminGuardNotice.vue';
import Icon from '@/components/Icon.vue';
import { audit, type AuditEvent, type AuditFilters, type AuditStats } from '@/api/audit';
import { compact, dateTime, num } from '@/utils/format';

const PAGE = 50;

const events = ref<AuditEvent[]>([]);
const total = ref(0);
const offset = ref(0);
const stats = ref<AuditStats | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);

const filters = ref<AuditFilters>({});
const types = ref<string[]>([]);
const players = ref<string[]>([]);

const pages = computed(() => Math.max(1, Math.ceil(total.value / PAGE)));
const page = computed(() => Math.floor(offset.value / PAGE) + 1);

/** Une ligne agrégée couvre une fenêtre : on l'affiche comme telle. */
function window(e: AuditEvent): string {
  if (e.count <= 1) return dateTime(Date.parse(e.ts) / 1000);
  const start = new Date(e.ts);
  const end = new Date(e.tsEnd);
  const hh = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${dateTime(Date.parse(e.ts) / 1000)} → ${hh(end)}`.replace(String(start.getFullYear()), String(start.getFullYear()));
}

async function load(reset = false): Promise<void> {
  if (reset) offset.value = 0;
  loading.value = true;
  error.value = null;
  try {
    const res = await audit.search({ ...filters.value, limit: PAGE, offset: offset.value });
    events.value = res.events ?? [];
    total.value = res.total ?? 0;
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Journal indisponible';
    events.value = [];
    total.value = 0;
  } finally {
    loading.value = false;
  }
}

async function loadMeta(): Promise<void> {
  stats.value = await audit.stats().catch(() => null);
  types.value = (await audit.distinct('type').catch(() => null))?.values ?? [];
  players.value = (await audit.distinct('player').catch(() => null))?.values ?? [];
}

function move(delta: number): void {
  const next = offset.value + delta * PAGE;
  if (next < 0 || next >= total.value) return;
  offset.value = next;
  void load();
}

/** Largeur de barre relative au type le plus fréquent. */
function barWidth(count: number): string {
  const top = stats.value?.topTypes24h?.[0]?.count ?? 1;
  return `${Math.round((100 * count) / (top || 1))}%`;
}

function reset(): void {
  filters.value = {};
  void load(true);
}

function exportCsv(): void {
  const header = ['horodatage', 'type', 'joueur', 'cible', 'outil', 'quantite', 'actions', 'x', 'y', 'z'];
  const lines = events.value.map((e) =>
    [e.ts, e.type, e.player ?? '', e.target ?? '', e.tool ?? '', e.quantity, e.count, e.x, e.y, e.z]
      .map((v) => String(v).replace(/;/g, ','))
      .join(';'),
  );
  const blob = new Blob([[header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'journal-eco.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

onMounted(async () => {
  await Promise.all([load(), loadMeta()]);
});
</script>

<template>
  <div class="au">
    <SectionTitle
      :level="1"
      title="Journal d’activité"
      hint="Qui a fait quoi, où et quand. Les actions répétitives sont regroupées par joueur, type, minute et zone."
    >
      <template #actions>
        <div class="u-row-tight u-wrap">
          <button class="btn btn--ghost btn--sm" :disabled="!events.length" @click="exportCsv">
            <Icon name="download" :size="15" /><span>CSV</span>
          </button>
          <button class="btn btn--ghost btn--sm" @click="load()">
            <Icon name="refresh" :size="15" /><span>Actualiser</span>
          </button>
        </div>
      </template>
    </SectionTitle>

    <div v-if="stats" class="grid-tiles">
      <StatTile
        label="Événements conservés"
        :value="compact(stats.events)"
        :hint="stats.retentionDays + ' jours de rétention'"
      />
      <StatTile label="Taille de la base" :value="compact(stats.databaseBytes)" suffix="o" tone="info" />
      <StatTile
        label="File d’écriture"
        :value="num(stats.queued)"
        :tone="stats.queued > 5000 ? 'warning' : 'success'"
        :hint="compact(stats.written) + ' écrits'"
      />
      <StatTile
        label="Perdus / erreurs"
        :value="num(stats.dropped) + ' / ' + num(stats.errors)"
        :tone="stats.dropped + stats.errors > 0 ? 'danger' : 'muted'"
      />
      <StatTile label="Archivés" :value="compact(stats.archived)" tone="muted" />
      <StatTile
        label="Journalisation"
        :value="stats.enabled ? 'Active' : 'Désactivée'"
        :tone="stats.enabled ? 'success' : 'warning'"
        :hint="'Fenêtre ' + stats.aggregationWindowSeconds + ' s'"
      />
    </div>

    <section class="card">
      <div class="au__filters">
        <label class="field au__f">
          <span class="field__label">Type</span>
          <div class="select-wrap">
            <select v-model="filters.type" class="select">
              <option value="">Tous</option>
              <option v-for="t in types" :key="t" :value="t">{{ t }}</option>
            </select>
          </div>
        </label>
        <label class="field au__f">
          <span class="field__label">Joueur</span>
          <div class="select-wrap">
            <select v-model="filters.player" class="select">
              <option value="">Tous</option>
              <option v-for="p in players" :key="p" :value="p">{{ p }}</option>
            </select>
          </div>
        </label>
        <label class="field au__f">
          <span class="field__label">Cible</span>
          <input v-model="filters.target" class="input" type="text" placeholder="Objet, espèce" />
        </label>
        <label class="field au__f">
          <span class="field__label">Outil</span>
          <input v-model="filters.tool" class="input" type="text" placeholder="Pioche…" />
        </label>
        <label class="field au__f">
          <span class="field__label">Depuis</span>
          <input v-model="filters.from" class="input" type="datetime-local" />
        </label>
        <label class="field au__f">
          <span class="field__label">Jusqu’à</span>
          <input v-model="filters.to" class="input" type="datetime-local" />
        </label>
        <div class="u-row-tight au__actions">
          <button class="btn btn--primary btn--sm" @click="load(true)">
            <Icon name="search" :size="15" /><span>Filtrer</span>
          </button>
          <button class="btn btn--ghost btn--sm" @click="reset">Réinitialiser</button>
        </div>
      </div>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Événements</h3>
          <p class="card__sub">{{ num(total) }} résultat(s) &middot; page {{ page }} sur {{ pages }}</p>
        </div>
        <div class="u-row-tight">
          <button class="btn btn--ghost btn--sm" :disabled="offset === 0" @click="move(-1)">Précédent</button>
          <button class="btn btn--ghost btn--sm" :disabled="offset + 50 >= total" @click="move(1)">Suivant</button>
        </div>
      </div>

      <StateBlock v-if="loading" kind="loading" title="Interrogation du journal" />
      <AdminGuardNotice v-else-if="error" :error="error" />
      <StateBlock
        v-else-if="events.length === 0"
        kind="empty"
        title="Aucun événement"
        text="Aucune activité ne correspond à ces filtres. Le journal se remplit dès que des joueurs agissent dans le monde."
      />
      <div v-else class="table-wrap">
        <table class="table table--compact">
          <thead>
            <tr>
              <th>Quand</th><th>Type</th><th>Joueur</th><th>Cible</th><th>Outil</th>
              <th class="u-right">Quantité</th><th class="u-right">Actions</th><th>Position</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="e in events" :key="e.id">
              <td class="u-nowrap u-faint">{{ window(e) }}</td>
              <td><strong>{{ e.type.replace('action.', '') }}</strong></td>
              <td>{{ e.player || '--' }}</td>
              <td class="u-ellipsis">{{ e.target || '--' }}</td>
              <td class="u-muted">{{ e.tool || '--' }}</td>
              <td class="u-right">{{ e.quantity ? num(e.quantity, 2) : '--' }}</td>
              <td class="u-right">
                <span v-if="e.count > 1" class="badge badge--primary">x{{ num(e.count) }}</span>
                <span v-else class="u-faint">1</span>
              </td>
              <td class="u-mono u-faint">{{ e.x }}, {{ e.y }}, {{ e.z }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="stats && stats.topTypes24h && stats.topTypes24h.length" class="card">
      <div class="card__head"><h3 class="card__title">Activité des 24 dernières heures</h3></div>
      <div class="au__top">
        <div v-for="t in stats.topTypes24h" :key="t.type" class="au__top-row">
          <span class="u-fill u-ellipsis">{{ t.type.replace('action.', '') }}</span>
          <div class="meter au__meter">
            <div class="meter__fill" :style="{ width: barWidth(t.count) }" />
          </div>
          <strong class="au__top-count">{{ compact(t.count) }}</strong>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.au { display: grid; gap: var(--sp-5); }
.au__filters { display: flex; gap: var(--sp-3); align-items: flex-end; flex-wrap: wrap; }
.au__f { width: 170px; }
.au__actions { margin-bottom: 1px; }
.au__top { display: grid; gap: 6px; }
.au__top-row { display: flex; align-items: center; gap: var(--sp-3); font-size: 13px; }
.au__meter { flex: 0 0 220px; }
.au__top-count { width: 70px; text-align: right; }
@media (max-width: 720px) {
  .au__f { width: 100%; }
  .au__meter { flex: 0 0 90px; }
}
</style>
