<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import SectionTitle from '@/components/SectionTitle.vue';
import StateBlock from '@/components/StateBlock.vue';
import Icon from '@/components/Icon.vue';
import { useSiteStore } from '@/stores/site';
import { useToastStore } from '@/stores/toasts';
import { langues, t } from '@/i18n';
import { COULEUR_DEFAUT, siteDefaut, cloner, couleurRgb, fusionner, sectionVide, type SiteConfig } from '@/site/schema';

/**
 * Personnalisation du panel : tout ce qu'un autre serveur doit changer pour en
 * faire le sien, sans recompiler. Enregistre par le mod Eco Agora dans
 * Mods/EcoAgora/data/site.json, servi a tous les visiteurs.
 */

const site = useSiteStore();
const toasts = useToastStore();

const brouillon = ref<SiteConfig>(cloner(site.config));
const enregistrement = ref(false);
const fichier = ref<HTMLInputElement | null>(null);

const modifie = computed(() => JSON.stringify(brouillon.value) !== JSON.stringify(site.config));

const LANGUES = [
  { code: 'fr', nom: 'Français' },
  { code: 'en', nom: 'English' },
  { code: 'de', nom: 'Deutsch' },
  { code: 'es', nom: 'Español' },
  { code: 'ru', nom: 'Русский' },
  { code: 'zh', nom: '中文' },
];

// --- Champs derives -----------------------------------------------------------

/** Liste <-> texte, une entree par ligne (regles, lignes de conclusion). */
function versTexte(lignes: string[]): string {
  return lignes.join('\n');
}
function depuisTexte(texte: string): string[] {
  return texte.split('\n').map((l) => l.trim()).filter(Boolean);
}

const couleurValide = computed(() => !brouillon.value.identite.couleur || couleurRgb(brouillon.value.identite.couleur) !== null);
const couleurApercu = computed(() => (couleurValide.value && brouillon.value.identite.couleur) || COULEUR_DEFAUT);

const portValide = computed(() => {
  const p = brouillon.value.jeu.port;
  return Number.isInteger(p) && p >= 0 && p <= 65535;
});

/** Date ISO avec decalage <-> valeur d'un champ datetime-local (heure du navigateur). */
const dateLocale = computed({
  get(): string {
    const t = Date.parse(brouillon.value.ouverture.date);
    if (Number.isNaN(t)) return '';
    const d = new Date(t);
    const p = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  },
  set(v: string) {
    if (!v) { brouillon.value.ouverture.date = ''; return; }
    const d = new Date(v);
    const p = (n: number): string => String(Math.abs(n)).padStart(2, '0');
    const decalage = -d.getTimezoneOffset();
    const signe = decalage >= 0 ? '+' : '-';
    brouillon.value.ouverture.date = `${v}:00${signe}${p(Math.trunc(decalage / 60))}:${p(decalage % 60)}`;
  },
});

const dateValide = computed(() => !brouillon.value.ouverture.actif || !Number.isNaN(Date.parse(brouillon.value.ouverture.date)));

const erreurs = computed(() => {
  const e: string[] = [];
  if (!couleurValide.value) e.push(t('adminSite.erreurs.couleur'));
  if (!portValide.value) e.push(t('adminSite.erreurs.port'));
  if (!dateValide.value) e.push(t('adminSite.erreurs.date'));
  return e;
});

// --- Sections du reglement ----------------------------------------------------

function ajouterSection(): void {
  brouillon.value.reglement.sections.push(sectionVide());
}
function deplacer(i: number, sens: -1 | 1): void {
  const s = brouillon.value.reglement.sections;
  const j = i + sens;
  if (j < 0 || j >= s.length) return;
  [s[i], s[j]] = [s[j], s[i]];
}
function retirer(i: number): void {
  brouillon.value.reglement.sections.splice(i, 1);
}
function reglesExemple(): void {
  brouillon.value.reglement.sections = siteDefaut().reglement.sections;
}

// --- Actions ------------------------------------------------------------------

async function enregistrer(): Promise<void> {
  if (erreurs.value.length) return;
  enregistrement.value = true;
  try {
    await site.enregistrer(brouillon.value);
    brouillon.value = cloner(site.config);
    toasts.ok(t('adminSite.toasts.enregistre'), t('adminSite.toasts.enregistreTexte'));
  } catch (err) {
    toasts.fail(t('adminSite.toasts.refuse'), err instanceof Error ? err.message : '');
  } finally {
    enregistrement.value = false;
  }
}

function annuler(): void {
  brouillon.value = cloner(site.config);
}

function exporter(): void {
  const blob = new Blob([JSON.stringify(brouillon.value, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'site.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function importer(evt: Event): Promise<void> {
  const f = (evt.target as HTMLInputElement).files?.[0];
  if (!f) return;
  try {
    brouillon.value = fusionner(siteDefaut(), JSON.parse(await f.text()));
    toasts.ok(t('adminSite.toasts.charge'), t('adminSite.toasts.chargeTexte'));
  } catch {
    toasts.fail(t('adminSite.toasts.illisible'), t('adminSite.toasts.illisibleTexte'));
  } finally {
    if (fichier.value) fichier.value.value = '';
  }
}

// Ne pas perdre un travail en cours en changeant de page ou en fermant l'onglet.
function retenir(e: BeforeUnloadEvent): void {
  if (modifie.value) e.preventDefault();
}
onMounted(() => window.addEventListener('beforeunload', retenir));
onBeforeUnmount(() => window.removeEventListener('beforeunload', retenir));
onBeforeRouteLeave(() => !modifie.value || window.confirm(t('adminSite.confirmQuitter')));
</script>

<template>
  <div class="perso">
    <SectionTitle
      :level="1"
      :title="$t('adminSite.titre')"
      :hint="$t('adminSite.hint')"
    >
      <template #actions>
        <input ref="fichier" type="file" accept="application/json,.json" hidden @change="importer" />
        <button class="btn btn--ghost btn--sm" @click="fichier?.click()"><Icon name="upload" :size="15" /><span>{{ $t('adminSite.importer') }}</span></button>
        <button class="btn btn--ghost btn--sm" @click="exporter"><Icon name="download" :size="15" /><span>{{ $t('adminSite.exporter') }}</span></button>
      </template>
    </SectionTitle>

    <StateBlock
      v-if="!site.modDisponible"
      kind="locked"
      :title="$t('adminSite.modAbsentTitre')"
      :text="$t('adminSite.modAbsentTexte')"
    />
    <p v-else-if="site.erreur" class="perso__alerte">{{ $t('adminSite.erreurSite', { erreur: site.erreur }) }}</p>

    <!-- Identite -->
    <section class="card perso__bloc">
      <h2 class="card__title">{{ $t('adminSite.identite.titre') }}</h2>
      <div class="perso__grille">
        <label class="field">
          <span class="field__label">{{ $t('adminSite.identite.nom') }}</span>
          <input v-model.trim="brouillon.identite.nom" class="input" maxlength="60" :placeholder="site.nomServeur || $t('adminSite.identite.nomPlaceholder')" />
          <small class="u-faint">{{ $t('adminSite.identite.nomAide') }}</small>
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.identite.couleur') }}</span>
          <span class="perso__couleur">
            <input type="color" :value="couleurApercu" @input="brouillon.identite.couleur = ($event.target as HTMLInputElement).value" />
            <input v-model.trim="brouillon.identite.couleur" class="input" placeholder="#ff6b0d" maxlength="7" />
            <button v-if="brouillon.identite.couleur" class="btn btn--ghost btn--sm" :title="$t('adminSite.identite.couleurDefaut')" @click="brouillon.identite.couleur = ''">
              <Icon name="close" :size="14" />
            </button>
          </span>
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.identite.langue') }}</span>
          <select v-model="brouillon.identite.langue" class="select">
            <option v-for="l in langues" :key="l.code" :value="l.code">{{ l.nom }}</option>
          </select>
          <small class="u-faint">{{ $t('adminSite.identite.langueAide') }}</small>
        </label>
        <label class="field perso__large">
          <span class="field__label">{{ $t('adminSite.identite.baseline') }}</span>
          <input v-model="brouillon.identite.baseline" class="input" maxlength="200" :placeholder="$t('adminSite.identite.baselinePlaceholder')" />
        </label>
        <label class="field perso__large">
          <span class="field__label">{{ $t('adminSite.identite.logo') }}</span>
          <span class="perso__logo">
            <img :src="brouillon.identite.logo || '/brand/logo-192.png'" alt="" width="40" height="40" />
            <input v-model.trim="brouillon.identite.logo" class="input" :placeholder="$t('adminSite.identite.logoPlaceholder')" />
          </span>
          <small class="u-faint">{{ $t('adminSite.identite.logoAide') }}</small>
        </label>
      </div>
    </section>

    <!-- Rejoindre -->
    <section class="card perso__bloc">
      <h2 class="card__title">{{ $t('adminSite.jeu.titre') }}</h2>
      <div class="perso__grille">
        <label class="field">
          <span class="field__label">{{ $t('adminSite.jeu.hote') }}</span>
          <input v-model.trim="brouillon.jeu.hote" class="input" :placeholder="site.hote" />
          <small class="u-faint">{{ $t('adminSite.jeu.hoteAide') }}</small>
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.jeu.port') }}</span>
          <input v-model.number="brouillon.jeu.port" class="input" type="number" min="0" max="65535" />
          <small class="u-faint">{{ site.portServeur ? $t('adminSite.jeu.portAideConnu', { port: site.portServeur }) : $t('adminSite.jeu.portAide') }}</small>
        </label>
        <label class="field perso__large">
          <span class="field__label">{{ $t('adminSite.jeu.secours') }}</span>
          <input v-model.trim="brouillon.jeu.hoteSecours" class="input" :placeholder="$t('adminSite.jeu.secoursPlaceholder')" />
          <small class="u-faint">{{ $t('adminSite.jeu.secoursAide') }}</small>
        </label>
      </div>
    </section>

    <!-- Liens -->
    <section class="card perso__bloc">
      <h2 class="card__title">{{ $t('adminSite.liens.titre') }}</h2>
      <div class="perso__grille">
        <label class="field">
          <span class="field__label">{{ $t('adminSite.liens.site') }}</span>
          <input v-model.trim="brouillon.liens.site" class="input" :placeholder="$t('adminSite.liens.sitePlaceholder')" />
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.liens.libelle') }}</span>
          <input v-model.trim="brouillon.liens.siteLibelle" class="input" :placeholder="$t('adminSite.liens.libellePlaceholder')" />
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.liens.hebergeur') }}</span>
          <input v-model.trim="brouillon.liens.hebergeurMention" class="input" :placeholder="$t('adminSite.liens.hebergeurPlaceholder')" />
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.liens.hebergeurUrl') }}</span>
          <input v-model.trim="brouillon.liens.hebergeurUrl" class="input" placeholder="https://…" />
        </label>
      </div>
      <p class="u-faint perso__note">{{ $t('adminSite.liens.noteDiscord') }}</p>
    </section>

    <!-- Guides -->
    <section class="card perso__bloc">
      <h2 class="card__title">{{ $t('adminSite.guides.titre') }}</h2>
      <div class="perso__grille">
        <label class="field">
          <span class="field__label">{{ $t('adminSite.guides.langueWiki') }}</span>
          <select v-model="brouillon.wiki.langue" class="select">
            <option v-for="l in LANGUES" :key="l.code" :value="l.code">{{ l.nom }}</option>
          </select>
        </label>
        <div class="field">
          <span class="field__label">Eco Gnome</span>
          <label class="checkbox"><input v-model="brouillon.ecoGnome.actif" type="checkbox" /> {{ $t('adminSite.guides.afficherEcoGnome') }}</label>
        </div>
        <label v-if="brouillon.ecoGnome.actif" class="field perso__large">
          <span class="field__label">{{ $t('adminSite.guides.codeEcoGnome') }}</span>
          <input v-model.trim="brouillon.ecoGnome.codeParticipation" class="input" maxlength="40" />
        </label>
      </div>
    </section>

    <!-- Reglement -->
    <section class="card perso__bloc">
      <div class="perso__entete">
        <h2 class="card__title">{{ $t('adminSite.reglement.titre') }}</h2>
        <label class="checkbox"><input v-model="brouillon.reglement.actif" type="checkbox" /> {{ $t('adminSite.reglement.publier') }}</label>
      </div>
      <div class="perso__grille">
        <label class="field">
          <span class="field__label">{{ $t('adminSite.reglement.champTitre') }}</span>
          <input v-model="brouillon.reglement.titre" class="input" maxlength="80" />
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.reglement.signature') }}</span>
          <input v-model="brouillon.reglement.signature" class="input" maxlength="120" />
        </label>
        <label class="field perso__large">
          <span class="field__label">{{ $t('adminSite.reglement.intro') }}</span>
          <textarea v-model="brouillon.reglement.intro" class="textarea perso__texte" rows="2" />
        </label>
      </div>

      <div v-for="(s, i) in brouillon.reglement.sections" :key="i" class="perso__section">
        <div class="perso__section-tete">
          <span class="perso__num">{{ i + 1 }}</span>
          <input v-model="s.emoji" class="input perso__emoji" maxlength="8" :aria-label="$t('adminSite.reglement.emoji')" />
          <input v-model="s.titre" class="input" maxlength="80" :aria-label="$t('adminSite.reglement.titreSection')" />
          <button class="btn btn--ghost btn--icon btn--sm" :title="$t('adminSite.reglement.monter')" :disabled="i === 0" @click="deplacer(i, -1)"><Icon name="up" :size="15" /></button>
          <button class="btn btn--ghost btn--icon btn--sm" :title="$t('adminSite.reglement.descendre')" :disabled="i === brouillon.reglement.sections.length - 1" @click="deplacer(i, 1)"><Icon name="down" :size="15" /></button>
          <button class="btn btn--ghost btn--icon btn--sm" :title="$t('adminSite.reglement.supprimerSection')" @click="retirer(i)"><Icon name="delete" :size="15" /></button>
        </div>
        <div class="perso__grille">
          <label class="field perso__large">
            <span class="field__label">{{ $t('adminSite.reglement.introSection') }}</span>
            <input v-model="s.intro" class="input" />
          </label>
          <label class="field perso__large">
            <span class="field__label">{{ $t('adminSite.reglement.regles') }}</span>
            <textarea class="textarea perso__texte" rows="4" :value="versTexte(s.regles)" @change="s.regles = depuisTexte(($event.target as HTMLTextAreaElement).value)" />
          </label>
          <label class="field perso__large">
            <span class="field__label">{{ $t('adminSite.reglement.alerte') }}</span>
            <input v-model="s.alerte" class="input" />
          </label>
          <label class="checkbox perso__large">
            <input v-model="s.finale" type="checkbox" /> {{ $t('adminSite.reglement.finale') }}
          </label>
          <label v-if="s.finale" class="field perso__large">
            <span class="field__label">{{ $t('adminSite.reglement.fin') }}</span>
            <textarea class="textarea perso__texte" rows="3" :value="versTexte(s.fin)" @change="s.fin = depuisTexte(($event.target as HTMLTextAreaElement).value)" />
          </label>
        </div>
      </div>

      <div class="perso__actions-section">
        <button class="btn btn--ghost btn--sm" @click="ajouterSection"><Icon name="add" :size="15" /><span>{{ $t('adminSite.reglement.ajouterSection') }}</span></button>
        <button class="btn btn--ghost btn--sm" @click="reglesExemple"><Icon name="refresh" :size="15" /><span>{{ $t('adminSite.reglement.reglesExemple') }}</span></button>
      </div>
    </section>

    <!-- Rideau d'ouverture -->
    <section class="card perso__bloc">
      <div class="perso__entete">
        <h2 class="card__title">{{ $t('adminSite.ouverture.titre') }}</h2>
        <label class="checkbox"><input v-model="brouillon.ouverture.actif" type="checkbox" /> {{ $t('adminSite.ouverture.activer') }}</label>
      </div>
      <p class="u-faint perso__note">{{ $t('adminSite.ouverture.note') }}</p>
      <div class="perso__grille">
        <label class="field">
          <span class="field__label">{{ $t('adminSite.ouverture.date') }}</span>
          <input v-model="dateLocale" class="input" type="datetime-local" />
          <small class="u-faint">{{ $t('adminSite.ouverture.dateAide') }}</small>
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.ouverture.motDePasse') }}</span>
          <input v-model.trim="brouillon.ouverture.motDePasse" class="input" autocomplete="off" />
          <small class="perso__attention">{{ $t('adminSite.ouverture.motDePasseAide') }}</small>
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.ouverture.champTitre') }}</span>
          <input v-model="brouillon.ouverture.titre" class="input" maxlength="80" />
        </label>
        <label class="field">
          <span class="field__label">{{ $t('adminSite.ouverture.sousTitre') }}</span>
          <input v-model="brouillon.ouverture.sousTitre" class="input" maxlength="160" :placeholder="$t('adminSite.ouverture.sousTitrePlaceholder')" />
        </label>
      </div>
    </section>

    <!-- Barre d'enregistrement -->
    <div class="perso__barre" :class="{ 'is-visible': modifie }">
      <ul v-if="erreurs.length" class="perso__erreurs">
        <li v-for="e in erreurs" :key="e">{{ e }}</li>
      </ul>
      <span v-else class="u-muted">{{ $t('adminSite.barre.nonEnregistre') }}</span>
      <div class="perso__barre-boutons">
        <button class="btn btn--ghost btn--sm" @click="annuler">{{ $t('adminSite.barre.annuler') }}</button>
        <button class="btn btn--primary btn--sm" :disabled="enregistrement || !!erreurs.length || !site.modDisponible" @click="enregistrer">
          <Icon name="check" :size="15" /><span>{{ enregistrement ? $t('adminSite.barre.enregistrement') : $t('adminSite.barre.enregistrer') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.perso { display: grid; gap: var(--sp-4); padding-bottom: 88px; }
.perso__bloc { display: grid; gap: var(--sp-3); }
.perso__entete { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); flex-wrap: wrap; }
.perso__grille { display: grid; gap: var(--sp-3); grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.perso__large { grid-column: 1 / -1; }
.perso__note { margin: 0; font-size: 13px; }
.perso__alerte { margin: 0; padding: var(--sp-3); border-radius: var(--r-md); background: rgba(240, 196, 25, 0.08); border: 1px solid rgba(240, 196, 25, 0.3); }
.perso__attention { color: var(--warning); }
.perso__texte { font-family: inherit; min-height: 0; }
.perso__couleur, .perso__logo { display: flex; align-items: center; gap: var(--sp-2); }
.perso__couleur input[type='color'] { width: 40px; height: 34px; padding: 0; border: 1px solid var(--hairline-strong); border-radius: var(--r-sm); background: none; cursor: pointer; }
.perso__logo img { width: 40px; height: 40px; border-radius: 8px; object-fit: contain; background: var(--surface-inset); flex: none; }

.perso__section { display: grid; gap: var(--sp-3); padding: var(--sp-3); border: 1px solid var(--hairline); border-radius: var(--r-md); background: var(--surface-inset); }
.perso__section-tete { display: flex; align-items: center; gap: var(--sp-2); }
.perso__section-tete .input:not(.perso__emoji) { flex: 1; min-width: 0; }
.perso__emoji { width: 56px; text-align: center; flex: none; }
.perso__num {
  display: inline-grid; place-items: center; flex: none; width: 24px; height: 24px; border-radius: 50%;
  background: rgb(var(--primary-rgb) / 0.14); color: var(--primary); font-size: 12px; font-weight: 700;
}
.perso__actions-section { display: flex; gap: var(--sp-2); flex-wrap: wrap; }

.perso__barre {
  position: fixed; left: 50%; bottom: var(--sp-4); z-index: 50; transform: translate(-50%, 140%);
  display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-3) var(--sp-4);
  width: min(720px, calc(100% - 32px)); justify-content: space-between;
  background: var(--surface-2); border: 1px solid var(--hairline-strong); border-radius: var(--r-lg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45); transition: transform 0.2s ease;
}
.perso__barre.is-visible { transform: translate(-50%, 0); }
.perso__barre-boutons { display: flex; gap: var(--sp-2); flex: none; }
.perso__erreurs { margin: 0; padding-left: 1.1em; color: var(--danger); font-size: 13px; }
</style>
