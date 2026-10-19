<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import AdminGuardNotice from '@/components/AdminGuardNotice.vue';
import Icon from '@/components/Icon.vue';
import { chat, commands, stats } from '@/api/eco';
import type { ChatMessage } from '@/api/types';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toasts';
import { dateMonde, num, stripMarkup } from '@/utils/format';
import { t } from '@/i18n';

type Mode = 'all' | 'user' | 'tag';

const session = useSessionStore();
const toasts = useToastStore();

const mode = ref<Mode>('all');
const username = ref('');
const tag = ref('');
const startDay = ref(0);
const endDay = ref(0);
const messages = ref<ChatMessage[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const message = ref('');
/** `sendChat` exige un destinataire : un canal (#Général) ou un joueur. */
const recipient = ref('#General');
const broadcast = ref(true);
const sending = ref(false);

const senders = computed(() => {
  const counts = new Map<string, number>();
  for (const m of messages.value) counts.set(m.Sender, (counts.get(m.Sender) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
});

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  try {
    if (mode.value === 'user' && username.value.trim()) {
      messages.value = await chat.byUser(username.value.trim(), startDay.value, endDay.value);
    } else if (mode.value === 'tag' && tag.value.trim()) {
      messages.value = await chat.byTag(tag.value.trim(), startDay.value, endDay.value);
    } else {
      messages.value = await chat.range(startDay.value, endDay.value);
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('adminChat.erreurs.indisponible');
    messages.value = [];
  } finally {
    loading.value = false;
  }
}

async function loadMore(count: number): Promise<void> {
  loading.value = true;
  try {
    const older = await chat.previous(count);
    const seen = new Set(messages.value.map((m) => m.Timestamp + m.Sender + m.Text));
    messages.value = [...older.filter((m) => !seen.has(m.Timestamp + m.Sender + m.Text)), ...messages.value];
  } catch (err) {
    toasts.fail(t('adminChat.toasts.chargementImpossible'), err instanceof Error ? err.message : '');
  } finally {
    loading.value = false;
  }
}

async function send(): Promise<void> {
  const text = message.value.trim();
  if (!text) return;
  sending.value = true;
  try {
    if (broadcast.value) {
      // Diffusion a tout le serveur : commande d'annonce du jeu.
      const res = await commands.exec(`/manage announce ${text}`);
      if (res.Errored) throw new Error(t('adminChat.erreurs.annonceEchec'));
      toasts.ok(t('adminChat.toasts.annonceDiffusee'));
    } else {
      const to = recipient.value.trim();
      if (!to) {
        toasts.warn(t('adminChat.toasts.destinataire'), t('adminChat.toasts.destinataireTexte'));
        return;
      }
      await chat.send(to, text);
      toasts.ok(t('adminChat.toasts.envoye'), to);
    }
    message.value = '';
    await load();
  } catch (err) {
    toasts.fail(t('adminChat.toasts.envoiImpossible'), err instanceof Error ? err.message : '');
  } finally {
    sending.value = false;
  }
}

onMounted(async () => {
  const range = await stats.timeRange().catch(() => null);
  if (range) {
    startDay.value = Math.floor(range[0]);
    endDay.value = Math.ceil(range[1]) || 1;
  } else {
    endDay.value = 1;
  }
  await load();
});
</script>

<template>
  <div class="chat">
    <SectionTitle
      :level="1"
      :title="$t('adminChat.titre')"
      :hint="$t('adminChat.hint')"
    />

    <section class="card">
      <div class="chat__filters">
        <div class="segmented">
          <button :class="{ 'is-active': mode === 'all' }" @click="mode = 'all'; load()">{{ $t('adminChat.filtres.tout') }}</button>
          <button :class="{ 'is-active': mode === 'user' }" @click="mode = 'user'">{{ $t('adminChat.filtres.parJoueur') }}</button>
          <button :class="{ 'is-active': mode === 'tag' }" @click="mode = 'tag'">{{ $t('adminChat.filtres.parCanal') }}</button>
        </div>

        <label v-if="mode === 'user'" class="field chat__field">
          <span class="field__label">{{ $t('adminChat.filtres.joueur') }}</span>
          <input v-model="username" class="input" type="text" :placeholder="$t('adminChat.filtres.joueurPlaceholder')" @keydown.enter.prevent="load" />
        </label>
        <label v-if="mode === 'tag'" class="field chat__field">
          <span class="field__label">{{ $t('adminChat.filtres.canal') }}</span>
          <input v-model="tag" class="input" type="text" placeholder="general" @keydown.enter.prevent="load" />
        </label>

        <label class="field chat__field chat__field--sm">
          <span class="field__label">{{ $t('adminChat.filtres.jourDebut') }}</span>
          <input v-model.number="startDay" class="input" type="number" min="0" step="1" />
        </label>
        <label class="field chat__field chat__field--sm">
          <span class="field__label">{{ $t('adminChat.filtres.jourFin') }}</span>
          <input v-model.number="endDay" class="input" type="number" min="0" step="1" />
        </label>

        <button class="btn btn--primary btn--sm chat__go" :disabled="loading" @click="load">
          <Icon name="search" :size="15" /><span>{{ $t('adminChat.filtres.filtrer') }}</span>
        </button>
      </div>

      <div v-if="senders.length" class="chat__senders">
        <span class="field__label">{{ $t('adminChat.filtres.plusActifs') }}</span>
        <button
          v-for="[name, count] in senders"
          :key="name"
          class="badge chat__sender"
          @click="mode = 'user'; username = name; load()"
        >
          {{ stripMarkup(name) }} <span class="u-faint">{{ count }}</span>
        </button>
      </div>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ $t('adminChat.messages.titre') }}</h3>
          <p class="card__sub">{{ $t('adminChat.messages.charges', { n: num(messages.length) }, messages.length) }}</p>
        </div>
        <div class="u-row-tight">
          <button class="btn btn--ghost btn--sm" :disabled="loading" @click="loadMore(100)">
            {{ $t('adminChat.messages.plusAnciens') }}
          </button>
          <button class="btn btn--ghost btn--sm" :disabled="loading" @click="load">
            <Icon name="refresh" :size="14" />
          </button>
        </div>
      </div>

      <StateBlock v-if="loading && messages.length === 0" kind="loading" :title="$t('adminChat.messages.chargement')" />
      <AdminGuardNotice v-else-if="error" :error="error" />
      <StateBlock
        v-else-if="messages.length === 0"
        kind="empty"
        :title="$t('adminChat.messages.aucun')"
        :text="$t('adminChat.messages.aucunTexte')"
      />
      <ol v-else class="chat__list">
        <li v-for="(m, i) in messages" :key="i">
          <span class="chat__when u-faint">{{ dateMonde(m.Timestamp / 86400) }}</span>
          <strong class="chat__who">{{ stripMarkup(m.Sender) || '???' }}</strong>
          <span v-if="m.Receiver" class="badge chat__to">{{ stripMarkup(m.Receiver) }}</span>
          <span class="chat__text">{{ stripMarkup(m.Text) }}</span>
        </li>
      </ol>
    </section>

    <section class="card">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ $t('adminChat.ecrire.titre') }}</h3>
          <p class="card__sub">
            {{ $t('adminChat.ecrire.subAvant') }} <code>#General</code>{{ $t('adminChat.ecrire.subApres') }}
          </p>
        </div>
      </div>
      <div class="chat__compose">
        <label class="checkbox chat__mode">
          <input v-model="broadcast" type="checkbox" />
          <span>{{ $t('adminChat.ecrire.diffuserTout') }}</span>
        </label>
        <input
          v-if="!broadcast"
          v-model="recipient"
          class="input chat__to-field"
          type="text"
          :placeholder="$t('adminChat.ecrire.destinatairePlaceholder')"
        />
        <input
          v-model="message"
          class="input"
          type="text"
          :placeholder="$t('adminChat.ecrire.messagePlaceholder')"
          @keydown.enter.prevent="send"
        />
        <button class="btn btn--primary" :disabled="!message.trim() || sending" @click="send">
          <Icon name="send" :size="15" /><span>{{ broadcast ? $t('adminChat.ecrire.diffuser') : $t('adminChat.ecrire.envoyer') }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.chat { display: grid; gap: var(--sp-5); }
.chat__filters { display: flex; align-items: flex-end; gap: var(--sp-3); flex-wrap: wrap; }
.chat__field { width: 180px; }
.chat__field--sm { width: 110px; }
.chat__go { margin-bottom: 1px; }
.chat__senders { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--hairline); }
.chat__sender { border: 0; cursor: pointer; }
.chat__sender:hover { background: rgb(var(--primary-rgb) / 0.18); color: #ffa163; }
.chat__list { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; max-height: 560px; overflow-y: auto; font-size: 13.5px; }
.chat__list li { display: flex; align-items: baseline; gap: var(--sp-2); padding: 5px var(--sp-2); border-radius: var(--r-sm); flex-wrap: wrap; }
.chat__list li:nth-child(odd) { background: rgba(255, 255, 255, 0.02); }
.chat__when { font-family: var(--font-mono); font-size: 11px; white-space: nowrap; }
.chat__who { color: #ffa163; }
.chat__text { flex: 1 1 320px; min-width: 0; overflow-wrap: anywhere; }
.chat__compose { display: flex; gap: var(--sp-3); flex-wrap: wrap; align-items: center; }
.chat__mode { white-space: nowrap; }
.chat__to-field { flex: 0 1 200px; }
.chat__compose code { background: rgba(0, 0, 0, 0.35); padding: 1px 5px; border-radius: 4px; }
.chat__compose .input { flex: 1 1 280px; }
</style>
