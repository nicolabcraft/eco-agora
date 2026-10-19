/**
 * Personnalisation du panel, modifiable dans Administration > Personnalisation.
 *
 * Le mod garde l'objet tel quel (Mods/EcoAgora/data/site.json) et le sert a tout
 * visiteur : n'y mettez aucun secret. Les champs absents du fichier prennent les
 * valeurs par defaut ci-dessous, ce qui permet d'ajouter des reglages sans
 * migration.
 */

export interface RegleSection {
  emoji: string;
  titre: string;
  intro: string;
  /** Une regle par entree. */
  regles: string[];
  /** Encadre d'avertissement, facultatif. */
  alerte: string;
  /** Section mise en avant en pleine largeur, avec le compte a rebours de l'asteroide. */
  finale: boolean;
  /** Lignes de conclusion de la section finale. */
  fin: string[];
}

export interface SiteConfig {
  identite: {
    /** Nom de la communaute. Vide : le nom du serveur Eco. */
    nom: string;
    /** Phrase d'accueil quand le serveur n'a pas de description. */
    baseline: string;
    /** Adresse du logo (https://... ou /chemin dans le webroot). Vide : logo par defaut. */
    logo: string;
    /** Couleur d'accent, #rrggbb. Vide : orange par defaut. */
    couleur: string;
    /** Langue par defaut des visiteurs (code de lang/langues.json). Chacun peut en changer. */
    langue: string;
  };
  liens: {
    /** Site de la communaute, en bas de la barre laterale. */
    site: string;
    siteLibelle: string;
    /** Credit d'hebergement : mention seule, ou mention + lien. */
    hebergeurMention: string;
    hebergeurUrl: string;
  };
  jeu: {
    /** Adresse du jeu pour le bouton Rejoindre. Vide : l'adresse du site. */
    hote: string;
    /** Seconde adresse proposee au survol (nom de domaine, par exemple). */
    hoteSecours: string;
    /** Port de jeu. 0 : celui du serveur (lu par le mod). */
    port: number;
  };
  wiki: {
    /** Langue du wiki officiel : fr, en, de, es... */
    langue: string;
  };
  ecoGnome: {
    actif: boolean;
    /** Code qui permet aux joueurs de rejoindre le serveur sur eco-gnome.com. */
    codeParticipation: string;
  };
  reglement: {
    actif: boolean;
    titre: string;
    intro: string;
    sections: RegleSection[];
    signature: string;
  };
  ouverture: {
    /** Rideau « ouverture prochaine » devant tout le panel, jusqu'a la date. */
    actif: boolean;
    /** Date avec decalage horaire, ex. 2026-09-30T19:00:00+02:00. */
    date: string;
    /**
     * Acces anticipe pour les testeurs. Ce n'est PAS une securite : il est
     * compare dans le navigateur et lisible par tous.
     */
    motDePasse: string;
    titre: string;
    sousTitre: string;
  };
}

export function sectionVide(): RegleSection {
  return { emoji: '📌', titre: 'Nouvelle section', intro: '', regles: [], alerte: '', finale: false, fin: [] };
}

/** Regles d'exemple, proposees desactivees : a relire avant de les publier. */
const REGLES_EXEMPLE: RegleSection[] = [
  {
    emoji: '🤝', titre: 'Respect et coopération', intro: 'Eco est avant tout une aventure communautaire et coopérative.',
    regles: [
      'Respectez les autres joueurs et le staff.',
      'Les insultes, le harcèlement et les comportements toxiques ne sont pas tolérés.',
      'Privilégiez la communication et l’entraide : une question posée évite souvent un conflit.',
      'Respectez le travail, les constructions et les ressources des autres joueurs.',
    ],
    alerte: '', finale: false, fin: [],
  },
  {
    emoji: '🌱', titre: 'Protégez l’environnement', intro: 'Vos actions ont des conséquences durables sur l’écosystème.',
    regles: [
      'Évitez la surexploitation des ressources : replantez ce que vous abattez.',
      'Ne cherchez pas volontairement à faire disparaître une espèce.',
      'Limitez la pollution de l’air, de l’eau et des sols.',
    ],
    alerte: 'La destruction volontaire de l’écosystème pourra entraîner une intervention du staff.', finale: false, fin: [],
  },
  {
    emoji: '🏛️', titre: 'Gouvernement et lois', intro: 'Dans Eco, ce sont les joueurs qui écrivent les lois et élisent leurs représentants.',
    regles: [
      'Respectez les lois votées par la communauté, même celles que vous n’avez pas soutenues.',
      'Proposez vos idées par les voies prévues (propositions, votes, élections) plutôt que de les imposer.',
    ],
    alerte: '', finale: false, fin: [],
  },
  {
    emoji: '🛠️', titre: 'Bugs et triche', intro: 'Logiciels, exploits ou bugs donnant un avantage injuste sont interdits.',
    regles: ['Si vous découvrez un problème important, prévenez le staff.'],
    alerte: '', finale: false, fin: [],
  },
  {
    emoji: '☄️', titre: 'L’objectif', intro: 'Un astéroïde menace la planète : coopérez pour le détruire à temps.',
    regles: [], alerte: '', finale: true,
    fin: ['🌍 Construisez ensemble.', '🤝 Entraidez-vous.', '🌱 Protégez votre planète.'],
  },
];

export const SITE_DEFAUT: SiteConfig = {
  identite: { nom: '', baseline: '', logo: '', couleur: '', langue: 'fr' },
  liens: { site: '', siteLibelle: '', hebergeurMention: '', hebergeurUrl: '' },
  jeu: { hote: '', hoteSecours: '', port: 0 },
  wiki: { langue: 'fr' },
  ecoGnome: { actif: false, codeParticipation: '' },
  reglement: {
    actif: false,
    titre: 'Règlement',
    intro: 'Bienvenue sur le serveur ! Avant de commencer l’aventure, merci de prendre connaissance des règles suivantes.',
    sections: REGLES_EXEMPLE,
    signature: 'Bon jeu à tous !',
  },
  ouverture: {
    actif: false,
    date: '',
    motDePasse: '',
    titre: 'Ouverture prochaine',
    sousTitre: '',
  },
};

export const COULEUR_DEFAUT = '#ff6b0d';

/**
 * Copie profonde. La configuration n'est que du JSON ; structuredClone, lui,
 * refuse les objets reactifs de Pinia (proxys).
 */
export function cloner<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Valeurs par defaut completees par l'objet enregistre. Chaque champ garde le
 * type du defaut : un fichier edite a la main avec un mauvais type ne casse pas
 * le panel, le champ fautif retombe simplement sur sa valeur par defaut.
 */
export function fusionner<T>(defaut: T, valeur: unknown): T {
  if (Array.isArray(defaut)) {
    if (!Array.isArray(valeur)) return cloner(defaut);
    // Les sections de reglement : chaque element complete un modele vide.
    if (defaut.length && estObjet(defaut[0])) {
      return valeur.filter(estObjet).map((v) => fusionner(sectionVide(), v)) as T;
    }
    return valeur.filter((v) => typeof v === 'string') as T;
  }
  if (estObjet(defaut)) {
    const source = estObjet(valeur) ? valeur : {};
    const out: Record<string, unknown> = {};
    for (const [k, d] of Object.entries(defaut)) out[k] = fusionner(d, source[k]);
    return out as T;
  }
  return (typeof valeur === typeof defaut ? valeur : defaut) as T;
}

/** Couleur #rrggbb -> « r g b » pour la variable --primary-rgb, ou null si invalide. */
export function couleurRgb(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** Lien sur que l'on peut placer dans un href : http(s) ou chemin local. */
export function lienSur(url: string): string {
  const u = url.trim();
  return /^(https?:\/\/|\/(?!\/))/i.test(u) ? u : '';
}
