import { apiGet } from '@/api/http';

/**
 * Conversion horloge du monde -> heure reelle.
 *
 * Eco date ses statistiques en secondes du monde. Le monde avance au rythme reel
 * mais s'arrete quand le serveur est coupe : afficher ces secondes comme une heure
 * (« Jour 0, 15:00 ») donnait l'impression de donnees en retard. Le mod enregistre
 * des reperes « a telle heure reelle, le monde valait tant » ; entre deux coupures,
 * la conversion est exacte.
 *
 * Sans le mod (route absente), on ne devine rien : les fonctions renvoient null et
 * l'affichage retombe sur l'heure du monde.
 */

interface Repere {
  /** Heure reelle, en millisecondes depuis 1970. */
  reel: number;
  /** Horloge du monde, en secondes. */
  monde: number;
}

interface HorlogeApi {
  maintenant?: { utc?: string; monde?: number };
  ancrages?: Array<{ utc?: string; monde?: number }>;
}

let reperes: Repere[] = [];

function lire(utc: string | undefined, monde: number | undefined): Repere | null {
  const reel = utc ? Date.parse(utc) : NaN;
  return Number.isFinite(reel) && typeof monde === 'number' ? { reel, monde } : null;
}

/** Charge les reperes. Ne leve jamais : sans mod, la conversion est simplement indisponible. */
export async function chargerHorloge(): Promise<void> {
  try {
    const r = await apiGet<HorlogeApi>('/api/agora/horloge');
    const liste = (r.ancrages ?? [])
      .map((a) => lire(a.utc, a.monde))
      .filter((a): a is Repere => a !== null);
    const actuel = lire(r.maintenant?.utc, r.maintenant?.monde);
    if (actuel) liste.push(actuel); // vaut pour toute la session en cours
    reperes = liste.sort((a, b) => a.monde - b.monde);
  } catch {
    reperes = [];
  }
}

export function horlogeDisponible(): boolean {
  return reperes.length > 0;
}

/** Instant reel correspondant a une seconde du monde, ou null si inconnu. */
export function versReel(secondesMonde: number): Date | null {
  if (reperes.length === 0 || !Number.isFinite(secondesMonde)) return null;
  // Le dernier repere qui precede l'instant : c'est la session qui le contient.
  let base = reperes[0];
  for (const r of reperes) {
    if (r.monde <= secondesMonde) base = r;
    else break;
  }
  return new Date(base.reel + (secondesMonde - base.monde) * 1000);
}
