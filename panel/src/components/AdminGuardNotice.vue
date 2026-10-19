<script setup lang="ts">
import { computed } from 'vue';
import StateBlock from './StateBlock.vue';
import { t } from '@/i18n';

const props = defineProps<{ error: string | null }>();

/** On adapte l'explication au code renvoyé : 401 et 403 n'ont pas la même cause. */
const detail = computed(() => {
  const e = props.error ?? '';
  if (e.includes('401')) {
    return t('adminGuardNotice.e401');
  }
  if (e.includes('403')) {
    return t('adminGuardNotice.e403');
  }
  if (e.includes('404')) {
    return t('adminGuardNotice.e404');
  }
  // Message de http.ts (« Serveur injoignable »), dans la langue affichee.
  if (e.includes('injoignable') || e.includes(t('api.injoignable'))) {
    return t('adminGuardNotice.injoignable');
  }
  return t('adminGuardNotice.refuse');
});
</script>

<template>
  <StateBlock v-if="error" kind="locked" :title="error" :text="detail" />
</template>
