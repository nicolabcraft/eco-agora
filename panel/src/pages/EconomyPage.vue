<script setup lang="ts">

import SectionTitle from '@/components/SectionTitle.vue';
import ChartCard from '@/components/ChartCard.vue';
import StatTile from '@/components/StatTile.vue';
import { num } from '@/utils/format';
import { computed, onMounted, ref, shallowRef } from 'vue';
import EChart from '@/components/EChart.vue';
import StateBlock from '@/components/StateBlock.vue';
import { agoraEconomy, type CurrencyLine, type EconomySnapshot } from '@/api/agoraEconomy';
import type { EChartsOption } from 'echarts';
import { timeLineOption } from '@/utils/chart';
import { compact } from '@/utils/format';
import { useServerStore } from '@/stores/server';
import { localeIntl, t } from '@/i18n';

const srv = useServerStore();

/**
 * `/info` ne donne qu'une phrase du type « 3 commerces, 12 contrats » :
 * on en extrait les deux nombres pour en faire deux indicateurs distincts.
 */
/* --- Agrégats relevés par le mod Eco Agora --- */
const snapshot = ref<EconomySnapshot | null>(null);
const historyOption = shallowRef<EChartsOption | null>(null);
const modLoading = ref(true);
/** Chaque joueur peut créer sa propre monnaie : par défaut on masque ce bruit. */
const hidePersonal = ref(true);

/** Une monnaie personnelle : un seul détenteur, ou aucun solde fini. */
function isPersonal(l: CurrencyLine): boolean {
  return l.unlimited === true || (l.holders ?? 0) <= 1;
}

const visibleLines = computed<CurrencyLine[]>(() => {
  const lines = snapshot.value?.lines ?? [];
  return hidePersonal.value ? lines.filter((l) => !isPersonal(l)) : lines;
});

const hiddenCount = computed(
  () => (snapshot.value?.lines?.length ?? 0) - visibleLines.value.length,
);

/** Un solde non fini se lit « illimité », jamais « ∞ G ». */
function money(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return t('economy.unlimited');
  return compact(value);
}

onMounted(async () => {
  snapshot.value = await agoraEconomy.latest().catch(() => null);
  const hist = await agoraEconomy.history(14).catch(() => null);
  if (hist && hist.series && hist.series.length) {
    historyOption.value = timeLineOption([
      { name: t('economy.totalHoldings'), points: hist.series.map((p) => [p.hour, p.totalHoldings]) },
      { name: t('economy.treasury'), points: hist.series.map((p) => [p.hour, p.governmentHoldings]) },
      { name: t('economy.citizenHoldings'), points: hist.series.map((p) => [p.hour, p.personalHoldings]) },
    ]);
  }
  modLoading.value = false;
});

const marketCounts = computed(() => {
  const desc = srv.info?.EconomyDesc ?? '';
  const numbers = desc.match(/\d+/g) ?? [];
  return {
    stores: numbers[0] !== undefined ? Number(numbers[0]) : null,
    contracts: numbers[1] !== undefined ? Number(numbers[1]) : null,
  };
});
</script>

<template>
  <div class="econ">
    <SectionTitle
      :level="1"
      :title="$t('economy.title')"
      :hint="$t('economy.hint')"
    />

    <div class="grid-tiles">
      <StatTile
        :label="$t('economy.stores')"
        :value="marketCounts.stores !== null ? num(marketCounts.stores) : '--'"
        tone="primary"
      />
      <StatTile
        :label="$t('economy.contracts')"
        :value="marketCounts.contracts !== null ? num(marketCounts.contracts) : '--'"
        tone="info"
      />
    </div>

    <!-- Relevés du mod : totaux réels des comptes, ce que l API d Eco n expose pas -->
    <section v-if="snapshot && snapshot.available" class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ $t('economy.realHoldings') }}</h3>
          <p class="card__sub">
            {{ $t('economy.realHoldingsHint', { date: snapshot.hour ? new Date(snapshot.hour).toLocaleString(localeIntl()) : '--' }) }}
          </p>
        </div>
      </div>

      <div class="grid-tiles">
        <StatTile :label="$t('economy.totalHoldings')" :value="money(snapshot.totalHoldings)" tone="primary" />
        <StatTile :label="$t('economy.treasury')" :value="money(snapshot.governmentHoldings)" tone="warning" />
        <StatTile :label="$t('economy.citizenHoldings')" :value="money(snapshot.personalHoldings)" tone="success" />
        <StatTile :label="$t('economy.accounts')" :value="num(snapshot.accounts ?? 0)" tone="info" />
        <StatTile :label="$t('economy.currencies')" :value="num(snapshot.currencies ?? 0)" tone="muted" />
      </div>

      <div class="u-row u-spread u-wrap econ__filter">
        <label class="checkbox">
          <input v-model="hidePersonal" type="checkbox" />
          <span>{{ $t('economy.hidePersonal') }}</span>
        </label>
        <span v-if="hidePersonal && hiddenCount > 0" class="u-faint">
          {{ $t('economy.hiddenCount', { n: hiddenCount }) }}
        </span>
      </div>

      <div v-if="visibleLines.length" class="table-wrap econ__lines">
        <table class="table table--compact">
          <thead>
            <tr><th>{{ $t('economy.cols.currency') }}</th><th class="u-right">{{ $t('economy.totalHoldings') }}</th><th class="u-right">{{ $t('economy.treasury') }}</th><th class="u-right">{{ $t('economy.cols.holders') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in visibleLines" :key="l.name">
              <td><strong>{{ l.name }}</strong></td>
              <td class="u-right">
                <span v-if="l.unlimited" class="u-faint">{{ $t('economy.unlimited') }}</span>
                <span v-else>{{ num(l.total, 2) }}</span>
              </td>
              <td class="u-right">{{ num(l.government, 2) }}</td>
              <td class="u-right">
                {{ num(l.holders) }}
                <span v-if="l.unlimitedHolders" class="u-faint">{{ $t('economy.unlimitedHolders', { n: l.unlimitedHolders }) }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StateBlock
        v-else
        kind="empty"
        :title="$t('economy.noBacked')"
        :text="$t('economy.noBackedText')"
      />
    </section>

    <section v-if="historyOption" class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ $t('economy.history') }}</h3>
          <p class="card__sub">{{ $t('economy.historyHint') }}</p>
        </div>
      </div>
      <EChart :option="historyOption" height="280px" />
    </section>

    <StateBlock
      v-else-if="!modLoading && (!snapshot || !snapshot.available)"
      kind="empty"
      :title="$t('economy.modUnavailable')"
      :text="$t('economy.modUnavailableText')"
    />

    <div class="econ__split">
      <ChartCard
        :title="$t('economy.charts.wealth')"
        :hint="$t('economy.charts.wealthHint')"
        :names="['PersonalWealthInDefaultCurrency', 'GovernmentHoldingsInDefaultCurrency']"
        height="290px"
      />
      <ChartCard
        :title="$t('economy.charts.gdp')"
        :hint="$t('economy.charts.gdpHint')"
        :names="['GDP']"
        height="290px"
        area
      />
    </div>

    <div class="econ__split">
      <ChartCard
        :title="$t('economy.charts.debt')"
        :hint="$t('economy.charts.debtHint')"
        :names="['Debt', 'DebtPerActiveCitizen']"
        height="260px"
      />
      <ChartCard
        :title="$t('economy.charts.trades')"
        :hint="$t('economy.charts.tradesHint')"
        :names="['TradesInLast7Days', 'TaxedTransactions']"
        height="260px"
      />
    </div>

    <div class="econ__split">
      <ChartCard
        :title="$t('economy.charts.currencies')"
        :hint="$t('economy.charts.currenciesHint')"
        :names="['ActiveCurrencies']"
        height="230px"
        area
      />
      <ChartCard
        :title="$t('economy.charts.activity')"
        :hint="$t('economy.charts.activityHint')"
        :names="['CurrencyTrade', 'BarterTrade', 'MintCurrency']"
        height="230px"
      />
    </div>

    <ChartCard
      :title="$t('economy.charts.contracts')"
      :hint="$t('economy.charts.contractsHint')"
      :names="['PostedContract', 'JoinedContract', 'CompletedContract', 'FailedContract']"
      height="270px"
    />
  </div>
</template>

<style scoped>
.econ { display: grid; gap: var(--sp-5); }
.econ__filter { margin-top: var(--sp-4); }
.econ__lines { margin-top: var(--sp-3); }
.econ__split { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); }
@media (max-width: 900px) { .econ__split { grid-template-columns: 1fr; } }
</style>
