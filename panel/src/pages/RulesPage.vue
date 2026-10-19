<script setup lang="ts">
import { computed } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import MeteorCountdown from '@/components/MeteorCountdown.vue';
import { useSiteStore } from '@/stores/site';

/**
 * Reglement du serveur, redige dans Administration > Personnalisation.
 * Tout est affiche comme du texte : aucun balisage n'est interprete.
 */
const reglement = computed(() => useSiteStore().config.reglement);

/** Ancre stable par section, pour le sommaire. */
const ancre = (i: number): string => `section-${i + 1}`;
</script>

<template>
  <div class="rules">
    <SectionTitle :level="1" :title="reglement.titre || $t('rules.title')" :hint="reglement.intro" />

    <nav class="card rules__sommaire" :aria-label="$t('rules.summary')">
      <a v-for="(s, i) in reglement.sections" :key="i" :href="`#${ancre(i)}`">
        <span class="rules__num">{{ i + 1 }}</span>
        <span>{{ s.emoji }} {{ s.titre }}</span>
      </a>
    </nav>

    <div class="rules__grille">
    <section
      v-for="(s, i) in reglement.sections"
      :id="ancre(i)"
      :key="i"
      class="card rules__section"
      :class="{ 'rules__section--final': s.finale }"
    >
      <h2 class="rules__titre">
        <span class="rules__num">{{ i + 1 }}</span>
        <span>{{ s.emoji }} {{ s.titre }}</span>
      </h2>
      <p v-if="s.intro" class="rules__intro">{{ s.intro }}</p>
      <ul v-if="s.regles.length" class="rules__liste">
        <li v-for="(r, j) in s.regles" :key="j">{{ r }}</li>
      </ul>
      <p v-if="s.alerte" class="rules__alerte">⚠️ {{ s.alerte }}</p>

      <template v-if="s.finale">
        <MeteorCountdown class="rules__meteor" />
        <ul v-if="s.fin.length" class="rules__fin">
          <li v-for="(f, j) in s.fin" :key="j">{{ f }}</li>
        </ul>
      </template>
    </section>
    </div>

    <p v-if="reglement.signature" class="rules__signature">{{ reglement.signature }}</p>
  </div>
</template>

<style scoped>
.rules { display: grid; gap: var(--sp-5); width: 100%; }

/* En-tete centre */
.rules :deep(.section-title) { text-align: center; }
.rules :deep(.section-title__row) { justify-content: center; }
.rules :deep(.section-title__line) { margin-inline: auto; }
.rules :deep(.section-title__hint) { margin-inline: auto; }

/* Sommaire : pastilles centrees */
.rules__sommaire { display: flex; flex-wrap: wrap; justify-content: center; gap: var(--sp-2); }
.rules__sommaire a {
  display: inline-flex; align-items: center; gap: var(--sp-2); padding: 6px 12px 6px 6px;
  border-radius: var(--r-pill); border: 1px solid var(--hairline);
  color: var(--text-muted); text-decoration: none; font-size: 13px;
}
.rules__sommaire a:hover { background: var(--surface-inset); color: var(--text); border-color: rgb(var(--primary-rgb) / 0.35); }

.rules__num {
  display: inline-grid; place-items: center; flex: none;
  width: 22px; height: 22px; border-radius: 50%;
  background: rgb(var(--primary-rgb) / 0.14); color: var(--primary);
  font-size: 11.5px; font-weight: 700;
}

/* Sections : grille qui remplit la largeur, lignes de texte lisibles */
.rules__grille {
  display: grid; gap: var(--sp-4); align-items: start;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr));
}
.rules__section { display: grid; gap: var(--sp-3); scroll-margin-top: 80px; height: 100%; align-content: start; }
.rules__titre { display: flex; align-items: center; gap: var(--sp-2); margin: 0; font-size: 17px; }
.rules__intro { margin: 0; color: var(--text-muted); }
.rules__liste { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; line-height: 1.5; }
.rules__liste li::marker { color: var(--primary); }
.rules__alerte {
  margin: 0; padding: var(--sp-3); border-radius: var(--r-md);
  background: rgba(240, 196, 25, 0.08); border: 1px solid rgba(240, 196, 25, 0.3); font-size: 13.5px;
}

/* Objectif : toute la largeur, centre */
.rules__section--final { grid-column: 1 / -1; text-align: center; justify-items: center; }
.rules__section--final .rules__titre { justify-content: center; }
.rules__section--final .rules__intro { max-width: 70ch; }
.rules__meteor { width: min(100%, 720px); margin-top: var(--sp-2); }
.rules__fin {
  list-style: none; margin: 0; padding: 0; font-weight: 600;
  display: flex; flex-wrap: wrap; justify-content: center; gap: var(--sp-2) var(--sp-5);
}

.rules__signature { text-align: center; font-size: 16px; font-weight: 600; margin: 0 0 var(--sp-6); }
</style>
