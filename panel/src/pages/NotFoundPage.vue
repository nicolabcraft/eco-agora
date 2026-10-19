<script setup lang="ts">
import StateBlock from '@/components/StateBlock.vue';
</script>

<template>
  <div class="card">
    <StateBlock
      kind="error"
      :title="$t('notFound.title')"
      :text="$t('notFound.text')"
    >
      <RouterLink to="/" class="btn btn--primary btn--sm">{{ $t('notFound.dashboard') }}</RouterLink>
    </StateBlock>
  </div>
</template>
