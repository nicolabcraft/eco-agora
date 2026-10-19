<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import Icon from './Icon.vue';

const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    text?: string;
    detail?: string;
    confirmLabel?: string;
    danger?: boolean;
    /** Mot à saisir pour débloquer la confirmation (actions irréversibles). */
    requirePhrase?: string;
  }>(),
  { confirmLabel: 'Confirmer', danger: false },
);

const emit = defineEmits<{ confirm: []; cancel: [] }>();

const typed = ref('');
const phraseInput = ref<HTMLInputElement | null>(null);

/** Comparaison tolérante : espaces, casse et accents ne doivent pas bloquer. */
function normalize(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase('fr')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

const matches = computed(
  () => !props.requirePhrase || normalize(typed.value) === normalize(props.requirePhrase),
);

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return;
    typed.value = '';
    // Le champ prend le focus : sans cela, on ne voit pas qu'il faut écrire.
    await nextTick();
    phraseInput.value?.focus();
  },
);

function confirm(): void {
  if (matches.value) emit('confirm');
}
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="emit('cancel')">
      <div class="modal" role="dialog" aria-modal="true" @keydown.esc="emit('cancel')">
        <h3 class="modal__title">{{ title }}</h3>
        <p v-if="text" class="u-muted">{{ text }}</p>
        <div v-if="$slots.default" class="confirm__extra"><slot /></div>

        <pre v-if="detail" class="pre-log confirm__detail">{{ detail }}</pre>

        <label v-if="requirePhrase" class="field confirm__phrase">
          <span class="field__label">
            Confirmation &mdash; recopiez
            <code class="confirm__word">{{ requirePhrase }}</code>
          </span>
          <div class="confirm__input">
            <input
              ref="phraseInput"
              v-model="typed"
              class="input"
              type="text"
              autocomplete="off"
              autocapitalize="off"
              autocorrect="off"
              spellcheck="false"
              data-1p-ignore
              data-lpignore="true"
              data-form-type="other"
              :placeholder="requirePhrase"
              @keydown.enter.prevent="confirm"
            />
            <Icon v-if="matches" name="check" :size="18" class="confirm__ok" />
          </div>
          <span class="u-faint confirm__note">
            La casse et les accents n’ont pas d’importance. Le bouton s’active dès que le mot
            correspond.
          </span>
        </label>

        <div class="modal__actions">
          <button class="btn btn--ghost btn--sm" @click="emit('cancel')">Annuler</button>
          <button
            class="btn btn--sm"
            :class="danger ? 'btn--danger' : 'btn--primary'"
            :disabled="!matches"
            :title="matches ? confirmLabel : `Recopiez « ${requirePhrase} » pour activer ce bouton`"
            @click="confirm"
          >
            {{ confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.confirm__extra { margin-top: var(--sp-4); }
.confirm__detail { max-height: 180px; margin-top: var(--sp-3); }
.confirm__phrase { margin-top: var(--sp-4); }
.confirm__word {
  font-family: var(--font-mono); background: rgb(var(--primary-rgb) / 0.16); color: #ffa163;
  padding: 1px 6px; border-radius: 4px; text-transform: none; letter-spacing: 0;
}
.confirm__input { position: relative; display: flex; align-items: center; }
.confirm__input .input { padding-right: 36px; }
.confirm__ok { position: absolute; right: 11px; color: var(--success); }
.confirm__note { display: block; font-size: 11.5px; margin-top: 5px; }
</style>
