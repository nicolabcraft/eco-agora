<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import ChartCard from '@/components/ChartCard.vue';
import StatTile from '@/components/StatTile.vue';
import StateBlock from '@/components/StateBlock.vue';
import { loadCatalog } from '@/composables/useSeries';
import { useServerStore } from '@/stores/server';
import type { StatInfo } from '@/api/types';
import { compact, num } from '@/utils/format';
import { localeIntl } from '@/i18n';

const srv = useServerStore();
const catalog = ref<StatInfo[]>([]);
const loading = ref(true);
const species = ref<string[]>([]);

/** Les populations d'espèces sont des séries « Organisms » : on les propose au choix. */
const speciesOptions = computed(() =>
  catalog.value
    .filter((s) => s.Unit === 'Organisms' && s.Name.endsWith('Species'))
    .sort((a, b) => a.DisplayName.localeCompare(b.DisplayName, localeIntl())),
);

onMounted(async () => {
  try {
    catalog.value = await loadCatalog();
    species.value = speciesOptions.value.slice(0, 3).map((s) => s.Name);
  } finally {
    loading.value = false;
  }
});

function toggleSpecies(name: string): void {
  species.value = species.value.includes(name)
    ? species.value.filter((n) => n !== name)
    : [...species.value, name].slice(-6);
}
</script>

<template>
  <div class="eco">
    <SectionTitle
      :level="1"
      :title="$t('ecology.title')"
      :hint="$t('ecology.hint')"
    />

    <div class="grid-tiles">
      <StatTile :label="$t('ecology.livingPlants')" :value="compact(srv.info?.Plants ?? 0)" tone="success" />
      <StatTile :label="$t('ecology.livingAnimals')" :value="compact(srv.info?.Animals ?? 0)" tone="info" />
      <StatTile
        :label="$t('ecology.daysToMeteor')"
        :value="srv.info?.HasMeteor ? num(srv.info?.DaysUntilMeteor ?? 0) : $t('ecology.none')"
        :tone="(srv.info?.DaysUntilMeteor ?? 999) <= 30 ? 'warning' : 'muted'"
      />
    </div>

    <div class="eco__split">
      <ChartCard
        :title="$t('ecology.charts.co2')"
        :hint="$t('ecology.charts.co2Hint')"
        :names="['TotalCO2', 'LifetimeCO2FromPollution', 'LifetimeCO2FromPlants', 'LifetimeCO2FromAnimals']"
        height="280px"
      />
      <ChartCard
        :title="$t('ecology.charts.temperature')"
        :hint="$t('ecology.charts.temperatureHint')"
        :names="['AverageGlobalTemperature']"
        height="280px"
        area
      />
    </div>

    <ChartCard
      :title="$t('ecology.charts.pollution')"
      :hint="$t('ecology.charts.pollutionHint')"
      :names="[
        'TotalGroundPollution',
        'TotalSoilPollution',
        'TotalChemicalPollution',
        'TotalHeavyMineralPollution',
        'TotalAcidRainPollution',
      ]"
      height="300px"
    />

    <div class="eco__split">
      <ChartCard
        :title="$t('ecology.charts.populations')"
        :hint="$t('ecology.charts.populationsHint')"
        :names="['PlantPopulation', 'TreePopulation', 'AnimalPopulation']"
        height="280px"
      />
      <ChartCard
        :title="$t('ecology.charts.citizens')"
        :hint="$t('ecology.charts.citizensHint')"
        :names="['CitizenPopulation', 'ActiveCitizenPopulation']"
        height="280px"
      />
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ $t('ecology.species.title') }}</h3>
          <p class="card__sub">
            {{ $t('ecology.species.hint', { n: num(speciesOptions.length) }) }}
          </p>
        </div>
      </div>

      <StateBlock v-if="loading" kind="loading" :title="$t('ecology.species.loading')" />
      <template v-else>
        <div class="eco__chips">
          <button
            v-for="s in speciesOptions"
            :key="s.Name"
            class="eco__chip"
            :class="{ 'is-on': species.includes(s.Name) }"
            @click="toggleSpecies(s.Name)"
          >
            {{ s.DisplayName.replace(' Species', '') }}
          </button>
        </div>
        <ChartCard
          v-if="species.length"
          :title="$t('ecology.species.chart')"
          :names="species"
          height="320px"
          class="eco__inner"
        />
        <StateBlock
          v-else
          kind="empty"
          :title="$t('ecology.species.none')"
          :text="$t('ecology.species.noneText')"
        />
      </template>
    </section>
  </div>
</template>

<style scoped>
.eco { display: grid; gap: var(--sp-5); }
.eco__split { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); }
.eco__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: var(--sp-4); max-height: 168px; overflow-y: auto; }
.eco__chip {
  border: 0; cursor: pointer; padding: 5px 12px; border-radius: 99px; font-size: 12px;
  background: rgba(255, 255, 255, 0.06); color: var(--text-muted); transition: all 0.14s var(--ease);
}
.eco__chip:hover { background: rgba(255, 255, 255, 0.12); color: var(--text); }
.eco__chip.is-on { background: var(--primary); color: var(--text-on-primary); font-weight: 600; }
.eco__inner { border: 0; box-shadow: none; padding: 0; background: transparent; }
@media (max-width: 900px) { .eco__split { grid-template-columns: 1fr; } }
</style>
