import { defineStore } from 'pinia';
import { apiGet, apiPut } from '@/api/http';
import { agoraServer } from '@/api/agoraServer';
import { siteDefaut, cloner, couleurRgb, fusionner, lienSur, type SiteConfig } from '@/site/schema';

/** Route du mod Eco Agora qui garde la personnalisation. */
export const SITE_API = '/api/agora/site';

const LOGO_DEFAUT = '/brand/logo-192.png';

interface SiteApi {
  config: unknown;
  miseAJour: string | null;
  erreur?: string;
}

/**
 * Personnalisation du panel, chargee avant l'affichage.
 *
 * Sans le mod, ou avant le premier enregistrement, le panel tourne avec les
 * valeurs par defaut : il reste utilisable, simplement neutre.
 */
export const useSiteStore = defineStore('site', {
  state: () => ({
    config: siteDefaut(),
    /** Vrai quand le mod repond (la personnalisation est alors modifiable). */
    modDisponible: false,
    miseAJour: null as string | null,
    erreur: null as string | null,
    /** Nom du serveur, lu dans /info : repli du nom de la communaute. */
    nomServeur: '',
    /** Port de jeu, lu par le mod dans la configuration reseau. */
    portServeur: 0,
  }),

  getters: {
    nom(state): string {
      return state.config.identite.nom.trim() || state.nomServeur || 'Eco Agora';
    },
    logo(state): string {
      return lienSur(state.config.identite.logo) || LOGO_DEFAUT;
    },
    /** Hote du bouton Rejoindre : celui configure, sinon l'adresse du site. */
    hote(state): string {
      return state.config.jeu.hote.trim() || window.location.hostname;
    },
    port(state): number {
      return state.config.jeu.port > 0 ? state.config.jeu.port : state.portServeur;
    },
    /** Le bouton Rejoindre n'a de sens que si le port est connu. */
    rejoindrePossible(): boolean {
      return this.port > 0;
    },
    wikiBase(state): string {
      const langue = /^[a-z]{2}(-[a-z]{2})?$/i.test(state.config.wiki.langue) ? state.config.wiki.langue : 'fr';
      return `https://wiki.play.eco/${langue}/`;
    },
  },

  actions: {
    /** Adresse `hote:port` pour la connexion directe saisie dans Eco. */
    adresseJeu(secours = false): string {
      const hote = secours && this.config.jeu.hoteSecours.trim() ? this.config.jeu.hoteSecours.trim() : this.hote;
      return `${hote}:${this.port}`;
    },

    /** Lien `eco://` qui ouvre le jeu directement. */
    lienJeu(secours = false): string {
      return `eco://${this.adresseJeu(secours)}`;
    },

    async charger(): Promise<void> {
      const [site, info] = await Promise.allSettled([
        apiGet<SiteApi>(SITE_API),
        agoraServer.info(),
      ]);
      if (site.status === 'fulfilled' && site.value && 'config' in site.value) {
        this.modDisponible = true;
        this.config = fusionner(siteDefaut(), site.value.config);
        this.miseAJour = site.value.miseAJour;
        this.erreur = site.value.erreur ?? null;
      }
      if (info.status === 'fulfilled') {
        this.nomServeur = info.value.name ?? '';
        this.portServeur = info.value.gamePort ?? 0;
      }
      this.appliquer();
    },

    /** Enregistre la personnalisation (administrateurs). */
    async enregistrer(config: SiteConfig): Promise<void> {
      const r = await apiPut<SiteApi>(SITE_API, config);
      this.config = fusionner(siteDefaut(), r.config);
      this.miseAJour = r.miseAJour;
      this.erreur = null;
      this.appliquer();
    },

    /** Couleur d'accent, titre d'onglet et icone. */
    appliquer(): void {
      const rgb = couleurRgb(this.config.identite.couleur);
      const racine = document.documentElement.style;
      if (rgb) racine.setProperty('--primary-rgb', rgb);
      else racine.removeProperty('--primary-rgb');

      const icone = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (icone) icone.href = this.logo;
    },
  },
});
