<script setup lang="ts">
import { ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import Icon from '@/components/Icon.vue';
import { useSiteStore } from '@/stores/site';
import { t } from '@/i18n';

/**
 * Acces au wiki officiel, dans la langue choisie dans la personnalisation.
 *
 * Le wiki refuse d'etre affiche dans une autre page (en-tete
 * X-Frame-Options: SAMEORIGIN, verifie) : on ne peut donc pas l'integrer en
 * iframe. Cette page sert de point d'entree : recherche directe et raccourcis.
 *
 * Les raccourcis portent des titres de pages francais : ils ne s'affichent que
 * pour le wiki francais. Les autres langues gardent la recherche et l'accueil.
 *
 * Chaque page ci-dessous a ete verifiee comme existante. Des liens de la page
 * d'accueil du wiki pointent vers des pages inexistantes (Habitat, Propriete,
 * Meteore) : ils ne figurent pas ici.
 */

interface Lien { titre: string; page: string; aide?: string }
interface Groupe { titre: string; icone: string; liens: Lien[] }

const GROUPES: Groupe[] = [
  {
    titre: t('wiki.groups.start'),
    icone: 'play',
    liens: [
      { titre: t('wiki.links.firstSteps'), page: 'Premiers_Pas', aide: t('wiki.links.firstStepsHelp') },
      { titre: t('wiki.links.faq'), page: 'Foire_aux_questions' },
      { titre: t('wiki.links.chatCommands'), page: 'Commandes_de_chat', aide: t('wiki.links.chatCommandsHelp') },
      { titre: t('wiki.links.server'), page: 'Serveur' },
    ],
  },
  {
    titre: t('wiki.groups.skills'),
    icone: 'user',
    liens: [
      { titre: t('wiki.links.skills'), page: 'Compétences', aide: t('wiki.links.skillsHelp') },
      { titre: t('wiki.links.crafting'), page: 'Artisanat' },
      { titre: t('wiki.links.farmer'), page: 'Agriculteur' },
      { titre: t('wiki.links.hunter'), page: 'Chasseur' },
      { titre: t('wiki.links.cook'), page: 'Cuisinier' },
      { titre: t('wiki.links.smith'), page: 'Forgeron' },
      { titre: t('wiki.links.engineer'), page: 'Ingénieur' },
      { titre: t('wiki.links.mason'), page: 'Maçon' },
      { titre: t('wiki.links.carpenter'), page: 'Menuisier' },
      { titre: t('wiki.links.scientist'), page: 'Scientifique' },
      { titre: t('wiki.links.survivalist'), page: 'Survivaliste' },
      { titre: t('wiki.links.tailor'), page: 'Tailleur' },
      { titre: t('wiki.links.mining'), page: 'Minage' },
    ],
  },
  {
    titre: t('wiki.groups.together'),
    icone: 'landmark',
    liens: [
      { titre: t('wiki.links.government'), page: 'Gouvernement', aide: t('wiki.links.governmentHelp') },
      { titre: t('wiki.links.laws'), page: 'Lois' },
      { titre: t('wiki.links.economy'), page: 'Économie' },
      { titre: t('wiki.links.market'), page: 'Marché' },
      { titre: t('wiki.links.colonies'), page: 'Colonies' },
    ],
  },
  {
    titre: t('wiki.groups.planet'),
    icone: 'leaf',
    liens: [
      { titre: t('wiki.links.pollution'), page: 'Pollution' },
      { titre: t('wiki.links.agriculture'), page: 'Agriculture' },
      { titre: t('wiki.links.food'), page: 'Nourriture' },
      { titre: t('wiki.links.laser'), page: 'Laser', aide: t('wiki.links.laserHelp') },
    ],
  },
];

const site = useSiteStore();
const ACCUEIL = site.wikiBase + 'Eco_Wiki';
const RECHERCHE = site.wikiBase + 'index.php?search=';
const RACCOURCIS = site.wikiBase.endsWith('/fr/');

const url = (page: string): string => site.wikiBase + encodeURIComponent(page);

const recherche = ref('');

function chercher(): void {
  const q = recherche.value.trim();
  const cible = q ? RECHERCHE + encodeURIComponent(q) : ACCUEIL;
  window.open(cible, '_blank', 'noopener');
}
</script>

<template>
  <div class="wiki">
    <SectionTitle
      :level="1"
      :title="$t('wiki.title')"
      :hint="$t('wiki.hint')"
    >
      <template #actions>
        <a :href="ACCUEIL" target="_blank" rel="noopener" class="btn btn--primary btn--sm">
          <Icon name="book" :size="15" /><span>{{ $t('wiki.open') }}</span>
        </a>
      </template>
    </SectionTitle>

    <form class="card wiki__recherche" @submit.prevent="chercher">
      <Icon name="search" :size="18" class="wiki__loupe" />
      <input
        v-model="recherche"
        class="input"
        type="search"
        :placeholder="$t('wiki.searchPlaceholder')"
        :aria-label="$t('wiki.searchLabel')"
      />
      <button class="btn btn--primary" type="submit">{{ $t('wiki.search') }}</button>
    </form>

    <div class="wiki__grille">
      <section v-for="g in RACCOURCIS ? GROUPES : []" :key="g.titre" class="card">
        <h3 class="card__title wiki__groupe">
          <Icon :name="g.icone" :size="16" />
          {{ g.titre }}
        </h3>
        <ul class="wiki__liens">
          <li v-for="l in g.liens" :key="l.page">
            <a :href="url(l.page)" target="_blank" rel="noopener">
              <span>{{ l.titre }}</span>
              <small v-if="l.aide">{{ l.aide }}</small>
            </a>
          </li>
        </ul>
      </section>
    </div>

    <p class="wiki__note u-faint">
      {{ $t('wiki.note') }}
    </p>
  </div>
</template>

<style scoped>
.wiki { display: grid; gap: var(--sp-4); }

.wiki__recherche { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: var(--sp-3); }
.wiki__loupe { color: var(--text-faint); }

.wiki__grille { display: grid; gap: var(--sp-4); grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); align-items: start; }
.wiki__groupe { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-3); }

.wiki__liens { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.wiki__liens a {
  display: grid; gap: 1px; padding: 7px 10px; border-radius: var(--r-sm);
  color: var(--text); text-decoration: none; font-size: 13.5px;
}
.wiki__liens a:hover { background: rgb(var(--primary-rgb) / 0.08); color: var(--primary); }
.wiki__liens small { color: var(--text-faint); font-size: 11.5px; }

.wiki__note { font-size: 12px; margin: 0; }

@media (max-width: 520px) {
  .wiki__recherche { grid-template-columns: 1fr; }
  .wiki__loupe { display: none; }
}
</style>
