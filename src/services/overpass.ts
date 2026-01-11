// ============================================================
// AFSNIT 01 – Imports & typer
// ============================================================

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  elements: OverpassElement[];
};

export type Place = {
  id: string;
  name: string;
  kind: string; // fx "Museum", "Minde", "Hospital"
  shortDescription: string; // den tekst du viser i kortet
  addressLine?: string;
  openingHours?: string;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
  source?: "OpenStreetMap";
};

// ============================================================
// AFSNIT 02 – Konstanter
// ============================================================

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";

// Default timeout til Overpass. Hvis du får timeouts i travle perioder, kan du sætte den højere.
const OVERPASS_TIMEOUT_SECONDS = 25;

// ============================================================
// AFSNIT 03 – Små helpers (tag-læsning / tekst)
// ============================================================

function tag(el: OverpassElement, key: string): string | undefined {
  return el.tags?.[key];
}

function pickLatLon(el: OverpassElement): { lat: number; lon: number } | null {
  if (typeof el.lat === "number" && typeof el.lon === "number") return { lat: el.lat, lon: el.lon };
  if (el.center && typeof el.center.lat === "number" && typeof el.center.lon === "number") {
    return { lat: el.center.lat, lon: el.center.lon };
  }
  return null;
}

function safeName(el: OverpassElement): string {
  return tag(el, "name") || tag(el, "name:en") || "Ukendt sted";
}

function toKindFromTags(tags: Record<string, string> | undefined): string {
  if (!tags) return "Sted";

  // Høj prioritet
  if (tags.tourism === "museum") return "Museum";
  if (tags.tourism === "attraction") return "Attraktion";
  if (tags.tourism === "gallery") return "Galleri";
  if (tags.tourism === "viewpoint") return "Udsigt";
  if (tags.amenity === "hospital") return "Hospital";
  if (tags.amenity === "clinic") return "Klinik";
  if (tags.amenity === "police") return "Politi";
  if (tags.amenity === "pharmacy") return "Apotek";
  if (tags.amenity === "embassy") return "Ambassade";
  if (tags.historic) return "Historisk sted";
  if (tags.man_made === "tower") return "Tårn";
  if (tags.natural) return "Natur";
  if (tags.leisure) return "Oplevelse";
  if (tags.shop) return "Butik";

  return "Sted";
}

/**
 * Lav en mere informativ kort-tekst end "Historisk sted med lokal betydning."
 * Vi kigger på OSM tags og gætter en kort beskrivelse i human-venlig stil.
 */
export function buildShortDescriptionFromTags(tags?: Record<string, string>): string {
  if (!tags) return "Et sted i området.";

  // Hjælp-side: sundhed / politi
  if (tags.amenity === "hospital") return "Hospital – akut hjælp og behandling.";
  if (tags.amenity === "clinic") return "Klinik – lægehjælp og konsultationer.";
  if (tags.amenity === "police") return "Politistation – hjælp og anmeldelser.";
  if (tags.amenity === "pharmacy") return "Apotek – medicin og rådgivning.";

  // Turist / kultur
  if (tags.tourism === "museum") return "Museum – udstillinger, samlinger og historie.";
  if (tags.tourism === "gallery") return "Kunstgalleri – lokale og internationale værker.";
  if (tags.tourism === "attraction") return "Turistattraktion – populært besøgsmål.";
  if (tags.tourism === "viewpoint") return "Udsigtspunkt – flot view og fotos.";
  if (tags.historic) {
    // Nogle typiske historic-værdier
    const h = tags.historic;
    if (h === "castle") return "Historisk slot – arkitektur og historie.";
    if (h === "memorial") return "Mindesmærke – lokal historie og betydning.";
    if (h === "monument") return "Monument – kendt vartegn i området.";
    if (h === "ruins") return "Ruiner – spor fra fortiden.";
    if (h === "church") return "Historisk kirke – kultur og arkitektur.";
    return "Historisk sted – noget særligt at se.";
  }

  // Natur / udsigt
  if (tags.natural === "peak") return "Udsigtspunkt – højeste punkt i området.";
  if (tags.natural === "beach") return "Strand – badning og afslapning.";
  if (tags.natural) return "Naturoplevelse – ro og udsigt.";

  // Default fallback
  const kind = toKindFromTags(tags);
  return `${kind} – et interessant sted i området.`;
}

function buildAddressLine(tags?: Record<string, string>): string | undefined {
  if (!tags) return undefined;

  // Brug addr:* hvis tilgængeligt
  const street = tags["addr:street"];
  const housenumber = tags["addr:housenumber"];
  const city = tags["addr:city"];
  const postcode = tags["addr:postcode"];

  const line1 = [street, housenumber].filter(Boolean).join(" ").trim();
  const line2 = [postcode, city].filter(Boolean).join(" ").trim();

  const joined = [line1, line2].filter(Boolean).join(", ").trim();
  return joined || undefined;
}

// ============================================================
// AFSNIT 04 – Overpass query builder
// ============================================================

/**
 * Bygger en Overpass QL query der finder relevante steder indenfor radius.
 * - centerLat/Lon: søgecenter
 * - radiusMeters: fx 6000
 * - filters: en liste af tag-filters som Overpass kan bruge
 */
function buildAroundQuery(
  centerLat: number,
  centerLon: number,
  radiusMeters: number,
  filters: string[]
): string {
  const around = `(around:${radiusMeters},${centerLat},${centerLon})`;
  const body = filters
    .map((f) => `nwr${f}${around};`)
    .join("\n");

  // out center: giver center for way/relation
  return `
[out:json][timeout:${OVERPASS_TIMEOUT_SECONDS}];
(
${body}
);
out center tags;
`;
}

// ============================================================
// AFSNIT 05 – Fetch: lav request til Overpass
// ============================================================

async function postOverpass(query: string): Promise<OverpassResponse> {
  const res = await fetch(OVERPASS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Overpass fejl (${res.status}): ${txt || res.statusText}`);
  }

  const json = (await res.json()) as OverpassResponse;
  return json;
}

// ============================================================
// AFSNIT 06 – Public API: queryOverpass (den du importer)
// ============================================================

export type QueryOverpassParams = {
  centerLat: number;
  centerLon: number;
  radiusKm: number;
  // fx "tourist_spots" | "hidden_gems" | "food" | "markets" | "help_hospitals" | ...
  // du kan selv sende en streng fra dine sider
  category: string;
};

/**
 * Hovedfunktion: brug fra dine pages.
 * Importeres som:
 *   import { queryOverpass } from "@/services/overpass";
 */
export async function queryOverpass(params: QueryOverpassParams): Promise<Place[]> {
  const radiusMeters = Math.max(500, Math.round(params.radiusKm * 1000));

  // Vælg filters pr kategori (du kan udvide senere)
  const filters = getFiltersForCategory(params.category);

  const q = buildAroundQuery(params.centerLat, params.centerLon, radiusMeters, filters);
  const data = await postOverpass(q);

  // Map til Place[]
  const places: Place[] = [];
  for (const el of data.elements || []) {
    const ll = pickLatLon(el);
    if (!ll) continue;

    const tags = el.tags || {};
    const name = safeName(el);

    const kind = toKindFromTags(tags);
    const shortDescription = buildShortDescriptionFromTags(tags);
    const addressLine = buildAddressLine(tags);
    const openingHours = tags["opening_hours"];

    places.push({
      id: `${el.type}/${el.id}`,
      name,
      kind,
      shortDescription,
      addressLine,
      openingHours,
      lat: ll.lat,
      lon: ll.lon,
      tags,
      source: "OpenStreetMap",
    });
  }

  // Sorter så stabile resultater: navn først
  places.sort((a, b) => a.name.localeCompare(b.name));

  return places;
}

// ============================================================
// AFSNIT 07 – Kategori-filters
// ============================================================

function getFiltersForCategory(category: string): string[] {
  // NB: Overpass filter-syntaksen her er fx: ["[tourism=museum]", "[historic]"]
  // nwr = node/way/relation

  switch (category) {
    // --------------------------------------------------------
    // Turist / seværdigheder
    // --------------------------------------------------------
    case "touristSpots":
    case "tourist_spots":
      return [
        "[tourism=museum]",
        "[tourism=attraction]",
        "[tourism=gallery]",
        "[tourism=viewpoint]",
        "[historic]",
        "[man_made=tower]",
      ];

    // --------------------------------------------------------
    // Skjulte perler (lidt bredere)
    // --------------------------------------------------------
    case "hiddenGems":
    case "hidden_gems":
      return [
        "[tourism=viewpoint]",
        "[historic]",
        "[leisure]",
        "[natural]",
        "[man_made=tower]",
      ];

    // --------------------------------------------------------
    // Mad / spisesteder
    // --------------------------------------------------------
    case "food":
      return [
        "[amenity=restaurant]",
        "[amenity=cafe]",
        "[amenity=fast_food]",
        "[amenity=bar]",
      ];

    // --------------------------------------------------------
    // Markeder
    // --------------------------------------------------------
    case "markets":
      return [
        "[amenity=marketplace]",
        "[shop=supermarket]",
        "[shop=convenience]",
      ];

    // --------------------------------------------------------
    // Hjælp (hospital/klinik/politi/apotek)
    // --------------------------------------------------------
    case "help":
    case "help_hospitals":
      return [
        "[amenity=hospital]",
        "[amenity=clinic]",
        "[amenity=police]",
        "[amenity=pharmacy]",
      ];

    // --------------------------------------------------------
    // Transport (kan udvides)
    // --------------------------------------------------------
    case "transport":
      return [
        "[public_transport=station]",
        "[railway=station]",
        "[amenity=bus_station]",
      ];

    default:
      // fallback: noget bredt men ikke alt for bredt
      return ["[tourism=attraction]", "[historic]"];
  }
}
