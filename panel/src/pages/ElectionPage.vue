<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import Icon from '@/components/Icon.vue';
import { civics } from '@/api/eco';
import type { Election } from '@/api/types';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toasts';
import { dateTime, days, num, stripMarkup } from '@/utils/format';
import EcoTexte from '@/components/EcoTexte.vue';

const route = useRoute();
const session = useSessionStore();
const toasts = useToastStore();

const election = ref<Election | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const ranking = ref<number[]>([]);
const sending = ref(false);
const comment = ref('');

const id = computed(() => Number(route.params.id));
const canVote = computed(
  () => Boolean(election.value) && !election.value!.Finished && session.isLoggedIn,
);

async function load(): Promise<void> {
  loading.value = true;
  error.value = null;
  ranking.value = [];
  try {
    election.value = await civics.election(id.value);
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Élection introuvable';
  } finally {
    loading.value = false;
  }
}

function rankOf(choiceId: number): number {
  return ranking.value.indexOf(choiceId) + 1;
}

function toggleRank(choiceId: number): void {
  ranking.value = ranking.value.includes(choiceId)
    ? ranking.value.filter((c) => c !== choiceId)
    : [...ranking.value, choiceId];
}

async function submitVote(): Promise<void> {
  if (!election.value || ranking.value.length === 0 || !session.username) return;
  sending.value = true;
  try {
    await civics.vote({
      ElectionID: election.value.Id,
      Voter: session.username,
      RankedVotes: [...ranking.value],
    });
    toasts.ok('Vote enregistré', 'Merci pour votre participation.');
    await load();
  } catch (err) {
    toasts.fail('Vote refusé', err instanceof Error ? err.message : 'Réessayez depuis le jeu.');
  } finally {
    sending.value = false;
  }
}

async function submitComment(): Promise<void> {
  if (!election.value || !comment.value.trim()) return;
  sending.value = true;
  try {
    await civics.addComment(election.value.Id, comment.value.trim(), session.username);
    comment.value = '';
    toasts.ok('Commentaire publié');
    await load();
  } catch (err) {
    toasts.fail('Commentaire refusé', err instanceof Error ? err.message : 'Action indisponible.');
  } finally {
    sending.value = false;
  }
}

onMounted(() => void load());
watch(id, () => void load());
</script>

<template>
  <div class="elec">
    <RouterLink to="/gouvernance" class="elec__back">
      <Icon name="chevron" :size="14" class="elec__back-icon" /> Retour à la gouvernance
    </RouterLink>

    <StateBlock v-if="loading" kind="loading" title="Chargement de l'élection" />
    <StateBlock v-else-if="error" kind="error" title="Élection introuvable" :text="error">
      <RouterLink to="/gouvernance" class="btn btn--primary btn--sm">Liste des élections</RouterLink>
    </StateBlock>

    <template v-else-if="election">
      <SectionTitle
        :level="1"
        :title="stripMarkup(election.Name) || 'Élection ' + election.Id"
      >
        <template #actions>
          <span
            class="badge"
            :class="election.Finished ? (election.Passed ? 'badge--success' : 'badge--danger') : 'badge--primary'"
          >
            {{ election.Finished ? (election.Passed ? 'Adoptée' : 'Rejetée') : 'En cours' }}
          </span>
        </template>
      </SectionTitle>

      <!-- Description d'Eco : elle contient souvent un tableau des votes en cours. -->
      <section v-if="election.ElectionDescription || election.UserDescription" class="card elec__desc">
        <EcoTexte :texte="election.ElectionDescription || election.UserDescription" />
      </section>

      <div class="elec__grid">
        <div class="elec__main">
          <!-- Choix et vote -->
          <section class="card">
            <div class="card__head">
              <div>
                <h3 class="card__title">
                  {{ election.BooleanElection ? 'Proposition' : 'Candidats et options' }}
                </h3>
                <p class="card__sub">
                  {{ election.PollElection ? 'Sondage' : 'Scrutin à vote alternatif' }} &middot;
                  {{ num(election.TotalVotes) }} vote(s) exprimé(s)
                </p>
              </div>
            </div>

            <StateBlock
              v-if="election.Choices.length === 0"
              kind="empty"
              title="Aucun choix publié"
              text="Le serveur n'expose pas d'option pour cette élection."
            />
            <ul v-else class="elec__choices">
              <li v-for="c in election.Choices" :key="c.Id">
                <button
                  class="elec__choice"
                  :class="{ 'is-picked': rankOf(c.Id) > 0, 'is-locked': !canVote }"
                  :disabled="!canVote"
                  @click="toggleRank(c.Id)"
                >
                  <span class="elec__rank">{{ rankOf(c.Id) || '-' }}</span>
                  <span class="u-fill">
                    <strong>{{ stripMarkup(c.Name) }}</strong>
                    <span v-if="stripMarkup(c.Speech)" class="u-muted elec__speech">
                      {{ stripMarkup(c.Speech) }}
                    </span>
                  </span>
                </button>
              </li>
            </ul>

            <div v-if="canVote" class="elec__vote">
              <p class="u-muted">
                Cliquez les options dans votre ordre de préférence, du plus au moins souhaité.
              </p>
              <button
                class="btn btn--primary"
                :disabled="ranking.length === 0 || sending"
                @click="submitVote"
              >
                <Icon name="check" :size="15" />
                <span>Soumettre mon vote</span>
              </button>
            </div>
            <div v-else-if="!election.Finished" class="elec__vote u-muted">
              <Icon name="shield" :size="15" />
              <span>Ouvrez ce panel depuis le jeu pour pouvoir voter.</span>
            </div>
          </section>

          <!-- Commentaires -->
          <section class="card">
            <div class="card__head">
              <h3 class="card__title">Débat</h3>
              <span class="badge">{{ election.Comments.length }}</span>
            </div>

            <StateBlock
              v-if="election.Comments.length === 0"
              kind="empty"
              title="Aucun commentaire"
              text="Les échanges des citoyens sur cette élection apparaîtront ici."
            />
            <ul v-else class="elec__comments">
              <li v-for="(c, i) in election.Comments" :key="i">
                <div class="elec__comment-head">
                  <strong>{{ stripMarkup(c.Username) || 'Anonyme' }}</strong>
                  <span class="u-faint">{{ dateTime(c.Timestamp) }}</span>
                </div>
                <p>{{ stripMarkup(c.Text) }}</p>
              </li>
            </ul>

            <div v-if="session.isLoggedIn && !election.Finished" class="elec__compose">
              <label class="field">
                <span class="field__label">Votre commentaire</span>
                <textarea v-model="comment" class="textarea" rows="3" placeholder="Argumentez votre position..." />
              </label>
              <button class="btn btn--ghost btn--sm" :disabled="!comment.trim() || sending" @click="submitComment">
                <Icon name="send" :size="14" /><span>Publier</span>
              </button>
            </div>
          </section>
        </div>

        <!-- Colonne latérale -->
        <aside class="elec__side">
          <section class="card">
            <div class="card__head"><h3 class="card__title">Informations</h3></div>
            <dl class="kv">
              <dt>Initiateur</dt>
              <dd>{{ stripMarkup(election.Creator) || '--' }}</dd>
              <dt>État</dt>
              <dd>{{ election.State || '--' }}</dd>
              <dt>Début</dt>
              <dd>{{ days(Math.abs(election.TimeStartAgo ?? 0) / 86400) }}</dd>
              <dt>{{ election.Finished ? 'Terminée depuis' : 'Fin dans' }}</dt>
              <dd>{{ days(Math.abs(election.TimeEndAgo ?? 0) / 86400) }}</dd>
              <dt>Type</dt>
              <dd>{{ election.BooleanElection ? 'Oui / Non' : election.PollElection ? 'Sondage' : 'Alternatif' }}</dd>
            </dl>
          </section>

          <section v-if="election.Results" class="card">
            <div class="card__head"><h3 class="card__title">Résultats</h3></div>
            <dl class="kv">
              <dt>Issue</dt>
              <dd><EcoTexte v-if="election.Results.Result" :texte="election.Results.Result" /><template v-else>--</template></dd>
              <dt>Votes gagnants</dt>
              <dd>{{ num(election.Results.TotalVotesForWinner) }}</dd>
            </dl>
            <div v-if="election.Results.Winners?.length" class="elec__winners">
              <span class="field__label">Vainqueurs</span>
              <p>{{ election.Results.Winners.map((w) => stripMarkup(String(w))).join(', ') }}</p>
            </div>
          </section>

          <section v-if="election.PositionForWinner" class="card">
            <div class="card__head"><h3 class="card__title">Poste en jeu</h3></div>
            <p><strong>{{ stripMarkup(election.PositionForWinner.Name) }}</strong></p>
            <p class="u-muted">{{ stripMarkup(election.PositionForWinner.UserDescription) || '--' }}</p>
          </section>
        </aside>
      </div>
    </template>
  </div>
</template>

<style scoped>
.elec__desc { font-size: 14px; color: var(--text-muted); }
.elec { display: grid; gap: var(--sp-4); }
.elec__back { display: inline-flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-muted); }
.elec__back:hover { color: var(--primary); }
.elec__back-icon { transform: rotate(180deg); }
.elec__grid { display: grid; gap: var(--sp-4); grid-template-columns: minmax(0, 1.7fr) minmax(280px, 1fr); align-items: start; }
.elec__main { display: grid; gap: var(--sp-4); }
.elec__side { display: grid; gap: var(--sp-4); }

.elec__choices { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }
.elec__choice {
  display: flex; align-items: flex-start; gap: var(--sp-3); width: 100%; text-align: left;
  background: var(--surface-2); border: 1px solid var(--hairline); color: var(--text);
  border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); cursor: pointer;
  transition: all 0.14s var(--ease);
}
.elec__choice:hover:not(.is-locked) { border-color: rgb(var(--primary-rgb) / 0.4); }
.elec__choice.is-picked { border-color: var(--primary); background: rgb(var(--primary-rgb) / 0.09); }
.elec__choice.is-locked { cursor: default; opacity: 0.9; }
.elec__rank {
  display: grid; place-items: center; width: 26px; height: 26px; flex: none;
  border-radius: 50%; background: rgba(255, 255, 255, 0.08); font-size: 12.5px; font-weight: 700;
}
.elec__choice.is-picked .elec__rank { background: var(--primary); color: var(--text-on-primary); }
.elec__speech { display: block; font-size: 12.5px; margin-top: 3px; }
.elec__vote {
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4);
  flex-wrap: wrap; margin-top: var(--sp-4); padding-top: var(--sp-4);
  border-top: 1px solid var(--hairline); font-size: 13px;
}

.elec__comments { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-3); }
.elec__comments li { background: var(--surface-2); border-radius: var(--r-md); padding: var(--sp-3) var(--sp-4); }
.elec__comment-head { display: flex; justify-content: space-between; gap: var(--sp-3); font-size: 12.5px; margin-bottom: 4px; }
.elec__comments p { margin: 0; font-size: 13.5px; }
.elec__compose { display: grid; gap: var(--sp-3); justify-items: start; margin-top: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--hairline); }
.elec__compose .field { width: 100%; }
.elec__winners { margin-top: var(--sp-3); padding-top: var(--sp-3); border-top: 1px solid var(--hairline); }
.elec__winners p { margin: 4px 0 0; font-weight: 600; }

@media (max-width: 1000px) { .elec__grid { grid-template-columns: 1fr; } }
</style>
