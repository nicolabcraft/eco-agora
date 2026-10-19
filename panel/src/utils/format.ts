import { versReel } from './horloge';
import { aTraduction, localeIntl, t } from '@/i18n';
/** Formatage dans la langue affichee : nombres, durees, unites de jeu. */

/**
 * Formateurs crees a la premiere utilisation, pas au chargement du module : la
 * langue n'est connue qu'apres le demarrage. Un changement de langue recharge la
 * page, mais on garde la locale dans la cle par prudence.
 */
const formateurs = new Map<string, Intl.NumberFormat>();
function nf(digits: 0 | 1 | 2): Intl.NumberFormat {
  const locale = localeIntl();
  const cle = `${locale}|${digits}`;
  let f = formateurs.get(cle);
  if (!f) {
    f = new Intl.NumberFormat(locale, { maximumFractionDigits: digits });
    formateurs.set(cle, f);
  }
  return f;
}
const nf0 = { format: (v: number): string => nf(0).format(v) };
const nf1 = { format: (v: number): string => nf(1).format(v) };
const nf2 = { format: (v: number): string => nf(2).format(v) };

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
  return t('utils.jourHeure', { jour: nf0.format(whole), h, m });
}

const deux = (n: number): string => String(n).padStart(2, '0');

/**
 * Instant du monde (en jours de jeu) affiche a l'heure reelle : « 30/09 21:00 ».
 * Sans correspondance disponible (mod absent), retombe sur l'heure du monde.
 */
export function dateMonde(day: number | null | undefined, long = false): string {
  if (day === null || day === undefined || Number.isNaN(day)) return '--';
  const d = versReel(day * 86400);
  if (!d) return gameDay(day);
  const date = `${deux(d.getDate())}/${deux(d.getMonth() + 1)}`;
  const heure = `${deux(d.getHours())}:${deux(d.getMinutes())}`;
  if (!long) return `${date} ${heure}`;
  // Jour court de la langue affichee (« lun. » en francais).
  const jour = new Intl.DateTimeFormat(localeIntl(), { weekday: 'short' }).format(d);
  return t('utils.dateLongue', { jour, date, heure });
}

/** Duree courte : 1.5 -> "1 j 12 h". */
export function days(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '--';
  const whole = Math.floor(value);
  const hours = Math.round((value - whole) * 24);
  if (whole === 0) return t('utils.duree.h', { h: hours });
  return hours === 0
    ? t('utils.duree.j', { j: nf0.format(whole) })
    : t('utils.duree.jh', { j: nf0.format(whole), h: hours });
}

/** Horodatage Unix (secondes ou millisecondes) -> date dans la langue affichee. */
export function dateTime(ts: number | null | undefined): string {
  if (!ts) return '--';
  const ms = ts > 1e12 ? ts : ts * 1000;
  return new Intl.DateTimeFormat(localeIntl(), {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(ms));
}

/**
 * Libelles des unites renvoyees par l API de statistiques : locales/<langue>/utils.json,
 * cles utils.unites.<Unite>. Une unite inconnue s'affiche telle qu'Eco l'envoie.
 */
export function unitLabel(unit: string | null | undefined): string {
  if (!unit) return '';
  const cle = `utils.unites.${unit}`;
  return aTraduction(cle) ? t(cle) : unit;
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
