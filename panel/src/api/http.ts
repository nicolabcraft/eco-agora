import axios, { AxiosError, type AxiosRequestConfig } from 'axios';
import { t } from '@/i18n';

/**
 * Le serveur de jeu sert a la fois le panel et son API.
 * En developpement, Vite proxifie /api, /datasets, /info... vers le port 3001,
 * donc une base vide fonctionne dans les deux environnements.
 */
export const serverUrl = '';

export const http = axios.create({
  baseURL: serverUrl,
  timeout: 25000,
  headers: { Accept: 'application/json' },
});

/** Jeton de session (world ticket obtenu en ouvrant le panel depuis le jeu). */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

/**
 * Cle d'administration (APIAdminAuthToken de Configs/Users.eco), pour se connecter
 * sans passer par le jeu.
 *
 * Eco aiguille vers son authentification par cle quand la requete porte le
 * parametre `api_key` ou l'en-tete `X-API-Key` (lu dans le code compile d'Eco :
 * la doc XML parle d'`apikey`, qui n'est que le nom interne du mode et n'est
 * jamais lu). On passe par l'en-tete : la cle n'apparait ainsi ni dans les
 * adresses ni dans les journaux d'acces du serveur.
 */
let apiKey: string | null = null;

export function setApiKey(key: string | null): void {
  apiKey = key;
}

http.interceptors.request.use((config) => {
  if (apiKey) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['X-API-Key'] = apiKey;
  } else if (authToken) {
    config.headers = config.headers ?? {};
    (config.headers as Record<string, string>)['X-Auth-Token'] = authToken;
  }
  return config;
});

/** Erreur enrichie : on garde le code HTTP pour degrader proprement l’affichage. */
export class ApiError extends Error {
  status: number;
  url: string;
  constructor(message: string, status: number, url: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.url = url;
  }
  get isAuth(): boolean {
    return this.status === 401 || this.status === 403;
  }
  get isMissing(): boolean {
    return this.status === 404;
  }
}

function toApiError(err: unknown, url: string): ApiError {
  const ax = err as AxiosError;
  const status = ax?.response?.status ?? 0;
  // Le code HTTP fait partie du message : 401 et 403 n’ont pas la même cause,
  // et l’administrateur doit pouvoir le lire sans ouvrir la console.
  const msg =
    status === 401
      ? t('api.e401')
      : status === 403
        ? t('api.e403')
        : status === 404
          ? t('api.e404')
          : status === 0
            ? t('api.injoignable')
            : t('api.erreurHttp', { status });
  return new ApiError(msg, status, url);
}

/**
 * Le serveur renvoie index.html (200) pour toute route inconnue : sans ce garde-fou
 * une page recevrait du HTML la ou elle attend du JSON.
 */
function looksLikeSpaFallback(data: unknown): boolean {
  return typeof data === 'string' && /^\s*<!doctype html/i.test(data);
}

/**
 * Le serveur parle HTTP/1.1 : le navigateur n'ouvre qu'une poignee de connexions
 * par origine (6 sur les navigateurs courants). Une page comme Statistiques lance
 * six lectures d'un coup ; si le serveur est lent, elles occupent tout le pool et
 * le fragment JavaScript de la page suivante attend derriere : cliquer dans le
 * menu ne fait alors rien pendant plusieurs secondes.
 *
 * On plafonne donc les lectures simultanees pour garder des connexions libres a
 * la navigation. Les ecritures ne passent pas par cette file : elles sont rares,
 * declenchees par l'utilisateur, et ne doivent jamais attendre derriere un
 * chargement de graphique.
 */
const MAX_LECTURES_SIMULTANEES = 4;
let lecturesEnCours = 0;
const fileDAttente: Array<() => void> = [];

function acquerirJeton(): Promise<void> | null {
  if (lecturesEnCours < MAX_LECTURES_SIMULTANEES) {
    lecturesEnCours += 1;
    return null;
  }
  return new Promise<void>((resolve) => fileDAttente.push(resolve));
}

function rendreJeton(): void {
  // Le jeton passe directement au suivant : le compteur reste juste.
  const suivant = fileDAttente.shift();
  if (suivant) suivant();
  else lecturesEnCours -= 1;
}

/**
 * Deux composants d'une meme page demandent parfois la meme lecture au meme
 * instant (`/datasets/treelist` etait ainsi appele deux fois). On partage alors
 * la requete en vol au lieu d'en ouvrir une seconde. Rien n'est mis en cache :
 * des que la reponse arrive, l'entree disparait.
 */
const lecturesPartagees = new Map<string, Promise<unknown>>();

function cleDeLecture(url: string, config?: AxiosRequestConfig): string {
  const params = config?.params ? JSON.stringify(config.params) : '';
  const type = config?.responseType ?? '';
  return `${url}|${params}|${type}`;
}

async function lireMaintenant<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const attente = acquerirJeton();
  if (attente) await attente;
  try {
    const res = await http.get<T>(url, config);
    if (looksLikeSpaFallback(res.data)) {
      throw new ApiError(t('api.pointAbsent'), 404, url);
    }
    return res.data;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    throw toApiError(err, url);
  } finally {
    rendreJeton();
  }
}

export function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  // Une requete portant un signal d'annulation reste individuelle : la partager
  // laisserait un appelant annuler la lecture d'un autre.
  if (config?.signal) return lireMaintenant<T>(url, config);

  const cle = cleDeLecture(url, config);
  const enVol = lecturesPartagees.get(cle);
  if (enVol) return enVol as Promise<T>;

  const promesse = lireMaintenant<T>(url, config).finally(() => {
    lecturesPartagees.delete(cle);
  });
  lecturesPartagees.set(cle, promesse);
  return promesse as Promise<T>;
}

export async function apiPut<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const res = await http.put<T>(url, body, config);
    return res.data;
  } catch (err) {
    throw toApiError(err, url);
  }
}

export async function apiPost<T>(
  url: string,
  body?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    const res = await http.post<T>(url, body, config);
    return res.data;
  } catch (err) {
    throw toApiError(err, url);
  }
}

/** Variante tolerante : renvoie `fallback` au lieu de lever, pour les blocs optionnels. */
export async function apiTry<T>(
  url: string,
  fallback: T,
  config?: AxiosRequestConfig,
): Promise<T> {
  try {
    return await apiGet<T>(url, config);
  } catch {
    return fallback;
  }
}
