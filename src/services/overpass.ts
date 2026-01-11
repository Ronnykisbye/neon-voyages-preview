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
// AFSNIT 02 – Helper: build endpoint
// =====================================================
const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// =====================================================
// AFSNIT 03 – queryOverpass (bruges af pages)
// =====================================================
export async function queryOverpass(
  query: string,
  opts?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<OverpassResponse> {
  const timeoutMs = opts?.timeoutMs ?? 25000;

  // Abort + timeout sammen
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  if (opts?.signal) opts.signal.addEventListener("abort", onAbort, { once: true });

  const t = setTimeout(() => ac.abort(), timeoutMs);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
      signal: ac.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Overpass fejl (${res.status}): ${text?.slice(0, 200)}`);
    }

    const json = (await res.json()) as OverpassResponse;
    if (!json?.elements) return { elements: [] };
    return json;
  } finally {
    clearTimeout(t);
    if (opts?.signal) opts.signal.removeEventListener("abort", onAbort);
  }
}

// =====================================================
// AFSNIT 04 – Tiny helpers (valgfrit, men nyttigt)
// =====================================================
export function elementLatLon(el: OverpassElement): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}
