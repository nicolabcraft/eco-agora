import { apiGet } from './http';

/** Journal d'activité exposé par le mod Eco Agora (routes admin). */

export interface AuditEvent {
  id: string;
  ts: string;
  tsEnd: string;
  type: string;
  player: string | null;
  target: string | null;
  tool: string | null;
  worldObject: string | null;
  quantity: number;
  /** Nombre d'actions réelles regroupées dans cette ligne (1 = ligne unitaire). */
  count: number;
  x: number;
  y: number;
  z: number;
  details: string | null;
}

export interface AuditPage {
  total: number;
  limit: number;
  offset: number;
  events: AuditEvent[];
}

export interface AuditStats {
  enabled: boolean;
  retentionDays: number;
  aggregationWindowSeconds: number;
  events: number;
  rollups: number;
  databaseBytes: number;
  written: number;
  queued: number;
  dropped: number;
  errors: number;
  archived: number;
  topTypes24h: Array<{ type: string; count: number }>;
}

export interface AuditFilters {
  type?: string;
  player?: string;
  target?: string;
  tool?: string;
  from?: string;
  to?: string;
  xmin?: number;
  xmax?: number;
  zmin?: number;
  zmax?: number;
  limit?: number;
  offset?: number;
}

/** Retire les filtres vides : le mod traite l'absence comme « pas de filtre ». */
function clean(filters: AuditFilters): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

export const audit = {
  search: (filters: AuditFilters = {}) =>
    apiGet<AuditPage>('/api/agora/audit', { params: clean(filters) }),
  stats: () => apiGet<AuditStats>('/api/agora/audit/stats'),
  rollups: (from?: string, to?: string, type?: string) =>
    apiGet<{ series: Array<{ hour: string; type: string; count: number; quantity: number }> }>(
      '/api/agora/audit/rollups',
      { params: clean({ from, to, type }) },
    ),
  distinct: (field: 'type' | 'player' | 'target' | 'tool') =>
    apiGet<{ field: string; values: string[] }>('/api/agora/audit/distinct', { params: { field } }),
};
