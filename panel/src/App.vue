<script setup lang="ts">
import AppShell from '@/components/AppShell.vue';
import ToastHost from '@/components/ToastHost.vue';
import LaunchGate from '@/components/LaunchGate.vue';
</script>

<template>
  <AppShell>
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
  <ToastHost />
  <LaunchGate />
</template>

<style>
.page-enter-active, .page-leave-active { transition: opacity 0.16s var(--ease), transform 0.16s var(--ease); }
.page-enter-from { opacity: 0; transform: translateY(6px); }
.page-leave-to { opacity: 0; }
</style>
