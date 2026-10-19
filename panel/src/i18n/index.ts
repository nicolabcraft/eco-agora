import { ref } from 'vue';
// Textes francais embarques dans le bundle : la langue de reference, toujours
// disponible meme si les fichiers de langue du webroot manquent.
import FR from '../../public/lang/fr.json';

/**
 * Traductions du panel.
 *
 * Les textes vivent dans des fichiers JSON servis avec le panel :
 * WebClient/WebBin/lang/<code>.json, plus lang/langues.json qui liste les
 * langues proposees. Un administrateur peut donc corriger un texte, traduire
 * le panel ou ajouter une langue sans rien recompiler : il suffit de modifier
 * ou de deposer un fichier. Une cle absente d'une langue retombe sur le
 * francais, puis sur la cle elle-meme.
 *
 * Dans le code :
 *   t('dashboard.titre')                       texte simple
 *   t('dashboard.joueurs', { n: 3 })           remplace {n}
 *   t('commun.objets', { n }, n)               pluriel : "un objet | {n} objets"
 *
 * Regle : n'appelez jamais t() au niveau d'un module (hors fonction), la langue
 * n'y est pas encore chargee. Dans <script setup>, le haut du script s'execute
 * au montage du composant : c'est permis.
 */

export interface Langue {
  code: string;
  nom: string;
  /** Code BCP 47 pour les dates et les nombres (fr-FR, en-GB...). */
  intl?: string;
}

type Messages = Record<string, unknown>;

const CLE_LANGUE = 'agora.langue';
export const LANGUE_REFERENCE = 'fr';

const LANGUES_DEFAUT: Langue[] = [
  { code: 'fr', nom: 'Français', intl: 'fr-FR' },
  { code: 'en', nom: 'English', intl: 'en-GB' },
];

/** Langue affichee. */
export const langue = ref(LANGUE_REFERENCE);
/** Langues proposees au visiteur (lang/langues.json). */
export const langues = ref<Langue[]>(LANGUES_DEFAUT);

let courant: Messages = FR as Messages;
let reference: Messages = FR as Messages;

function lire(source: Messages, cle: string): string | undefined {
  let v: unknown = source;
  for (const partie of cle.split('.')) {
    if (typeof v !== 'object' || v === null) return undefined;
    v = (v as Record<string, unknown>)[partie];
  }
  return typeof v === 'string' ? v : undefined;
}

/**
 * Traduit une cle. `params` remplace les {nom} du texte. Avec `compte`, un
 * texte de la forme « singulier | pluriel » choisit sa forme (singulier pour
 * 0 et 1, comme en francais ; « zero | un | plusieurs » est aussi accepte).
 */
export function t(cle: string, params?: Record<string, string | number>, compte?: number): string {
  let texte = lire(courant, cle) ?? lire(reference, cle) ?? cle;
  if (compte !== undefined && texte.includes('|')) {
    const formes = texte.split('|').map((f) => f.trim());
    const n = Math.abs(compte);
    texte = formes.length >= 3 ? formes[n === 0 ? 0 : n === 1 ? 1 : 2] : formes[n <= 1 ? 0 : 1];
  }
  if (params) {
    texte = texte.replace(/\{(\w+)\}/g, (m, nom: string) => (nom in params ? String(params[nom]) : m));
  }
  return texte;
}

/** Vrai si la cle existe (dans la langue courante ou en francais). */
export function aTraduction(cle: string): boolean {
  return lire(courant, cle) !== undefined || lire(reference, cle) !== undefined;
}

/** Code BCP 47 de la langue courante, pour toLocaleString et Intl. */
export function localeIntl(): string {
  return langues.value.find((l) => l.code === langue.value)?.intl ?? (langue.value === 'fr' ? 'fr-FR' : langue.value);
}

async function charger(fichier: string): Promise<Messages | null> {
  try {
    const r = await fetch(`/lang/${fichier}`, { cache: 'no-cache' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    return (await r.json()) as Messages;
  } catch {
    return null;
  }
}

/** Fusion profonde : les cles du fichier du webroot remplacent celles du bundle. */
function fusionner(base: Messages, ajout: Messages): Messages {
  const out: Messages = { ...base };
  for (const [k, v] of Object.entries(ajout)) {
    const b = out[k];
    out[k] = typeof v === 'object' && v !== null && typeof b === 'object' && b !== null
      ? fusionner(b as Messages, v as Messages)
      : v;
  }
  return out;
}

function langueNavigateur(): string {
  return (navigator.language || LANGUE_REFERENCE).slice(0, 2).toLowerCase();
}

/**
 * Charge la langue au demarrage, avant tout affichage. Ordre de choix : celle
 * choisie par le visiteur, sinon la langue par defaut du serveur, sinon celle
 * du navigateur si elle est proposee, sinon le francais.
 */
export async function demarrerLangue(defautServeur?: string): Promise<void> {
  const liste = await charger('langues.json');
  if (Array.isArray(liste)) {
    const valides = (liste as unknown[]).filter(
      (l): l is Langue => typeof l === 'object' && l !== null && typeof (l as Langue).code === 'string' && typeof (l as Langue).nom === 'string',
    );
    if (valides.length) langues.value = valides;
  }
  const proposees = new Set(langues.value.map((l) => l.code));

  let choix: string | null = null;
  try { choix = localStorage.getItem(CLE_LANGUE); } catch { /* navigation privee */ }
  const candidats = [choix, defautServeur, langueNavigateur(), LANGUE_REFERENCE];
  const code = candidats.find((c): c is string => !!c && proposees.has(c)) ?? LANGUE_REFERENCE;

  // Le francais du webroot peut corriger des textes : on le fusionne au bundle.
  const frWebroot = await charger('fr.json');
  if (frWebroot) reference = fusionner(FR as Messages, frWebroot);
  courant = reference;
  if (code !== LANGUE_REFERENCE) {
    const m = await charger(`${code}.json`);
    if (m) courant = fusionner(reference, m);
  }
  langue.value = code;
  document.documentElement.lang = code;
}

/** Change de langue : memorisee pour ce navigateur, puis la page est rechargee. */
export function choisirLangue(code: string): void {
  try { localStorage.setItem(CLE_LANGUE, code); } catch { /* navigation privee */ }
  location.reload();
}
