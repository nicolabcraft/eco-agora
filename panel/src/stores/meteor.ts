import { defineStore } from 'pinia';
import { apiGet } from '@/api/http';
import { useServerStore } from './server';

/**
 * Compte a rebours de l'asteroide, partage par toutes les vues.
 *
 * Deux sources, par ordre de precision :
 *  - `mod`  : /api/agora/meteor renvoie le delai exact en secondes ;
 *  - `info` : repli sur /info, qui ne publie qu'un nombre ENTIER de jours.
 *
 * Avec le mod, le delai recu est ancre sur l'horloge locale puis decompte chaque
 * seconde dans le navigateur. On se resynchronise toutes les minutes : l'horloge
 * du monde s'arrete quand le serveur est coupe ou en pause, ce qu'un decompte
 * local ne verrait pas.
 *
 * En repli, on lit /info en direct, sans rien calculer : ancrer « 59 jours » sur
 * l'horloge puis arrondir affichait 58 des la premiere milliseconde.
 */

interface MeteorApi {
  available?: boolean;
  hasMeteor?: boolean;
  destroyed?: boolean;
  impacted?: boolean;
  paused?: boolean;
  /** Salle d'attente : duree figee, le decompte demarrera a l'ouverture. */
  enAttente?: boolean;
  secondsUntilImpact?: number;
}

export type MeteorSource = 'mod' | 'info';

interface Parts {
  jours: number;
  heures: number;
  minutes: number;
  secondes: number;
  precis: boolean;
}

const SYNCHRO_MS = 60_000;
let horloge: number | undefined;
let synchro: number | undefined;

export const useMeteorStore = defineStore('meteor', {
  state: () => ({
    source: 'info' as MeteorSource,
    /** Donnees du mod (source `mod` uniquement). */
    impactLocal: null as number | null,
    restantFige: null as number | null,
    modActif: false,
    modDetruit: false,
    modImpacte: false,
    modPause: false,
    modAttente: false,
    maintenant: Date.now(),
  }),

  getters: {
    actif(s): boolean {
      if (s.source === 'mod') return s.modActif;
      return !!useServerStore().info?.HasMeteor;
    },
    detruit: (s): boolean => s.source === 'mod' && s.modDetruit,
    /** Avant l'ouverture : le decompte de 60 jours ne demarrera qu'a l'heure dite. */
    enAttente: (s): boolean => s.source === 'mod' && s.modAttente,
    impacte: (s): boolean => s.source === 'mod' && s.modImpacte,
    pause(s): boolean {
      if (s.source === 'mod') return s.modPause;
      return !!useServerStore().info?.IsPaused;
    },

    /** Millisecondes restantes ; connues seulement avec le mod. */
    restantMs(s): number | null {
      if (s.source !== 'mod') return null;
      if (s.modPause && s.restantFige !== null) return s.restantFige;
      if (s.impactLocal === null) return null;
      return Math.max(0, s.impactLocal - s.maintenant);
    },

    parts(): Parts | null {
      if (this.source === 'mod') {
        const ms = this.restantMs;
        if (ms === null) return null;
        const t = Math.floor(ms / 1000);
        return {
          jours: Math.floor(t / 86400),
          heures: Math.floor((t % 86400) / 3600),
          minutes: Math.floor((t % 3600) / 60),
          secondes: t % 60,
          precis: true,
        };
      }
      const info = useServerStore().info;
      if (!info?.HasMeteor || typeof info.DaysUntilMeteor !== 'number') return null;
      return { jours: Math.max(0, info.DaysUntilMeteor), heures: 0, minutes: 0, secondes: 0, precis: false };
    },

    /** Meme echelle que l'ancienne tuile du tableau de bord. */
    ton(): 'info' | 'warning' | 'danger' | 'success' {
      if (this.detruit) return 'success';
      const p = this.parts;
      if (!p) return 'info';
      const jours = p.jours + p.heures / 24;
      if (jours <= 10) return 'danger';
      if (jours <= 30) return 'warning';
      return 'info';
    },
  },

  actions: {
    async synchroniser(): Promise<void> {
      try {
        const r = await apiGet<MeteorApi>('/api/agora/meteor');
        if (!r || r.available !== true) throw new Error('reponse inattendue');
        const restant = Math.max(0, (r.secondsUntilImpact ?? 0) * 1000);
        this.$patch({
          source: 'mod',
          modActif: !!r.hasMeteor,
          modDetruit: !!r.destroyed,
          modImpacte: !!r.impacted,
          modPause: !!r.paused,
          modAttente: !!r.enAttente,
          impactLocal: Date.now() + restant,
          restantFige: r.paused ? restant : null,
          maintenant: Date.now(),
        });
      } catch {
        // Mod absent ou pas encore charge : /info prend le relais, au jour pres.
        this.source = 'info';
      }
    },

    demarrer(): void {
      if (horloge !== undefined) return;
      void this.synchroniser();
      horloge = window.setInterval(() => { this.maintenant = Date.now(); }, 1000);
      synchro = window.setInterval(() => void this.synchroniser(), SYNCHRO_MS);
    },

    arreter(): void {
      if (horloge !== undefined) window.clearInterval(horloge);
      if (synchro !== undefined) window.clearInterval(synchro);
      horloge = undefined;
      synchro = undefined;
    },
  },
});
