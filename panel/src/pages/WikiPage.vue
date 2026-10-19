<script setup lang="ts">
import { ref } from 'vue';
import SectionTitle from '@/components/SectionTitle.vue';
import Icon from '@/components/Icon.vue';
import { useSiteStore } from '@/stores/site';

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
    titre: 'Bien débuter',
    icone: 'play',
    liens: [
      { titre: 'Premiers pas', page: 'Premiers_Pas', aide: 'Le guide pour vos premières heures' },
      { titre: 'Foire aux questions', page: 'Foire_aux_questions' },
      { titre: 'Commandes de chat', page: 'Commandes_de_chat', aide: 'Toutes les commandes /…' },
      { titre: 'Serveur', page: 'Serveur' },
    ],
  },
  {
    titre: 'Métiers et compétences',
    icone: 'user',
    liens: [
      { titre: 'Compétences', page: 'Compétences', aide: 'Comment les spécialités fonctionnent' },
      { titre: 'Artisanat', page: 'Artisanat' },
      { titre: 'Agriculteur', page: 'Agriculteur' },
      { titre: 'Chasseur', page: 'Chasseur' },
      { titre: 'Cuisinier', page: 'Cuisinier' },
      { titre: 'Forgeron', page: 'Forgeron' },
      { titre: 'Ingénieur', page: 'Ingénieur' },
      { titre: 'Maçon', page: 'Maçon' },
      { titre: 'Menuisier', page: 'Menuisier' },
      { titre: 'Scientifique', page: 'Scientifique' },
      { titre: 'Survivaliste', page: 'Survivaliste' },
      { titre: 'Tailleur', page: 'Tailleur' },
      { titre: 'Minage', page: 'Minage' },
    ],
  },
  {
    titre: 'Vivre ensemble',
    icone: 'landmark',
    liens: [
      { titre: 'Gouvernement', page: 'Gouvernement', aide: 'Élections, titres, fonctionnement' },
      { titre: 'Lois', page: 'Lois' },
      { titre: 'Économie', page: 'Économie' },
      { titre: 'Marché', page: 'Marché' },
      { titre: 'Colonies', page: 'Colonies' },
    ],
  },
  {
    titre: 'La planète',
    icone: 'leaf',
    liens: [
      { titre: 'Pollution', page: 'Pollution' },
      { titre: 'Agriculture', page: 'Agriculture' },
      { titre: 'Nourriture', page: 'Nourriture' },
      { titre: 'Laser', page: 'Laser', aide: 'L’arme contre l’astéroïde' },
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
      title="Wiki"
      hint="Le wiki officiel d’Eco, en français : recettes, métiers, lois et mécaniques du jeu."
    >
      <template #actions>
        <a :href="ACCUEIL" target="_blank" rel="noopener" class="btn btn--primary btn--sm">
          <Icon name="book" :size="15" /><span>Ouvrir le wiki</span>
        </a>
      </template>
    </SectionTitle>

    <form class="card wiki__recherche" @submit.prevent="chercher">
      <Icon name="search" :size="18" class="wiki__loupe" />
      <input
        v-model="recherche"
        class="input"
        type="search"
        placeholder="Rechercher dans le wiki : fer, laser, école…"
        aria-label="Rechercher dans le wiki"
      />
      <button class="btn btn--primary" type="submit">Rechercher</button>
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
      Le wiki s’ouvre dans un nouvel onglet : il n’autorise pas son affichage à l’intérieur d’un
      autre site. Il est rédigé par la communauté et peut avoir une version de retard sur le jeu.
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
