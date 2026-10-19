<script setup lang="ts">
import { computed, ref, toRef } from 'vue';
import EChart from './EChart.vue';
import StateBlock from './StateBlock.vue';
import Icon from './Icon.vue';
import { useSeriesGroup } from '@/composables/useSeries';
import { lineOption } from '@/utils/chart';
import { dateMonde } from '@/utils/format';

const props = withDefaults(
  defineProps<{
    title: string;
    hint?: string;
    names: string[];
    height?: string;
    area?: boolean;
    stack?: boolean;
  }>(),
  { height: '260px', area: false, stack: false },
);

const { series, loading, error, hasData, reload } = useSeriesGroup(toRef(props, 'names'), {
  area: props.area,
});

const option = computed(() =>
  series.value.length ? lineOption(series.value, { stack: props.stack }) : null,
);

const chart = ref<InstanceType<typeof EChart> | null>(null);

function exportCsv(): void {
  // Les series n'ont pas forcement les memes instants (les connectes, releves par
  // le mod, ne tombent pas sur ceux d'Eco) : on aligne sur l'union des instants,
  // chaque colonne ne portant que ses propres valeurs.
  const instants = [...new Set(series.value.flatMap((s) => s.times))].sort((a, b) => a - b);
  const index = series.value.map((s) => new Map(s.times.map((t, i) => [t, s.values[i]])));
  const rows: string[] = ['date;jour_du_monde;' + series.value.map((s) => s.name).join(';')];
  for (const t of instants) {
    rows.push([dateMonde(t), t, ...index.map((m) => m.get(t) ?? '')].join(';'));
  }
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${props.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
</script>

<template>
  <section class="card">
    <div class="card__head">
      <div>
        <h3 class="card__title">{{ title }}</h3>
        <p v-if="hint" class="card__sub">{{ hint }}</p>
      </div>
      <div class="u-row-tight">
        <button v-if="hasData" class="btn btn--ghost btn--sm" title="Exporter en CSV" @click="exportCsv">
          <Icon name="download" :size="14" />
        </button>
        <button class="btn btn--ghost btn--sm" title="Recharger" @click="reload()">
          <Icon name="refresh" :size="14" />
        </button>
      </div>
    </div>

    <StateBlock
      v-if="error"
      kind="error"
      title="Données indisponibles"
      :text="error"
    />
    <StateBlock
      v-else-if="!loading && !hasData"
      kind="empty"
      title="Pas encore d’historique"
      text="Le serveur enregistre un point par heure de jeu. Cette courbe se remplira au fil de la partie."
    />
    <EChart v-else ref="chart" :option="option" :height="height" :loading="loading" />
  </section>
</template>
