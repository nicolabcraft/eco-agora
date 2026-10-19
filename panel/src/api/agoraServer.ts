import { apiGet, apiPost } from './http';

/**
 * Presentation du serveur, servie par le mod Eco Agora.
 *
 * Eco expose /api/v1/admin/{get,set}/servername pour le nom, mais aucune route pour
 * la description : le mod comble ce manque en ne touchant qu'une propriete de la
 * configuration reseau. Si le mod est absent, ces appels echouent et l'appelant
 * masque simplement le champ.
 */

export interface AgoraServerInfo {
  available: boolean;
  name: string;
  detailedDescription: string;
  discordAddress: string;
  category: string;
  publicServer: boolean;
  /** Port de jeu (absent de /info). */
  gamePort: number;
  maxLength: number;
}

export interface AgoraDescriptionResult {
  ok: boolean;
  detailedDescription: string;
  warning: string | null;
}

export const agoraServer = {
  info: () => apiGet<Partial<AgoraServerInfo>>('/api/agora/serverinfo'),

  setDescription: (detailedDescription: string) =>
    apiPost<AgoraDescriptionResult>('/api/agora/serverinfo', { detailedDescription }),
};
