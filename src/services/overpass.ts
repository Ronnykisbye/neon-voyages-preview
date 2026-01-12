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
// AFSNIT 02 – Query helper (robust: fallback + retry + timeout)
// =====================================================
type QueryOptions = {
  cacheKey?: string;
  forceRefresh?: boolean;
  signal?: AbortSignal;
};

// Flere endpoints (hvis én er travl/timeout, prøver vi næste)
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.nchc.org.tw/api/interpreter",
] as const;

// Enkel, robust cache (session)
// NOTE: vi kan senere flytte til rigtig cache, men det her er “safe”
const memCache = new Map<string, OverpassResponse>();

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shortText(txt: string, max = 600) {
  const t = (txt ?? "").trim();
  if (!t) return "";
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function isRetryableStatus(status: number) {
  // 429 = rate limit, 5xx = serverfejl/timeout hos Overpass
  return status === 429 || (status >= 500 && status <= 599);
}

export async function queryOverpass(
  query: string,
  opts?: QueryOptions
): Promise<OverpassResponse> {
  const cacheKey = opts?.cacheKey ?? query;

  if (!opts?.forceRefresh && memCache.has(cacheKey)) {
    return memCache.get(cacheKey)!;
  }

  // Respekter evt. abort udefra
  const outerController = new AbortController();
  const outerSignal = opts?.signal ?? outerController.signal;

  // Hvis nogen sender abort ind, så abort alt
  const onAbort = () => outerController.abort();
  if (opts?.signal) opts.signal.addEventListener("abort", onAbort);

  // Retry-strategi (kort og “safe”)
  const MAX_ATTEMPTS_PER_ENDPOINT = 2; // 2 forsøg pr endpoint
  const TIMEOUT_MS = 25000; // 25 sek pr forsøg
  const BASE_BACKOFF_MS = 600; // lille pause før retry

  try {
    let lastError: unknown = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ENDPOINT; attempt++) {
        // Timeout-controller pr forsøg (men koblet til outer abort)
        const attemptController = new AbortController();
        const timeoutId = setTimeout(() => attemptController.abort(), TIMEOUT_MS);

        const abortLink = () => attemptController.abort();
        outerSignal.addEventListener("abort", abortLink);

        try {
          const res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            },
            body: `data=${encodeURIComponent(query)}`,
            signal: attemptController.signal,
          });

          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            const msg = `Overpass fejl: ${res.status} ${res.statusText}${
              txt ? ` – ${shortText(txt)}` : ""
            } (endpoint: ${endpoint}, forsøg: ${attempt}/${MAX_ATTEMPTS_PER_ENDPOINT})`;

            // Kun retry på “typiske” Overpass-problemer
            if (isRetryableStatus(res.status)) {
              lastError = new Error(msg);
              await sleep(BASE_BACKOFF_MS * attempt);
              continue;
            }

            throw new Error(msg);
          }

          const data = (await res.json()) as OverpassResponse;
          memCache.set(cacheKey, data);
          return data;
        } catch (err) {
          // Abort/timeout: prøv igen eller næste endpoint
          const isAbort =
            err instanceof DOMException && err.name === "AbortError";

          if (isAbort) {
            lastError = new Error(
              `Overpass timeout/abort efter ${TIMEOUT_MS}ms (endpoint: ${endpoint}, forsøg: ${attempt}/${MAX_ATTEMPTS_PER_ENDPOINT})`
            );
            await sleep(BASE_BACKOFF_MS * attempt);
            continue;
          }

          lastError = err;

          // Ved “netværk” eller andet ukendt: prøv igen (én gang) og så næste endpoint
          await sleep(BASE_BACKOFF_MS * attempt);
          continue;
        } finally {
          clearTimeout(timeoutId);
          outerSignal.removeEventListener("abort", abortLink);
        }
      }
    }

    // Hvis vi når hertil, fejlede alle endpoints
    throw lastError instanceof Error
      ? lastError
      : new Error("Overpass fejl: alle endpoints fejlede.");
  } finally {
    if (opts?.signal) opts.signal.removeEventListener("abort", onAbort);
  }
}

// =====================================================
// AFSNIT 03 – Cache helpers (bruges af HiddenGems m.fl.)
// =====================================================

/** Giver et stabilt cache-key ud fra en tekststreng */
export function getCacheKey(input: string): string {
  // Holder det simpelt og stabilt: trim + normaliser whitespace
  return input.trim().replace(/\s+/g, " ");
}

/** Henter fra in-memory cache (session) */
export function getFromCache(key: string): OverpassResponse | undefined {
  return memCache.get(key);
}

/** Sætter in-memory cache (session) */
export function setCache(key: string, value: OverpassResponse): void {
  memCache.set(key, value);
}

// =====================================================
// AFSNIT 04 – Tiny helpers (valgfrit, men nyttigt)
// =====================================================
export function elementLatLon(
  el: OverpassElement
): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number")
    return { lat: el.lat, lon: el.lon };
  if (
    el.center &&
    typeof el.center.lat === "number" &&
    typeof el.center.lon === "number"
  ) {
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
