<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StatTile from '@/components/StatTile.vue';
import StateBlock from '@/components/StateBlock.vue';
import AdminGuardNotice from '@/components/AdminGuardNotice.vue';
import ConfirmDialog from '@/components/ConfirmDialog.vue';
import Icon from '@/components/Icon.vue';
import { admin, commands, server } from '@/api/eco';
import type { User } from '@/api/types';
import { useServerStore } from '@/stores/server';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toasts';
import { num } from '@/utils/format';

interface Action {
  key: string;
  label: string;
  /** Commande réelle du serveur, relevée dans son aide (`/manage ...`). */
  command: string;
  danger: boolean;
  /** Ce que le serveur attend éventuellement après le nom du joueur. */
  argHint?: string;
}

/**
 * Toutes les actions de modération d'Eco vivent sous `/manage`.
 * Le complément est volontairement vide par défaut : certaines sous-commandes
 * attendent un motif, d'autres une durée, et une valeur inattendue les fait échouer.
 */
const MODERATION: Action[] = [
  { key: 'kick', label: 'Expulser', command: '/manage kick', danger: true, argHint: 'motif (facultatif)' },
  { key: 'ban', label: 'Bannir', command: '/manage ban', danger: true, argHint: 'motif (facultatif)' },
  { key: 'unban', label: 'Débannir', command: '/manage unban', danger: false, argHint: 'motif (facultatif)' },
  { key: 'mute', label: 'Museler', command: '/manage mute', danger: true, argHint: 'durée en heures (facultatif)' },
  { key: 'unmute', label: 'Démuseler', command: '/manage unmute', danger: false },
];

const RIGHTS: Action[] = [
  { key: 'admin', label: 'Donner admin', command: '/manage admin', danger: true, argHint: 'motif (facultatif)' },
  { key: 'removeadmin', label: 'Retirer admin', command: '/manage removeadmin', danger: true, argHint: 'motif (facultatif)' },
  { key: 'whitelist', label: 'Ajouter en liste blanche', command: '/manage whitelist', danger: false, argHint: 'motif (facultatif)' },
  { key: 'unwhitelist', label: 'Retirer de la liste blanche', command: '/manage unwhitelist', danger: true, argHint: 'motif (facultatif)' },
];

/** Commandes de consultation : elles affichent les listes tenues par le serveur. */
const LISTS = [
  { label: 'Joueurs connectés', command: '/manage players' },
  { label: 'Administrateurs', command: '/listadmins' },
  { label: 'Liste blanche', command: '/manage whitelist' },
  { label: 'Bannis', command: '/manage ban' },
  { label: 'Muselés', command: '/manage mute' },
  { label: 'Tous les comptes connus', command: '/listusers' },
];

const srv = useServerStore();
const session = useSessionStore();
const toasts = useToastStore();

const users = ref<User[]>([]);
const admins = ref<string[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const search = ref('');
const minHours = ref(0);

const target = ref('');
const extra = ref('');
const chosen = ref<Action | null>(null);
const rightsTarget = ref('');
const announce = ref('');
const busy = ref(false);
const output = ref<{ command: string; lines: string[]; errored: boolean } | null>(null);
const outputCard = ref<HTMLElement | null>(null);

const online = computed(() => new Set(srv.info?.OnlinePlayersNames ?? []));
/**
 * `Configs/Users.eco` declare les administrateurs par identifiant de compte
 * (PlayFab), parfois par SteamID ou par pseudo : on compare donc les trois.
 */
const adminSet = computed(() => new Set(admins.value.map((a) => a.trim().toLowerCase())));

function isAdminUser(u: User): boolean {
  const keys = [u.PlayFabId, u.SteamId, u.Name].filter(Boolean).map((k) => k.toLowerCase());
  if (keys.some((k) => adminSet.value.has(k))) return true;
  // Le porteur du jeton est administrateur si le serveur l'a confirme (/isadmin).
  return session.isAdmin && u.Name === session.username;
}

const rows = computed(() => {
  const q = search.value.trim().toLowerCase();
  return users.value
    .filter((u) => !q || u.Name.toLowerCase().includes(q))
    .sort(
      (a, b) =>
        Number(online.value.has(b.Name)) - Number(online.value.has(a.Name)) ||
        a.Name.localeCompare(b.Name, 'fr'),
    );
});

const preview = computed(() => {
  if (!chosen.value) return '';
  const arg = extra.value.trim();
  return `${chosen.value.command} ${target.value}${arg ? ` ${arg}` : ''}`;
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    users.value = await admin.users(minHours.value || undefined);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Liste indisponible';
  }
  admins.value = await server.admins().catch(() => []);
  loading.value = false;
}

/** La réponse s'affiche juste sous les boutons : on l'amène à l'écran. */
async function showOutput(): Promise<void> {
  await nextTick();
  outputCard.value?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function run(command: string): Promise<void> {
  busy.value = true;
  try {
    const res = await commands.exec(command);
    output.value = {
      command,
      errored: res.Errored,
      lines: (res.CommandMessages ?? [])
        .map((m) => (typeof m === 'string' ? m : String(m.Message ?? m.Text ?? '')))
        .filter(Boolean),
    };
    if (res.Errored) toasts.warn('Le serveur a signalé une erreur', command);
    else toasts.ok('Commande exécutée', command);
    await showOutput();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Échec';
    output.value = { command, errored: true, lines: [message] };
    toasts.fail('Action impossible', message);
    await showOutput();
  } finally {
    busy.value = false;
  }
}

function ask(action: Action, username: string): void {
  if (!username.trim()) {
    toasts.warn('Aucun joueur indiqué');
    return;
  }
  chosen.value = action;
  target.value = username.trim();
  extra.value = '';
}

function apply(): void {
  const command = preview.value;
  chosen.value = null;
  void run(command);
}

async function sendAnnounce(): Promise<void> {
  const message = announce.value.trim();
  if (!message) return;
  // `/api/v1/chat/sendChat` attend un destinataire (joueur ou canal) et exige
  // AllowDebugCalls ; la commande d'annonce du jeu diffuse a tout le serveur.
  await run(`/manage announce ${message}`);
  announce.value = '';
}

onMounted(() => void load());
</script>

<template>
  <div class="pl">
    <SectionTitle
      :level="1"
      title="Joueurs et modération"
      hint="Comptes connus du serveur et actions de modération. Chaque action est une commande /manage exécutée sous votre identité d’administrateur."
    >
      <template #actions>
        <button class="btn btn--ghost btn--sm" @click="load()">
          <Icon name="refresh" :size="15" /><span>Actualiser</span>
        </button>
      </template>
    </SectionTitle>

    <div class="grid-tiles">
      <StatTile label="Comptes connus" :value="num(users.length)" />
      <StatTile
        label="En ligne"
        :value="num(srv.info?.OnlinePlayers ?? 0)"
        :tone="(srv.info?.OnlinePlayers ?? 0) > 0 ? 'success' : 'muted'"
      />
      <StatTile label="Administrateurs" :value="num(admins.length)" tone="warning" />
      <StatTile label="Pic de joueurs actifs" :value="num(srv.info?.PeakActivePlayers ?? 0)" tone="info" />
    </div>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Annonce dans le chat</h3>
          <p class="card__sub">
            Diffuse un message à tous les joueurs connectés, via la commande d’annonce du jeu.
          </p>
        </div>
      </div>
      <div class="pl__row">
        <input
          v-model="announce"
          class="input"
          type="text"
          placeholder="Redémarrage prévu dans 10 minutes..."
          @keydown.enter.prevent="sendAnnounce"
        />
        <button class="btn btn--primary" :disabled="!announce.trim() || busy" @click="sendAnnounce">
          <Icon name="send" :size="15" /><span>Envoyer</span>
        </button>
      </div>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Listes du serveur</h3>
          <p class="card__sub">
            Interroge directement le serveur. La réponse s’affiche juste en dessous.
          </p>
        </div>
      </div>
      <div class="pl__chips">
        <button
          v-for="l in LISTS"
          :key="l.command"
          class="pl__chip"
          :title="l.command"
          :disabled="busy"
          @click="run(l.command)"
        >
          {{ l.label }}
        </button>
      </div>
    </section>

    <section v-if="output" ref="outputCard" class="card pl__output">
      <div class="card__head">
        <div>
          <h3 class="card__title">Réponse du serveur</h3>
          <p class="card__sub u-mono">{{ output.command }}</p>
        </div>
        <div class="u-row-tight">
          <span class="badge" :class="output.errored ? 'badge--danger' : 'badge--success'">
            {{ output.errored ? 'erreur' : 'ok' }}
          </span>
          <button class="btn btn--ghost btn--sm" @click="output = null">Fermer</button>
        </div>
      </div>
      <pre class="pre-log">{{ output.lines.length ? output.lines.join('\n') : '(aucune sortie)' }}</pre>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Comptes</h3>
          <p class="card__sub">
            L’API du serveur ne fournit que le nom et les identifiants de plateforme : ni temps de
            jeu, ni compétences, ni richesse.
          </p>
        </div>
        <div class="u-row-tight u-wrap">
          <input v-model="search" class="input pl__search" type="search" placeholder="Rechercher un joueur" />
          <label class="field pl__hours">
            <span class="field__label">Heures min.</span>
            <input v-model.number="minHours" class="input" type="number" min="0" step="1" @change="load()" />
          </label>
        </div>
      </div>

      <StateBlock v-if="loading" kind="loading" title="Chargement des comptes" />
      <AdminGuardNotice v-else-if="error" :error="error" />
      <StateBlock
        v-else-if="rows.length === 0"
        kind="empty"
        title="Aucun compte"
        text="Aucun joueur ne correspond aux filtres, ou personne n’a encore rejoint le monde."
      />
      <div v-else class="table-wrap">
        <table class="table">
          <thead>
            <tr><th>Joueur</th><th>Statut</th><th>Steam</th><th>PlayFab</th><th class="u-right">Modération</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in rows" :key="u.Name + u.SteamId">
              <td>
                <div class="u-row-tight">
                  <span class="dot" :class="online.has(u.Name) ? 'dot--on' : 'dot--off'" />
                  <strong>{{ u.Name }}</strong>
                  <span v-if="isAdminUser(u)" class="badge badge--primary">Admin</span>
                </div>
              </td>
              <td class="u-muted">{{ online.has(u.Name) ? 'En jeu' : 'Hors ligne' }}</td>
              <td class="u-mono u-faint">{{ u.SteamId || '--' }}</td>
              <td class="u-mono u-faint">{{ u.PlayFabId || '--' }}</td>
              <td>
                <div class="pl__actions">
                  <button
                    v-for="a in MODERATION"
                    :key="a.key"
                    class="btn btn--sm"
                    :class="a.danger ? 'btn--danger' : 'btn--ghost'"
                    :title="`${a.command} ${u.Name}`"
                    :disabled="busy"
                    @click="ask(a, u.Name)"
                  >
                    {{ a.label }}
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">Droits et liste blanche</h3>
          <p class="card__sub">
            Accepte un nom d’utilisateur, un identifiant de compte, un SteamID ou un slgid.
          </p>
        </div>
      </div>
      <div class="pl__row">
        <input v-model="rightsTarget" class="input" type="text" placeholder="Nom ou identifiant du joueur" />
      </div>
      <div class="pl__chips pl__chips--rights">
        <button
          v-for="a in RIGHTS"
          :key="a.key"
          class="btn btn--sm"
          :class="a.danger ? 'btn--danger' : 'btn--ghost'"
          :title="`${a.command} <joueur>`"
          :disabled="busy || !rightsTarget.trim()"
          @click="ask(a, rightsTarget)"
        >
          {{ a.label }}
        </button>
      </div>
    </section>


    <ConfirmDialog
      :open="chosen !== null"
      :title="`${chosen?.label ?? ''} : ${target}`"
      text="Cette commande est exécutée immédiatement sur le serveur de jeu, qui la journalise."
      :detail="preview"
      :confirm-label="chosen?.label ?? 'Confirmer'"
      :danger="chosen?.danger ?? false"
      :require-phrase="chosen?.danger ? target : undefined"
      @confirm="apply"
      @cancel="chosen = null"
    >
      <label v-if="chosen?.argHint" class="field">
        <span class="field__label">Complément &mdash; {{ chosen.argHint }}</span>
        <input v-model="extra" class="input" type="text" placeholder="laisser vide en cas de doute" />
        <span class="u-faint pl__arghint">
          Laissez vide si vous n’êtes pas sûr : certaines sous-commandes d’Eco refusent un
          complément inattendu.
        </span>
      </label>
    </ConfirmDialog>
  </div>
</template>

<style scoped>
.pl { display: grid; gap: var(--sp-5); }
.pl__row { display: flex; gap: var(--sp-3); flex-wrap: wrap; }
.pl__row .input { flex: 1 1 280px; }
.pl__search { width: 190px; }
.pl__hours { width: 110px; }
.pl__actions { display: flex; gap: 4px; justify-content: flex-end; flex-wrap: wrap; }
.pl__chips { display: flex; flex-wrap: wrap; gap: 6px; }
.pl__chips--rights { margin-top: var(--sp-3); }
.pl__chip {
  border: 0; cursor: pointer; padding: 6px 14px; border-radius: 99px; font-size: 12.5px;
  background: rgba(255, 255, 255, 0.06); color: var(--text-muted);
}
.pl__chip:hover:not(:disabled) { background: rgb(var(--primary-rgb) / 0.18); color: #ffa163; }
.pl__chip:disabled { opacity: 0.5; cursor: not-allowed; }
.pl__arghint { display: block; font-size: 11.5px; margin-top: 4px; }
.pl__output { border-color: rgb(var(--primary-rgb) / 0.35); }
</style>
