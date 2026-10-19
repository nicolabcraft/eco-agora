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
    error.value = err instanceof Error ? err.message : 'Rapport indisponible';
  }
  try {
    profiling.value = await admin.profilingResults();
  } catch (err) {
    profilingError.value = err instanceof Error ? err.message : 'Profiling indisponible';
  }
  loading.value = false;
}

onMounted(() => void load());
</script>

<template>
  <div class="health">
    <SectionTitle
      :level="1"
      title="Santé du serveur"
      hint="Rapport de performance produit par le serveur, état de la simulation et fichiers de profilage."
    >
      <template #actions>
        <button class="btn btn--ghost btn--sm" @click="load()">
          <Icon name="refresh" :size="15" /><span>Actualiser</span>
        </button>
      </template>
    </SectionTitle>

    <div class="grid-tiles">
      <StatTile
        label="Simulation"
        :value="srv.info?.IsPaused ? 'En pause' : 'Active'"
        :tone="srv.info?.IsPaused ? 'warning' : 'success'"
        :hint="`Vitesse ${srv.info?.GameSpeed ?? '--'}`"
      />
      <StatTile
        label="Joueurs"
        :value="num(srv.info?.OnlinePlayers ?? 0)"
        :suffix="'/ ' + num(srv.info?.TotalPlayers ?? 0)"
        :hint="srv.info?.AdminOnline ? 'Admin connecté' : 'Aucun admin en jeu'"
      />
      <StatTile label="Objets vivants" :value="compact((srv.info?.Plants ?? 0) + (srv.info?.Animals ?? 0))" tone="info" />
      <StatTile label="Version" :value="srv.info?.Version ?? '--'" tone="muted" />
      <StatTile label="Accès" :value="srv.info?.Access ?? '--'" tone="muted" />
      <StatTile label="Niveau de simulation" :value="srv.info?.SimulationLevel ?? '--'" tone="muted" />
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Rapport de performance</h3>
          <p class="card__sub">Texte brut renvoyé par le moteur du serveur.</p>
        </div>
      </div>
      <StateBlock v-if="loading" kind="loading" title="Interrogation du serveur" />
      <AdminGuardNotice v-else-if="error" :error="error" />
      <pre v-else-if="report" class="pre-log">{{ report }}</pre>
      <StateBlock v-else kind="empty" title="Rapport vide" text="Le serveur n'a rien à signaler pour le moment." />
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Résultats de profilage</h3>
          <p class="card__sub">Fichiers déposés dans le dossier ProfilingResults du serveur.</p>
        </div>
        <span class="badge">{{ profiling.length }}</span>
      </div>
      <AdminGuardNotice v-if="profilingError" :error="profilingError" />
      <StateBlock
        v-else-if="profiling.length === 0"
        kind="empty"
        title="Aucun profilage"
        text="Lancez une capture depuis l'interface du serveur pour obtenir des fichiers ici."
      />
      <div v-else class="table-wrap">
        <table class="table table--compact">
          <thead><tr><th>Fichier</th><th class="u-right">Taille</th><th>Créé le</th></tr></thead>
          <tbody>
            <tr v-for="p in profiling" :key="p.Name">
              <td class="u-mono">{{ p.Name }}</td>
              <td class="u-right">{{ compact(p.Size) }} o</td>
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
