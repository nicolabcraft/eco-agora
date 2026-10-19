<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

const props = withDefaults(
  defineProps<{ option: EChartsOption | null; height?: string; loading?: boolean }>(),
  { height: '280px', loading: false },
);

const host = ref<HTMLDivElement | null>(null);
const chart = shallowRef<echarts.ECharts | null>(null);
let observer: ResizeObserver | null = null;

function draw(): void {
  if (!host.value || !props.option) return;
  if (!chart.value) chart.value = echarts.init(host.value, undefined, { renderer: 'canvas' });
  chart.value.setOption(props.option, { notMerge: true });
}

onMounted(() => {
  draw();
  if (host.value) {
    observer = new ResizeObserver(() => chart.value?.resize());
    observer.observe(host.value);
  }
});

watch(() => props.option, draw, { deep: false });

onBeforeUnmount(() => {
  observer?.disconnect();
  chart.value?.dispose();
  chart.value = null;
});

defineExpose({
  /** Image PNG du graphe, pour l export. */
  toDataURL: () => chart.value?.getDataURL({ pixelRatio: 2, backgroundColor: '#161419' }) ?? null,
});
</script>

<template>
  <div class="echart" :style="{ height }">
    <div v-if="loading" class="echart__veil"><span class="spinner" /></div>
    <div ref="host" class="echart__canvas" />
  </div>
</template>

<style scoped>
.echart { position: relative; width: 100%; }
.echart__canvas { width: 100%; height: 100%; }
.echart__veil {
  position: absolute; inset: 0; z-index: 2; display: grid; place-items: center;
  background: rgba(22, 20, 25, 0.55);
}
</style>
