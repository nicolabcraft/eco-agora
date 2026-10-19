import { ref, shallowRef, watch, type Ref } from 'vue';
import { stats } from '@/api/eco';
import { apiGet } from '@/api/http';

/** L API renvoie les abscisses en secondes de jeu. */
const SECONDS_PER_DAY = 86400;
import type { StatInfo, StatTree } from '@/api/types';
import { frenchify } from '@/i18n/statLabels';
import type { Serie } from '@/utils/chart';

/** Bornes temporelles du monde, en jours de jeu. Partagees par toutes les pages. */
const range = shallowRef<[number, number] | null>(null);
const rangeError = ref<string | null>(null);
let rangePromise: Promise<[number, number] | null> | null = null;

export async function loadTimeRange(force = false): Promise<[number, number] | null> {
  if (range.value && !force) return range.value;
  if (!rangePromise || force) {
    rangePromise = stats
      .timeRange()
      .then((r) => {
        range.value = r;
        rangeError.value = null;
        return r;
      })
      .catch((err: Error) => {
        rangeError.value = err.message;
        return null;
      });
  }
  return rangePromise;
}

export function useTimeRange() {
  void loadTimeRange();
  return { range, rangeError, reload: () => loadTimeRange(true) };
}

/** Catalogue complet des statistiques, charge une seule fois. */
const catalog = shallowRef<StatInfo[] | null>(null);
let catalogPromise: Promise<StatInfo[]> | null = null;

/**
 * `/datasets/flatlist` renvoie les libellés en anglais alors que
 * `/datasets/treelist` les renvoie traduits par le serveur. On fusionne donc les
 * deux pour obtenir un catalogue complet et localisé.
 */
export async function loadCatalog(): Promise<StatInfo[]> {
  if (catalog.value) return catalog.value;
  if (!catalogPromise) {
    catalogPromise = Promise.all([
      stats.flatList(),
      stats.tree().catch(() => null),
    ]).then(([flat, tree]) => {
      const localized = new Map<string, StatInfo>();
      const collect = (node: StatTree): void => {
        for (const s of node.ChildrenStats ?? []) localized.set(s.Name, s);
        for (const c of node.ChildrenCategories ?? []) collect(c);
      };
      if (tree) collect(tree);
      const merged = flat.map((s) => frenchify(localized.get(s.Name) ?? s));
      for (const [name, s] of localized) {
        if (!merged.some((m) => m.Name === name)) merged.push(frenchify(s));
      }
      catalog.value = merged;
      return merged;
    });
  }
  return catalogPromise;
}

/**
 * Series fournies par le mod, a cote des statistiques d'Eco. Eco n'enregistre pas
 * les joueurs connectes : le mod les releve, au meme format que /datasets.
 */
export const SERIE_CONNECTES = 'agora:connectes';
const SERIES_MOD: Record<string, { label: string; route: string; step?: boolean }> = {
  [SERIE_CONNECTES]: { label: 'Citoyens connectés', route: '/api/agora/connectes', step: true },
};

interface SerieBrute { Times?: number[]; Values?: number[]; Unit?: string }

/** Serie du mod, ou null si le mod est absent : la courbe est alors simplement omise. */
async function serieMod(name: string, debut: number, fin: number): Promise<SerieBrute | null> {
  const def = SERIES_MOD[name];
  if (!def) return null;
  try {
    return await apiGet<SerieBrute>(def.route, { params: { debut, fin } });
  } catch {
    return null;
  }
}

export function statLabel(name: string): string {
  if (SERIES_MOD[name]) return SERIES_MOD[name].label;
  const found = catalog.value?.find((s) => s.Name === name);
  return found?.DisplayName ?? name;
}

export function statInfo(name: string): StatInfo | undefined {
  return catalog.value?.find((s) => s.Name === name);
}

export interface SeriesState {
  series: Ref<Serie[]>;
  loading: Ref<boolean>;
  error: Ref<string | null>;
  hasData: Ref<boolean>;
  reload: () => Promise<void>;
}

/**
 * Charge un groupe de series sur toute la plage disponible du monde.
 * `names` peut etre reactif : le rechargement est automatique.
 */
export function useSeriesGroup(
  names: Ref<string[]> | (() => string[]),
  options: { area?: boolean; window?: Ref<[number, number] | null> } = {},
): SeriesState {
  const series = ref<Serie[]>([]) as Ref<Serie[]>;
  const loading = ref(false);
  const error = ref<string | null>(null);
  const hasData = ref(false);
  const read = typeof names === 'function' ? names : () => names.value;

  async function reload(): Promise<void> {
    const wanted = read();
    if (wanted.length === 0) {
      series.value = [];
      hasData.value = false;
      return;
    }

    loading.value = true;
    error.value = null;
    try {
      await loadCatalog().catch(() => []);
      const bounds = options.window?.value ?? (await loadTimeRange());
      if (!bounds) throw new Error('Plage temporelle indisponible');
      const [start, end] = bounds;

      const ecoNames = wanted.filter((n) => !SERIES_MOD[n]);
      const [ecoData, modData] = await Promise.all([
        ecoNames.length ? stats.getMany(ecoNames, start, end) : Promise.resolve([]),
        Promise.all(wanted.filter((n) => SERIES_MOD[n]).map((n) => serieMod(n, start, end))),
      ]);
      const parNom = new Map<string, SerieBrute | null>();
      ecoNames.forEach((n, i) => parNom.set(n, ecoData[i] ?? null));
      wanted.filter((n) => SERIES_MOD[n]).forEach((n, i) => parNom.set(n, modData[i] ?? null));

      series.value = wanted
        // Une serie du mod indisponible est retiree, pas affichee vide.
        .filter((name) => !SERIES_MOD[name] || parNom.get(name))
        .map((name) => {
          const d = parNom.get(name);
          return {
            name: statLabel(name),
            unit: d?.Unit ?? statInfo(name)?.Unit ?? '',
            times: (d?.Times ?? []).map((t) => t / SECONDS_PER_DAY),
            values: d?.Values ?? [],
            area: options.area && wanted.length === 1,
            step: SERIES_MOD[name]?.step,
          };
        });
      hasData.value = series.value.some((s) => s.values.length > 1);
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Chargement impossible';
      series.value = [];
      hasData.value = false;
    } finally {
      loading.value = false;
    }
  }

  void reload();
  if (typeof names !== 'function') watch(names, () => void reload(), { deep: true });
  if (options.window) watch(options.window, () => void reload(), { deep: true });

  return { series, loading, error, hasData, reload };
}
