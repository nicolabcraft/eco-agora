<script setup lang="ts">
import { useToastStore } from '@/stores/toasts';
const toasts = useToastStore();
</script>

<template>
  <div class="toasts" role="status" aria-live="polite">
    <TransitionGroup name="toast">
      <div v-for="t in toasts.items" :key="t.id" class="toast" :class="`toast--${t.kind}`">
        <div class="u-fill">
          <div class="toast__title">{{ t.title }}</div>
          <div v-if="t.text" class="u-muted">{{ t.text }}</div>
        </div>
        <button class="toast__close" title="Fermer" @click="toasts.dismiss(t.id)">x</button>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active, .toast-leave-active { transition: all 0.24s var(--ease); }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(16px); }
</style>
