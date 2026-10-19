<script setup lang="ts">
import { computed } from 'vue';
import { useMeteorStore } from '@/stores/meteor';
import { t } from '@/i18n';

/**
 * Compte a rebours avant l'impact de l'asteroide.
 *
 * `grand` : carte du tableau de bord. `compact` : pastille de la barre du haut.
 * Sans le mod du serveur, seul le nombre de jours est connu : on n'affiche alors
 * ni heures ni minutes, qui seraient inventees.
 */
const props = withDefaults(defineProps<{ variante?: 'grand' | 'compact' }>(), { variante: 'grand' });

const meteor = useMeteorStore();

const visible = computed(
  () => meteor.detruit || meteor.impacte || (meteor.actif && meteor.parts !== null),
);

const blocs = computed(() => {
  const p = meteor.parts;
  if (!p) return [];
  if (!p.precis) return [{ valeur: p.jours, libelle: t('meteorCountdown.jours', {}, p.jours) }];
  return [
    { valeur: p.jours, libelle: t('meteorCountdown.unite.jours') },
    { valeur: p.heures, libelle: t('meteorCountdown.unite.heures') },
    { valeur: p.minutes, libelle: t('meteorCountdown.unite.minutes') },
    { valeur: p.secondes, libelle: t('meteorCountdown.unite.secondes') },
  ];
});

const resume = computed(() => {
  const p = meteor.parts;
  if (!p) return '';
  if (!p.precis) return t('meteorCountdown.resume.approx', { j: p.jours });
  if (p.jours > 0) return t('meteorCountdown.resume.jhm', { j: p.jours, h: p.heures, m: String(p.minutes).padStart(2, '0') });
  return t('meteorCountdown.resume.hms', { h: p.heures, m: String(p.minutes).padStart(2, '0'), s: String(p.secondes).padStart(2, '0') });
});

</script>

<template>
  <!-- Une seule racine (chaine v-if / v-else-if) : les classes passees par le parent
       s'appliquent. Une racine en <template> les faisait ignorer. -->
  <span
      v-if="visible && props.variante === 'compact'"
      class="met-chip"
      :class="`met-chip--${meteor.ton}`"
      :title="meteor.detruit ? $t('meteorCountdown.detruitAide') : $t('meteorCountdown.restantAide')"
    >
      <span aria-hidden="true">☄️</span>
      <span v-if="meteor.detruit">{{ $t('meteorCountdown.detruit') }}</span>
      <span v-else-if="meteor.impacte">{{ $t('meteorCountdown.impact') }}</span>
      <strong v-else>{{ resume }}</strong>
    </span>

  <section v-else-if="visible" class="card met" :class="`met--${meteor.ton}`">
      <template v-if="meteor.detruit">
        <h3 class="met__titre">☄️ {{ $t('meteorCountdown.detruitTitre') }}</h3>
        <p class="met__sous">{{ $t('meteorCountdown.detruitSous') }} 🎉</p>
      </template>

      <template v-else-if="meteor.impacte">
        <h3 class="met__titre">☄️ {{ $t('meteorCountdown.frappeTitre') }}</h3>
        <p class="met__sous">{{ $t('meteorCountdown.frappeSous') }}</p>
      </template>

      <template v-else>
        <h3 class="met__titre">☄️ {{ $t('meteorCountdown.impactTitre') }}</h3>

        <div class="met__compte" :class="{ 'met__compte--jours': !meteor.parts?.precis }">
          <div v-for="b in blocs" :key="b.libelle" class="met__bloc">
            <strong>{{ meteor.parts?.precis ? String(b.valeur).padStart(2, '0') : b.valeur }}</strong>
            <span>{{ b.libelle }}</span>
          </div>
        </div>

        <p v-if="meteor.enAttente" class="met__note">
          {{ $t('meteorCountdown.enAttente') }}
        </p>
        <p v-else-if="meteor.pause" class="met__note">
          ⏸ {{ $t('meteorCountdown.pause') }}
        </p>
      </template>
  </section>
</template>

<style scoped>
/* --- Pastille --- */
.met-chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 10px; border-radius: var(--r-pill);
  border: 1px solid var(--hairline); background: var(--surface-inset);
  font-size: 12.5px; white-space: nowrap; font-variant-numeric: tabular-nums;
}
.met-chip--warning { border-color: rgba(240, 196, 25, 0.45); color: #f0c419; }
.met-chip--danger { border-color: rgba(255, 107, 107, 0.55); color: #ff8a8a; }
.met-chip--success { border-color: rgba(111, 207, 127, 0.5); color: #6fcf7f; }

/* --- Carte --- */
.met { display: grid; gap: var(--sp-4); justify-items: center; text-align: center; border-left: 3px solid var(--primary); }
.met--warning { border-left-color: #f0c419; }
.met--danger { border-left-color: #ff6b6b; }
.met--success { border-left-color: #6fcf7f; }

.met__titre { margin: 0; font-size: 16px; }
.met__sous { margin: 0; color: var(--text-muted); font-size: 13px; }

.met__compte { display: grid; grid-template-columns: repeat(4, 1fr); gap: var(--sp-3); width: min(100%, 760px); margin-inline: auto; }
.met__compte--jours { grid-template-columns: minmax(0, 200px); justify-content: center; }
.met__bloc {
  display: grid; gap: 4px; text-align: center; padding: var(--sp-4) var(--sp-2);
  background: var(--surface-inset); border: 1px solid var(--hairline); border-radius: var(--r-md);
}
.met__bloc strong { font-size: clamp(30px, 4.2vw, 46px); line-height: 1.05; font-variant-numeric: tabular-nums; }
.met__bloc span {
  color: var(--text-faint); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
}
.met--danger .met__bloc strong { color: #ff8a8a; }

.met__note { margin: 0; color: var(--text-faint); font-size: 12px; }

@media (max-width: 520px) {
  .met__compte { grid-template-columns: repeat(2, 1fr); }
}
</style>
