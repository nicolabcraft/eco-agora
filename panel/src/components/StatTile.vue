<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(
  defineProps<{
    label: string;
    value: string;
    suffix?: string;
    hint?: string;
    tone?: 'primary' | 'muted' | 'success' | 'warning' | 'danger' | 'info';
  }>(),
  { tone: 'primary' },
);

/**
 * Les valeurs textuelles (« LowCollaboration », « 0 commerces, 0 contrats »)
 * ne tiennent pas à la taille réservée aux nombres : on les affiche plus petit.
 */
const isText = computed(() => !/^[\d\s.,%°/+-]+$/.test(props.value));
</script>

<template>
  <div class="tile" :class="`tile--${tone}`">
    <div class="tile__label">{{ label }}</div>
    <div class="tile__value" :class="{ 'tile__value--text': isText }">
      {{ value }}<small v-if="suffix"> {{ suffix }}</small>
    </div>
    <div v-if="hint" class="tile__hint">{{ hint }}</div>
  </div>
</template>
