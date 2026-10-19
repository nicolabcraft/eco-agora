<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import AdminGuardNotice from '@/components/AdminGuardNotice.vue';
import Icon from '@/components/Icon.vue';
import { admin } from '@/api/eco';
import { useToastStore } from '@/stores/toasts';
import { num } from '@/utils/format';
import { localeIntl, t } from '@/i18n';

const toasts = useToastStore();

/** `/api/v1/logs` renvoie des chemins de fichiers ; on les regroupe par dossier. */
const allFiles = ref<string[]>([]);
const openGroup = ref<string>('');
const content = ref<string>('');
const file = ref<string>('');
const filter = ref('');
const loading = ref(true);
const error = ref<string | null>(null);
const busy = ref(false);

interface LogGroup { name: string; files: string[] }

/** Le dossier fait office de categorie d'affichage. */
const groups = computed<LogGroup[]>(() => {
  const map = new Map<string, string[]>();
  for (const path of allFiles.value) {
    const sep = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
    const dir = sep > 0 ? path.slice(0, sep) : t('adminLogs.racine');
    if (!map.has(dir)) map.set(dir, []);
    (map.get(dir) as string[]).push(path);
  }
  return [...map.entries()]
    .map(([name, files]) => ({ name, files: files.sort().reverse() }))
    .sort((a, b) => a.name.localeCompare(b.name, localeIntl()));
});

const lines = computed(() => {
  const all = content.value ? content.value.split(/\r?\n/) : [];
  const q = filter.value.trim().toLowerCase();
  return q ? all.filter((l) => l.toLowerCase().includes(q)) : all;
});

async function loadFiles(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    allFiles.value = await admin.logFiles();
    const first = groups.value[0];
    if (first) openGroup.value = first.name;
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('adminLogs.indisponible');
  } finally {
    loading.value = false;
  }
}

async function openFile(path: string): Promise<void> {
  file.value = path;
  busy.value = true;
  try {
    const raw = await admin.logFile(path);
    content.value = typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2);
  } catch (err) {
    toasts.fail(t('adminLogs.illisible'), err instanceof Error ? err.message : '');
    content.value = '';
  } finally {
    busy.value = false;
  }
}

function download(): void {
  if (!content.value) return;
  const blob = new Blob([content.value], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (file.value || t('adminLogs.nomFichier')).replace(/[\/]+/g, '-');
  a.click();
  URL.revokeObjectURL(a.href);
}

onMounted(() => void loadFiles());
</script>

<template>
  <div class="logs">
    <SectionTitle
      :level="1"
      :title="$t('adminLogs.titre')"
      :hint="$t('adminLogs.hint')"
    />

    <StateBlock v-if="loading" kind="loading" :title="$t('adminLogs.lecture')" />
    <AdminGuardNotice v-else-if="error" :error="error" />

    <div v-else class="logs__layout">
      <aside class="card card--tight logs__side">
        <h3 class="card__title logs__side-title">{{ $t('adminLogs.serveur') }}</h3>
        <StateBlock v-if="groups.length === 0" kind="empty" :title="$t('adminLogs.aucunFichier')" />
        <template v-for="g in groups" :key="g.name">
          <button
            class="logs__cat logs__group"
            :class="{ 'is-active': openGroup === g.name }"
            @click="openGroup = openGroup === g.name ? '' : g.name"
          >
            <Icon name="chevron" :size="13" :class="['logs__caret', { 'is-open': openGroup === g.name }]" />
            <span class="u-fill u-ellipsis">{{ g.name }}</span>
            <span class="badge">{{ g.files.length }}</span>
          </button>
          <ul v-if="openGroup === g.name" class="logs__cats">
            <li v-for="f in g.files" :key="f">
              <button class="logs__cat" :class="{ 'is-active': file === f }" @click="openFile(f)">
                <span class="u-fill u-ellipsis u-mono">{{ f.split(/[\/]/).pop() }}</span>
              </button>
            </li>
          </ul>
        </template>
      </aside>

      <section class="card logs__main">
        <div class="card__head">
          <div>
            <h3 class="card__title">{{ file ? file.split(/[\/]/).pop() : $t('adminLogs.aucunOuvert') }}</h3>
            <p class="card__sub">{{ $t(filter ? 'adminLogs.lignesFiltre' : 'adminLogs.lignes', { n: num(lines.length) }, lines.length) }}</p>
          </div>
          <div class="u-row-tight u-wrap">
            <input v-model="filter" class="input logs__filter" type="search" :placeholder="$t('adminLogs.filtrer')" />
            <button class="btn btn--ghost btn--sm" :disabled="!content" @click="download">
              <Icon name="download" :size="14" /><span>{{ $t('adminLogs.telecharger') }}</span>
            </button>
          </div>
        </div>

        <StateBlock v-if="busy" kind="loading" :title="$t('adminLogs.lectureFichier')" />
        <StateBlock
          v-else-if="!content"
          kind="empty"
          :title="$t('adminLogs.selection')"
          :text="$t('adminLogs.selectionTexte')"
        />
        <pre v-else class="pre-log logs__view">{{ lines.join('\n') }}</pre>
      </section>
    </div>
  </div>
</template>

<style scoped>
.logs { display: grid; gap: var(--sp-5); }
.logs__layout { display: grid; gap: var(--sp-4); grid-template-columns: 280px minmax(0, 1fr); align-items: start; }
.logs__side { position: sticky; top: calc(var(--topbar-h) + var(--sp-4)); max-height: calc(100vh - var(--topbar-h) - var(--sp-6)); overflow-y: auto; }
.logs__side-title { margin: var(--sp-3) 0 var(--sp-2); }
.logs__side-title:first-child { margin-top: 0; }
.logs__cats { list-style: none; margin: 0 0 var(--sp-2); padding: 0 0 0 var(--sp-4); display: grid; gap: 1px; }
.logs__group { font-weight: 600; }
.logs__caret { transition: transform 0.16s var(--ease); opacity: 0.6; }
.logs__caret.is-open { transform: rotate(90deg); }
.logs__cat {
  display: flex; align-items: center; gap: var(--sp-2); width: 100%; text-align: left;
  background: transparent; border: 0; cursor: pointer; color: var(--text-muted);
  padding: 6px var(--sp-2); border-radius: var(--r-sm); font-size: 12.5px;
}
.logs__cat:hover { background: rgba(255, 255, 255, 0.05); color: var(--text); }
.logs__cat.is-active { background: rgb(var(--primary-rgb) / 0.13); color: #ffa163; font-weight: 600; }
.logs__filter { width: 190px; }
.logs__view { max-height: 640px; }
@media (max-width: 1000px) {
  .logs__layout { grid-template-columns: 1fr; }
  .logs__side { position: static; max-height: 320px; }
}
</style>
