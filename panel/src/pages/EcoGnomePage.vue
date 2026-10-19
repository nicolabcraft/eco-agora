<script setup lang="ts">
import SectionTitle from '@/components/SectionTitle.vue';
import Icon from '@/components/Icon.vue';
import { useSiteStore } from '@/stores/site';
import { useSessionStore } from '@/stores/session';
import { useToastStore } from '@/stores/toasts';

/**
 * Eco Gnome : calculateur de prix communautaire (eco-gnome.com).
 *
 * Les commandes en jeu (/eguser, /egjoin...) ne sont disponibles que si le mod
 * serveur Eco Gnome est installe : l'encadre administrateur le rappelle.
 * Source : https://github.com/Eco-Gnome/eco-gnome-mod
 */

const session = useSessionStore();
const toasts = useToastStore();

/** Code de participation du serveur, saisi dans Administration > Personnalisation. */
const CODE = useSiteStore().config.ecoGnome.codeParticipation.trim();
const URL_ECO_GNOME = 'https://eco-gnome.com/';

function copier(texte: string, libelle: string): void {
  void navigator.clipboard
    .writeText(texte)
    .then(() => toasts.ok(`${libelle} copié`, texte))
    .catch(() => toasts.fail('Copie impossible', 'Le navigateur a refusé l’accès au presse-papiers.'));
}

const ETAPES = [
  {
    titre: 'Créez votre compte',
    texte: 'Rendez-vous sur Eco Gnome et connectez-vous.',
  },
  {
    titre: 'Rejoignez le serveur',
    texte: 'Sur Eco Gnome, rejoignez notre serveur avec le code de participation ci-dessus.',
  },
  {
    titre: 'Liez votre compte en jeu',
    texte:
      'Récupérez votre secretid : cliquez sur votre pseudo, en haut à droite sur Eco Gnome. Puis tapez la commande ci-dessous dans le chat du jeu.',
    commande: '/eguser {secretid}',
  },
  {
    titre: 'Sauvegardez votre compte',
    texte:
      'Téléchargez une sauvegarde de votre compte avec le bouton de téléchargement (bleu). Sans elle, vos prix peuvent être perdus.',
  },
];

const COMMANDES = [
  { cmd: '/egjoin', aide: 'Ouvre Eco Gnome et rejoint directement ce serveur.' },
  { cmd: '/egopen', aide: 'Ouvre Eco Gnome dans votre navigateur.' },
  { cmd: '/egsyncroom', aide: 'Met à jour les prix des objets en vente dans la pièce où vous êtes.' },
  { cmd: '/egsyncdeed', aide: 'Même chose, sur toute la propriété où vous vous trouvez.' },
];
</script>

<template>
  <div class="gnome">
    <SectionTitle
      :level="1"
      title="Eco Gnome"
      hint="L’outil pour calculer vos prix en jeu. Pratique pour fixer des prix justes et rentables."
    >
      <template #actions>
        <a :href="URL_ECO_GNOME" target="_blank" rel="noopener" class="btn btn--primary btn--sm">
          <Icon name="calculate" :size="15" /><span>Ouvrir Eco Gnome</span>
        </a>
      </template>
    </SectionTitle>

    <section v-if="CODE" class="card gnome__code">
      <div>
        <p class="gnome__code-label">Code de participation du serveur</p>
        <p class="gnome__code-valeur">{{ CODE }}</p>
      </div>
      <button class="btn btn--ghost btn--sm" @click="copier(CODE, 'Code')">
        <Icon name="copy" :size="15" /><span>Copier le code</span>
      </button>
    </section>

    <section class="card">
      <h3 class="card__title gnome__h">Configurer Eco Gnome en 4 étapes</h3>
      <ol class="gnome__etapes">
        <li v-for="(e, i) in ETAPES" :key="e.titre">
          <span class="gnome__num">{{ i + 1 }}</span>
          <div>
            <strong>{{ e.titre }}</strong>
            <p>{{ e.texte }}</p>
            <div v-if="e.commande" class="gnome__cmd">
              <code>{{ e.commande }}</code>
              <button class="btn btn--ghost btn--sm" @click="copier('/eguser ', 'Début de commande')">
                <Icon name="copy" :size="14" /><span>Copier</span>
              </button>
            </div>
            <p v-if="e.commande" class="u-faint gnome__petit">
              Remplacez <code>{secretid}</code> par votre identifiant, sans les accolades.
            </p>
          </div>
        </li>
      </ol>
    </section>

    <section class="card">
      <h3 class="card__title gnome__h">Commandes utiles en jeu</h3>
      <ul class="gnome__commandes">
        <li v-for="c in COMMANDES" :key="c.cmd">
          <code>{{ c.cmd }}</code>
          <span>{{ c.aide }}</span>
        </li>
      </ul>
      <p class="u-muted gnome__petit">
        Sur vos boutiques, un onglet <strong>Eco Gnome</strong> permet aussi de synchroniser prix et
        offres. Raccourci : <strong>Maj + clic droit</strong> sur une boutique pour mettre ses prix à
        jour.
      </p>
    </section>

    <section v-if="session.isAdmin" class="card gnome__admin">
      <h3 class="card__title gnome__h">
        <Icon name="shield" :size="16" /> Côté serveur (administrateurs)
      </h3>
      <p>
        Les commandes <code>/eguser</code>, <code>/egjoin</code>… n’existent que si le
        <strong>mod serveur Eco Gnome</strong> est installé. Sans lui, les joueurs obtiendront
        une commande inconnue.
      </p>
      <ol class="gnome__admin-liste">
        <li>
          Déposer <code>EcoGnomeMod.dll</code> et <code>StoreObject.cs</code> (page des versions du
          mod) dans <code>Mods/UserCode</code>, puis redémarrer le serveur.
        </li>
        <li>
          Une seule fois, en jeu : <code>/EcoGnome registerserver {{ CODE || "<code>" }}</code>.
        </li>
        <li>
          La configuration est dans <code>Configs/EcoGnome.eco</code> ; les valeurs par défaut
          conviennent.
        </li>
      </ol>
      <p class="u-faint gnome__petit">
        <code>StoreObject.cs</code> remplace la définition des boutiques du jeu : pensez à le mettre à
        jour à chaque nouvelle version d’Eco.
      </p>
      <a
        href="https://github.com/Eco-Gnome/eco-gnome-mod/releases"
        target="_blank"
        rel="noopener"
        class="btn btn--ghost btn--sm"
      >
        <Icon name="link" :size="14" /><span>Versions du mod</span>
      </a>
    </section>
  </div>
</template>

<style scoped>
.gnome { display: grid; gap: var(--sp-4); max-width: 900px; }
.gnome__h { display: flex; align-items: center; gap: var(--sp-2); margin-bottom: var(--sp-3); }

.gnome__code {
  display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); flex-wrap: wrap;
  border-left: 3px solid var(--primary);
}
.gnome__code-label { margin: 0; color: var(--text-muted); font-size: 12.5px; }
.gnome__code-valeur {
  margin: 2px 0 0; font-size: 26px; font-weight: 700; letter-spacing: 0.08em;
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; color: var(--primary);
}

.gnome__etapes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-4); }
.gnome__etapes li { display: grid; grid-template-columns: auto 1fr; gap: var(--sp-3); }
.gnome__etapes p { margin: 4px 0 0; color: var(--text-muted); line-height: 1.5; }
.gnome__num {
  display: grid; place-items: center; width: 28px; height: 28px; border-radius: 50%;
  background: rgb(var(--primary-rgb) / 0.14); color: var(--primary); font-weight: 700; font-size: 13px;
}

.gnome__cmd { display: flex; align-items: center; gap: var(--sp-2); margin-top: var(--sp-2); flex-wrap: wrap; }
code {
  font-family: ui-monospace, 'Cascadia Code', Consolas, monospace; font-size: 12.5px;
  background: var(--surface-inset); border: 1px solid var(--hairline);
  border-radius: var(--r-sm); padding: 2px 6px;
}
.gnome__cmd code { font-size: 14px; padding: 5px 10px; }
.gnome__petit { font-size: 12px; margin: var(--sp-2) 0 0; }

.gnome__commandes { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--sp-2); }
.gnome__commandes li { display: grid; grid-template-columns: 120px 1fr; gap: var(--sp-3); align-items: baseline; }
.gnome__commandes span { color: var(--text-muted); font-size: 13.5px; }

.gnome__admin { display: grid; gap: var(--sp-3); border: 1px dashed rgb(var(--primary-rgb) / 0.35); }
.gnome__admin p { margin: 0; line-height: 1.5; }
.gnome__admin-liste { margin: 0; padding-left: 1.2em; display: grid; gap: 6px; line-height: 1.5; }

@media (max-width: 520px) {
  .gnome__commandes li { grid-template-columns: 1fr; gap: 2px; }
}
</style>
