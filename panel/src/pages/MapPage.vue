<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import Icon from '@/components/Icon.vue';
import { prepareMapEngine } from '@/map/bootstrap';
import type { LayerGroup, MapEngine, MapViewElement } from '@/map/types';
import { worldMap } from '@/api/eco';
import { dateMonde, num } from '@/utils/format';
import { versReel } from '@/utils/horloge';

/** Legende servie par le serveur de jeu (hors bundle Vite). */
const MAP_KEY = '/images/map-key.png';

const frame = ref<HTMLDivElement | null>(null);
const view = ref<MapViewElement | null>(null);

const webglOk = ref(true);
const booting = ref(true);
const bootError = ref<string | null>(null);

const groups = ref<LayerGroup[]>([]);
const layer = ref('Terrain');
const paused = ref(true);
const speed = ref(0.5);
const flat = ref(false);
const currentTime = ref(0);
const serverTime = ref(0);
const position = ref('');
const info = ref('');
const dimension = ref<{ x: number; y: number; z: number } | null>(null);
const water = ref<number | null>(null);
const fullscreen = ref(false);

let engine: MapEngine | null = null;

const dayLabel = computed(() => {
  const secs = currentTime.value;
  // Heure reelle quand le mod fournit la correspondance, heure du monde sinon.
  if (versReel(secs)) return dateMonde(secs / 86400, true);
  const day = Math.floor(secs / 86400) + 1;
  const h = String(Math.floor((secs % 86400) / 3600)).padStart(2, '0');
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
  return `Jour ${day}, ${h}:${m}`;
});

const progress = computed(() =>
  serverTime.value > 0 ? Math.min(100, (currentTime.value / serverTime.value) * 100) : 0,
);

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return Boolean(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch {
    return false;
  }
}
function bindCallbacks(el: MapViewElement): void {
  el.OnTimeUpdated = (seconds) => {
    currentTime.value = seconds;
    serverTime.value = engine?.serverTime ?? 0;
  };
  el.OnInfoUpdated = (text) => { info.value = text; };
  el.OnPositionUpdated = (pos) => { position.value = `${Math.round(pos.x)}, ${Math.round(pos.y)}`; };
}

async function boot(): Promise<void> {
  if (!hasWebGL()) { webglOk.value = false; booting.value = false; return; }

  prepareMapEngine();
  try {
    // Import differe : le moteur pese lourd (three.js) et n’est utile qu’ici.
    const mod = await import('@/map/engine/ecomap');
    engine = mod.default as unknown as MapEngine;

    const el = view.value;
    if (!el) throw new Error('Conteneur de carte absent');

    if (engine.initialized) {
      engine.addView(el);
    } else {
      await engine.init();
    }
    bindCallbacks(el);

    // Les calques arrivent avec map.json ; on attend brievement leur presence.
    for (let i = 0; i < 40 && engine.layerGroups.length === 0; i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    groups.value = engine.layerGroups;
    serverTime.value = engine.serverTime;
    if (el.settings) {
      layer.value = el.settings.layerSelected;
      paused.value = el.settings.pause;
      speed.value = el.settings.playSpeed;
      flat.value = el.settings.flat;
      currentTime.value = el.settings.currentTime;
    }

    const [dim, lvl] = await Promise.all([
      worldMap.dimension().catch(() => null),
      worldMap.waterLevel().catch(() => null),
    ]);
    dimension.value = dim;
    water.value = lvl;
  } catch (err) {
    bootError.value = err instanceof Error ? err.message : 'Carte indisponible';
  } finally {
    booting.value = false;
  }
}

async function selectLayer(name: string): Promise<void> {
  layer.value = name;
  if (engine && view.value) await engine.setLayer(name, view.value);
}

function togglePlay(): void {
  const s = view.value?.settings;
  if (!s) return;
  s.pause = !s.pause;
  paused.value = s.pause;
}

function applySpeed(value: number): void {
  speed.value = value;
  const s = view.value?.settings;
  if (s) s.playSpeed = value;
}

function scrub(value: number): void {
  const s = view.value?.settings;
  if (!s) return;
  s.currentTime = value;
  currentTime.value = value;
}

function toggleFlat(): void {
  view.value?.toggle3D?.();
  flat.value = !flat.value;
}

function toggleFullscreen(): void {
  fullscreen.value = !fullscreen.value;
  // Le moteur recalcule sa taille a partir du canvas a chaque image rendue.
}

onMounted(() => void boot());

onBeforeUnmount(() => {
  const el = view.value;
  if (engine && el) {
    try { engine.removeView(el); } catch { /* le moteur peut deja etre demonte */ }
  }
});
</script>

<template>
  <div class="map">
    <SectionTitle
      :level="1"
      title="Carte du monde"
      hint="Moteur 3D du serveur : calques d’environnement, historique animé, districts et propriétés."
    >
      <template #actions>
        <div class="u-row-tight u-wrap">
          <span v-if="dimension" class="badge">
            {{ num(dimension.x) }} x {{ num(dimension.z) }} blocs
          </span>
          <span v-if="water !== null" class="badge badge--info">
            Niveau d’eau {{ num(water * 100, 1) }} %
          </span>
        </div>
      </template>
    </SectionTitle>

    <StateBlock
      v-if="!webglOk"
      kind="error"
      title="WebGL indisponible"
      text="Votre navigateur ou votre carte graphique n’autorise pas WebGL : la carte 3D ne peut pas s’afficher."
    />
    <StateBlock v-else-if="bootError" kind="error" title="Carte indisponible" :text="bootError" />

    <div v-else class="card card--flush map__shell" :class="{ 'map__shell--full': fullscreen }">
      <!-- Barre d’outils -->
      <div class="map__bar">
        <div class="select-wrap map__layer">
          <select class="select" :value="layer" @change="selectLayer(($event.target as HTMLSelectElement).value)">
            <optgroup v-for="g in groups" :key="g.category" :label="g.category || 'Divers'">
              <option v-for="l in g.layers" :key="l[0]" :value="l[0]">{{ l[1] }}</option>
            </optgroup>
            <option v-if="groups.length === 0" value="Terrain">Terrain</option>
          </select>
        </div>

        <button class="btn btn--primary btn--sm" :title="paused ? 'Lancer l\'animation' : 'Mettre en pause'" @click="togglePlay">
          <Icon :name="paused ? 'play' : 'pause'" :size="15" />
          <span>{{ paused ? 'Lire' : 'Pause' }}</span>
        </button>

        <label class="map__speed">
          <span class="field__label">Vitesse</span>
          <input
            type="range"
            min="0.05"
            max="4"
            step="0.05"
            :value="speed"
            @input="applySpeed(Number(($event.target as HTMLInputElement).value))"
          />
          <span class="u-mono">{{ num(speed, 2) }} j/s</span>
        </label>

        <div class="u-fill" />

        <button class="btn btn--ghost btn--sm" @click="toggleFlat">
          {{ flat ? '3D' : '2D' }}
        </button>
        <button class="btn btn--ghost btn--sm" :title="fullscreen ? 'Réduire' : 'Agrandir'" @click="toggleFullscreen">
          <Icon :name="fullscreen ? 'fullscreen_exit' : 'fullscreen'" :size="15" />
          <span>{{ fullscreen ? 'Réduire' : 'Plein écran' }}</span>
        </button>
      </div>

      <!-- Zone de rendu : le canvas et la vue partagent exactement le meme cadre -->
      <div ref="frame" class="map__frame">
        <canvas id="c" class="map__canvas" />
        <div id="main-map" ref="view" class="view-map map__view" />

        <div v-if="booting" class="map__veil"><span class="spinner" /></div>

        <div class="map__hud map__hud--left">
          <strong>{{ dayLabel }}</strong>
          <span v-if="position" class="u-faint">{{ position }}</span>
        </div>
        <div v-if="info" class="map__hud map__hud--right">{{ info }}</div>

        <img :src="MAP_KEY" alt="Légende des valeurs" class="map__key" />
      </div>

      <!-- Curseur temporel -->
      <div class="map__time">
        <input
          class="map__scrub"
          type="range"
          min="0"
          :max="serverTime || 1"
          step="600"
          :value="currentTime"
          @input="scrub(Number(($event.target as HTMLInputElement).value))"
        />
        <div class="meter map__progress"><div class="meter__fill" :style="{ width: progress + '%' }" /></div>
      </div>
    </div>

    <p class="map__note u-muted">
      Astuce : maintenez le bouton gauche pour faire pivoter la vue, la molette pour zoomer.
      L’historique d’un calque se charge à la première lecture, ce qui peut prendre quelques secondes.
    </p>
  </div>
</template>

<style scoped>
.map { display: grid; gap: var(--sp-4); }
.map__shell { display: flex; flex-direction: column; }
.map__shell--full {
  position: fixed; inset: 0; z-index: 90; border-radius: 0; border: 0;
}
.map__bar {
  display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap;
  padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--hairline);
  background: var(--surface-2);
}
.map__layer { min-width: 220px; }
.map__speed { display: flex; align-items: center; gap: var(--sp-2); font-size: 12px; }
.map__speed input { width: 110px; accent-color: var(--primary); }
.map__speed .field__label { margin: 0; }

.map__frame { position: relative; height: 62vh; min-height: 380px; background: #0f0d12; overflow: hidden; }
.map__shell--full .map__frame { height: auto; flex: 1 1 auto; }
.map__canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
.map__view { position: absolute; inset: 0; }
.map__veil { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(15, 13, 18, 0.7); }

.map__hud {
  position: absolute; bottom: var(--sp-3); display: flex; gap: var(--sp-3); align-items: center;
  padding: 6px 12px; border-radius: var(--r-ghost); font-size: 12.5px;
  background: rgba(22, 20, 25, 0.82); border: 1px solid var(--hairline);
  pointer-events: none;
}
.map__hud--left { left: var(--sp-3); }
.map__hud--right { right: var(--sp-3); max-width: 44%; }
.map__key {
  position: absolute; top: var(--sp-3); right: var(--sp-3); width: 190px;
  border-radius: var(--r-sm); opacity: 0.9; pointer-events: none;
}

.map__time { padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--hairline); display: grid; gap: var(--sp-2); }
.map__scrub { width: 100%; accent-color: var(--primary); }
.map__progress { opacity: 0.7; }
.map__note { font-size: 12.5px; }

@media (max-width: 720px) {
  .map__frame { height: 52vh; }
  .map__key { width: 130px; }
  .map__layer { min-width: 100%; }
}
</style>
