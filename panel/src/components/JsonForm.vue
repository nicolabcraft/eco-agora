<script setup lang="ts">
import { computed } from 'vue';

/**
 * Formulaire généré à partir d'un objet de configuration.
 *
 * Les greffons d'Eco exposent leur configuration en JSON libre : plutôt que
 * d'imposer un éditeur de texte, on déduit un champ de chaque valeur — case à
 * cocher, nombre, texte, liste ligne par ligne, ou groupe imbriqué.
 * Les modifications se font en place sur l'objet fourni.
 */
const props = defineProps<{ model: Record<string, unknown>; depth?: number }>();

type Kind = 'bool' | 'number' | 'text' | 'longtext' | 'list' | 'object' | 'unknown';

interface Field {
  key: string;
  label: string;
  kind: Kind;
}

/** Rend un nom technique lisible : « MaxUsersLoading » → « Max users loading ». */
function humanize(key: string): string {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

function kindOf(value: unknown): Kind {
  if (typeof value === 'boolean') return 'bool';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return value.length > 90 ? 'longtext' : 'text';
  if (Array.isArray(value)) {
    return value.every((v) => v === null || typeof v !== 'object') ? 'list' : 'unknown';
  }
  if (value && typeof value === 'object') return 'object';
  if (value === null) return 'text';
  return 'unknown';
}

const fields = computed<Field[]>(() =>
  Object.keys(props.model ?? {})
    // Les clés techniques du sérialiseur d'Eco n'ont rien à faire dans un formulaire.
    .filter((k) => !k.startsWith('$'))
    .map((key) => ({ key, label: humanize(key), kind: kindOf(props.model[key]) })),
);

/** Les valeurs sont typees `unknown` : ces accesseurs evitent les casts dans le gabarit. */
function getStr(key: string): string {
  const v = props.model[key];
  return v === null || v === undefined ? '' : String(v);
}

function setStr(key: string, value: string): void {
  props.model[key] = value;
}

function asList(value: unknown): string {
  return Array.isArray(value) ? value.map(String).join('\n') : '';
}

function setList(key: string, raw: string): void {
  props.model[key] = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}
</script>

<template>
  <div class="jf" :class="{ 'jf--nested': (depth ?? 0) > 0 }">
    <template v-for="f in fields" :key="f.key">
      <!-- Groupe imbriqué -->
      <fieldset v-if="f.kind === 'object'" class="jf__group">
        <legend>{{ f.label }}</legend>
        <JsonForm :model="(model[f.key] as Record<string, unknown>)" :depth="(depth ?? 0) + 1" />
      </fieldset>

      <!-- Case à cocher -->
      <label v-else-if="f.kind === 'bool'" class="checkbox jf__row">
        <input v-model="model[f.key]" type="checkbox" />
        <span>{{ f.label }}</span>
      </label>

      <!-- Nombre -->
      <label v-else-if="f.kind === 'number'" class="field jf__row">
        <span class="field__label">{{ f.label }}</span>
        <input v-model.number="model[f.key]" class="input" type="number" step="any" />
      </label>

      <!-- Liste de valeurs simples -->
      <label v-else-if="f.kind === 'list'" class="field jf__row">
        <span class="field__label">{{ f.label }} {{ $t('jsonForm.uneValeurParLigne') }}</span>
        <textarea
          class="textarea"
          rows="3"
          :value="asList(model[f.key])"
          @change="setList(f.key, ($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <!-- Texte long -->
      <label v-else-if="f.kind === 'longtext'" class="field jf__row">
        <span class="field__label">{{ f.label }}</span>
        <textarea
          class="textarea jf__long"
          rows="3"
          :value="getStr(f.key)"
          @input="setStr(f.key, ($event.target as HTMLTextAreaElement).value)"
        />
      </label>

      <!-- Texte court -->
      <label v-else-if="f.kind === 'text'" class="field jf__row">
        <span class="field__label">{{ f.label }}</span>
        <input
          class="input"
          type="text"
          :value="getStr(f.key)"
          @input="setStr(f.key, ($event.target as HTMLInputElement).value)"
        />
      </label>

      <!-- Structure non éditable en formulaire : on le dit plutôt que de la casser -->
      <div v-else class="jf__row jf__opaque">
        <span class="field__label">{{ f.label }}</span>
        <p class="u-faint">
          {{ $t('jsonForm.structureComplexe') }}
        </p>
      </div>
    </template>

    <p v-if="fields.length === 0" class="u-faint">{{ $t('jsonForm.aucunReglage') }}</p>
  </div>
</template>

<style scoped>
.jf { display: grid; gap: var(--sp-3); }
.jf--nested { padding-left: var(--sp-3); }
.jf__row { max-width: 560px; }
.jf__long { font-family: var(--font); }
.jf__group {
  border: 1px solid var(--hairline); border-radius: var(--r-md);
  padding: var(--sp-3) var(--sp-4); margin: 0; display: grid; gap: var(--sp-3);
}
.jf__group legend {
  padding: 0 6px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.6px;
  text-transform: uppercase; color: var(--text-muted);
}
.jf__opaque { background: rgba(255, 255, 255, 0.03); border-radius: var(--r-sm); padding: var(--sp-3); }
.jf__opaque p { margin: 4px 0 0; font-size: 12.5px; }
</style>
