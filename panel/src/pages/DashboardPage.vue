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
import { t } from '@/i18n';

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
    .then(() => toasts.ok(t('dashboard.addressCopied'), url))
    .catch(() => toasts.fail(t('dashboard.copyFailed'), t('dashboard.clipboardRefused')));
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
            <span>{{ $t('dashboard.joinDiscord') }}</span>
          </a>
          <a
            v-if="site.rejoindrePossible"
            :href="LIEN_JEU"
            class="btn btn--primary btn--sm"
            :title="LIEN_JEU_SECOURS ? $t('dashboard.openEcoBackup', { lien: LIEN_JEU, secours: LIEN_JEU_SECOURS }) : $t('dashboard.openEco', { lien: LIEN_JEU })"
          >
            <Icon name="play" :size="15" />
            <span>{{ $t('dashboard.joinServer') }}</span>
          </a>
          <button v-if="site.rejoindrePossible" class="btn btn--ghost btn--sm" :title="$t('dashboard.copyAddressTitle', { adresse: site.adresseJeu() })" @click="copyJoin">
            <Icon name="copy" :size="15" />
            <span>{{ $t('dashboard.copyAddress') }}</span>
          </button>
        </div>
      </template>
    </SectionTitle>

    <StateBlock v-if="srv.error && !info" kind="error" :title="$t('dashboard.unreachable')" :text="srv.error">
      <button class="btn btn--primary btn--sm" @click="srv.refresh()">{{ $t('dashboard.retry') }}</button>
    </StateBlock>

    <template v-else>
      <MeteorCountdown />


      <div class="grid-tiles">
        <StatTile
          :label="$t('dashboard.tiles.onlinePlayers')"
          :value="num(info?.OnlinePlayers ?? 0)"
          :suffix="$t('dashboard.tiles.registered', { n: num(info?.TotalPlayers ?? 0) })"
          :tone="(info?.OnlinePlayers ?? 0) > 0 ? 'success' : 'muted'"
          :hint="info?.AdminOnline ? $t('dashboard.tiles.adminOnline') : undefined"
        />
        <StatTile
          :label="$t('dashboard.tiles.daysElapsed')"
          :value="num(info?.DaysRunning ?? 0)"
          :hint="info?.IsPaused ? $t('dashboard.tiles.paused') : undefined"
        />
        <StatTile :label="$t('dashboard.tiles.plants')" :value="compact(info?.Plants ?? 0)" tone="success" />
        <StatTile :label="$t('dashboard.tiles.animals')" :value="compact(info?.Animals ?? 0)" tone="info" />
        <StatTile :label="$t('dashboard.tiles.activeLaws')" :value="num(info?.Laws ?? 0)" tone="warning" />
        <StatTile :label="$t('dashboard.tiles.totalCulture')" :value="compact(info?.TotalCulture ?? 0)" tone="muted" />
      </div>

      <div class="dash__split">
        <ChartCard
          :title="$t('dashboard.charts.population')"
          :hint="$t('dashboard.charts.populationHint')"
          :names="['CitizenPopulation', 'ActiveCitizenPopulation', SERIE_CONNECTES]"
          height="240px"
        />
        <ChartCard
          :title="$t('dashboard.charts.climate')"
          :hint="$t('dashboard.charts.climateHint')"
          :names="['TotalCO2', 'AverageGlobalTemperature']"
          height="240px"
        />
      </div>

      <div class="dash__split">
        <ChartCard
          :title="$t('dashboard.charts.ecosystem')"
          :hint="$t('dashboard.charts.ecosystemHint')"
          :names="['PlantPopulation', 'TreePopulation', 'AnimalPopulation']"
          height="240px"
        />
        <ChartCard
          :title="$t('dashboard.charts.economy')"
          :hint="$t('dashboard.charts.economyHint')"
          :names="['PersonalWealthInDefaultCurrency', 'GovernmentHoldingsInDefaultCurrency']"
          height="240px"
        />
      </div>

      <div class="dash__split dash__split--aside">
        <section class="card">
          <div class="card__head">
            <h3 class="card__title">{{ $t('dashboard.connectedCitizens') }}</h3>
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
            :title="$t('dashboard.nobodyOnline')"
            :text="$t('dashboard.nobodyOnlineText')"
          />
        </section>

        <section class="card">
          <div class="card__head">
            <h3 class="card__title">{{ $t('dashboard.world.title') }}</h3>
          </div>
          <dl class="kv">
            <dt>{{ $t('dashboard.world.version') }}</dt>
            <dd>{{ info?.Version ?? '--' }}</dd>
            <dt>{{ $t('dashboard.world.category') }}</dt>
            <dd>{{ info?.Category ?? '--' }}</dd>
            <dt>{{ $t('dashboard.world.collaboration') }}</dt>
            <dd>{{ info?.CollaborationLevel ?? '--' }}</dd>
            <dt>{{ $t('dashboard.world.simulation') }}</dt>
            <dd>{{ info?.SimulationLevel ?? '--' }}</dd>
            <dt>{{ $t('dashboard.world.peakPlayers') }}</dt>
            <dd>{{ num(info?.PeakActivePlayers ?? 0) }}</dd>
            <dt>{{ $t('dashboard.world.economy') }}</dt>
            <dd>{{ info?.EconomyDesc ?? '--' }}</dd>
            <dt>{{ $t('dashboard.world.exhaustion') }}</dt>
            <dd>{{ info?.ExhaustionActive ? $t('dashboard.world.hours', { n: num(info?.ExhaustionAfterHours ?? 0) }) : $t('dashboard.world.disabled') }}</dd>
            <dt>{{ $t('dashboard.world.shelfLife') }}</dt>
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
