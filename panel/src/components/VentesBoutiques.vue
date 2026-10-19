<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import StateBlock from '@/components/StateBlock.vue';
import { apiGet } from '@/api/http';
import { num } from '@/utils/format';
import { localeIntl, t } from '@/i18n';

/**
 * Qui a depense combien dans chaque boutique (administrateurs).
 * Donnees : /api/agora/ventes/resume, alimente par le mod a chaque transaction.
 */
const props = defineProps<{ boutiqueId?: string }>();

interface Montant { devise: string; montant: number }
interface Client { joueur: string; achats: number; articles: number; depense: Montant[]; dernier: string }
interface Fournisseur { joueur: string; ventes: number; articles: number; recu: Montant[] }
interface Boutique {
  boutiqueId: string | null; boutique: string | null; proprietaire: string | null;
  transactions: number; encaisse: Montant[]; clients: Client[]; fournisseurs: Fournisseur[];
}
interface Resume { transactions: number; premiere: string | null; boutiques: Boutique[] }

const PERIODES = [
  { jours: 1, libelle: t('ventesBoutiques.periode24h') },
  { jours: 7, libelle: t('ventesBoutiques.periode7j') },
  { jours: 0, libelle: t('ventesBoutiques.periodeTout') },
];

const jours = ref(0);
const resume = ref<Resume | null>(null);
const chargement = ref(true);
const erreur = ref<string | null>(null);

async function charger(): Promise<void> {
  chargement.value = true;
  erreur.value = null;
  try {
    resume.value = await apiGet<Resume>('/api/agora/ventes/resume', { params: { jours: jours.value } });
  } catch (e) {
    erreur.value = e instanceof Error ? e.message : t('ventesBoutiques.indisponibles');
    resume.value = null;
  } finally {
    chargement.value = false;
  }
}

const boutiques = computed(() =>
  (resume.value?.boutiques ?? []).filter((b) => !props.boutiqueId || b.boutiqueId === props.boutiqueId),
);

const depuis = computed(() => {
  const p = resume.value?.premiere;
  return p ? new Date(p).toLocaleString(localeIntl(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;
});

function montants(liste: Montant[]): string {
  if (!liste.length) return '--';
  return liste.map((m) => `${num(m.montant, 2)} ${m.devise || ''}`.trim()).join(' · ');
}

function quand(iso: string): string {
  return new Date(iso).toLocaleString(localeIntl(), { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

onMounted(() => void charger());
watch(jours, () => void charger());
</script>

<template>
  <div class="ventes">
    <div class="ventes__tete">
      <p class="u-muted ventes__info">
        <template v-if="resume">
          {{ $t('ventesBoutiques.transactions', { n: num(resume.transactions) }, resume.transactions) }}
          <template v-if="depuis">· {{ $t('ventesBoutiques.releveDepuis', { date: depuis }) }}</template>
        </template>
      </p>
      <div class="segmented">
        <button v-for="p in PERIODES" :key="p.jours" :class="{ 'is-active': jours === p.jours }" @click="jours = p.jours">
          {{ p.libelle }}
        </button>
      </div>
    </div>

    <StateBlock v-if="chargement" kind="loading" :title="$t('ventesBoutiques.lecture')" />
    <StateBlock
      v-else-if="erreur"
      kind="locked"
      :title="$t('ventesBoutiques.indisponibles')"
      :text="$t('ventesBoutiques.erreurTexte', { erreur })"
    />
    <StateBlock
      v-else-if="boutiques.length === 0"
      kind="empty"
      :title="$t('ventesBoutiques.aucuneVente')"
      :text="$t('ventesBoutiques.aucuneVenteTexte')"
    />

    <section v-for="b in boutiques" v-else :key="b.boutiqueId ?? b.boutique ?? ''" class="card ventes__boutique">
      <div class="card__head">
        <div>
          <h3 class="card__title">{{ b.boutique || $t('ventesBoutiques.boutique') }}</h3>
          <p class="card__sub">
            {{ b.proprietaire ? $t('ventesBoutiques.tenuePar', { nom: b.proprietaire }) : '' }} · {{ $t('ventesBoutiques.transactions', { n: num(b.transactions) }, b.transactions) }} ·
            {{ $t('ventesBoutiques.encaisse') }} <strong>{{ montants(b.encaisse) }}</strong>
          </p>
        </div>
      </div>

      <div v-if="b.clients.length" class="table-wrap">
        <table class="table table--compact">
          <thead>
            <tr><th>{{ $t('ventesBoutiques.col.client') }}</th><th class="u-right">{{ $t('ventesBoutiques.col.depense') }}</th><th class="u-right">{{ $t('ventesBoutiques.col.achats') }}</th><th class="u-right">{{ $t('ventesBoutiques.col.articles') }}</th><th>{{ $t('ventesBoutiques.col.dernierAchat') }}</th></tr>
          </thead>
          <tbody>
            <tr v-for="c in b.clients" :key="c.joueur">
              <td><strong>{{ c.joueur }}</strong></td>
              <td class="u-right u-nowrap">{{ montants(c.depense) }}</td>
              <td class="u-right">{{ num(c.achats) }}</td>
              <td class="u-right">{{ num(c.articles) }}</td>
              <td class="u-faint">{{ quand(c.dernier) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-else class="u-faint ventes__vide">{{ $t('ventesBoutiques.aucunAchat') }}</p>

      <template v-if="b.fournisseurs.length">
        <h4 class="ventes__sous">{{ $t('ventesBoutiques.boutiqueAAchete') }}</h4>
        <div class="table-wrap">
          <table class="table table--compact">
            <thead><tr><th>{{ $t('ventesBoutiques.col.joueur') }}</th><th class="u-right">{{ $t('ventesBoutiques.col.recu') }}</th><th class="u-right">{{ $t('ventesBoutiques.col.ventes') }}</th><th class="u-right">{{ $t('ventesBoutiques.col.articles') }}</th></tr></thead>
            <tbody>
              <tr v-for="f in b.fournisseurs" :key="f.joueur">
                <td><strong>{{ f.joueur }}</strong></td>
                <td class="u-right u-nowrap">{{ montants(f.recu) }}</td>
                <td class="u-right">{{ num(f.ventes) }}</td>
                <td class="u-right">{{ num(f.articles) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </section>
  </div>
</template>

<style scoped>
.ventes { display: grid; gap: var(--sp-4); }
.ventes__tete { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); flex-wrap: wrap; }
.ventes__info { margin: 0; font-size: 13px; }
.ventes__boutique { display: grid; gap: var(--sp-3); }
.ventes__sous { margin: var(--sp-2) 0 0; font-size: 13px; color: var(--text-muted); font-weight: 600; }
.ventes__vide { margin: 0; font-size: 13px; }
</style>
