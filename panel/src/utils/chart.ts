import type { EChartsOption } from 'echarts';
import { dateMonde, num, unitLabel } from './format';

/** Palette de series, alignee sur les jetons CSS de la charte. */
export const SERIES_COLORS = [
  '#ff6b0d', '#4aa3d8', '#6fcf7f', '#c58af9',
  '#f0c419', '#ff8fa3', '#5fd0c4', '#ad6151',
];

const TEXT = '#eeedf0';
const MUTED = 'rgba(238, 237, 240, 0.62)';
const GRID_LINE = 'rgba(255, 255, 255, 0.07)';
const SURFACE = '#1e1b23';

export interface Serie {
  name: string;
  unit: string;
  times: number[];
  values: number[];
  area?: boolean;
  /** Valeur par paliers (ex. joueurs connectes) : tracee en escalier, sans lissage. */
  step?: boolean;
}

/** Derniere valeur connue d'une serie a l'instant donne (ses instants sont tries). */
function valeurA(s: Serie, x: number): number | null {
  let v: number | null = null;
  for (let i = 0; i < s.times.length && s.times[i] <= x + 1e-9; i++) v = s.values[i];
  return v;
}

/**
 * Construit une option ECharts homogene pour toutes les courbes du panel.
 * L axe X est en jours de jeu ; les series de plusieurs unites sont
 * reparties sur deux axes Y afin de rester lisibles.
 */
export function lineOption(series: Serie[], opts: { smooth?: boolean; stack?: boolean } = {}): EChartsOption {
  const units = [...new Set(series.map((s) => s.unit))];
  const primaryUnit = units[0];
  const secondaryUnit = units.length > 1 ? units[1] : undefined;

  // Unite par serie, pour que l'infobulle dise a quelle echelle appartient
  // chaque nombre quand deux axes cohabitent.
  const uniteParSerie = new Map(series.map((s) => [s.name, unitLabel(s.unit)]));

  const yAxes: Record<string, unknown>[] = [
    {
      type: 'value' as const,
      name: unitLabel(primaryUnit),
      // nameGap reserve une bande fixe au-dessus de l'axe. Sans lui, le nom
      // etait pose juste au-dessus du canevas : « ppm » passait (aucun jambage
      // haut) mais « °C » etait rogne, le degre montant plus haut qu'une
      // capitale. Mesure : premier pixel de texte a y=0 avant, y=22 apres.
      nameLocation: 'end' as const,
      nameGap: 12,
      nameTextStyle: { color: MUTED, fontSize: 11, padding: [0, 0, 0, 4], align: 'left' },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11, hideOverlap: true, formatter: (v: number) => num(v, 0) },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
  ];
  if (secondaryUnit) {
    yAxes.push({
      type: 'value' as const,
      name: unitLabel(secondaryUnit),
      nameLocation: 'end' as const,
      nameGap: 12,
      nameTextStyle: { color: MUTED, fontSize: 11, padding: [0, 4, 0, 0], align: 'right' },
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11, hideOverlap: true, formatter: (v: number) => num(v, 0) },
      splitLine: { show: false },
    });
  }

  return {
    animationDuration: 420,
    color: SERIES_COLORS,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', color: TEXT },
    // La legende est placee sous le graphe : au-dessus, elle chevauchait les
    // noms d'unites des axes verticaux des que plusieurs series etaient tracees.
    grid: {
      left: 8,
      right: secondaryUnit ? 8 : 14,
      // 44 = 32 + la bande du nom d'unite (nameGap 12).
      top: 44,
      bottom: series.length > 1 ? 26 : 6,
      containLabel: true,
    },
    legend: {
      show: series.length > 1,
      bottom: 0,
      left: 'center',
      type: 'scroll',
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      padding: [4, 0, 0, 0],
      textStyle: { color: MUTED, fontSize: 12 },
      inactiveColor: 'rgba(238,237,240,0.25)',
      pageIconColor: '#ff6b0d',
      pageIconInactiveColor: 'rgba(238,237,240,0.3)',
      pageTextStyle: { color: MUTED, fontSize: 11 },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: SURFACE,
      borderColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      textStyle: { color: TEXT, fontSize: 12.5 },
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,107,13,0.55)' } },
      // L'unite est rappelee par serie : sur un graphe a deux axes, un nombre
      // seul ne dit pas a quelle echelle il appartient.
      // Chaque courbe y figure avec sa derniere valeur connue a l'instant survole :
      // des series aux instants differents (les connectes, releves par le mod) ne
      // disparaissent pas de l'infobulle.
      formatter: (params: unknown) => {
        const points = (Array.isArray(params) ? params : [params]) as Array<{ value?: unknown }>;
        if (points.length === 0) return '';
        const premier = points[0].value;
        const x = Array.isArray(premier) ? Number(premier[0]) : NaN;
        if (!Number.isFinite(x)) return '';
        const lignes = series.flatMap((serie, i) => {
          const v = valeurA(serie, x);
          if (v === null) return [];
          const unite = uniteParSerie.get(serie.name) ?? '';
          const couleur = SERIES_COLORS[i % SERIES_COLORS.length];
          const pastille = `<span style="display:inline-block;margin-right:6px;border-radius:50%;width:9px;height:9px;background:${couleur}"></span>`;
          return [`${pastille}${serie.name} : <strong>${num(v, 2)}${unite ? ' ' + unite : ''}</strong>`];
        });
        return [dateMonde(x, true), ...lignes].join('<br/>');
      },
    },
    xAxis: {
      type: 'value',
      min: 'dataMin',
      max: 'dataMax',
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { show: false },
      // hideOverlap evite le chevauchement des dernieres graduations quand la
      // plage est courte (deux libelles tombaient au meme endroit).
      axisLabel: {
        color: MUTED,
        fontSize: 11,
        hideOverlap: true,
        formatter: (v: number) => dateMonde(v),
      },
      splitNumber: 5,
      splitLine: { show: false },
    },
    yAxis: yAxes,
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line' as const,
      yAxisIndex: secondaryUnit && s.unit === secondaryUnit ? 1 : 0,
      smooth: s.step ? false : (opts.smooth ?? true),
      smoothMonotone: 'x' as const,
      step: s.step ? ('end' as const) : undefined,
      showSymbol: s.times.length < 40,
      symbolSize: 5,
      lineStyle: { width: 2 },
      stack: opts.stack ? 'total' : undefined,
      areaStyle: s.area
        ? {
            opacity: 0.18,
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: SERIES_COLORS[i % SERIES_COLORS.length] },
                { offset: 1, color: 'rgba(0,0,0,0)' },
              ],
            },
          }
        : undefined,
      data: s.times.map((t, idx) => [t, s.values[idx]]),
    })),
  };
}

/** Une série indexée sur le temps réel, et non sur les jours de jeu. */
export interface TimeSerie {
  name: string;
  points: Array<[string, number]>;
  area?: boolean;
}

/**
 * Variante de `lineOption` pour les relevés horodatés en temps réel (économie).
 * L'axe X est un axe de type « time », pas une échelle de jours de jeu.
 */
export function timeLineOption(series: TimeSerie[]): EChartsOption {
  return {
    animationDuration: 420,
    color: SERIES_COLORS,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: '"Segoe UI", Tahoma, Geneva, Verdana, sans-serif', color: TEXT },
    grid: { left: 8, right: 14, top: 32, bottom: series.length > 1 ? 26 : 6, containLabel: true },
    legend: {
      show: series.length > 1,
      bottom: 0,
      left: 'center',
      type: 'scroll',
      icon: 'roundRect',
      itemWidth: 10,
      itemHeight: 10,
      itemGap: 14,
      textStyle: { color: MUTED, fontSize: 12 },
      inactiveColor: 'rgba(238,237,240,0.25)',
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: SURFACE,
      borderColor: 'rgba(255,255,255,0.15)',
      borderWidth: 1,
      textStyle: { color: TEXT, fontSize: 12.5 },
      axisPointer: { type: 'line', lineStyle: { color: 'rgba(255,107,13,0.55)' } },
      valueFormatter: (v) => num(Number(v), 2),
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: GRID_LINE } },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11, hideOverlap: true },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: MUTED, fontSize: 11, hideOverlap: true, formatter: (v: number) => num(v, 0) },
      splitLine: { lineStyle: { color: GRID_LINE } },
    },
    series: series.map((s, i) => ({
      name: s.name,
      type: 'line' as const,
      smooth: true,
      showSymbol: s.points.length < 40,
      symbolSize: 5,
      lineStyle: { width: 2 },
      areaStyle: s.area
        ? {
            opacity: 0.18,
            color: {
              type: 'linear' as const,
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: SERIES_COLORS[i % SERIES_COLORS.length] },
                { offset: 1, color: 'rgba(0,0,0,0)' },
              ],
            },
          }
        : undefined,
      data: s.points,
    })),
  };
}
