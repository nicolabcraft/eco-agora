<script setup lang="ts">
import Icon from './Icon.vue';

withDefaults(
  defineProps<{
    kind?: 'loading' | 'empty' | 'error' | 'locked';
    title?: string;
    text?: string;
  }>(),
  { kind: 'empty' },
);

const ICONS: Record<string, string> = {
  empty: 'layers',
  error: 'alert',
  locked: 'shield',
};
</script>

<template>
  <div class="state">
    <div v-if="kind === 'loading'" class="state__spin"><span class="spinner" /></div>
    <div v-else class="state__glyph" :class="`state__glyph--${kind}`">
      <Icon :name="ICONS[kind]" :size="22" />
    </div>
    <div v-if="title" class="state__title">{{ title }}</div>
    <p v-if="text" class="state__text">{{ text }}</p>
    <div v-if="$slots.default" class="state__actions"><slot /></div>
  </div>
</template>

<style scoped>
.state__spin { display: grid; place-items: center; margin-bottom: var(--sp-3); }
.state__glyph {
  display: grid; place-items: center; width: 46px; height: 46px; margin: 0 auto var(--sp-3);
  border-radius: 50%; background: rgba(255, 255, 255, 0.05); color: var(--text-faint);
}
.state__glyph--error { background: rgba(229, 84, 75, 0.12); color: #ff9b94; }
.state__glyph--locked { background: rgb(var(--primary-rgb) / 0.12); color: #ffa163; }
.state__actions { margin-top: var(--sp-4); display: flex; justify-content: center; gap: var(--sp-2); }
</style>
