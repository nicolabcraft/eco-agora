import type { StatInfo } from '@/api/types';
import { aTraduction, t } from '@/i18n';

/**
 * Le serveur traduit une partie seulement des libellés de statistiques
 * (`/datasets/treelist`). Les libellés des statistiques mises en avant dans le
 * panel vivent dans locales/<langue>/stats.json, sous le nom technique d'Eco
 * (« GDP », « TreePopulation »...). Une statistique absente garde le texte d'Eco.
 */
export function statLabelTraduit(name: string): string | undefined {
  const cle = `stats.${name}`;
  return name && !name.includes('.') && aTraduction(cle) ? t(cle) : undefined;
}

/** Renvoie la statistique avec un libellé traduit quand on en a un. */
export function frenchify(stat: StatInfo): StatInfo {
  const libelle = statLabelTraduit(stat.Name);
  return libelle ? { ...stat, DisplayName: libelle } : stat;
}
