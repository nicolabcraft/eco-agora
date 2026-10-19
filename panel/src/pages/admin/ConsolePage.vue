<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import Icon from '@/components/Icon.vue';
import { commands } from '@/api/eco';
import { useToastStore } from '@/stores/toasts';
import { dateTime } from '@/utils/format';

interface Entry {
  command: string;
  at: number;
  errored: boolean;
  lines: string[];
}

const HISTORY_KEY = 'agora.console.history';
/**
 * Commandes dont l'effet est difficile à annuler : confirmation explicite.
 * Les noms viennent de l'aide du serveur (`/help`) : la modération vit sous `/manage`.
 */
const RISKY =
  /^\/?(manage\s+(ban|kick|mute|unban|unmute|admin|removeadmin|whitelist|unwhitelist)|ban|kick|mute|unban|unmute|removeadmin|unwhitelist|objects|meteor|sim|initialspawn|garbage|time\s+(?!now)\S|profiler|network|shutdown|restart|wipe|destroy)/i;

const toasts = useToastStore();
const input = ref('');
const running = ref(false);
const entries = ref<Entry[]>([]);
const history = ref<string[]>([]);
const historyIndex = ref(-1);
const pending = ref<string | null>(null);

const suggestions = [
  { cmd: '/players', help: 'Liste les joueurs connectés' },
  { cmd: '/time', help: 'Affiche l\u2019heure du monde' },
  { cmd: '/whitelist', help: 'Gère la liste blanche' },
  { cmd: '/admin', help: 'Gère les administrateurs' },
  { cmd: '/announce ', help: 'Message à tout le serveur' },
  { cmd: '/tp ', help: 'Téléporte un joueur' },
  { cmd: '/give ', help: 'Donne un objet' },
  { cmd: '/weather', help: 'État de la météo' },
  { cmd: '/help', help: 'Liste des commandes du serveur' },
];

const isRisky = computed(() => RISKY.test(input.value.trim()));

function pushHistory(cmd: string): void {
  history.value = [cmd, ...history.value.filter((c) => c !== cmd)].slice(0, 40);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.value)); } catch { /* mode privé */ }
}

async function run(cmd: string): Promise<void> {
  running.value = true;
  try {
    const res = await commands.exec(cmd);
    const lines = (res.CommandMessages ?? []).map((m) =>
      typeof m === 'string' ? m : String(m.Message ?? m.Text ?? ''),
    ).filter(Boolean);
    entries.value = [
      { command: cmd, at: Date.now(), errored: res.Errored, lines: lines.length ? lines : ['(aucune sortie)'] },
      ...entries.value,
    ].slice(0, 60);
    if (res.Errored) toasts.warn('La commande a signalé une erreur', cmd);
    else toasts.ok('Commande exécutée', cmd);
    pushHistory(cmd);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Échec de la commande';
    entries.value = [{ command: cmd, at: Date.now(), errored: true, lines: [message] }, ...entries.value];
    toasts.fail('Commande refusée', message);
  } finally {
    running.value = false;
  }
}

function submit(): void {
  const cmd = input.value.trim();
  if (!cmd || running.value) return;
  if (isRisky.value) { pending.value = cmd; return; }
  input.value = '';
  void run(cmd);
}

function confirmRisky(): void {
  const cmd = pending.value;
  pending.value = null;
  if (!cmd) return;
  input.value = '';
  void run(cmd);
}

function navigateHistory(delta: number): void {
  if (history.value.length === 0) return;
  const next = Math.min(history.value.length - 1, Math.max(-1, historyIndex.value + delta));
  historyIndex.value = next;
  input.value = next === -1 ? '' : history.value[next];
}

onMounted(() => {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (raw) history.value = JSON.parse(raw) as string[];
  } catch { /* ignore */ }
});
</script>

<template>
  <div class="cons">
    <SectionTitle
      :level="1"
      title="Console de commandes"
      hint="Exécute une commande du jeu côté serveur. Les commandes sensibles demandent une confirmation, et le serveur journalise les actions d'administration."
    />

    <section class="card">
      <div class="cons__bar">
        <div class="cons__prompt">
          <span class="cons__caret">&gt;</span>
          <input
            v-model="input"
            class="input cons__input"
            type="text"
            placeholder="/players"
            autocomplete="off"
            spellcheck="false"
            @keydown.enter.prevent="submit"
            @keydown.up.prevent="navigateHistory(1)"
            @keydown.down.prevent="navigateHistory(-1)"
          />
        </div>
        <button class="btn btn--primary" :disabled="!input.trim() || running" @click="submit">
          <span v-if="running" class="spinner" />
          <Icon v-else name="terminal" :size="15" />
          <span>Exécuter</span>
        </button>
      </div>

      <p class="cons__hint u-faint">
        Les commandes qui agissent sur un personnage (<code>/give</code>, <code>/teleport</code>...)
        sont refusées : le serveur exige un joueur en jeu, pas une commande web. Tapez
        <code>/help</code> ou une famille seule (<code>/manage</code>) pour voir ses sous-commandes.
      </p>

      <p v-if="isRisky" class="cons__warn">
        <Icon name="alert" :size="14" />
        Cette commande est considérée comme sensible : une confirmation sera demandée.
      </p>

      <div class="cons__chips">
        <button v-for="s in suggestions" :key="s.cmd" class="cons__chip" :title="s.help" @click="input = s.cmd">
          {{ s.cmd }}
        </button>
      </div>
    </section>

    <section class="card">
      <div class="card__head">
        <h3 class="card__title">Sorties</h3>
        <button v-if="entries.length" class="btn btn--ghost btn--sm" @click="entries = []">Vider l'affichage</button>
      </div>

      <StateBlock
        v-if="entries.length === 0"
        kind="empty"
        title="Aucune commande exécutée"
        text="La réponse du serveur, y compris ses messages d'erreur, s'affichera ici."
      />
      <ol v-else class="cons__log">
        <li v-for="(e, i) in entries" :key="i" :class="{ 'is-error': e.errored }">
          <div class="cons__log-head">
            <span class="u-mono">{{ e.command }}</span>
            <span class="u-faint">{{ dateTime(e.at) }}</span>
            <span class="badge" :class="e.errored ? 'badge--danger' : 'badge--success'">
              {{ e.errored ? 'erreur' : 'ok' }}
            </span>
          </div>
          <pre class="pre-log">{{ e.lines.join('\n') }}</pre>
        </li>
      </ol>
    </section>

    <ConfirmDialog
      :open="pending !== null"
      title="Commande sensible"
      text="Cette commande peut modifier durablement le serveur ou affecter des joueurs. Vérifiez-la avant de continuer."
      :detail="pending ?? ''"
      confirm-label="Exécuter la commande"
      danger
      @confirm="confirmRisky"
      @cancel="pending = null"
    />
  </div>
</template>

<style scoped>
.cons { display: grid; gap: var(--sp-5); }
.cons__bar { display: flex; gap: var(--sp-3); align-items: center; flex-wrap: wrap; }
.cons__prompt { position: relative; flex: 1 1 320px; display: flex; align-items: center; }
.cons__caret { position: absolute; left: 12px; color: var(--primary); font-family: var(--font-mono); font-weight: 700; }
.cons__input { padding-left: 28px; font-family: var(--font-mono); }
.cons__warn { display: flex; align-items: center; gap: 6px; margin: var(--sp-3) 0 0; font-size: 12.5px; color: #f5c45f; }
.cons__hint { margin: var(--sp-3) 0 0; font-size: 12px; }
.cons__hint code { background: rgba(0, 0, 0, 0.35); padding: 1px 5px; border-radius: 4px; font-family: var(--font-mono); }
.cons__chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: var(--sp-4); }
.cons__chip {
  border: 0; cursor: pointer; padding: 4px 11px; border-radius: 99px; font-size: 12px;
  font-family: var(--font-mono); background: rgba(255, 255, 255, 0.06); color: var(--text-muted);
}
.cons__chip:hover { background: rgb(var(--primary-rgb) / 0.18); color: #ffa163; }
.cons__log { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-3); }
.cons__log-head { display: flex; align-items: center; gap: var(--sp-3); flex-wrap: wrap; font-size: 12.5px; margin-bottom: 6px; }
.cons__log li.is-error .pre-log { border-color: rgba(229, 84, 75, 0.4); }
</style>
