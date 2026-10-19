import { versReel } from './horloge';
/** Formatage en francais : nombres, durees, unites de jeu. */

const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf2 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });

export function num(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  if (digits >= 2) return nf2.format(value);
  if (digits === 1) return nf1.format(value);
  return nf0.format(value);
}

/** Nombres compacts pour les tuiles : 12 400 -> 12,4 k */
export function compact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${nf1.format(value / 1e9)} G`;
  if (abs >= 1e6) return `${nf1.format(value / 1e6)} M`;
  if (abs >= 1e4) return `${nf1.format(value / 1e3)} k`;
  return nf0.format(value);
}

/** Un temps de jeu exprime en jours fractionnaires -> "Jour 12, 06:30". */
export function gameDay(day: number | null | undefined): string {
  if (day === null || day === undefined || Number.isNaN(day)) return '--';
  const whole = Math.floor(day);
  const frac = day - whole;
  const totalMin = Math.round(frac * 24 * 60);
  const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const m = String(totalMin % 60).padStart(2, '0');
  return `Jour ${nf0.format(whole)}, ${h}:${m}`;
}

const JOURS_COURTS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const deux = (n: number): string => String(n).padStart(2, '0');

/**
 * Instant du monde (en jours de jeu) affiche a l'heure reelle : « 30/09 21:00 ».
 * Sans correspondance disponible (mod absent), retombe sur l'heure du monde.
 */
export function dateMonde(day: number | null | undefined, long = false): string {
  if (day === null || day === undefined || Number.isNaN(day)) return '--';
  const d = versReel(day * 86400);
  if (!d) return gameDay(day);
  const court = `${deux(d.getDate())}/${deux(d.getMonth() + 1)} ${deux(d.getHours())}:${deux(d.getMinutes())}`;
  return long ? `${JOURS_COURTS[d.getDay()]} ${court.replace(' ', ' à ')}` : court;
}

/** Duree courte : 1.5 -> "1 j 12 h". */
export function days(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const whole = Math.floor(value);
  const hours = Math.round((value - whole) * 24);
  if (whole === 0) return `${hours} h`;
  return hours === 0 ? `${nf0.format(whole)} j` : `${nf0.format(whole)} j ${hours} h`;
}

/** Horodatage Unix (secondes ou millisecondes) -> date locale francaise. */
export function dateTime(ts: number | null | undefined): string {
  if (!ts) return '--';
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ms));
}

/** Libelles francais des unites renvoyees par l API de statistiques. */
const UNITS: Record<string, string> = {
  ActionsPerHour: 'actions/h',
  CO2PPM: 'ppm CO2',
  Celsius: '°C',
  Citizens: 'citoyens',
  Count: 'unités',
  CurrencyAmount: 'monnaie',
  Meters: 'm',
  Organisms: 'organismes',
  PPM: 'ppm',
  Percent: '%',
  SkillPoints: 'points',
};

export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  return UNITS[unit] ?? unit;
}

/** Coupe une chaine en gardant un mot entier. */
export function shorten(text: string, max = 90): string {
  if (text.length <= max) return text;
  return `${text.slice(0, text.lastIndexOf(' ', max))} ...`;
}

/** Retire les balises de mise en forme du jeu (TMP) et le HTML des libelles. */
export function stripMarkup(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .trim();
}
