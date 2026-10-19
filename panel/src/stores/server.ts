import { defineStore } from 'pinia';
import { server } from '@/api/eco';
import type { ServerInfo } from '@/api/types';
import { useSiteStore } from './site';

const POLL_MS = 15000;
let timer: number | undefined;

/** Etat du serveur, rafraichi periodiquement depuis /info. */
export const useServerStore = defineStore('server', {
  state: () => ({
    info: null as ServerInfo | null,
    loading: false,
    error: null as string | null,
    lastUpdate: 0,
  }),
  getters: {
    /**
     * Nom du serveur. /info le tronque quand il contient des accents (Eco compte
     * en octets et coupe un caractere de trop par lettre accentuee) : on prefere
     * le nom complet lu par le mod.
     */
    name: (s): string => useSiteStore().nomServeur || s.info?.Description || 'Serveur Eco',
    online: (s) => s.info?.OnlinePlayers ?? 0,
    reachable: (s) => s.info !== null,
    joinUrl: (s) => s.info?.JoinUrl ?? null,
  },
  actions: {
    async refresh(): Promise<void> {
      this.loading = this.info === null;
      try {
        this.info = await server.info();
        this.error = null;
        this.lastUpdate = Date.now();
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Serveur injoignable';
      } finally {
        this.loading = false;
      }
    },
    startPolling(): void {
      if (timer !== undefined) return;
      void this.refresh();
      timer = window.setInterval(() => void this.refresh(), POLL_MS);
    },
    stopPolling(): void {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    },
  },
});
