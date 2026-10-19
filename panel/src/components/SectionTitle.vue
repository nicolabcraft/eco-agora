<script setup lang="ts">
defineProps<{ title: string; hint?: string; level?: 1 | 2 }>();
</script>

<template>
  <header class="section-title">
    <div class="section-title__row">
      <h1 v-if="level === 1">{{ title }}</h1>
      <h2 v-else>{{ title }}</h2>
      <slot name="actions" />
    </div>
    <div class="section-title__line" />
    <p v-if="hint" class="section-title__hint">{{ hint }}</p>
  </header>
</template>
