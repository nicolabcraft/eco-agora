<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import Icon from '@/components/Icon.vue';
import {
  ANNONCES_PATH,
  fetchAnnonces,
  isActive,
  isModAvailable,
  saveAnnonces,
  type Annonce,
  type AnnonceLevel,
} from '@/api/annonces';
import { useAnnoncesStore } from '@/stores/annonces';
import { useToastStore } from '@/stores/toasts';
import { dateTime } from '@/utils/format';
import {
  chooseFile,
  ensureWritable,
  forgetHandle,
  isDirectWriteSupported,
  loadHandle,
  saveHandle,
  writeToHandle,
} from '@/utils/fileTarget';

const DRAFT_KEY = 'agora.annonces.brouillon';

const LEVELS: Array<{ value: AnnonceLevel; label: string }> = [
  { value: 'info', label: 'Information' },
  { value: 'important', label: 'Important' },
  { value: 'alerte', label: 'Alerte' },
];

const store = useAnnoncesStore();
const toasts = useToastStore();

const items = ref<Annonce[]>([]);
const loading = ref(true);
const dirty = ref(false);
const toDelete = ref<Annonce | null>(null);
const publishedAt = ref<string | null>(null);

/* --- Écriture directe dans WebBin/annonces.json --- */
const HANDLE_KEY = 'annonces.json';
const directSupported = isDirectWriteSupported();
const handle = ref<FileSystemFileHandle | null>(null);
const handleName = ref<string | null>(null);
const publishing = ref(false);

/** Le mod serveur est-il installé ? Si oui, la publication écrit directement en base. */
const modReady = ref<boolean | null>(null);

/** Garde-fou : publier une liste vide effacerait tout, on le fait confirmer. */
const confirmEmpty = ref(false);

/**
 * Publication par l'API du mod : plus aucun fichier à déposer.
 *
 * Une liste vide remplace tout côté serveur : on vérifie donc l'état publié avant,
 * et on demande une confirmation explicite plutôt que d'effacer en silence.
 */
async function publishToServer(force = false): Promise<void> {
  if (!Array.isArray(items.value)) {
    toasts.fail('Brouillon illisible', 'Rechargez la page avant de publier.');
    return;
  }
  if (!force && items.value.length === 0) {
    const current = await fetchAnnonces().catch(() => null);
    if (current && current.annonces.length > 0) {
      confirmEmpty.value = true;
      return;
    }
  }
  publishing.value = true;
  try {
    const saved = await saveAnnonces(items.value);
    items.value = saved.annonces;
    publishedAt.value = saved.miseAJour ?? new Date().toISOString();
    dirty.value = false;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    await store.load();
    toasts.ok('Annonces publiées', 'Enregistrées sur le serveur.');
  } catch (err) {
    toasts.fail('Publication refusée', err instanceof Error ? err.message : '');
  } finally {
    publishing.value = false;
  }
}

/** Enregistre directement dans le fichier, en demandant la cible au besoin. */
async function publishDirect(): Promise<void> {
  publishing.value = true;
  try {
    let target = handle.value;
    if (!target) {
      target = await chooseFile('annonces.json');
      if (!target) return;
    }
    if (!(await ensureWritable(target))) {
      toasts.warn('Autorisation refusée', 'Le navigateur n’a pas accordé l’accès en écriture.');
      return;
    }
    await writeToHandle(target, json.value);
    handle.value = target;
    handleName.value = target.name;
    await saveHandle(HANDLE_KEY, target);
    dirty.value = false;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    await store.load();
    publishedAt.value = new Date().toISOString();
    toasts.ok('Annonces publiées', `Écrites dans ${target.name}`);
  } catch (err) {
    toasts.fail('Écriture impossible', err instanceof Error ? err.message : '');
  } finally {
    publishing.value = false;
  }
}

async function chooseTarget(): Promise<void> {
  const target = await chooseFile('annonces.json');
  if (!target) return;
  handle.value = target;
  handleName.value = target.name;
  await saveHandle(HANDLE_KEY, target);
  toasts.ok('Fichier cible enregistré', target.name);
}

async function clearTarget(): Promise<void> {
  handle.value = null;
  handleName.value = null;
  await forgetHandle(HANDLE_KEY);
  toasts.info('Fichier cible oublié');
}

const json = computed(() =>
  JSON.stringify({ version: 1, miseAJour: new Date().toISOString(), annonces: items.value }, null, 2),
);
const active = computed(() => items.value.filter((a) => isActive(a)).length);

function newId(): string {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function saveDraft(): void {
  dirty.value = true;
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify(items.value)); } catch { /* mode privé */ }
}

function add(): void {
  items.value = [
    {
      id: newId(),
      titre: 'Nouvelle annonce',
      message: '',
      niveau: 'info',
      epinglee: false,
      debut: null,
      fin: null,
      lienUrl: null,
      lienTexte: null,
    },
    ...items.value,
  ];
  saveDraft();
}

function move(index: number, delta: number): void {
  const next = index + delta;
  if (next < 0 || next >= items.value.length) return;
  const copy = [...items.value];
  [copy[index], copy[next]] = [copy[next], copy[index]];
  items.value = copy;
  saveDraft();
}

function remove(): void {
  const target = toDelete.value;
  toDelete.value = null;
  if (!target) return;
  items.value = items.value.filter((a) => a.id !== target.id);
  saveDraft();
}

function download(): void {
  const blob = new Blob([json.value], { type: 'application/json;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'annonces.json';
  a.click();
  URL.revokeObjectURL(a.href);
  toasts.ok('Fichier annonces.json généré', 'Déposez-le dans WebClient/WebBin du serveur.');
}

async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(json.value);
    toasts.ok('JSON copié dans le presse-papiers');
  } catch {
    toasts.fail('Copie impossible', 'Le navigateur a refusé l’accès au presse-papiers.');
  }
}

async function reload(): Promise<void> {
  loading.value = true;
  try {
    const file = await fetchAnnonces();
    items.value = file.annonces;
    publishedAt.value = file.miseAJour;
    dirty.value = false;
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* ignore */ }
    await store.load();
    toasts.ok('Annonces rechargées depuis le serveur');
  } catch {
    items.value = [];
    publishedAt.value = null;
    toasts.warn('Aucun fichier publié', 'annonces.json est absent du serveur : commencez par en créer un.');
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  loading.value = true;
  modReady.value = await isModAvailable();
  if (directSupported) {
    const stored = await loadHandle(HANDLE_KEY);
    if (stored) {
      handle.value = stored;
      handleName.value = stored.name;
    }
  }
  try {
    const file = await fetchAnnonces();
    items.value = file.annonces;
    publishedAt.value = file.miseAJour;
  } catch {
    publishedAt.value = null;
  }
  // Un brouillon local reprend la main : on ne perd pas un travail en cours.
  try {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      const parsed = JSON.parse(draft) as unknown;
      if (Array.isArray(parsed) && parsed.length > 0) {
        items.value = parsed as Annonce[];
        dirty.value = true;
      }
    }
  } catch { /* ignore */ }
  loading.value = false;
});
</script>

<template>
  <div class="ann">
    <SectionTitle
      :level="1"
      title="Annonces du site"
      hint="Messages affichés en haut de toutes les pages du panel, pour tous les visiteurs."
    >
      <template #actions>
        <div class="u-row-tight u-wrap">
          <button class="btn btn--ghost btn--sm" @click="reload">
            <Icon name="refresh" :size="15" /><span>Recharger</span>
          </button>
          <button class="btn btn--ghost btn--sm" @click="copy">
            <Icon name="copy" :size="15" /><span>Copier le JSON</span>
          </button>
          <button class="btn btn--ghost btn--sm" @click="download">
            <Icon name="download" :size="15" /><span>Télécharger</span>
          </button>
          <button
            v-if="modReady === true"
            class="btn btn--primary btn--sm"
            :disabled="publishing"
            @click="publishToServer()"
          >
            <span v-if="publishing" class="spinner" />
            <Icon v-else name="save" :size="15" />
            <span>Publier</span>
          </button>
          <button
            v-else-if="modReady === false && directSupported"
            class="btn btn--primary btn--sm"
            :disabled="publishing"
            @click="publishDirect"
          >
            <span v-if="publishing" class="spinner" />
            <Icon v-else name="save" :size="15" />
            <span>Publier</span>
          </button>
        </div>
      </template>
    </SectionTitle>

    <section class="card card--warm ann__howto">
      <Icon name="info" :size="18" />
      <div class="u-fill">
        <strong>Comment une annonce devient publique</strong>
        <p v-if="modReady === null" class="u-muted">
          Vérification de la présence du mod serveur…
        </p>
        <p v-else-if="modReady" class="u-muted">
          Le mod serveur Eco Agora est installé : <strong>Publier</strong> enregistre les
          annonces directement en base côté serveur. Plus aucun fichier à déposer, et elles sont
          visibles immédiatement par tous les visiteurs.
        </p>
        <p v-else-if="modReady === false && directSupported" class="u-muted">
          Le mod serveur n’est pas installé (ou pas encore chargé). En attendant, les annonces
          vivent dans <code>WebBinnnonces.json</code> : au premier <strong>Publier</strong>,
          désignez ce fichier et autorisez l’écriture.
        </p>
        <p v-else class="u-muted">
          Ni le mod serveur ni l’écriture directe ne sont disponibles ici : utilisez
          <strong>Télécharger</strong> puis déposez le fichier dans <code>WebClient\WebBin\</code>.
        </p>
        <p v-if="modReady === false && handleName" class="u-faint ann__meta">
          Cible d’écriture : <strong>{{ handleName }}</strong>
          <button class="ann__link" @click="chooseTarget">changer</button>
          <button class="ann__link" @click="clearTarget">oublier</button>
        </p>
        <p class="u-faint ann__meta">
          Fichier actuellement publié :
          <template v-if="publishedAt">mis à jour le {{ dateTime(Date.parse(publishedAt) / 1000) }}</template>
          <template v-else>aucun</template>
          &middot; {{ active }} annonce(s) active(s) sur {{ items.length }}
          <template v-if="dirty"> &middot; <span class="u-primary">modifications non publiées</span></template>
        </p>
      </div>
    </section>

    <div class="u-row u-spread u-wrap">
      <button class="btn btn--primary btn--sm" @click="add">
        <Icon name="add" :size="15" /><span>Nouvelle annonce</span>
      </button>
      <span class="u-faint">{{ ANNONCES_PATH }}</span>
    </div>

    <StateBlock v-if="loading" kind="loading" title="Lecture des annonces" />
    <StateBlock
      v-else-if="items.length === 0"
      kind="empty"
      title="Aucune annonce"
      text="Créez une annonce, publiez le fichier, et elle apparaîtra en haut de toutes les pages."
    />

    <section v-for="(a, i) in items" v-else :key="a.id" class="card ann__item">
      <div class="card__head">
        <div class="u-row-tight u-wrap">
          <span class="badge" :class="isActive(a) ? 'badge--success' : ''">
            {{ isActive(a) ? 'Active' : 'Hors période' }}
          </span>
          <span v-if="a.epinglee" class="badge badge--primary">Épinglée</span>
        </div>
        <div class="u-row-tight">
          <button class="btn btn--ghost btn--sm" title="Monter" :disabled="i === 0" @click="move(i, -1)">
            <Icon name="sort" :size="14" />
          </button>
          <button class="btn btn--danger btn--sm" title="Supprimer" @click="toDelete = a">
            <Icon name="delete" :size="14" />
          </button>
        </div>
      </div>

      <div class="ann__grid">
        <label class="field ann__span2">
          <span class="field__label">Titre</span>
          <input v-model="a.titre" class="input" type="text" @input="saveDraft" />
        </label>

        <label class="field">
          <span class="field__label">Niveau</span>
          <div class="select-wrap">
            <select v-model="a.niveau" class="select" @change="saveDraft">
              <option v-for="l in LEVELS" :key="l.value" :value="l.value">{{ l.label }}</option>
            </select>
          </div>
        </label>

        <label class="checkbox ann__pin">
          <input v-model="a.epinglee" type="checkbox" @change="saveDraft" />
          <span>Épingler en haut</span>
        </label>

        <label class="field ann__span3">
          <span class="field__label">Message</span>
          <textarea v-model="a.message" class="textarea ann__text" rows="3" @input="saveDraft" />
        </label>

        <label class="field">
          <span class="field__label">Début (facultatif)</span>
          <input
            class="input"
            type="datetime-local"
            :value="a.debut ? a.debut.slice(0, 16) : ''"
            @change="a.debut = ($event.target as HTMLInputElement).value ? new Date(($event.target as HTMLInputElement).value).toISOString() : null; saveDraft()"
          />
        </label>
        <label class="field">
          <span class="field__label">Fin (facultatif)</span>
          <input
            class="input"
            type="datetime-local"
            :value="a.fin ? a.fin.slice(0, 16) : ''"
            @change="a.fin = ($event.target as HTMLInputElement).value ? new Date(($event.target as HTMLInputElement).value).toISOString() : null; saveDraft()"
          />
        </label>
        <label class="field">
          <span class="field__label">Lien (facultatif)</span>
          <input
            class="input"
            type="url"
            placeholder="https://exemple.fr/..."
            :value="a.lienUrl ?? ''"
            @input="a.lienUrl = ($event.target as HTMLInputElement).value || null; saveDraft()"
          />
        </label>
        <label class="field">
          <span class="field__label">Texte du lien</span>
          <input
            class="input"
            type="text"
            placeholder="En savoir plus"
            :value="a.lienTexte ?? ''"
            @input="a.lienTexte = ($event.target as HTMLInputElement).value || null; saveDraft()"
          />
        </label>
      </div>
    </section>

    <ConfirmDialog
      :open="confirmEmpty"
      title="Publier une liste vide"
      text="Toutes les annonces actuellement publiées seront retirées du site."
      detail="0 annonce publiée"
      confirm-label="Tout retirer"
      danger
      require-phrase="vider"
      @confirm="confirmEmpty = false; publishToServer(true)"
      @cancel="confirmEmpty = false"
    />

    <ConfirmDialog
      :open="toDelete !== null"
      title="Supprimer cette annonce"
      text="Elle disparaîtra du site à la prochaine publication du fichier."
      :detail="toDelete?.titre ?? ''"
      confirm-label="Supprimer"
      danger
      @confirm="remove"
      @cancel="toDelete = null"
    />
  </div>
</template>

<style scoped>
.ann { display: grid; gap: var(--sp-4); }
.ann__howto { display: flex; gap: var(--sp-4); align-items: flex-start; color: #e8b79a; }
.ann__howto p { margin: 4px 0 0; font-size: 13px; max-width: 96ch; }
.ann__howto code { background: rgba(0, 0, 0, 0.35); padding: 1px 5px; border-radius: 4px; }
.ann__meta { font-size: 12px; }
.ann__link {
  background: none; border: 0; padding: 0 0 0 8px; cursor: pointer;
  color: var(--primary); font: inherit; text-decoration: underline;
}
.ann__item { display: grid; gap: var(--sp-3); }
.ann__grid { display: grid; gap: var(--sp-3); grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; }
.ann__span2 { grid-column: span 2; }
.ann__span3 { grid-column: 1 / -1; }
.ann__pin { padding-bottom: 10px; }
.ann__text { min-height: 70px; font-family: var(--font); }
@media (max-width: 820px) {
  .ann__grid { grid-template-columns: 1fr; }
  .ann__span2, .ann__span3 { grid-column: auto; }
}
</style>
