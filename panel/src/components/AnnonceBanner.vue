<script setup lang="ts">
import Icon from './Icon.vue';
import { useAnnoncesStore } from '@/stores/annonces';
import type { AnnonceLevel } from '@/api/annonces';

const annonces = useAnnoncesStore();

const ICONS: Record<AnnonceLevel, string> = {
  info: 'info',
  important: 'campaign',
  alerte: 'alert',
};
</script>

<template>
  <div v-if="annonces.visibles.length" class="annonces">
    <article
      v-for="a in annonces.visibles"
      :key="a.id"
      class="annonce"
      :class="`annonce--${a.niveau}`"
    >
      <Icon :name="ICONS[a.niveau]" :size="20" class="annonce__icon" />
      <div class="u-fill">
        <div class="annonce__head">
          <strong>{{ a.titre }}</strong>
          <span v-if="a.epinglee" class="badge">Épinglée</span>
        </div>
        <p class="annonce__msg">{{ a.message }}</p>
        <a
          v-if="a.lienUrl"
          :href="a.lienUrl"
          target="_blank"
          rel="noopener"
          class="btn btn--ghost btn--sm annonce__link"
        >
          <span>{{ a.lienTexte || 'En savoir plus' }}</span>
          <Icon name="link" :size="13" />
        </a>
      </div>
      <button class="annonce__close" title="Masquer cette annonce" @click="annonces.hide(a.id)">
        <Icon name="close" :size="16" />
      </button>
    </article>
  </div>
</template>

<style scoped>
.annonces { display: grid; gap: var(--sp-3); margin-bottom: var(--sp-5); }
.annonce {
  display: flex; gap: var(--sp-3); align-items: flex-start;
  background: var(--surface); border: 1px solid var(--hairline);
  border-left: 3px solid var(--primary); border-radius: var(--r-md);
  padding: var(--sp-3) var(--sp-4); box-shadow: var(--shadow-card);
}
.annonce--info { border-left-color: var(--info); }
.annonce--important { border-left-color: var(--primary); }
.annonce--alerte { border-left-color: var(--danger); }
.annonce__icon { margin-top: 2px; color: var(--text-muted); }
.annonce--info .annonce__icon { color: #86c8ea; }
.annonce--important .annonce__icon { color: #ffa163; }
.annonce--alerte .annonce__icon { color: #ff9b94; }
.annonce__head { display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap; }
.annonce__msg { margin: 3px 0 0; font-size: 13.5px; color: var(--text-muted); white-space: pre-line; }
.annonce__link { margin-top: var(--sp-3); }
.annonce__close {
  background: transparent; border: 0; cursor: pointer; color: var(--text-faint);
  padding: 2px; border-radius: var(--r-sm); flex: none;
}
.annonce__close:hover { color: var(--text); background: rgba(255, 255, 255, 0.07); }
</style>
