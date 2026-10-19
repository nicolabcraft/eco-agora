<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StatTile from '@/components/StatTile.vue';
import StateBlock from '@/components/StateBlock.vue';
import Icon from '@/components/Icon.vue';
import { flatten, market, type FlatOffer, type MarketSnapshot } from '@/api/market';
import { compact, dateTime, num } from '@/utils/format';
import VentesBoutiques from '@/components/VentesBoutiques.vue';
import { useSessionStore } from '@/stores/session';
import { localeIntl, t } from '@/i18n';

type Tab = 'offers' | 'stores' | 'ventes';
type Sort = 'price' | 'name' | 'store' | 'stock';

const snapshot = ref<MarketSnapshot | null>(null);
const offers = ref<FlatOffer[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const tab = ref<Tab>('offers');
const session = useSessionStore();
const search = ref('');
const direction = ref<'all' | 'sell' | 'buy'>('all');
const sort = ref<Sort>('price');
/** Boutique choisie (identifiant), ou '' pour toutes. */
const boutique = ref('');

const stores = computed(() => snapshot.value?.stores ?? []);

const currencies = computed(() => {
  const set = new Set<string>();
  for (const s of stores.value) if (s.currency) set.add(s.currency);
  return [...set].sort((a, b) => a.localeCompare(b, localeIntl()));
});

const distinctItems = computed(() => new Set(offers.value.map((o) => o.label)).size);

const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  const filtered = offers.value.filter((o) => {
    if (boutique.value && o.storeId !== boutique.value) return false;
    if (direction.value !== 'all' && o.direction !== direction.value) return false;
    if (!q) return true;
    return (
      o.label.toLowerCase().includes(q) ||
      o.storeName.toLowerCase().includes(q) ||
      o.ownersLabel.toLowerCase().includes(q)
    );
  });
  const by: Record<Sort, (a: FlatOffer, b: FlatOffer) => number> = {
    price: (a, b) => (a.price ?? 0) - (b.price ?? 0),
    name: (a, b) => a.label.localeCompare(b.label, localeIntl()),
    // A boutique egale, par objet : les offres d'une meme boutique restent groupees et lisibles.
    store: (a, b) => a.storeName.localeCompare(b.storeName, localeIntl()) || a.label.localeCompare(b.label, localeIntl()),
    stock: (a, b) => (b.availableQuantity ?? 0) - (a.availableQuantity ?? 0),
  };
  return filtered.sort(by[sort.value]).slice(0, 600);
});

const boutiquesTriees = computed(() =>
  [...stores.value].sort((a, b) => a.name.localeCompare(b.name, localeIntl())),
);
const nomBoutique = computed(() => stores.value.find((s) => s.storeId === boutique.value)?.name ?? '');

/** Depuis l'onglet Magasins : afficher les offres d'une boutique. */
function voirBoutique(id: string): void {
  boutique.value = id;
  tab.value = 'offers';
}

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    const snap = await market.snapshot();
    snapshot.value = snap;
    offers.value = flatten(snap);
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('market.unavailable');
    snapshot.value = null;
    offers.value = [];
  } finally {
    loading.value = false;
  }
}

function exportCsv(): void {
  const header = ['item', 'direction', 'price', 'currency', 'stock', 'store', 'owners', 'category'].map((k) => t(`market.csv.${k}`));
  const lines = rows.value.map((o) =>
    [o.label, o.direction, o.price ?? '', o.currency, o.availableQuantity ?? '', o.storeName, o.ownersLabel, o.category ?? '']
      .map((v) => String(v).replace(/;/g, ','))
      .join(';'),
  );
  const blob = new Blob([[header.join(';'), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${t('market.fileName')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

onMounted(() => void load());
</script>

<template>
  <div class="mk">
    <SectionTitle
      :level="1"
      :title="$t('market.title')"
      :hint="$t('market.hint')"
    >
      <template #actions>
        <div class="u-row-tight u-wrap">
          <span v-if="snapshot?.observedAt" class="badge">
            {{ $t('market.observedAt', { date: dateTime(Date.parse(snapshot.observedAt ?? '') / 1000) }) }}
          </span>
          <button class="btn btn--ghost btn--sm" :disabled="!rows.length" @click="exportCsv">
            <Icon name="download" :size="15" /><span>CSV</span>
          </button>
          <button class="btn btn--ghost btn--sm" @click="load()">
            <Icon name="refresh" :size="15" /><span>{{ $t('market.refresh') }}</span>
          </button>
        </div>
      </template>
    </SectionTitle>

    <StateBlock v-if="loading" kind="loading" :title="$t('market.loading')" />
    <StateBlock
      v-else-if="error"
      kind="locked"
      :title="$t('market.unavailable')"
      :text="$t('market.unavailableText', { error })"
    >
      <button class="btn btn--primary btn--sm" @click="load()">{{ $t('market.retry') }}</button>
    </StateBlock>

    <template v-else>
      <div class="grid-tiles">
        <StatTile :label="$t('market.stores')" :value="num(stores.length)" />
        <StatTile :label="$t('market.offers')" :value="num(offers.length)" tone="info" />
        <StatTile :label="$t('market.distinctItems')" :value="num(distinctItems)" tone="success" />
        <StatTile
          :label="$t('market.currencies')"
          :value="currencies.length ? currencies.join(', ') : '--'"
          tone="muted"
        />
      </div>

      <nav class="tabs">
        <button :class="{ 'is-active': tab === 'offers' }" @click="tab = 'offers'">
          {{ $t('market.offers') }} <span class="badge">{{ offers.length }}</span>
        </button>
        <button :class="{ 'is-active': tab === 'stores' }" @click="tab = 'stores'">
          {{ $t('market.stores') }} <span class="badge">{{ stores.length }}</span>
        </button>
        <!-- Depenses des joueurs : reserve aux administrateurs, comme la route du mod. -->
        <button v-if="session.isAdmin" :class="{ 'is-active': tab === 'ventes' }" @click="tab = 'ventes'">
          {{ $t('market.sales') }} <span class="badge badge--primary">{{ $t('market.adminBadge') }}</span>
        </button>
      </nav>

      <!-- Offres -->
      <section v-if="tab === 'offers'" class="card">
        <div class="card__head">
          <div class="u-row-tight u-wrap">
            <input v-model="search" class="input mk__search" type="search" :placeholder="$t('market.searchPlaceholder')" />
            <div class="segmented">
              <button :class="{ 'is-active': direction === 'all' }" @click="direction = 'all'">{{ $t('market.all') }}</button>
              <button :class="{ 'is-active': direction === 'sell' }" @click="direction = 'sell'">{{ $t('market.sell') }}</button>
              <button :class="{ 'is-active': direction === 'buy' }" @click="direction = 'buy'">{{ $t('market.buy') }}</button>
            </div>
          </div>
          <div class="select-wrap mk__boutique">
            <select v-model="boutique" class="select" :aria-label="$t('market.filterByStore')">
              <option value="">{{ $t('market.allStores') }}</option>
              <option v-for="b in boutiquesTriees" :key="b.storeId" :value="b.storeId">
                {{ b.name }} ({{ b.offers.length }})
              </option>
            </select>
          </div>
          <div class="select-wrap mk__sort">
            <select v-model="sort" class="select">
              <option value="price">{{ $t('market.sort.price') }}</option>
              <option value="name">{{ $t('market.sort.name') }}</option>
              <option value="store">{{ $t('market.sort.store') }}</option>
              <option value="stock">{{ $t('market.sort.stock') }}</option>
            </select>
          </div>
        </div>

        <p v-if="boutique" class="mk__filtre">
          {{ $t('market.storeOffers') }} <strong>{{ nomBoutique }}</strong>
          <button class="btn btn--ghost btn--sm" @click="boutique = ''">
            <Icon name="close" :size="13" /><span>{{ $t('market.seeAllStores') }}</span>
          </button>
        </p>

        <StateBlock
          v-if="rows.length === 0"
          kind="empty"
          :title="$t('market.noOffer')"
          :text="stores.length === 0
            ? $t('market.noStoreYet')
            : $t('market.noMatchingOffer')"
        />
        <div v-else class="table-wrap">
          <table class="table table--compact">
            <thead>
              <tr>
                <th>{{ $t('market.cols.item') }}</th><th>{{ $t('market.cols.direction') }}</th><th class="u-right">{{ $t('market.cols.price') }}</th><th class="u-right">{{ $t('market.cols.stock') }}</th>
                <th>{{ $t('market.cols.store') }}</th><th>{{ $t('market.cols.owner') }}</th><th>{{ $t('market.cols.category') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="o in rows" :key="o.storeId + o.offerId">
                <td>
                  <strong>{{ o.label }}</strong>
                  <span v-if="o.parEtiquette" class="badge mk__etiquette" :title="$t('market.tagTitle')">{{ $t('market.tag') }}</span>
                </td>
                <td>
                  <span class="badge" :class="o.direction === 'sell' ? 'badge--success' : 'badge--info'">
                    {{ o.direction === 'sell' ? $t('market.sells') : $t('market.buys') }}
                  </span>
                </td>
                <td class="u-right u-nowrap">
                  {{ o.isBarter ? $t('market.barter') : num(o.price ?? 0, 2) }}
                  <span v-if="!o.isBarter && o.currency" class="u-faint">{{ o.currency }}</span>
                </td>
                <td class="u-right">{{ o.availableQuantity === null ? '--' : compact(o.availableQuantity) }}</td>
                <td class="u-ellipsis">
                  <button class="mk__lien" :title="$t('market.seeStoreOffers', { store: o.storeName })" @click="voirBoutique(o.storeId)">
                    {{ o.storeName }}
                  </button>
                </td>
                <td class="u-muted u-ellipsis">{{ o.ownersLabel || '--' }}</td>
                <td class="u-faint">{{ o.category || '--' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="offers.length > rows.length" class="card__foot">
          {{ $t('market.limited', { shown: num(rows.length), total: num(offers.length) }) }}
        </p>
      </section>

      <!-- Ventes -->
      <VentesBoutiques v-else-if="tab === 'ventes'" />

      <!-- Magasins -->
      <section v-else class="card">
        <StateBlock v-if="stores.length === 0" kind="empty" :title="$t('market.noStore')" :text="$t('market.noStoreText')" />
        <div v-else class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>{{ $t('market.cols.store') }}</th><th>{{ $t('market.cols.owner') }}</th><th class="u-right">{{ $t('market.offers') }}</th>
                <th>{{ $t('market.cols.currency') }}</th><th>{{ $t('market.cols.position') }}</th><th>{{ $t('market.cols.state') }}</th><th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="s in boutiquesTriees" :key="s.storeId" class="mk__ligne" @click="voirBoutique(s.storeId)">
                <td><strong>{{ s.name }}</strong></td>
                <td class="u-muted">{{ s.owners.join(', ') || '--' }}</td>
                <td class="u-right">{{ num(s.offers.length) }}</td>
                <td>{{ s.isBarter ? $t('market.barter') : (s.currency || '--') }}</td>
                <td class="u-mono u-faint">
                  {{ s.position ? `${Math.round(s.position.x)}, ${Math.round(s.position.z)}` : '--' }}
                </td>
                <td>
                  <span class="badge" :class="s.enabled ? 'badge--success' : ''">
                    {{ s.enabled ? $t('market.open') : $t('market.closed') }}
                  </span>
                </td>
                <td class="u-right">
                  <span class="mk__voir">{{ $t('market.seeOffers') }} <Icon name="chevron" :size="14" /></span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.mk { display: grid; gap: var(--sp-5); }
.mk__search { width: 260px; }
.mk__sort { width: 190px; }
.mk__boutique { width: 230px; }
.mk__filtre { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; margin: 0 0 var(--sp-3); font-size: 13.5px; }
.mk__etiquette { margin-left: 6px; font-size: 10.5px; }
.mk__lien {
  background: none; border: 0; padding: 0; font: inherit; color: var(--text);
  cursor: pointer; text-decoration: underline; text-decoration-color: rgb(var(--primary-rgb) / 0.4);
  text-underline-offset: 3px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.mk__lien:hover { color: var(--primary); }
.mk__ligne { cursor: pointer; }
.mk__ligne:hover td { background: rgb(var(--primary-rgb) / 0.05); }
.mk__voir { display: inline-flex; align-items: center; gap: 2px; color: var(--primary); font-size: 12.5px; white-space: nowrap; }
</style>
