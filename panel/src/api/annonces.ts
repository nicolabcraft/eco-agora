import { apiGet, apiPut } from './http';

export type AnnonceLevel = 'info' | 'important' | 'alerte';

export interface Annonce {
  id: string;
  titre: string;
  message: string;
  niveau: AnnonceLevel;
  epinglee: boolean;
  /** Dates ISO facultatives : hors de cette fenêtre, l'annonce n'est pas affichée. */
  debut?: string | null;
  fin?: string | null;
  /** Lien facultatif affiché en bouton. */
  lienUrl?: string | null;
  lienTexte?: string | null;
}

export interface AnnoncesFile {
  version: 1;
  miseAJour: string;
  annonces: Annonce[];
}

export const ANNONCES_PATH = '/annonces.json';
/** API du mod serveur Eco Agora, quand il est installé. */
export const ANNONCES_API = '/api/agora/annonces';

/** D'où viennent les annonces affichées : le mod, ou l'ancien fichier statique. */
export type AnnoncesSource = 'mod' | 'fichier' | 'aucune';

export const EMPTY_ANNONCES: AnnoncesFile = {
  version: 1,
  miseAJour: new Date(0).toISOString(),
  annonces: [],
};

/**
 * Le serialiseur du serveur Eco enveloppe les listes sous la forme
 * `{ "$type": "...", "$values": [...] }`. On accepte donc les deux formes.
 */
function readList(raw: unknown): Annonce[] {
  if (Array.isArray(raw)) return raw as Annonce[];
  if (raw && typeof raw === 'object') {
    const values = (raw as Record<string, unknown>).$values;
    if (Array.isArray(values)) return values as Annonce[];
  }
  return [];
}

/**
 * Lit les annonces. On interroge d'abord le mod : c'est lui qui les stocke désormais.
 * S'il n'est pas installé, on retombe sur l'ancien fichier statique — aucune régression.
 */
export async function fetchAnnonces(): Promise<AnnoncesFile & { source: AnnoncesSource }> {
  try {
    const raw = await apiGet<AnnoncesFile>(`${ANNONCES_API}?t=${Date.now()}`);
    const annonces = readList(raw?.annonces);
    if (raw && annonces.length >= 0) return { ...raw, annonces, source: 'mod' };
  } catch {
    /* mod absent ou hors service : on tente le fichier */
  }
  try {
    const raw = await apiGet<AnnoncesFile>(`${ANNONCES_PATH}?t=${Date.now()}`);
    if (raw && Array.isArray(raw.annonces)) return { ...raw, source: 'fichier' };
  } catch {
    /* aucune source disponible */
  }
  return { ...EMPTY_ANNONCES, source: 'aucune' };
}

/** Enregistre la liste côté serveur. Nécessite le mod et des droits d'administration. */
export async function saveAnnonces(annonces: Annonce[]): Promise<AnnoncesFile> {
  const raw = await apiPut<AnnoncesFile>(ANNONCES_API, { annonces });
  return { ...raw, annonces: readList(raw?.annonces) };
}

/** Le mod répond-il ? Sert à afficher le bon mode de publication. */
export async function isModAvailable(): Promise<boolean> {
  try {
    await apiGet<unknown>(`${ANNONCES_API}?t=${Date.now()}`);
    return true;
  } catch {
    return false;
  }
}

/** Une annonce est visible si elle est dans sa fenêtre de dates (bornes optionnelles). */
export function isActive(a: Annonce, now = Date.now()): boolean {
  const start = a.debut ? Date.parse(a.debut) : Number.NEGATIVE_INFINITY;
  const end = a.fin ? Date.parse(a.fin) : Number.POSITIVE_INFINITY;
  return now >= start && now <= end;
}
