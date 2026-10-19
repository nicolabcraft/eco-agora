import { apiGet } from './http';

/** Agrégats économiques relevés par le mod Eco Agora (lecture publique). */

export interface CurrencyLine {
  name: string;
  total: number;
  government: number;
  holders: number;
  /** Détenteurs au solde non fini : monnaies personnelles non gagées. */
  unlimitedHolders?: number;
  /** Vrai si aucun solde fini n'existe pour cette monnaie. */
  unlimited?: boolean;
}

export interface EconomySnapshot {
  available: boolean;
  message?: string;
  hour?: string;
  currencies?: number;
  accounts?: number;
  personalAccounts?: number;
  governmentAccounts?: number;
  totalHoldings?: number;
  governmentHoldings?: number;
  personalHoldings?: number;
  lines?: CurrencyLine[];
}

export interface EconomyPoint {
  hour: string;
  totalHoldings: number;
  governmentHoldings: number;
  personalHoldings: number;
  accounts: number;
  currencies: number;
}

export const agoraEconomy = {
  latest: () => apiGet<EconomySnapshot>('/api/agora/economy'),
  history: (days = 14) =>
    apiGet<{ days: number; series: EconomyPoint[] }>('/api/agora/economy/history', { params: { days } }),
};
