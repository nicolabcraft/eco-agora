<script setup lang="ts">
import StateBlock from '@/components/StateBlock.vue';
</script>

<template>
  <div class="card">
    <StateBlock
      kind="error"
      title="Page introuvable"
      text="Cette adresse ne correspond à aucune page du panel."
    >
      <RouterLink to="/" class="btn btn--primary btn--sm">Tableau de bord</RouterLink>
    </StateBlock>
  </div>
</template>
