<script setup lang="ts">
import { computed } from 'vue';
import StateBlock from './StateBlock.vue';

const props = defineProps<{ error: string | null }>();

/** On adapte l'explication au code renvoyé : 401 et 403 n'ont pas la même cause. */
const detail = computed(() => {
  const e = props.error ?? '';
  if (e.includes('401')) {
    return 'Le serveur ne reconnaît pas votre session pour cet appel. Rouvrez le panel depuis le jeu pour obtenir un jeton frais.';
  }
  if (e.includes('403')) {
    return 'Votre compte est authentifié mais n’a pas les droits requis. Certains points d’accès d’Eco (exports, configuration des greffons) exigent un compte de niveau développeur, ou l’option AllowDebugCalls activée dans Configs/Users.eco.';
  }
  if (e.includes('404')) {
    return 'Ce point d’accès n’existe pas sur cette version du serveur.';
  }
  if (e.includes('injoignable')) {
    return 'Le serveur de jeu ne répond pas. Vérifiez qu’il tourne toujours.';
  }
  return 'Le serveur a refusé cet appel. Le code exact est indiqué ci-dessus.';
});
</script>

<template>
  <StateBlock v-if="error" kind="locked" :title="error" :text="detail" />
</template>
