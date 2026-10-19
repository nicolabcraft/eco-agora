<script setup lang="ts">
import { computed } from 'vue';
import { DISCORD_PATH, ICON_PATHS } from './icons.generated';

/** Icônes Material Symbols (Google), figées en chemins SVG dans le bundle. */
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 18 });

const path = computed(() =>
  props.name === 'discord' ? DISCORD_PATH : (ICON_PATHS[props.name] ?? ICON_PATHS.grid),
);

/** Discord est un tracé maison en repère 24x24, Material Symbols en 0 -960 960 960. */
const box = computed(() => (props.name === 'discord' ? '0 0 24 24' : '0 -960 960 960'));
</script>

<template>
  <svg
    class="icon"
    :width="size"
    :height="size"
    :viewBox="box"
    fill="currentColor"
    aria-hidden="true"
    focusable="false"
  >
    <path :d="path" />
  </svg>
</template>

<style scoped>
.icon { flex: none; display: block; }
</style>
