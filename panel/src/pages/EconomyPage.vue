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
  if (value === undefined || !Number.isFinite(value)) return 'illimité';
  return compact(value);
}

onMounted(async () => {
  snapshot.value = await agoraEconomy.latest().catch(() => null);
  const hist = await agoraEconomy.history(14).catch(() => null);
  if (hist && hist.series && hist.series.length) {
    historyOption.value = timeLineOption([
      { name: 'Avoirs totaux', points: hist.series.map((p) => [p.hour, p.totalHoldings]) },
      { name: 'Trésor public', points: hist.series.map((p) => [p.hour, p.governmentHoldings]) },
      { name: 'Avoirs des citoyens', points: hist.series.map((p) => [p.hour, p.personalHoldings]) },
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
      title="Économie"
      hint="Monnaies, richesse, dette et échanges du monde."
    />

    <div class="grid-tiles">
      <StatTile
        label="Commerces"
        :value="marketCounts.stores !== null ? num(marketCounts.stores) : '--'"
        tone="primary"
      />
      <StatTile
        label="Contrats"
        :value="marketCounts.contracts !== null ? num(marketCounts.contracts) : '--'"
        tone="info"
      />
    </div>

    <!-- Relevés du mod : totaux réels des comptes, ce que l API d Eco n expose pas -->
    <section v-if="snapshot && snapshot.available" class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Avoirs réels des comptes</h3>
          <p class="card__sub">
            Relevé du mod, toutes devises confondues. Dernière mesure :
            {{ snapshot.hour ? new Date(snapshot.hour).toLocaleString('fr-FR') : '--' }}.
          </p>
        </div>
      </div>

      <div class="grid-tiles">
        <StatTile label="Avoirs totaux" :value="money(snapshot.totalHoldings)" tone="primary" />
        <StatTile label="Trésor public" :value="money(snapshot.governmentHoldings)" tone="warning" />
        <StatTile label="Avoirs des citoyens" :value="money(snapshot.personalHoldings)" tone="success" />
        <StatTile label="Comptes" :value="num(snapshot.accounts ?? 0)" tone="info" />
        <StatTile label="Devises" :value="num(snapshot.currencies ?? 0)" tone="muted" />
      </div>

      <div class="u-row u-spread u-wrap econ__filter">
        <label class="checkbox">
          <input v-model="hidePersonal" type="checkbox" />
          <span>Masquer les monnaies personnelles</span>
        </label>
        <span v-if="hidePersonal && hiddenCount > 0" class="u-faint">
          {{ hiddenCount }} monnaie(s) personnelle(s) masquée(s)
        </span>
      </div>

      <div v-if="visibleLines.length" class="table-wrap econ__lines">
        <table class="table table--compact">
          <thead>
            <tr><th>Devise</th><th class="u-right">Avoirs totaux</th><th class="u-right">Trésor public</th><th class="u-right">Détenteurs</th></tr>
          </thead>
          <tbody>
            <tr v-for="l in visibleLines" :key="l.name">
              <td><strong>{{ l.name }}</strong></td>
              <td class="u-right">
                <span v-if="l.unlimited" class="u-faint">illimité</span>
                <span v-else>{{ num(l.total, 2) }}</span>
              </td>
              <td class="u-right">{{ num(l.government, 2) }}</td>
              <td class="u-right">
                {{ num(l.holders) }}
                <span v-if="l.unlimitedHolders" class="u-faint">+{{ l.unlimitedHolders }} illim.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <StateBlock
        v-else
        kind="empty"
        title="Aucune monnaie gagée"
        text="Toutes les monnaies du serveur sont personnelles. Décochez le filtre pour les afficher."
      />
    </section>

    <section v-if="historyOption" class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Évolution des avoirs</h3>
          <p class="card__sub">Relevé horaire sur quatorze jours.</p>
        </div>
      </div>
      <EChart :option="historyOption" height="280px" />
    </section>

    <StateBlock
      v-else-if="!modLoading && (!snapshot || !snapshot.available)"
      kind="empty"
      title="Relevés économiques indisponibles"
      text="Le mod Eco Agora fournit les avoirs réels des comptes. Il n est chargé qu au démarrage du serveur : redémarrez-le pour activer ces relevés."
    />

    <div class="econ__split">
      <ChartCard
        title="Richesse et trésor public"
        hint="Patrimoine des citoyens face aux avoirs du gouvernement"
        :names="['PersonalWealthInDefaultCurrency', 'GovernmentHoldingsInDefaultCurrency']"
        height="290px"
      />
      <ChartCard
        title="Produit intérieur brut"
        hint="Richesse produite par le monde"
        :names="['GDP']"
        height="290px"
        area
      />
    </div>

    <div class="econ__split">
      <ChartCard
        title="Endettement"
        hint="Dette totale et dette moyenne par citoyen actif"
        :names="['Debt', 'DebtPerActiveCitizen']"
        height="260px"
      />
      <ChartCard
        title="Échanges"
        hint="Volume échangé sur sept jours et transactions taxées"
        :names="['TradesInLast7Days', 'TaxedTransactions']"
        height="260px"
      />
    </div>

    <div class="econ__split">
      <ChartCard
        title="Monnaies en circulation"
        hint="Nombre de devises actives"
        :names="['ActiveCurrencies']"
        height="230px"
        area
      />
      <ChartCard
        title="Activité commerciale"
        hint="Commerce monétaire, troc et frappe de monnaie"
        :names="['CurrencyTrade', 'BarterTrade', 'MintCurrency']"
        height="230px"
      />
    </div>

    <ChartCard
      title="Contrats"
      hint="Contrats publiés, rejoints, terminés et échoués"
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
