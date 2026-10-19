import axios from 'axios';

/**
 * Le moteur de carte d’origine (ecomap) utilise l’instance axios globale avec
 * des chemins relatifs (/map/map.json, /laws/districtmap/...) et lit
 * window.serverUrl pour charger les textures de calques (/Layers/*.gif).
 * On aligne donc ces deux reglages avant de l’initialiser.
 */
let done = false;

export function prepareMapEngine(): void {
  if (done) return;
  (window as unknown as { serverUrl: string }).serverUrl = '';
  axios.defaults.baseURL = '/api/v1';
  done = true;
}
