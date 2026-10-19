<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import Icon from './Icon.vue';
import { useSiteStore } from '@/stores/site';
import { localeIntl, t } from '@/i18n';

/**
 * Rideau affiche avant l'ouverture : decompte, acces anticipe par mot de passe,
 * puis animation d'ouverture le jour J. Une fois la date passee il ne revient
 * plus jamais — c'est la date qui decide, il n'y a rien a retirer a la main.
 */

type Phase = 'compte' | 'ouverture';

/** Duree de l'animation d'ouverture, en millisecondes. */
const DUREE_ANIMATION = 2600;

/**
 * Reglages du rideau : Administration > Personnalisation. Le mot de passe n'est
 * PAS une securite (il est compare ici, dans le navigateur, et lisible par tous) :
 * c'est un acces anticipe pour les testeurs, rien de plus.
 */
const site = useSiteStore();
const LAUNCH = site.config.ouverture;

/**
 * Les memorisations portent la date : si l'administrateur repousse l'ouverture,
 * le rideau revient, y compris pour les testeurs deja passes.
 */
const LAUNCH_KEYS = {
  deverrouille: `agora.launch.unlocked:${LAUNCH.date}`,
  ouvert: `agora.launch.opened:${LAUNCH.date}`,
};

const cible = Date.parse(LAUNCH.date);
const phase = ref<Phase>('compte');
const restant = ref(Math.max(0, cible - Date.now()));
const visible = ref(false);
const sortie = ref(false);
const saisie = ref('');
const erreur = ref(false);

let horloge: number | undefined;
let minuterie: number | undefined;

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string): void {
  try {
    localStorage.setItem(cle, '1');
  } catch {
    /* navigation privee : le rideau reviendra, sans consequence */
  }
}

/** Ferme le rideau pour de bon, avec un fondu. */
function fermer(): void {
  sortie.value = true;
  window.setTimeout(() => {
    visible.value = false;
  }, 480);
}

function verifier(): void {
  if (!LAUNCH.motDePasse || saisie.value.trim() !== LAUNCH.motDePasse) {
    erreur.value = true;
    return;
  }
  erreur.value = false;
  ecrire(LAUNCH_KEYS.deverrouille);
  fermer();
}

function ouvrir(): void {
  if (phase.value === 'ouverture') return;
  phase.value = 'ouverture';
  ecrire(LAUNCH_KEYS.ouvert);
  minuterie = window.setTimeout(fermer, DUREE_ANIMATION);
}

function battre(): void {
  restant.value = Math.max(0, cible - Date.now());
  if (restant.value === 0) {
    if (horloge !== undefined) {
      window.clearInterval(horloge);
      horloge = undefined;
    }
    ouvrir();
  }
}

onMounted(() => {
  if (!LAUNCH.actif) return;
  if (Number.isNaN(cible)) return; // date mal ecrite : on n'affiche rien
  if (Date.now() >= cible) return; // deja ouvert : plus jamais de rideau
  if (lire(LAUNCH_KEYS.deverrouille)) return; // testeur deja passe

  visible.value = true;
  horloge = window.setInterval(battre, 1000);
});

onBeforeUnmount(() => {
  if (horloge !== undefined) window.clearInterval(horloge);
  if (minuterie !== undefined) window.clearTimeout(minuterie);
});

const parts = computed(() => {
  const total = Math.floor(restant.value / 1000);
  return [
    { valeur: Math.floor(total / 86400), libelle: t('launchGate.jours') },
    { valeur: Math.floor((total % 86400) / 3600), libelle: t('launchGate.heures') },
    { valeur: Math.floor((total % 3600) / 60), libelle: t('launchGate.minutes') },
    { valeur: total % 60, libelle: t('launchGate.secondes') },
  ];
});

const dateLisible = computed(() =>
  new Date(cible).toLocaleString(localeIntl(), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }),
);
</script>

<template>
  <div
    v-if="visible"
    class="gate"
    :class="{ 'gate--sortie': sortie }"
  >
    <div class="gate__carte">
      <img :src="site.logo" alt="" class="gate__logo" width="72" height="72" />

      <template v-if="phase === 'compte'">
        <h1 class="gate__titre">{{ LAUNCH.titre }}</h1>
        <p v-if="LAUNCH.sousTitre" class="gate__sous">{{ LAUNCH.sousTitre }}</p>

        <div class="gate__compte">
          <div v-for="p in parts" :key="p.libelle" class="gate__bloc">
            <strong>{{ String(p.valeur).padStart(2, '0') }}</strong>
            <span>{{ p.libelle }}</span>
          </div>
        </div>

        <form v-if="LAUNCH.motDePasse" class="gate__form" @submit.prevent="verifier">
          <label class="field">
            <span class="field__label">{{ $t('launchGate.accesAnticipe') }}</span>
            <input
              v-model="saisie"
              class="input"
              type="password"
              :placeholder="$t('launchGate.motDePasse')"
              autocomplete="off"
              data-1p-ignore
              data-lpignore="true"
              @input="erreur = false"
            />
          </label>
          <button class="btn btn--primary" type="submit">
            <Icon name="check" :size="15" /><span>{{ $t('launchGate.entrer') }}</span>
          </button>
        </form>
        <p v-if="erreur" class="gate__erreur">{{ $t('launchGate.erreur') }}</p>

        <p class="gate__pied">{{ dateLisible }}</p>
      </template>

      <template v-else>
        <h1 class="gate__titre gate__titre--ouvert">{{ $t('launchGate.ouvert') }}</h1>
        <p class="gate__sous">{{ $t('launchGate.bienvenue', { nom: site.nom }) }}</p>
        <div class="gate__onde" />
      </template>
    </div>
  </div>
</template>

<style scoped>
.gate {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: grid;
  place-items: center;
  padding: var(--sp-4);
  background: radial-gradient(120% 120% at 50% 0%, #2a2532 0%, #141118 70%);
  transition: opacity 0.45s var(--ease), transform 0.45s var(--ease), filter 0.45s var(--ease);
}
.gate--sortie {
  opacity: 0;
  transform: scale(1.06);
  filter: blur(10px);
  pointer-events: none;
}

.gate__carte {
  width: min(560px, 100%);
  text-align: center;
  background: var(--surface-2);
  border: 1px solid var(--hairline);
  border-radius: var(--r-lg);
  padding: var(--sp-6) var(--sp-5);
  box-shadow: 0 24px 70px rgba(0, 0, 0, 0.5);
  animation: gate-entree 0.5s var(--ease) both;
}
@keyframes gate-entree {
  from { opacity: 0; transform: translateY(14px) scale(0.98); }
  to { opacity: 1; transform: none; }
}

.gate__logo { border-radius: var(--r-md); margin-bottom: var(--sp-3); }
.gate__titre { margin: 0 0 6px; font-size: 26px; letter-spacing: 0.01em; }
.gate__sous { margin: 0 0 var(--sp-5); color: var(--text-muted); font-size: 14px; }

.gate__compte {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--sp-2);
  margin-bottom: var(--sp-5);
}
.gate__bloc {
  display: grid;
  gap: 2px;
  padding: var(--sp-3) var(--sp-2);
  background: var(--surface-inset);
  border: 1px solid var(--hairline);
  border-radius: var(--r-md);
}
.gate__bloc strong { font-size: 30px; font-variant-numeric: tabular-nums; line-height: 1.1; }
.gate__bloc span {
  color: var(--text-faint);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.gate__form {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: var(--sp-2);
  align-items: end;
  text-align: left;
}
.gate__erreur { margin: var(--sp-2) 0 0; color: #ff8fa3; font-size: 12.5px; }
.gate__pied { margin: var(--sp-5) 0 0; color: var(--text-faint); font-size: 11.5px; }

/* --- Jour J --- */
.gate__titre--ouvert { animation: gate-eclat 0.9s var(--ease) both; }
@keyframes gate-eclat {
  0% { opacity: 0; transform: scale(0.8); letter-spacing: 0.2em; }
  60% { opacity: 1; transform: scale(1.05); }
  100% { opacity: 1; transform: none; letter-spacing: 0.01em; }
}
.gate__onde {
  width: 120px;
  height: 120px;
  margin: var(--sp-4) auto 0;
  border: 2px solid var(--primary);
  border-radius: 50%;
  animation: gate-onde 1.5s var(--ease) infinite;
}
@keyframes gate-onde {
  from { opacity: 0.7; transform: scale(0.3); }
  to { opacity: 0; transform: scale(1.5); }
}

@media (prefers-reduced-motion: reduce) {
  .gate,
  .gate__carte,
  .gate__titre--ouvert,
  .gate__onde {
    animation: none;
    transition-duration: 0.01ms;
  }
}

@media (max-width: 520px) {
  .gate__compte { grid-template-columns: repeat(2, 1fr); }
  .gate__form { grid-template-columns: 1fr; }
}
</style>
