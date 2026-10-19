import { apiGet } from './http';

/**
 * Client du mod EcoMarketApi (installé dans Mods/EcoMarketApi).
 * Routes : /api/v1/ecomarket/{snapshot,catalog,me}.
 *
 * Le mod sérialise en camelCase sur le fil (« stores », « observedAt »), alors que
 * ses propres types exposent du PascalCase (« StoreId », « ItemName »). On lit donc
 * chaque champ sans tenir compte de la casse, et on n'expose ici que du camelCase.
 */

type Raw = Record<string, unknown>;

function pick(source: unknown, key: string): unknown {
  if (!source || typeof source !== 'object') return undefined;
  const obj = source as Raw;
  if (key in obj) return obj[key];
  const wanted = key.toLowerCase();
  for (const k of Object.keys(obj)) if (k.toLowerCase() === wanted) return obj[k];
  return undefined;
}

function asText(source: unknown, key: string): string | null {
  const v = pick(source, key);
  if (v === null || v === undefined || v === '') return null;
  return typeof v === 'string' ? v : String(v);
}

function asNumber(source: unknown, key: string): number | null {
  const v = pick(source, key);
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function asBool(source: unknown, key: string, fallback = false): boolean {
  const v = pick(source, key);
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') return v.toLowerCase() === 'true';
  return fallback;
}

/** Le sérialiseur d'Eco enveloppe parfois les listes : on accepte les deux formes. */
function asList(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  const values = pick(raw, '$values');
  return Array.isArray(values) ? values : [];
}

export interface MarketPosition { x: number; y: number; z: number }

export interface TradeOffer {
  offerId: string;
  direction: string;
  category: string | null;
  price: number | null;
  itemId: number | null;
  itemName: string | null;
  itemType: string | null;
  tagId: number | null;
  tagName: string | null;
  /** Vrai pour une offre portant sur une etiquette (« toute culture »...). */
  parEtiquette: boolean;
  listedStackQuantity: number | null;
  availableQuantity: number | null;
  limit: number | null;
  maxNumWanted: number | null;
  shouldLimit: boolean;
  settlement: string | null;
}

export interface MarketStore {
  storeId: string;
  name: string;
  objectType: string | null;
  owners: string[];
  position: MarketPosition | null;
  enabled: boolean;
  isBarter: boolean;
  currency: string | null;
  balance: number | null;
  offers: TradeOffer[];
}

export interface MarketSnapshot {
  schemaVersion: number | null;
  snapshotId: string | null;
  observedAt: string | null;
  stores: MarketStore[];
  collectionWarningCount: number | null;
}

export interface CatalogItem { id: number | null; name: string | null; iconName: string | null }
export interface CatalogTag { id: number | null; name: string | null; key: string | null }
export interface MarketCatalog { items: CatalogItem[]; tags: CatalogTag[] }

/**
 * Sens de l'offre, du point de vue du magasin. EcoMarketApi renvoie
 * « store-sells » / « store-buys » (releve en production) ; on accepte aussi
 * « sell » / « buy ».
 */
function sens(raw: string | null): 'sell' | 'buy' | '' {
  const v = (raw ?? '').toLowerCase();
  if (v.includes('sell')) return 'sell';
  if (v.includes('buy')) return 'buy';
  return '';
}

function toOffer(raw: unknown, index: number): TradeOffer {
  const tagId = asNumber(raw, 'tagId');
  return {
    offerId: asText(raw, 'offerId') ?? `offre-${index}`,
    direction: sens(asText(raw, 'direction')),
    category: asText(raw, 'category'),
    price: asNumber(raw, 'price'),
    itemId: asNumber(raw, 'itemId'),
    itemName: asText(raw, 'itemName'),
    itemType: asText(raw, 'itemType'),
    tagId,
    tagName: asText(raw, 'tagName'),
    parEtiquette: tagId !== null,
    listedStackQuantity: asNumber(raw, 'listedStackQuantity'),
    // Le mod ne publie pas « availableQuantity » : la quantite affichee par le
    // magasin est « listedStackQuantity » (stock a vendre, ou quantite voulue a l'achat).
    availableQuantity: asNumber(raw, 'availableQuantity') ?? asNumber(raw, 'listedStackQuantity'),
    limit: asNumber(raw, 'limit'),
    maxNumWanted: asNumber(raw, 'maxNumWanted'),
    shouldLimit: asBool(raw, 'shouldLimit'),
    settlement: asText(raw, 'settlement'),
  };
}

function toPosition(raw: unknown): MarketPosition | null {
  const source = pick(raw, 'position');
  if (!source || typeof source !== 'object') return null;
  const x = asNumber(source, 'x');
  const z = asNumber(source, 'z');
  if (x === null && z === null) return null;
  return { x: x ?? 0, y: asNumber(source, 'y') ?? 0, z: z ?? 0 };
}

function toStore(raw: unknown, index: number): MarketStore {
  return {
    storeId: asText(raw, 'storeId') ?? `magasin-${index}`,
    name: asText(raw, 'name') ?? 'Magasin',
    objectType: asText(raw, 'objectType'),
    owners: asList(pick(raw, 'owners')).map((o) => (typeof o === 'string' ? o : String(o))),
    position: toPosition(raw),
    enabled: asBool(raw, 'enabled', true),
    isBarter: asBool(raw, 'isBarter'),
    currency: asText(raw, 'currency'),
    balance: asNumber(raw, 'balance'),
    offers: asList(pick(raw, 'offers')).map(toOffer),
  };
}

export const market = {
  async snapshot(): Promise<MarketSnapshot> {
    const [raw, noms] = await Promise.all([
      apiGet<unknown>('/api/v1/ecomarket/snapshot'),
      nomsTraduits().catch(() => null),
    ]);
    const releve: MarketSnapshot = {
      schemaVersion: asNumber(raw, 'schemaVersion'),
      snapshotId: asText(raw, 'snapshotId'),
      observedAt: asText(raw, 'observedAt'),
      stores: asList(pick(raw, 'stores')).map(toStore),
      collectionWarningCount: asNumber(raw, 'collectionWarningCount'),
    };
    if (noms) traduire(releve, noms);
    return releve;
  },

  async catalog(): Promise<MarketCatalog> {
    const raw = await apiGet<unknown>('/api/v1/ecomarket/catalog');
    return {
      items: asList(pick(raw, 'items')).map((i) => ({
        id: asNumber(i, 'id'),
        name: asText(i, 'name'),
        iconName: asText(i, 'iconName'),
      })),
      tags: asList(pick(raw, 'tags')).map((t) => ({
        id: asNumber(t, 'id'),
        name: asText(t, 'name'),
        key: asText(t, 'key'),
      })),
    };
  },

  /** Session et droits du porteur du jeton ; échoue si non connecté. */
  me: () => apiGet<unknown>('/api/v1/ecomarket/me'),
};

/**
 * Les offres ne portent que le nom technique (« ClayItem ») ; le catalogue du mod
 * donne le nom francais (« Argile ») par identifiant. Charge une seule fois.
 */
interface Noms { objets: Map<number, string>; etiquettes: Map<number, string> }
let nomsEnCache: Promise<Noms> | null = null;

function nomsTraduits(): Promise<Noms> {
  if (!nomsEnCache) {
    nomsEnCache = market.catalog().then((c) => ({
      objets: new Map(c.items.filter((i) => i.id !== null && i.name).map((i) => [i.id as number, i.name as string])),
      etiquettes: new Map(c.tags.filter((t) => t.id !== null && t.name).map((t) => [t.id as number, t.name as string])),
    }));
    // Un echec ne doit pas rester en cache : on retentera au prochain releve.
    nomsEnCache.catch(() => { nomsEnCache = null; });
  }
  return nomsEnCache;
}

function traduire(releve: MarketSnapshot, noms: Noms): void {
  for (const store of releve.stores) {
    for (const o of store.offers) {
      if (o.itemId !== null && noms.objets.has(o.itemId)) o.itemName = noms.objets.get(o.itemId) ?? o.itemName;
      if (o.tagId !== null && noms.etiquettes.has(o.tagId)) o.tagName = noms.etiquettes.get(o.tagId) ?? o.tagName;
    }
  }
}

/** Une offre remise à plat, avec son magasin, pour les tableaux et le tri. */
export interface FlatOffer extends TradeOffer {
  storeId: string;
  storeName: string;
  ownersLabel: string;
  currency: string;
  isBarter: boolean;
  storeEnabled: boolean;
  label: string;
}

export function flatten(snapshot: MarketSnapshot): FlatOffer[] {
  const out: FlatOffer[] = [];
  for (const store of snapshot.stores) {
    for (const offer of store.offers) {
      out.push({
        ...offer,
        storeId: store.storeId,
        storeName: store.name,
        ownersLabel: store.owners.join(', '),
        currency: store.currency ?? '',
        isBarter: store.isBarter,
        storeEnabled: store.enabled,
        label: offer.itemName ?? offer.tagName ?? offer.itemType ?? '(inconnu)',
      });
    }
  }
  return out;
}
