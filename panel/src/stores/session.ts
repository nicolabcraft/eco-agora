import { defineStore } from 'pinia';
import { ApiError, apiGet, setApiKey, setAuthToken } from '@/api/http';
import { t } from '@/i18n';

const STORAGE_KEY = 'agora.session';
const TTL_MS = 24 * 60 * 60 * 1000;

/** Cle d'administration : sessionStorage par defaut, localStorage si « se souvenir ». */
const CLE_KEY = 'agora.admin-key';
const CLE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored {
  username: string;
  worldTicket: string;
  expiration: number;
  /** Dernier statut connu : sert a afficher le panel sans attendre le serveur. */
  isAdmin?: boolean;
}

interface StoredKey {
  key: string;
  expiration: number;
}

export type ResultatCle = 'ok' | 'refusee' | 'injoignable';

function read(): Stored | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed.worldTicket || Date.now() > parsed.expiration) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function lireCle(): StoredKey | null {
  for (const store of [sessionStorage, localStorage]) {
    try {
      const raw = store.getItem(CLE_KEY);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as StoredKey;
      if (parsed.key && Date.now() < parsed.expiration) return parsed;
      store.removeItem(CLE_KEY);
    } catch {
      /* stockage indisponible */
    }
  }
  return null;
}

/**
 * Statut d'administrateur selon le serveur : vrai, faux, ou null si le serveur
 * n'a pas pu repondre. Un serveur injoignable (redemarrage quotidien) ne doit pas
 * faire perdre sa session a un administrateur.
 */
async function verifierAdmin(): Promise<boolean | null> {
  try {
    const raw = await apiGet<unknown>('/isadmin');
    if (raw === true || raw === 'true') return true;
  } catch (err) {
    if (!(err instanceof ApiError && (err.status === 401 || err.status === 403))) return null;
  }
  // /isadmin a dit non : on confirme sur une route reellement protegee par la
  // regle RequireAdmin d'Eco. C'est elle qui garde l'administration.
  return adminSelonRouteProtegee();
}

async function adminSelonRouteProtegee(): Promise<boolean | null> {
  try {
    await apiGet<unknown>('/api/agora/whoami');
    return true;
  } catch (err) {
    if (err instanceof ApiError && (err.status === 401 || err.status === 403)) return false;
    // 404 : mod absent, on ne peut pas trancher par cette voie.
    if (err instanceof ApiError && err.status === 404) return false;
    return null;
  }
}

function oublierCle(): void {
  for (const store of [sessionStorage, localStorage]) {
    try { store.removeItem(CLE_KEY); } catch { /* ignore */ }
  }
}

/**
 * Session du panel, par deux voies :
 *  - le jeu : en ouvrant le panel depuis Eco, l'URL recoit ?username=...&worldTicket=... ;
 *    c'est l'identite d'un citoyen (voter, commenter) ;
 *  - la cle d'administration : APIAdminAuthToken de Configs/Users.eco, pour les
 *    administrateurs qui ne sont pas en jeu. Elle ne donne pas d'identite de citoyen.
 * Dans les deux cas, le statut administrateur vient du serveur (/isadmin).
 */
export const useSessionStore = defineStore('session', {
  state: () => ({
    username: null as string | null,
    worldTicket: null as string | null,
    expiration: 0,
    /** Presente seulement pour une session ouverte par cle d'administration. */
    apiKey: null as string | null,
    isAdmin: false,
    /** Faux tant que le serveur n'a pas confirme le statut d'administrateur. */
    adminChecked: false,
    checked: false,
    sessionExpired: false,
  }),
  getters: {
    /** Citoyen identifie par le jeu : condition pour voter ou commenter. */
    isLoggedIn: (s) => Boolean(s.worldTicket),
    /** Une session quelconque (jeu ou cle). */
    hasSession: (s) => Boolean(s.worldTicket || s.apiKey),
    viaCle: (s) => Boolean(s.apiKey),
  },
  actions: {
    /** A appeler une fois au demarrage, avant le routeur. */
    async bootstrap(): Promise<void> {
      const params = new URLSearchParams(location.search);
      const username = params.get('username');
      const worldTicket = params.get('worldTicket');

      if (username && worldTicket) {
        const stored: Stored = { username, worldTicket, expiration: Date.now() + TTL_MS };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* mode prive */ }
        this.apply(stored);
        history.replaceState(null, '', location.pathname);
      } else {
        const stored = read();
        if (stored) this.apply(stored);
        else if (localStorage.getItem(STORAGE_KEY) === null && params.has('worldTicket')) {
          this.sessionExpired = true;
        }
      }

      // Pas de session de jeu : une cle d'administration memorisee, peut-etre.
      if (!this.worldTicket) {
        const cle = lireCle();
        if (cle) {
          this.appliquerCle(cle.key);
          // Statut affiche tout de suite, revalide en fond : une cle revoquee cote
          // serveur est detectee au prochain chargement.
          this.isAdmin = true;
        }
      }

      if (this.worldTicket || this.apiKey) {
        // `/isadmin` peut mettre plusieurs secondes a repondre : on affiche
        // immediatement le dernier statut connu, puis on le rafraichit en fond.
        // Aucun risque de fuite : le serveur revalide chaque appel d'administration.
        void verifierAdmin().then((isAdmin) => {
          this.adminChecked = true;
          if (isAdmin === null) return; // serveur injoignable : on garde l'etat connu
          this.isAdmin = isAdmin;
          if (this.apiKey && !isAdmin) this.signOut(); // cle revoquee
          else this.persist();
        });
      } else {
        this.adminChecked = true;
      }
      this.checked = true;
    },

    apply(stored: Stored): void {
      this.username = stored.username;
      this.worldTicket = stored.worldTicket;
      this.expiration = stored.expiration;
      this.isAdmin = stored.isAdmin === true;
      setAuthToken(stored.worldTicket);
    },

    appliquerCle(key: string): void {
      this.apiKey = key;
      this.username = t('stores.session.administrateur');
      setAuthToken(null);
      setApiKey(key);
    },

    /**
     * Ouvre une session d'administration avec la cle du serveur. La cle n'est
     * gardee que si le serveur confirme qu'elle donne les droits d'administration.
     */
    async signInWithKey(key: string, seSouvenir: boolean): Promise<ResultatCle> {
      const cle = key.trim();
      if (!cle) return 'refusee';

      const ticketAvant = this.worldTicket;
      setAuthToken(null);
      setApiKey(cle);

      const admin = await verifierAdmin();
      if (admin === null) {
        setApiKey(null);
        if (ticketAvant) setAuthToken(ticketAvant);
        return 'injoignable';
      }

      if (!admin) {
        setApiKey(null);
        if (ticketAvant) setAuthToken(ticketAvant);
        return 'refusee';
      }

      // Une session de jeu eventuelle cede la place : on ne melange pas les identites.
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      this.worldTicket = null;
      this.appliquerCle(cle);
      this.isAdmin = true;
      this.adminChecked = true;

      oublierCle();
      const stored: StoredKey = { key: cle, expiration: Date.now() + CLE_TTL_MS };
      try {
        (seSouvenir ? localStorage : sessionStorage).setItem(CLE_KEY, JSON.stringify(stored));
      } catch {
        /* mode prive : la session durera le temps de l'onglet */
      }
      return 'ok';
    },

    /** Memorise le statut confirme, pour un demarrage instantane la fois suivante. */
    persist(): void {
      if (!this.worldTicket || !this.username) return;
      const stored: Stored = {
        username: this.username,
        worldTicket: this.worldTicket,
        expiration: this.expiration,
        isAdmin: this.isAdmin,
      };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* mode prive */ }
    },

    signOut(): void {
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
      oublierCle();
      this.username = null;
      this.worldTicket = null;
      this.apiKey = null;
      this.isAdmin = false;
      setAuthToken(null);
      setApiKey(null);
    },
  },
});
