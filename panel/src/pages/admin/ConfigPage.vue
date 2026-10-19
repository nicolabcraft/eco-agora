<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import AdminGuardNotice from '@/components/AdminGuardNotice.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import Icon from '@/components/Icon.vue';
import JsonForm from '@/components/JsonForm.vue';
import { admin, server } from '@/api/eco';
import { agoraServer } from '@/api/agoraServer';
import type { PluginInfo } from '@/api/types';
import { useServerStore } from '@/stores/server';
import { useToastStore } from '@/stores/toasts';
import { num } from '@/utils/format';
import { t } from '@/i18n';

type Job = 'identity' | 'access' | 'plugin';

const ACCESS = [
  { value: 'public', label: t('adminConfig.acces.public'), hint: t('adminConfig.acces.publicAide') },
  { value: 'hidden', label: t('adminConfig.acces.masque'), hint: t('adminConfig.acces.masqueAide') },
  { value: 'private', label: t('adminConfig.acces.prive'), hint: t('adminConfig.acces.priveAide') },
];

const srv = useServerStore();
const toasts = useToastStore();

const plugins = ref<PluginInfo[]>([]);
const serverName = ref('');
const originalName = ref('');
/** Description detaillee : servie par le mod, donc facultative. */
const description = ref('');
const originalDescription = ref('');
const descriptionMax = ref(1000);
/** null = pas encore verifie, false = mod injoignable, true = champ modifiable. */
const descriptionReady = ref<boolean | null>(null);
const access = ref('');
const accessPassword = ref('');
const loading = ref(true);
/** Erreurs séparées : le nom du serveur reste lisible même si l'accès échoue. */
const nameError = ref<string | null>(null);
const accessError = ref<string | null>(null);
const busy = ref(false);
const job = ref<Job | null>(null);

const search = ref('');
const openPlugin = ref<string | null>(null);
const pluginJson = ref('');
const pluginError = ref<string | null>(null);
/** Objet edite par le formulaire ; l'editeur JSON reste disponible en secours. */
const pluginModel = ref<Record<string, unknown> | null>(null);
const rawMode = ref(false);

const identityDirty = computed(
  () =>
    serverName.value.trim() !== originalName.value ||
    (descriptionReady.value === true && description.value.trim() !== originalDescription.value),
);

/** Ce que la confirmation doit annoncer : seuls les champs reellement modifies. */
const identitySummary = computed(() => {
  const parts: string[] = [];
  if (serverName.value.trim() !== originalName.value) parts.push(t('adminConfig.resume.nom', { valeur: serverName.value.trim() }));
  if (descriptionReady.value === true && description.value.trim() !== originalDescription.value) {
    parts.push(t('adminConfig.resume.description', { valeur: description.value.trim().slice(0, 120) || t('adminConfig.resume.vide') }));
  }
  return parts.join(' · ');
});

const configurable = computed(() => {
  const q = search.value.trim().toLowerCase();
  return plugins.value
    .filter((p) => p.HasConfig)
    .filter((p) => !q || p.TypeName.toLowerCase().includes(q))
    .sort((a, b) => a.TypeName.localeCompare(b.TypeName));
});

/** Retire les guillemets d'une chaine encodee en JSON. */
function unquote(value: string): string {
  const t = value.trim();
  if (t.length > 1 && t.startsWith('"') && t.endsWith('"')) {
    try { return JSON.parse(t) as string; } catch { return t.slice(1, -1); }
  }
  return t;
}

async function load(): Promise<void> {
  loading.value = true;
  nameError.value = null;
  accessError.value = null;
  plugins.value = await server.plugins();

  const [name, acc, presentation] = await Promise.allSettled([
    admin.getServerName(),
    admin.getAccess(),
    agoraServer.info(),
  ]);
  if (name.status === 'fulfilled') {
    // Le serveur peut renvoyer une chaine JSON : on retire les guillemets, sans quoi
    // ils apparaissent dans le champ et finissent enregistres dans la configuration.
    serverName.value = unquote(String(name.value ?? ''));
  } else {
    // Repli : le nom complet lu par le mod ; celui de /info est tronque s'il a des accents.
    serverName.value = (presentation.status === 'fulfilled' && presentation.value.name) || srv.info?.Description || '';
    nameError.value = name.reason instanceof Error ? name.reason.message : t('adminConfig.erreurs.nomIllisible');
  }
  if (acc.status === 'fulfilled') {
    access.value = String(acc.value ?? '');
  } else {
    // `/info` expose déjà la visibilité : on s'en sert comme repli.
    access.value = srv.info?.Access ?? '';
    accessError.value = acc.reason instanceof Error ? acc.reason.message : t('adminConfig.erreurs.accesIllisible');
  }

  if (presentation.status === 'fulfilled' && presentation.value?.available) {
    description.value = presentation.value.detailedDescription ?? '';
    if (presentation.value.maxLength) descriptionMax.value = presentation.value.maxLength;
    descriptionReady.value = true;
  } else {
    // Repli en lecture seule : /info publie la description meme sans le mod.
    description.value = srv.info?.DetailedDescription ?? '';
    descriptionReady.value = false;
  }
  originalName.value = serverName.value.trim();
  originalDescription.value = description.value.trim();

  loading.value = false;
}

async function openConfig(name: string): Promise<void> {
  openPlugin.value = name;
  pluginJson.value = '';
  pluginError.value = null;
  busy.value = true;
  try {
    const cfg = await admin.pluginConfig(name);
    pluginJson.value = JSON.stringify(cfg, null, 2);
    pluginModel.value =
      cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? (cfg as Record<string, unknown>) : null;
    rawMode.value = pluginModel.value === null;
  } catch (err) {
    pluginError.value = err instanceof Error ? err.message : t('adminConfig.erreurs.configIllisible');
  } finally {
    busy.value = false;
  }
}

async function commit(): Promise<void> {
  const kind = job.value;
  job.value = null;
  if (!kind) return;
  busy.value = true;
  try {
    if (kind === 'identity') {
      // Deux routes distinctes : le nom passe par Eco, la description par le mod.
      const nextName = unquote(serverName.value).trim();
      if (nextName && nextName !== originalName.value) {
        await admin.setServerName(nextName);
        originalName.value = nextName;
        toasts.ok(t('adminConfig.toasts.nomMaj'));
      }
      const nextDescription = description.value.replace(/\r\n/g, '\n').trim();
      if (descriptionReady.value === true && nextDescription !== originalDescription.value) {
        const result = await agoraServer.setDescription(nextDescription);
        originalDescription.value = nextDescription;
        if (result?.warning) toasts.fail(t('adminConfig.toasts.descReserve'), result.warning);
        else toasts.ok(t('adminConfig.toasts.descMaj'));
      }
    } else if (kind === 'access') {
      await admin.setAccess(access.value, accessPassword.value || undefined);
      accessPassword.value = '';
      toasts.ok(t('adminConfig.toasts.accesMaj'));
    } else if (kind === 'plugin' && openPlugin.value) {
      // En mode formulaire, on renvoie l'objet edite ; sinon le JSON saisi.
      const parsed = rawMode.value
        ? (JSON.parse(pluginJson.value) as unknown)
        : pluginModel.value;
      await admin.savePluginConfig(openPlugin.value, parsed);
      toasts.ok(t('adminConfig.toasts.configEnregistree'), openPlugin.value);
    }
    await srv.refresh();
  } catch (err) {
    const msg = err instanceof SyntaxError ? t('adminConfig.erreurs.jsonInvalide') : err instanceof Error ? err.message : t('adminConfig.erreurs.echec');
    toasts.fail(t('adminConfig.toasts.refusee'), msg);
  } finally {
    busy.value = false;
  }
}

onMounted(() => void load());
</script>

<template>
  <div class="cfg">
    <SectionTitle
      :level="1"
      :title="$t('adminConfig.titre')"
      :hint="$t('adminConfig.hint')"
    />

    <StateBlock v-if="loading" kind="loading" :title="$t('adminConfig.lecture')" />

    <template v-else>
      <div class="cfg__grid">
        <section class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">{{ $t('adminConfig.identite.titre') }}</h3>
              <p class="card__sub">{{ $t('adminConfig.identite.sub') }}</p>
            </div>
          </div>
          <AdminGuardNotice v-if="nameError" :error="nameError" />
          <label class="field">
            <span class="field__label">{{ $t('adminConfig.identite.nom') }}</span>
            <input v-model="serverName" class="input" type="text" />
          </label>
          <p class="u-faint cfg__hint">
            {{ $t('adminConfig.identite.nomAide') }}
          </p>

          <label class="field cfg__desc">
            <span class="field__label">
              {{ $t('adminConfig.identite.description') }}
              <span class="u-faint">
                {{ description.trim().length }} / {{ descriptionMax }}
              </span>
            </span>
            <textarea
              v-model="description"
              class="input cfg__desc-input"
              rows="4"
              :maxlength="descriptionMax"
              :disabled="descriptionReady !== true"
              :placeholder="$t('adminConfig.identite.descPlaceholder')"
            />
          </label>
          <p v-if="descriptionReady === false" class="u-faint cfg__hint">
            {{ $t('adminConfig.identite.descAvant') }}
            <strong>Eco Agora</strong>{{ $t('adminConfig.identite.descMilieu') }}
            <code>/info</code>{{ $t('adminConfig.identite.descApres') }}
          </p>

          <div class="card__foot cfg__foot">
            <button
              class="btn btn--primary btn--sm"
              :disabled="!serverName.trim() || busy || !identityDirty"
              @click="job = 'identity'"
            >
              <Icon name="check" :size="14" /><span>{{ $t('adminConfig.identite.enregistrer') }}</span>
            </button>
          </div>
        </section>

        <section class="card">
          <div class="card__head">
            <div>
              <h3 class="card__title">{{ $t('adminConfig.visibilite.titre') }}</h3>
              <p class="card__sub">
                {{ $t('adminConfig.visibilite.actuel') }} <strong>{{ access || '--' }}</strong>
                <span v-if="accessError" class="u-faint"> {{ $t('adminConfig.visibilite.repli') }}</span>
              </p>
            </div>
          </div>
          <AdminGuardNotice v-if="accessError" :error="accessError" />
          <div class="cfg__access">
            <button
              v-for="a in ACCESS"
              :key="a.value"
              class="cfg__option"
              :class="{ 'is-on': access === a.value }"
              @click="access = a.value"
            >
              <strong>{{ a.label }}</strong>
              <span class="u-muted">{{ a.hint }}</span>
            </button>
          </div>
          <label class="field cfg__pwd">
            <span class="field__label">{{ $t('adminConfig.visibilite.motDePasse') }}</span>
            <input v-model="accessPassword" class="input" type="text" autocomplete="off" :placeholder="$t('adminConfig.visibilite.motDePassePlaceholder')" />
          </label>
          <div class="card__foot cfg__foot">
            <button class="btn btn--primary btn--sm" :disabled="!access || busy" @click="job = 'access'">
              <Icon name="check" :size="14" /><span>{{ $t('adminConfig.visibilite.appliquer') }}</span>
            </button>
          </div>
        </section>
      </div>

      <section class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">{{ $t('adminConfig.greffons.titre') }}</h3>
            <p class="card__sub">
              {{ $t('adminConfig.greffons.compte', { n: num(configurable.length), total: num(plugins.length) }, configurable.length) }}
            </p>
          </div>
          <input v-model="search" class="input cfg__search" type="search" :placeholder="$t('adminConfig.greffons.recherche')" />
        </div>

        <div class="cfg__plugins">
          <button
            v-for="p in configurable"
            :key="p.TypeName"
            class="cfg__plugin"
            :class="{ 'is-open': openPlugin === p.TypeName }"
            @click="openConfig(p.TypeName)"
          >
            <Icon name="settings" :size="15" />
            <span class="u-fill">
              <strong>{{ p.TypeName }}</strong>
              <span v-if="p.Status" class="u-muted cfg__status">{{ p.Status }}</span>
            </span>
          </button>
        </div>
      </section>

      <section v-if="openPlugin" class="card">
        <div class="card__head">
          <div>
            <h3 class="card__title">{{ openPlugin }}</h3>
            <p class="card__sub">{{ $t('adminConfig.greffons.sub') }}</p>
          </div>
          <button class="btn btn--ghost btn--sm" @click="openPlugin = null">{{ $t('adminConfig.greffons.fermer') }}</button>
        </div>

        <StateBlock v-if="busy && !pluginJson" kind="loading" :title="$t('adminConfig.greffons.lecture')" />
        <AdminGuardNotice v-else-if="pluginError" :error="pluginError" />
        <template v-else>
          <div class="cfg__mode">
            <div class="segmented">
              <button :class="{ 'is-active': !rawMode }" :disabled="pluginModel === null" @click="rawMode = false">
                {{ $t('adminConfig.greffons.formulaire') }}
              </button>
              <button :class="{ 'is-active': rawMode }" @click="rawMode = true">{{ $t('adminConfig.greffons.jsonAvance') }}</button>
            </div>
            <span v-if="pluginModel === null" class="u-faint">
              {{ $t('adminConfig.greffons.pasObjet') }}
            </span>
          </div>

          <JsonForm v-if="!rawMode && pluginModel" :model="pluginModel" />

          <label v-else class="field">
            <span class="field__label">{{ $t('adminConfig.greffons.json') }}</span>
            <textarea v-model="pluginJson" class="textarea cfg__json" rows="18" spellcheck="false" />
          </label>
          <div class="card__foot cfg__foot">
            <button class="btn btn--primary btn--sm" :disabled="busy" @click="job = 'plugin'">
              <Icon name="check" :size="14" /><span>{{ $t('adminConfig.greffons.enregistrer') }}</span>
            </button>
          </div>
        </template>
      </section>
    </template>

    <ConfirmDialog
      :open="job !== null"
      :title="job === 'identity' ? $t('adminConfig.confirmation.identite') : job === 'access' ? $t('adminConfig.confirmation.acces') : $t('adminConfig.confirmation.greffon')"
      :text="$t('adminConfig.confirmation.texte')"
      :detail="job === 'identity' ? identitySummary : job === 'access' ? access : (openPlugin ?? '')"
      :confirm-label="$t('adminConfig.confirmation.appliquer')"
      danger
      @confirm="commit"
      @cancel="job = null"
    />
  </div>
</template>

<style scoped>
.cfg { display: grid; gap: var(--sp-5); }
.cfg__grid { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); }
.cfg__foot { display: flex; justify-content: flex-end; }
.cfg__access { display: grid; gap: var(--sp-2); }
.cfg__option {
  display: grid; gap: 2px; text-align: left; cursor: pointer; color: var(--text);
  background: var(--surface-2); border: 1px solid var(--hairline); border-radius: var(--r-md);
  padding: var(--sp-3) var(--sp-4); font-size: 13px;
}
.cfg__option:hover { border-color: rgb(var(--primary-rgb) / 0.35); }
.cfg__option.is-on { border-color: var(--primary); background: rgb(var(--primary-rgb) / 0.09); }
.cfg__pwd { margin-top: var(--sp-3); }
.cfg__desc { margin-top: var(--sp-4); }
.cfg__desc-input { resize: vertical; min-height: 88px; font-family: inherit; line-height: 1.5; }
.cfg__search { width: 220px; }
.cfg__plugins { display: grid; gap: var(--sp-2); grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
.cfg__plugin {
  display: flex; align-items: flex-start; gap: var(--sp-3); text-align: left; cursor: pointer;
  background: var(--surface-2); border: 1px solid var(--hairline); color: var(--text);
  border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); font-size: 13px;
}
.cfg__plugin:hover { border-color: rgb(var(--primary-rgb) / 0.35); }
.cfg__plugin.is-open { border-color: var(--primary); background: rgb(var(--primary-rgb) / 0.09); }
.cfg__status { display: block; font-size: 12px; margin-top: 2px; }
.cfg__json { min-height: 320px; font-size: 12px; }
.cfg__hint { margin: var(--sp-2) 0 0; font-size: 12px; }
.cfg__mode { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; margin-bottom: var(--sp-4); }
</style>
