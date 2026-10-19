import type { StatInfo } from '@/api/types';

/**
 * Le serveur traduit une partie seulement des libellés de statistiques
 * (`/datasets/treelist`). Ce tableau complète les entrées restées en anglais
 * pour les statistiques mises en avant dans le panel.
 */
export const STAT_FR: Record<string, string> = {
  ActiveCitizenPopulation: 'Citoyens actifs',
  ActiveCurrencies: 'Monnaies en circulation',
  AnimalPopulation: 'Population animale',
  CitizenPopulation: 'Population citoyenne',
  Debt: 'Dette totale',
  DebtPerActiveCitizen: 'Dette par citoyen actif',
  GDP: 'Produit intérieur brut',
  GovernmentHoldingsInDefaultCurrency: 'Avoirs du gouvernement',
  PersonalWealthInDefaultCurrency: 'Richesse des citoyens',
  PlantPopulation: 'Population végétale',
  TaxedTransactions: 'Transactions taxées',
  TotalAcidRainPollution: 'Pollution par pluies acides',
  TotalChemicalPollution: 'Pollution chimique',
  TotalHeavyMineralPollution: 'Pollution par métaux lourds',
  TotalSoilPollution: 'Pollution des sols',
  TradesInLast7Days: 'Échanges sur sept jours',
  TreePopulation: 'Population d’arbres',
  MedianHouseValueOfActiveCitizens: 'Valeur médiane des logements',
  MedianNutritionValueOfActiveCitizens: 'Nutrition médiane',
  MedianSkillRateOfActiveCitizens: 'Vitesse d’apprentissage médiane',
  MedianUnlockedSkillsOfActiveCitizens: 'Compétences débloquées (médiane)',
  MedianSpecialtyPercentOfActiveCitizens: 'Spécialisation médiane',
};

/** Renvoie la statistique avec un libellé français quand on en a un. */
export function frenchify(stat: StatInfo): StatInfo {
  const fr = STAT_FR[stat.Name];
  return fr ? { ...stat, DisplayName: fr } : stat;
}
