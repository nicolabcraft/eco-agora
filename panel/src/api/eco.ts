/**
 * Appels a l’API du serveur Eco, regroupes par domaine.
 * Les chemins sont ceux du contrat Swagger v1 ; certains vivent a la racine
 * (/info, /datasets/...), les autres sous /api/v1.
 */
import { apiGet, apiPost, apiTry } from './http';
import type {
  ChatMessage,
  CommandResult,
  DataSet,
  Election,
  ElectedTitle,
  Law,
  MapEntity,
  PluginInfo,
  ProfilingResult,
  RunoffVote,
  ServerInfo,
  StatInfo,
  StatTree,
  User,
  Vector3,
  WebPluginInfo,
  WorldLayer,
} from './types';

/**
 * Certaines reponses d'Eco sont enveloppees par son serialiseur, sous la for
 * `{ "<Type>": { "$type": "...", "$values": [...] } }`. On en extrait le tableau.
 */
function unwrapEcoList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (raw && typeof raw === 'object') {
    for (const value of Object.values(raw as Record<string, unknown>)) {
      if (Array.isArray(value)) return value.map(String);
      if (value && typeof value === 'object') {
        const nested = (value as Record<string, unknown>).$values;
        if (Array.isArray(nested)) return nested.map(String);
      }
    }
  }
  return [];
}

/* ------------------------------------------------------------------ Serveur */

export const server = {
  info: () => apiGet<ServerInfo>('/info'),
  isAdmin: async (): Promise<boolean> => {
    const raw = await apiTry<unknown>('/isadmin', false);
    return raw === true || raw === 'true';
  },
  /**
   * La liste des administrateurs vit a la racine (`/admins`, et non sous /api/v1)
   * et arrive enveloppee par le serialiseur d'Eco. Elle contient des
   * identifiants de compte, pas des pseudos.
   */
  admins: async (): Promise<string[]> => {
    const raw = await apiTry<unknown>('/admins', []);
    return unwrapEcoList(raw);
  },
  plugins: () => apiTry<PluginInfo[]>('/api/v1/plugins', []),
  webPlugins: () => apiTry<WebPluginInfo[]>('/api/v1/plugins/web', []),
};

/* -------------------------------------------------------------- Statistiques */

export const stats = {
  /** Arbre des categories de statistiques. */
  tree: () => apiGet<StatTree>('/datasets/treelist'),
  /** Liste plate des 200+ statistiques avec leurs metadonnees. */
  flatList: () => apiGet<StatInfo[]>('/datasets/flatlist'),
  /** Bornes temporelles disponibles, en jours de jeu : [debut, fin]. */
  timeRange: () => apiGet<[number, number]>('/datasets/timerange'),
  /** Une serie. */
  get: (dataset: string, dayStart: number, dayEnd: number) =>
    apiGet<DataSet>('/datasets/get', {
      params: { dataset, dayStart, dayEnd: dayEnd === dayStart ? dayEnd + 0.01 : dayEnd },
    }),
  /** Plusieurs series en un seul aller-retour (meme ordre que `names`). */
  getMany: (names: string[], dayStart: number, dayEnd: number) =>
    apiGet<DataSet[]>('/datasets/getlist', {
      params: {
        requestedSets: names,
        dayStart,
        dayEnd: dayEnd === dayStart ? dayEnd + 0.01 : dayEnd,
      },
      paramsSerializer: { indexes: null },
    }),
  /**
   * Remplit le monde de statistiques factices, pour valider les courbes.
   * Endpoint de debogage : le serveur exige `authtoken`/`authtokentype` en
   * parametres d'URL et, cote configuration, `AllowDebugCalls` active.
   */
  generateTestData: (
    params: { days: number; users: number; generateClimateData: boolean; pollutionMultiplier: number },
    auth: { authtoken: string; authtokentype: 'slg' | 'steam_encrypted_token' },
  ) => apiGet<unknown>('/datasets/generatetestdata', { params: { ...params, ...auth } }),

  /** Graphes mis en avant sur la page d’accueil, tels que configures cote serveur. */
  frontPageGraphs: () => apiTry<unknown[]>('/datasets/graphs', []),
};

/* ---------------------------------------------------------------- Carte */

export const worldMap = {
  json: () => apiGet<Record<string, unknown>>('/api/v1/map/map.json'),
  dimension: () => apiGet<Vector3>('/api/v1/map/dimension'),
  waterLevel: () => apiGet<number>('/api/v1/map/waterLevel'),
  layerList: () => apiTry<string[]>('/api/v1/map/layerList', []),
  entityTypes: () => apiTry<string[]>('/api/v1/map/entitytypes', []),
  entities: (entityTypes?: string[], states?: string[]) =>
    apiTry<MapEntity[]>('/api/v1/map/entities', [], {
      params: { entityTypes, states },
      paramsSerializer: { indexes: null },
    }),
  property: () => apiTry<unknown>('/api/v1/map/property', null),
  districtMap: (name: string) =>
    apiGet<{ DistrictMap: string; DistrictMetadata: unknown[] }>(
      `/api/v1/laws/districtmap/${encodeURIComponent(name)}`,
    ),
};

/* ------------------------------------------------------- Calques du monde */

export const layers = {
  list: () => apiTry<WorldLayer[]>('/api/v1/worldlayers/layers', []),
  detail: (focusLayer: string, box?: { minX: number; minY: number; maxX: number; maxY: number }) =>
    apiGet<unknown>(`/api/v1/worldlayers/layers/${encodeURIComponent(focusLayer)}`, {
      params: box,
    }),
  relationships: (focusLayer: string, box?: { minX: number; minY: number; maxX: number; maxY: number }) =>
    apiGet<unknown>(`/api/v1/worldlayers/relationships/${encodeURIComponent(focusLayer)}`, {
      params: box,
    }),
  areaDescription: (box: { minX: number; minY: number; maxX: number; maxY: number }) =>
    apiGet<string>('/api/v1/worldlayers/relationships/areadescription', { params: box }),
};

/* ----------------------------------------------------------- Gouvernance */

export const civics = {
  elections: (active?: boolean) =>
    apiTry<Election[]>('/api/v1/elections', [], {
      params: active === undefined ? undefined : { returnActive: active },
    }),
  election: (id: number) => apiGet<Election>(`/api/v1/elections/${id}`),
  titles: (state?: string) =>
    apiTry<ElectedTitle[]>('/api/v1/elections/titles', [], { params: state ? { state } : undefined }),
  title: (id: number) => apiGet<ElectedTitle>(`/api/v1/elections/titles/${id}`),
  votes: (id: number) => apiTry<unknown[]>('/api/v1/elections/votes', [], { params: { id } }),
  comments: (electionId: number) =>
    apiTry<unknown[]>('/api/v1/elections/listcomments', [], { params: { electionId } }),
  laws: () => apiTry<Law[]>('/api/v1/laws', []),
  law: (id: number) => apiGet<Law>(`/api/v1/laws/${id}`),
  lawsByState: (states: string) => apiTry<Law[]>(`/api/v1/laws/byStates/${encodeURIComponent(states)}`, []),
  vote: (vote: RunoffVote, forceVote = false) =>
    apiPost<void>('/api/v1/elections/vote', vote, { params: { forceVote } }),
  /**
   * Eco attend un objet ElectionCommentV1 (Username, Text...), pas une chaine :
   * l'envoi d'une chaine seule renvoyait 400. Meme corps que l'ancien panel d'Eco.
   */
  addComment: (electionId: number, text: string, username: string | null) =>
    apiPost<void>('/api/v1/elections/addcomment', { Username: username ?? '', Text: text }, {
      params: { electionId },
    }),
};

/* ----------------------------------------------------------------- Admin */

export const admin = {
  users: (hoursPlayedGte?: number) =>
    apiGet<User[]>('/api/v1/users', {
      params: hoursPlayedGte ? { hoursPlayedGte } : undefined,
    }),
  performanceReport: () => apiGet<string>('/api/v1/performance/performanceReport', { responseType: 'text' }),
  profilingResults: () => apiGet<ProfilingResult[]>('/api/v1/profiling-results'),
  /** Renvoie des chemins de fichiers de journaux, et non des categories. */
  logFiles: () => apiGet<string[]>('/api/v1/logs'),
  categoryLogs: (category: string) =>
    apiGet<string[]>(`/api/v1/logs/${encodeURIComponent(category)}`),
  logFile: (filepath: string) =>
    apiGet<string>('/api/v1/logs/get', { params: { filepath }, responseType: 'text' }),
  getAccess: () => apiGet<string>('/api/v1/admin/get/access'),
  setAccess: (value: string, password?: string) =>
    apiPost<void>('/api/v1/admin/set/access', null, { params: { value, password } }),
  getServerName: () => apiGet<string>('/api/v1/admin/get/servername'),
  setServerName: (name: string) =>
    apiPost<void>('/api/v1/admin/set/servername', null, { params: { name } }),
  pluginConfig: (name: string) =>
    apiGet<unknown>(`/api/v1/plugins/config/${encodeURIComponent(name)}`),
  savePluginConfig: (name: string, config: unknown) =>
    apiPost<unknown>(`/api/v1/plugins/config/${encodeURIComponent(name)}`, config),
};

/* ------------------------------------------------------------------ Chat */

export const chat = {
  range: (startDay?: number, endDay?: number) =>
    apiGet<ChatMessage[]>('/api/v1/chat', { params: { startDay, endDay } }),
  byUser: (username: string, startDay?: number, endDay?: number) =>
    apiGet<ChatMessage[]>(`/api/v1/chat/${encodeURIComponent(username)}`, {
      params: { startDay, endDay },
    }),
  byTag: (tag: string, startDay?: number, endDay?: number) =>
    apiGet<ChatMessage[]>('/api/v1/chat/tag', { params: { tag, startDay, endDay } }),
  next: (numNextMessages: number) =>
    apiPost<ChatMessage[]>('/api/v1/chat/next', null, { params: { numNextMessages } }),
  previous: (numPreviousMessages: number) =>
    apiPost<ChatMessage[]>('/api/v1/chat/previous', null, { params: { numPreviousMessages } }),
  send: (username: string, message: string) =>
    apiGet<unknown>('/api/v1/chat/sendChat', { params: { username, message } }),
};

/* -------------------------------------------------------------- Commandes */

export const commands = {
  exec: (command: string) =>
    apiPost<CommandResult>('/api/v1/command/exec', { Command: command }),
};

/* ---------------------------------------------------------------- Exports */

export const exporter = {
  actionList: () => apiGet<string[] | string>('/api/v1/exporter/actionlist'),
  speciesList: () => apiGet<string[] | string>('/api/v1/exporter/specieslist'),
  environmentList: () => apiGet<string[] | string>('/api/v1/exporter/environmentlist'),
  actions: (actionName: string) =>
    apiGet<unknown>('/api/v1/exporter/actions', { params: { actionName } }),
  species: (speciesName: string) =>
    apiGet<unknown>('/api/v1/exporter/species', { params: { speciesName } }),
  environment: (category: string, units?: string, column?: string) =>
    apiGet<unknown>('/api/v1/exporter/environment', { params: { category, units, column } }),
  pushAll: () => apiPost<unknown>('/api/v1/exporter/all'),
  pushChat: () => apiPost<unknown>('/api/v1/exporter/chat'),
  pushActions: () => apiPost<unknown>('/api/v1/exporter/actions'),
  pushEnvironment: () => apiPost<unknown>('/api/v1/exporter/environment'),
  pushSpecies: () => apiPost<unknown>('/api/v1/exporter/species'),
  gameExport: () => apiPost<unknown>('/api/v1/admin/game/export'),
};
