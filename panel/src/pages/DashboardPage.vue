<script setup lang="ts">
import { computed } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StatTile from '@/components/StatTile.vue';
import ChartCard from '@/components/ChartCard.vue';
import StateBlock from '@/components/StateBlock.vue';
import Icon from '@/components/Icon.vue';
import { useServerStore } from '@/stores/server';
import { useToastStore } from '@/stores/toasts';
import { compact, num, stripMarkup } from '@/utils/format';
import { useSiteStore } from '@/stores/site';
import MeteorCountdown from '@/components/MeteorCountdown.vue';
import { SERIE_CONNECTES } from '@/composables/useSeries';

const srv = useServerStore();
const toasts = useToastStore();
const info = computed(() => srv.info);

/** Adresse de connexion : celle de la personnalisation, sinon le site et le port lu par le mod. */
const site = useSiteStore();
const LIEN_JEU = computed(() => site.lienJeu());
const LIEN_JEU_SECOURS = computed(() => (site.config.jeu.hoteSecours ? site.lienJeu(true) : ''));

function copyJoin(): void {
  const url = site.adresseJeu();
  void navigator.clipboard
    .writeText(url)
    .then(() => toasts.ok('Adresse copiée', url))
    .catch(() => toasts.fail('Copie impossible', 'Le navigateur a refusé l’accès au presse-papiers.'));
}
</script>


<template>
  <div class="dash">
    <SectionTitle
      :level="1"
      :title="srv.name"
      :hint="stripMarkup(info?.DetailedDescription) || site.config.identite.baseline"
    >
      <template #actions>
        <div class="u-row-tight u-wrap">
          <a
            v-if="info?.DiscordAddress"
            :href="info.DiscordAddress"
            target="_blank"
            rel="noopener"
            class="btn btn--discord btn--sm"
          >
            <Icon name="discord" :size="15" />
            <span>Rejoindre le Discord</span>
          </a>
          <a
            v-if="site.rejoindrePossible"
            :href="LIEN_JEU"
            class="btn btn--primary btn--sm"
            :title="LIEN_JEU_SECOURS ? `Ouvre Eco sur ${LIEN_JEU}. Autre adresse : ${LIEN_JEU_SECOURS}` : `Ouvre Eco sur ${LIEN_JEU}`"
          >
            <Icon name="play" :size="15" />
            <span>Rejoindre le serveur</span>
          </a>
          <button v-if="site.rejoindrePossible" class="btn btn--ghost btn--sm" :title="`Copier ${site.adresseJeu()} pour la connexion directe`" @click="copyJoin">
            <Icon name="copy" :size="15" />
            <span>Copier l’adresse</span>
          </button>
        </div>
      </template>
    </SectionTitle>

    <StateBlock v-if="srv.error && !info" kind="error" title="Serveur injoignable" :text="srv.error">
      <button class="btn btn--primary btn--sm" @click="srv.refresh()">Réessayer</button>
    </StateBlock>

    <template v-else>
      <MeteorCountdown />


      <div class="grid-tiles">
        <StatTile
          label="Joueurs en ligne"
          :value="num(info?.OnlinePlayers ?? 0)"
          :suffix="'/ ' + num(info?.TotalPlayers ?? 0) + ' inscrits'"
          :tone="(info?.OnlinePlayers ?? 0) > 0 ? 'success' : 'muted'"
          :hint="info?.AdminOnline ? 'Un administrateur est connecté' : undefined"
        />
        <StatTile
          label="Jours écoulés"
          :value="num(info?.DaysRunning ?? 0)"
          :hint="info?.IsPaused ? 'Simulation en pause' : undefined"
        />
        <StatTile label="Plantes" :value="compact(info?.Plants ?? 0)" tone="success" />
        <StatTile label="Animaux" :value="compact(info?.Animals ?? 0)" tone="info" />
        <StatTile label="Lois actives" :value="num(info?.Laws ?? 0)" tone="warning" />
        <StatTile label="Culture totale" :value="compact(info?.TotalCulture ?? 0)" tone="muted" />
      </div>

      <div class="dash__split">
        <ChartCard
          title="Population citoyenne"
          hint="Citoyens totaux, actifs et connectés"
          :names="['CitizenPopulation', 'ActiveCitizenPopulation', SERIE_CONNECTES]"
          height="240px"
        />
        <ChartCard
          title="Climat"
          hint="CO2 atmosphérique et température moyenne"
          :names="['TotalCO2', 'AverageGlobalTemperature']"
          height="240px"
        />
      </div>

      <div class="dash__split">
        <ChartCard
          title="Écosystème"
          hint="Plantes, arbres et animaux du monde"
          :names="['PlantPopulation', 'TreePopulation', 'AnimalPopulation']"
          height="240px"
        />
        <ChartCard
          title="Économie"
          hint="Richesse des citoyens et trésor public"
          :names="['PersonalWealthInDefaultCurrency', 'GovernmentHoldingsInDefaultCurrency']"
          height="240px"
        />
      </div>

      <div class="dash__split dash__split--aside">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">Citoyens connectés</h3>
            <span class="badge badge--primary">{{ num(info?.OnlinePlayers ?? 0) }}</span>
          </div>
          <ul v-if="(info?.OnlinePlayersNames?.length ?? 0) > 0" class="dash__players">
            <li v-for="name in info?.OnlinePlayersNames" :key="name">
              <span class="dot dot--on" />
              <span class="u-ellipsis">{{ name }}</span>
            </li>
          </ul>
          <StateBlock
            v-else
            kind="empty"
            title="Personne en ligne"
            text="Les citoyens connectés apparaîtront ici en temps réel."
          />
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">État du monde</h3>
          </div>
          <dl class="kv">
            <dt>Version du serveur</dt>
            <dd>{{ info?.Version ?? '--' }}</dd>
            <dt>Catégorie</dt>
            <dd>{{ info?.Category ?? '--' }}</dd>
            <dt>Collaboration</dt>
            <dd>{{ info?.CollaborationLevel ?? '--' }}</dd>
            <dt>Simulation</dt>
            <dd>{{ info?.SimulationLevel ?? '--' }}</dd>
            <dt>Pic de joueurs actifs</dt>
            <dd>{{ num(info?.PeakActivePlayers ?? 0) }}</dd>
            <dt>Économie</dt>
            <dd>{{ info?.EconomyDesc ?? '--' }}</dd>
            <dt>Épuisement</dt>
            <dd>{{ info?.ExhaustionActive ? num(info?.ExhaustionAfterHours ?? 0) + ' h' : 'Désactivé' }}</dd>
            <dt>Durée de vie des aliments</dt>
            <dd>x{{ num(info?.ShelfLifeMultiplier ?? 1, 1) }}</dd>
          </dl>
        </section>
      </div>
    </template>
  </div>
</template>

<style scoped>
.dash { display: grid; gap: var(--sp-5); }
.dash__split { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); }
.dash__split--aside { grid-template-columns: minmax(280px, 1fr) minmax(340px, 1.4fr); }
.dash__players {
  list-style: none; margin: 0; padding: 0; display: grid; gap: 7px;
  max-height: 280px; overflow-y: auto;
}
.dash__players li { display: flex; align-items: center; gap: var(--sp-2); font-size: 13.5px; }
@media (max-width: 900px) {
  .dash__split, .dash__split--aside { grid-template-columns: 1fr; }
}
</style>
