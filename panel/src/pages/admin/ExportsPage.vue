<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import AdminGuardNotice from '@/components/AdminGuardNotice.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import Icon from '@/components/Icon.vue';
import { exporter } from '@/api/eco';
import { useToastStore } from '@/stores/toasts';

interface PushAction { key: string; label: string; hint: string; run: () => Promise<unknown>; danger: boolean; }

const toasts = useToastStore();

const actions = ref<string[]>([]);
const species = ref<string[]>([]);
const environment = ref<EnvEntry[]>([]);
/** Une erreur par liste : un point d'accès en panne ne doit pas vider la page. */
const errors = ref<{ actions: string | null; species: string | null; environment: string | null }>({
  actions: null, species: null, environment: null,
});
const loading = ref(true);

const preview = ref<string>('');
const previewTitle = ref<string>('');
const busy = ref(false);
const pending = ref<PushAction | null>(null);

const PUSH: PushAction[] = [
  { key: 'all', label: 'Tout exporter', hint: 'Actions, chat, environnement et espèces', run: () => exporter.pushAll(), danger: true },
  { key: 'chat', label: 'Chat', hint: 'Historique complet du chat', run: () => exporter.pushChat(), danger: false },
  { key: 'actions', label: 'Actions', hint: 'Journal des actions des joueurs', run: () => exporter.pushActions(), danger: false },
  { key: 'env', label: 'Environnement', hint: 'Séries environnementales', run: () => exporter.pushEnvironment(), danger: false },
  { key: 'species', label: 'Espèces', hint: 'Populations par espèce', run: () => exporter.pushSpecies(), danger: false },
  { key: 'game', label: 'Sauvegarde de partie (S3)', hint: 'Nécessite une URI S3 configurée côté serveur', run: () => exporter.gameExport(), danger: true },
];

/**
 * Le serveur renvoie tantôt un tableau JSON, tantôt du texte ligne par ligne.
 * On ne découpe surtout pas sur les virgules : les entrées d'environnement ont la
 * forme « Category:AirPollution, Units:PPM, Column:... » et une virgule les casse.
 */
/** Decoupe sur les vrais sauts de ligne comme sur la sequence litterale « 
 ». */
function splitLines(text: string): string[] {
  return text
    .split(/\r?\n|\\n/)
    .map((line) => line.trim().replace(/^"|"$/g, '').replace(/,$/, ''))
    .filter(Boolean);
}

function toList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    const text = raw.trim();
    // Le corps peut etre une chaine JSON : on la decode avant de decouper.
    if (text.startsWith('"')) {
      try {
        const decoded = JSON.parse(text) as unknown;
        if (typeof decoded === 'string') return splitLines(decoded);
        if (Array.isArray(decoded)) return decoded.map(String);
      } catch {
        /* on continue avec le texte brut */
      }
    }
    if (text.startsWith('[')) {
      try {
        const parsed = JSON.parse(text) as unknown;
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch {
        /* on retombe sur le découpage ligne à ligne */
      }
    }
    return text
      .split(/\r?\n/)
      .map((line) => line.trim().replace(/^"|"$/g, '').replace(/,$/, ''))
      .filter(Boolean);
  }
  return [];
}

/** Une entrée d'environnement décomposée en paramètres de requête. */
interface EnvEntry {
  label: string;
  category: string;
  units?: string;
  column?: string;
}

/** Décompose « Category:X, Units:Y, Column:Z ». */
function parseEnvEntry(line: string): EnvEntry {
  const fields = new Map<string, string>();
  for (const part of line.split(',')) {
    const sep = part.indexOf(':');
    if (sep > 0) fields.set(part.slice(0, sep).trim().toLowerCase(), part.slice(sep + 1).trim());
  }
  const category = fields.get('category');
  return {
    label: line,
    category: category ?? line.trim(),
    units: fields.get('units'),
    column: fields.get('column'),
  };
}

function reason(r: PromiseSettledResult<unknown>): string | null {
  if (r.status === 'fulfilled') return null;
  return r.reason instanceof Error ? r.reason.message : 'Liste indisponible';
}

async function loadLists(): Promise<void> {
  loading.value = true;
  const [a, s, e] = await Promise.allSettled([
    exporter.actionList(),
    exporter.speciesList(),
    exporter.environmentList(),
  ]);
  actions.value = a.status === 'fulfilled' ? toList(a.value) : [];
  species.value = s.status === 'fulfilled' ? toList(s.value) : [];
  environment.value = e.status === 'fulfilled' ? toList(e.value).map(parseEnvEntry) : [];
  errors.value = { actions: reason(a), species: reason(s), environment: reason(e) };
  loading.value = false;
}

async function show(title: string, fetcher: () => Promise<unknown>): Promise<void> {
  busy.value = true;
  previewTitle.value = title;
  try {
    const data = await fetcher();
    preview.value = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  } catch (err) {
    preview.value = '';
    toasts.fail('Export illisible', err instanceof Error ? err.message : '');
  } finally {
    busy.value = false;
  }
}

function downloadPreview(): void {
  if (!preview.value) return;
  const blob = new Blob([preview.value], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${previewTitle.value.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function runPush(): Promise<void> {
  const action = pending.value;
  pending.value = null;
  if (!action) return;
  busy.value = true;
  try {
    const res = await action.run();
    toasts.ok('Export lancé', typeof res === 'string' && res ? res : action.label);
  } catch (err) {
    toasts.fail('Export refusé', err instanceof Error ? err.message : action.label);
  } finally {
    busy.value = false;
  }
}

onMounted(() => void loadLists());
</script>

<template>
  <div class="exp">
    <SectionTitle
      :level="1"
      title="Exports de données"
      hint="Consultation des jeux de données exportables et déclenchement des exports côté serveur."
    />

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Lancer un export</h3>
          <p class="card__sub">
            Le serveur écrit les fichiers dans son propre dossier ; le panel ne fait que déclencher
            l'opération.
          </p>
        </div>
      </div>
      <div class="exp__push">
        <button
          v-for="p in PUSH"
          :key="p.key"
          class="exp__card"
          :class="{ 'is-danger': p.danger }"
          :disabled="busy"
          @click="pending = p"
        >
          <Icon name="download" :size="18" />
          <span class="u-fill">
            <strong>{{ p.label }}</strong>
            <span class="u-muted exp__hint">{{ p.hint }}</span>
          </span>
        </button>
      </div>
    </section>

    <StateBlock v-if="loading" kind="loading" title="Chargement des jeux de données" />

    <div v-else class="exp__grid">
      <section class="card">
        <div class="card__head">
          <h3 class="card__title">Actions</h3>
          <span class="badge">{{ actions.length }}</span>
        </div>
        <AdminGuardNotice v-if="errors.actions" :error="errors.actions" />
        <StateBlock v-else-if="actions.length === 0" kind="empty" title="Aucune action listée" />
        <div v-else class="exp__chips">
          <button
            v-for="a in actions"
            :key="a"
            class="exp__chip"
            @click="show('action-' + a, () => exporter.actions(a))"
          >{{ a }}</button>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <h3 class="card__title">Espèces</h3>
          <span class="badge">{{ species.length }}</span>
        </div>
        <AdminGuardNotice v-if="errors.species" :error="errors.species" />
        <StateBlock v-else-if="species.length === 0" kind="empty" title="Aucune espèce listée" />
        <div v-else class="exp__chips">
          <button
            v-for="s in species"
            :key="s"
            class="exp__chip"
            @click="show('espece-' + s, () => exporter.species(s))"
          >{{ s }}</button>
        </div>
      </section>

      <section class="card">
        <div class="card__head">
          <h3 class="card__title">Environnement</h3>
          <span class="badge">{{ environment.length }}</span>
        </div>
        <AdminGuardNotice v-if="errors.environment" :error="errors.environment" />
        <StateBlock v-else-if="environment.length === 0" kind="empty" title="Aucune catégorie listée" />
        <div v-else class="exp__chips">
          <button
            v-for="e in environment"
            :key="e.label"
            class="exp__chip"
            :title="e.label"
            @click="show('environnement-' + e.category, () => exporter.environment(e.category, e.units, e.column))"
          >{{ e.category }}<span v-if="e.units" class="u-faint"> &middot; {{ e.units }}</span></button>
        </div>
      </section>
    </div>

    <section v-if="previewTitle" class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Aperçu &middot; {{ previewTitle }}</h3>
          <p class="card__sub">Réponse brute du serveur.</p>
        </div>
        <div class="u-row-tight">
          <button class="btn btn--ghost btn--sm" :disabled="!preview" @click="downloadPreview">
            <Icon name="download" :size="14" /><span>JSON</span>
          </button>
          <button class="btn btn--ghost btn--sm" @click="previewTitle = ''; preview = ''">Fermer</button>
        </div>
      </div>
      <StateBlock v-if="busy" kind="loading" title="Récupération" />
      <pre v-else-if="preview" class="pre-log">{{ preview }}</pre>
      <StateBlock v-else kind="empty" title="Réponse vide" />
    </section>

    <ConfirmDialog
      :open="pending !== null"
      :title="pending?.label ?? ''"
      text="L'export est réalisé par le serveur de jeu et peut solliciter ses ressources pendant quelques instants."
      :detail="pending?.hint ?? ''"
      confirm-label="Lancer l'export"
      :danger="pending?.danger ?? false"
      @confirm="runPush"
      @cancel="pending = null"
    />
  </div>
</template>

<style scoped>
.exp { display: grid; gap: var(--sp-5); }
.exp__push { display: grid; gap: var(--sp-3); grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
.exp__card {
  display: flex; align-items: flex-start; gap: var(--sp-3); text-align: left; cursor: pointer;
  background: var(--surface-2); border: 1px solid var(--hairline); color: var(--text);
  border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); transition: all 0.14s var(--ease);
}
.exp__card:hover:not(:disabled) { border-color: rgb(var(--primary-rgb) / 0.4); background: var(--surface-3); }
.exp__card.is-danger { border-color: rgba(229, 84, 75, 0.3); }
.exp__card:disabled { opacity: 0.5; cursor: not-allowed; }
.exp__hint { display: block; font-size: 12px; margin-top: 2px; }
.exp__grid { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
.exp__chips { display: flex; flex-wrap: wrap; gap: 5px; max-height: 220px; overflow-y: auto; }
.exp__chip {
  border: 0; cursor: pointer; padding: 4px 11px; border-radius: 99px; font-size: 12px;
  background: rgba(255, 255, 255, 0.06); color: var(--text-muted);
}
.exp__chip:hover { background: rgb(var(--primary-rgb) / 0.18); color: #ffa163; }
</style>
