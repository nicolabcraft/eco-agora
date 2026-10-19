<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StatTile from '@/components/StatTile.vue';
import StateBlock from '@/components/StateBlock.vue';
import AdminGuardNotice from '@/components/AdminGuardNotice.vue';
import Icon from '@/components/Icon.vue';
import { admin } from '@/api/eco';
import type { ProfilingResult } from '@/api/types';
import { useServerStore } from '@/stores/server';
import { compact, dateTime, num } from '@/utils/format';
import { t } from '@/i18n';

const srv = useServerStore();

const report = ref<string>('');
const profiling = ref<ProfilingResult[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const profilingError = ref<string | null>(null);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    report.value = await admin.performanceReport();
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('adminHealth.erreurs.rapport');
  }
  try {
    profiling.value = await admin.profilingResults();
  } catch (err) {
    profilingError.value = err instanceof Error ? err.message : t('adminHealth.erreurs.profilage');
  }
  loading.value = false;
}

onMounted(() => void load());
</script>

<template>
  <div class="health">
    <SectionTitle
      :level="1"
      :title="$t('adminHealth.titre')"
      :hint="$t('adminHealth.hint')"
    >
      <template #actions>
        <button class="btn btn--ghost btn--sm" @click="load()">
          <Icon name="refresh" :size="15" /><span>{{ $t('adminHealth.actualiser') }}</span>
        </button>
      </template>
    </SectionTitle>

    <div class="grid-tiles">
      <StatTile
        :label="$t('adminHealth.tuiles.simulation')"
        :value="srv.info?.IsPaused ? $t('adminHealth.tuiles.enPause') : $t('adminHealth.tuiles.active')"
        :tone="srv.info?.IsPaused ? 'warning' : 'success'"
        :hint="$t('adminHealth.tuiles.vitesse', { vitesse: srv.info?.GameSpeed ?? '--' })"
      />
      <StatTile
        :label="$t('adminHealth.tuiles.joueurs')"
        :value="num(srv.info?.OnlinePlayers ?? 0)"
        :suffix="'/ ' + num(srv.info?.TotalPlayers ?? 0)"
        :hint="srv.info?.AdminOnline ? $t('adminHealth.tuiles.adminConnecte') : $t('adminHealth.tuiles.aucunAdmin')"
      />
      <StatTile :label="$t('adminHealth.tuiles.objetsVivants')" :value="compact((srv.info?.Plants ?? 0) + (srv.info?.Animals ?? 0))" tone="info" />
      <StatTile :label="$t('adminHealth.tuiles.version')" :value="srv.info?.Version ?? '--'" tone="muted" />
      <StatTile :label="$t('adminHealth.tuiles.acces')" :value="srv.info?.Access ?? '--'" tone="muted" />
      <StatTile :label="$t('adminHealth.tuiles.niveauSimulation')" :value="srv.info?.SimulationLevel ?? '--'" tone="muted" />
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ $t('adminHealth.rapport.titre') }}</h3>
          <p class="card__sub">{{ $t('adminHealth.rapport.sub') }}</p>
        </div>
      </div>
      <StateBlock v-if="loading" kind="loading" :title="$t('adminHealth.rapport.interrogation')" />
      <AdminGuardNotice v-else-if="error" :error="error" />
      <pre v-else-if="report" class="pre-log">{{ report }}</pre>
      <StateBlock v-else kind="empty" :title="$t('adminHealth.rapport.vide')" :text="$t('adminHealth.rapport.videTexte')" />
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ $t('adminHealth.profilage.titre') }}</h3>
          <p class="card__sub">{{ $t('adminHealth.profilage.sub') }}</p>
        </div>
        <span class="badge">{{ profiling.length }}</span>
      </div>
      <AdminGuardNotice v-if="profilingError" :error="profilingError" />
      <StateBlock
        v-else-if="profiling.length === 0"
        kind="empty"
        :title="$t('adminHealth.profilage.aucun')"
        :text="$t('adminHealth.profilage.aucunTexte')"
      />
      <div v-else class="table-wrap">
        <table class="table table--compact">
          <thead><tr><th>{{ $t('adminHealth.profilage.fichier') }}</th><th class="u-right">{{ $t('adminHealth.profilage.taille') }}</th><th>{{ $t('adminHealth.profilage.cree') }}</th></tr></thead>
          <tbody>
            <tr v-for="p in profiling" :key="p.Name">
              <td class="u-mono">{{ p.Name }}</td>
              <td class="u-right">{{ $t('adminHealth.profilage.octets', { taille: compact(p.Size) }) }}</td>
              <td>{{ dateTime(Date.parse(p.CreatedAt) / 1000) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

  </div>
</template>

<style scoped>
.health { display: grid; gap: var(--sp-5); }
</style>
