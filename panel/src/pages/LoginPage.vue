<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SectionTitle from '@/components/SectionTitle.vue';
import Icon from '@/components/Icon.vue';
import { useServerStore } from '@/stores/server';
import { useSessionStore } from '@/stores/session';
import { t } from '@/i18n';

const route = useRoute();
const router = useRouter();
const srv = useServerStore();
const session = useSessionStore();
const needsAdmin = computed(() => route.query.requis === 'admin');

/* --- Acces administrateur sans le jeu --- */
const cle = ref('');
const seSouvenir = ref(false);
const envoi = ref(false);
const erreurCle = ref<string | null>(null);

async function entrerAvecCle(): Promise<void> {
  if (!cle.value.trim() || envoi.value) return;
  envoi.value = true;
  erreurCle.value = null;
  try {
    const r = await session.signInWithKey(cle.value, seSouvenir.value);
    if (r === 'ok') {
      cle.value = '';
      const suite = typeof route.query.suite === 'string' && route.query.suite.startsWith('/')
        ? route.query.suite
        : '/admin';
      await router.push(suite);
    } else if (r === 'injoignable') {
      erreurCle.value = t('login.keyUnreachable');
    } else {
      erreurCle.value = t('login.keyRefused');
    }
  } finally {
    envoi.value = false;
  }
}
</script>

<template>
  <div class="login">
    <SectionTitle
      :level="1"
      :title="$t('login.title')"
      :hint="$t('login.hint')"
    />

    <div class="card login__card">
      <div v-if="needsAdmin" class="login__notice">
        <Icon name="shield" :size="18" />
        <div>
          <strong>{{ $t('login.adminOnly') }}</strong>
          <p class="u-muted">
            {{ $t('login.adminOnlyText') }}
          </p>
        </div>
      </div>

      <h3 class="card__title">{{ $t('login.howTo') }}</h3>
      <ol class="login__steps">
        <li>{{ $t('login.step1') }} <strong>{{ srv.name }}</strong>{{ $t('login.step1End') }}</li>
        <li>{{ $t('login.step2') }}</li>
        <li>
          {{ $t('login.step3') }}
        </li>
      </ol>

      <div class="login__foot">
        <p class="u-muted">
          {{ $t('login.publicText') }}
        </p>
        <div class="u-row-tight u-wrap">
          <a
            v-if="srv.info?.DiscordAddress"
            :href="srv.info.DiscordAddress"
            target="_blank"
            rel="noopener"
            class="btn btn--discord btn--sm"
          >
            <Icon name="discord" :size="15" />
            <span>{{ $t('login.discordHelp') }}</span>
          </a>
          <RouterLink to="/" class="btn btn--ghost btn--sm">{{ $t('login.backToDashboard') }}</RouterLink>
        </div>
      </div>

      <div v-if="session.hasSession" class="login__state">
        <span class="dot dot--on" />
        {{ $t('login.loggedInAs') }} <strong>{{ session.username }}</strong>
        <span v-if="session.isAdmin" class="badge badge--primary">{{ $t('login.admin') }}</span>
        <span v-if="session.viaCle" class="u-faint">{{ $t('login.viaKey') }}</span>
        <button class="btn btn--ghost btn--sm" @click="session.signOut()">{{ $t('login.signOut') }}</button>
      </div>
    </div>

    <form v-if="!session.viaCle" class="card login__card login__cle" @submit.prevent="entrerAvecCle">
      <h3 class="card__title">
        <Icon name="lock" :size="16" /> {{ $t('login.keyTitle') }}
      </h3>
      <p class="u-muted login__cle-texte">
        {{ $t('login.keyText1') }}<code>APIAdminAuthToken</code>{{ $t('login.keyText2') }}<code>Configs/Users.eco</code>{{ $t('login.keyText3') }}
      </p>
      <div class="login__cle-ligne">
        <input
          v-model="cle"
          class="input"
          type="password"
          :placeholder="$t('login.keyPlaceholder')"
          autocomplete="off"
          :aria-label="$t('login.keyPlaceholder')"
          data-1p-ignore
          data-lpignore="true"
          @input="erreurCle = null"
        />
        <button class="btn btn--primary" type="submit" :disabled="!cle.trim() || envoi">
          <span v-if="envoi" class="spinner" />
          <Icon v-else name="check" :size="15" />
          <span>{{ $t('login.enter') }}</span>
        </button>
      </div>
      <label class="checkbox">
        <input v-model="seSouvenir" type="checkbox" />
        <span>{{ $t('login.remember') }}</span>
      </label>
      <p v-if="erreurCle" class="login__cle-erreur">{{ erreurCle }}</p>
    </form>
  </div>
</template>

<style scoped>
.login { display: grid; gap: var(--sp-4); }
.login__card { max-width: 720px; }
.login__cle { display: grid; gap: var(--sp-3); }
.login__cle .card__title { display: flex; align-items: center; gap: var(--sp-2); margin: 0; }
.login__cle-texte { margin: 0; font-size: 13px; line-height: 1.5; }
.login__cle-texte code { font-size: 12px; }
.login__cle-ligne { display: grid; grid-template-columns: 1fr auto; gap: var(--sp-2); }
.login__cle-erreur { margin: 0; color: #ff8fa3; font-size: 13px; }
.login__notice {
  display: flex; gap: var(--sp-3); align-items: flex-start;
  background: rgb(var(--primary-rgb) / 0.1); border: 1px solid rgb(var(--primary-rgb) / 0.3);
  border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); margin-bottom: var(--sp-5);
  color: #ffb079;
}
.login__notice p { margin: 2px 0 0; font-size: 13px; }
.login__steps { margin: var(--sp-3) 0 var(--sp-5); padding-left: 22px; display: grid; gap: 8px; font-size: 13.5px; }
.login__foot { border-top: 1px solid var(--hairline); padding-top: var(--sp-4); display: grid; gap: var(--sp-4); }
.login__state {
  display: flex; align-items: center; gap: var(--sp-2); flex-wrap: wrap;
  margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--hairline);
  font-size: 13.5px;
}
</style>
