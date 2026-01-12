// =====================================================
// AFSNIT 01 – Types
// =====================================================
export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
};

export type OverpassResponse = {
  version?: number;
  generator?: string;
  osm3s?: any;
  elements: OverpassElement[];
};

// =====================================================
// AFSNIT 02 – Query helper
// =====================================================
type QueryOptions = {
  cacheKey?: string;
  forceRefresh?: boolean;
  signal?: AbortSignal;
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Enkel, robust cache (session)
// NOTE: vi kan senere flytte til rigtig cache, men det her er “safe”
const memCache = new Map<string, OverpassResponse>();

export async function queryOverpass(
  query: string,
  opts?: QueryOptions
): Promise<OverpassResponse> {
  const cacheKey = opts?.cacheKey ?? query;

  if (!opts?.forceRefresh && memCache.has(cacheKey)) {
    return memCache.get(cacheKey)!;
  }

  const controller = new AbortController();
  const signal = opts?.signal ?? controller.signal;

  // Hvis nogen sender abort ind, så abort vores fetch også
  const onAbort = () => controller.abort();
  if (opts?.signal) opts.signal.addEventListener("abort", onAbort);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
      signal,
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Overpass fejl: ${res.status} ${res.statusText}${txt ? ` – ${txt}` : ""}`);
    }

    const data = (await res.json()) as OverpassResponse;
    memCache.set(cacheKey, data);
    return data;
  } finally {
    if (opts?.signal) opts.signal.removeEventListener("abort", onAbort);
  }
}

// =====================================================
// AFSNIT 04 – Tiny helpers (valgfrit, men nyttigt)
// =====================================================
export function elementLatLon(
  el: OverpassElement
): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

// =====================================================
// AFSNIT 05 – Helpers til UI (labels, beskrivelser, koordinater)
// =====================================================

/**
 * getCoordinates
 * Bruges af PlaceCard m.fl.
 * Returnerer bedste bud på lat/lon for et OverpassElement (node/way/relation).
 */
export function getCoordinates(
  el: OverpassElement
): { lat: number; lon: number } | null {
  return elementLatLon(el);
}

/**
 * getCategoryLabel
 * Prøver at udlede en menneskevenlig kategori ud fra OSM-tags.
 * (Holdt enkel og robust – udvides senere hvis vi vil.)
 */
export function getCategoryLabel(el: OverpassElement): string {
  const t = el.tags ?? {};

  // tourism
  if (t.tourism) {
    const v = t.tourism;
    if (v === "museum") return "Museum";
    if (v === "attraction") return "Attraktion";
    if (v === "viewpoint") return "Udsigtspunkt";
    if (v === "information") return "Information";
    if (v === "hotel") return "Hotel";
    if (v === "guest_house") return "Guesthouse";
    if (v === "camp_site") return "Camping";
    return "Turisme";
  }

  // explicit tags
  if (t.museum) return "Museum";
  if (t.viewpoint) return "Udsigtspunkt";

  // historic
  if (t.historic) {
    const v = t.historic;
    if (v === "castle") return "Slot";
    if (v === "monument") return "Monument";
    if (v === "memorial") return "Mindesmærke";
    if (v === "ruins") return "Ruiner";
    return "Historisk sted";
  }

  // religion / place of worship
  if (t.amenity === "place_of_worship" || t.building === "church") return "Kirke";
  if (t.building === "cathedral") return "Katedral";
  if (t.building === "chapel") return "Kapel";

  // leisure / nature
  if (t.leisure === "park") return "Park";
  if (t.natural) return "Natur";
  if (t.waterway) return "Vand";

  // fallback
  return "Sted";
}

/**
 * getCategoryDescription
 * Kort, pæn tekst til UI. Viser navn + type, ellers udvalgte tags.
 */
export function getCategoryDescription(el: OverpassElement): string {
  const t = el.tags ?? {};
  const name = t.name?.trim();
  const label = getCategoryLabel(el);

  // Hvis der er navn, så brug det sammen med label
  if (name) return `${label}: ${name}`;

  // Ellers prøv at give en lille “tag-baseret” forklaring
  const candidates: Array<[string, string | undefined]> = [
    ["tourism", t.tourism],
    ["historic", t.historic],
    ["amenity", t.amenity],
    ["building", t.building],
    ["leisure", t.leisure],
    ["natural", t.natural],
  ];

  const first = candidates.find(([, v]) => !!v);
  if (first) {
    const [k, v] = first;
    return `${label} (${k}: ${v})`;
  }

  return label;
}
