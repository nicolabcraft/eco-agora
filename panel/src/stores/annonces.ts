import { defineStore } from 'pinia';
import { fetchAnnonces, isActive, type Annonce } from '@/api/annonces';

const HIDDEN_KEY = 'agora.annonces.masquees';

function readHidden(): string[] {
  try {
    return JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

/** Annonces publiées sur le site, lues dans /annonces.json. */
export const useAnnoncesStore = defineStore('annonces', {
  state: () => ({
    items: [] as Annonce[],
    hidden: readHidden(),
    loaded: false,
    /** Aucune source disponible : ce n'est pas une erreur, il n'y a juste rien à dire. */
    absent: false,
    /** Mod, ancien fichier, ou rien du tout. */
    source: 'aucune' as 'mod' | 'fichier' | 'aucune',
  }),
  getters: {
    /** Annonces à afficher : actives, non masquées par ce visiteur, épinglées d'abord. */
    visibles(state): Annonce[] {
      const now = Date.now();
      return state.items
        .filter((a) => isActive(a, now) && !state.hidden.includes(a.id))
        .sort((a, b) => Number(b.epinglee) - Number(a.epinglee));
    },
    actives(state): Annonce[] {
      const now = Date.now();
      return state.items.filter((a) => isActive(a, now));
    },
  },
  actions: {
    async load(): Promise<void> {
      try {
        const file = await fetchAnnonces();
        this.items = file.annonces;
        this.source = file.source;
        this.absent = file.source === 'aucune';
      } catch {
        this.items = [];
        this.source = 'aucune';
        this.absent = true;
      } finally {
        this.loaded = true;
      }
    },
    hide(id: string): void {
      this.hidden = [...new Set([...this.hidden, id])];
      try { localStorage.setItem(HIDDEN_KEY, JSON.stringify(this.hidden)); } catch { /* mode privé */ }
    },
    resetHidden(): void {
      this.hidden = [];
      try { localStorage.removeItem(HIDDEN_KEY); } catch { /* ignore */ }
    },
  },
});
