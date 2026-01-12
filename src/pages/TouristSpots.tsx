// ============================================================================
// AFSNIT 01 – Imports
// ============================================================================
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTrip } from "@/contexts/TripContext";
import { queryOverpass } from "@/services/overpass";
import { PlaceCard } from "@/components/PlaceCard";
import { TripGuard } from "@/components/TripGuard";
import SearchControls from "@/components/SearchControls";
import { NeonCard } from "@/components/ui/NeonCard";
import { ErrorState, EmptyState } from "@/components/ui/States";

import { PlaceSkeleton } from "@/components/ui/Skeletons";


import SearchStatusBar from "@/components/SearchStatusBar";
import TripDebug from "@/components/TripDebug";
import { ExternalLink } from "lucide-react";
import type { OverpassElement } from "@/services/overpass";

// ============================================================================
// AFSNIT 02 – Typer + helpers
// ============================================================================
type Scope = "nearby" | "dk" | "country";

const STORAGE_RADIUS = "nv_search_radius_km"; // ny
const LEGACY_RADIUS = "nv_spots_radius_km"; // legacy

const STORAGE_SCOPE = "nv_spots_scope"; // ny
const LEGACY_SCOPE = "nv_search_scope"; // legacy

function readRadiusKm(defaultKm = 6): number {
  const raw =
    localStorage.getItem(STORAGE_RADIUS) ?? localStorage.getItem(LEGACY_RADIUS);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : defaultKm;
}

function writeRadiusKm(km: number) {
  localStorage.setItem(STORAGE_RADIUS, String(km));
  localStorage.setItem(LEGACY_RADIUS, String(km)); // skriv også legacy
}

function readScope(defaultScope: Scope = "nearby"): Scope {
  const raw =
    (localStorage.getItem(STORAGE_SCOPE) ??
      localStorage.getItem(LEGACY_SCOPE) ??
      defaultScope) as Scope;

  if (raw === "nearby" || raw === "dk" || raw === "country") return raw;
  return defaultScope;
}

function writeScope(scope: Scope) {
  localStorage.setItem(STORAGE_SCOPE, scope);
  localStorage.setItem(LEGACY_SCOPE, scope); // skriv også legacy
}

function getTripCountryCode(trip: any): string | null {
  return (
    trip?.location?.countryCode ||
    trip?.location?.country_code ||
    trip?.location?.country_code_iso ||
    trip?.location?.country?.code ||
    null
  );
}

// ============================================================================
// AFSNIT 03 – Overpass query builder
// ============================================================================
function buildTouristQuery(
  lat: number,
  lon: number,
  radiusM: number,
  scope: Scope,
  countryCode?: string | null
) {
  // NOTE:
  // nearby: bare radius rundt om lat/lon
  // dk: radius + landekode DK (admin/country filter)
  // country: radius + landekode for destination
  const useCountryCode =
    scope === "dk" ? "dk" : scope === "country" ? countryCode ?? null : null;

  // simple filter: vi bruger kun country filter hvis vi har en kode
  const countryFilter =
    useCountryCode && useCountryCode.length === 2
      ? `area["ISO3166-1"="${useCountryCode.toUpperCase()}"]->.countryArea;`
      : "";

  const around = `around:${radiusM},${lat},${lon}`;

  // Vi søger på en håndfuld nyttige tags (tourism + historic + museum + viewpoint etc.)
  // og sorterer/limiter senere i UI.
  // Hvis countryArea findes, indsnævrer vi med (area.countryArea)
  const areaPart = countryFilter ? `(area.countryArea)` : "";

  return `
    [out:json][timeout:25];
    ${countryFilter}
    (
      node${areaPart}[tourism](${around});
      way${areaPart}[tourism](${around});
      relation${areaPart}[tourism](${around});

      node${areaPart}[historic](${around});
      way${areaPart}[historic](${around});
      relation${areaPart}[historic](${around});

      node${areaPart}[museum](${around});
      way${areaPart}[museum](${around});
      relation${areaPart}[museum](${around});

      node${areaPart}[viewpoint](${around});
      way${areaPart}[viewpoint](${around});
      relation${areaPart}[viewpoint](${around});
    );
    out center tags;
  `;
}

// ============================================================================
// AFSNIT 04 – Component (content)
// ============================================================================
function TouristSpotsContent() {
  const { trip } = useTrip();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spots, setSpots] = useState<OverpassElement[]>([]);
  const [status, setStatus] = useState<"idle" | "ok" | "empty" | "error">("idle");

  // radius + scope (persistent)
  const [baseRadiusKm, setBaseRadiusKm] = useState<number>(() => readRadiusKm(6));
  const [scope, setScope] = useState<Scope>(() => readScope("country"));

  const hasLocation = !!trip?.location?.lat && !!trip?.location?.lon;

  // radiusM afhænger af scope:
  // nearby = base
  // dk/country = base (vi filtrerer land via Overpass area)
  const radiusM = useMemo(() => Math.round(baseRadiusKm * 1000), [baseRadiusKm]);

  // Auto-fallback: hvis scope=dk men destinationland != DK -> nearby (som du ønskede)
  useEffect(() => {
    const cc = getTripCountryCode(trip);
    if (scope === "dk" && cc && cc.toLowerCase() !== "dk") {
      setScope("nearby");
      writeScope("nearby");
    }
  }, [trip, scope]);

  // persist radius/scope
  useEffect(() => {
    writeRadiusKm(baseRadiusKm);
  }, [baseRadiusKm]);

  useEffect(() => {
    writeScope(scope);
  }, [scope]);

  const fetchSpots = useCallback(
    async (opts?: { forceRefresh?: boolean }) => {
      const forceRefresh = opts?.forceRefresh === true;

      if (!trip?.location?.lat || !trip?.location?.lon) {
        setError("Ingen lokation fundet");
        setStatus("error");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const lat = trip.location.lat;
        const lon = trip.location.lon;

        const countryCode = getTripCountryCode(trip);

        const query = buildTouristQuery(lat, lon, radiusM, scope, countryCode);

        const data = await queryOverpass(query, {
          cacheKey: `tourist-spots-${scope}-${baseRadiusKm}km`,
          forceRefresh,
        });

        const elements = data?.elements ?? [];
        setSpots(elements);

        if (elements.length > 0) {
          setStatus("ok");
        } else {
          setStatus("empty");
        }
      } catch (e: any) {
        setError(e?.message || "Der skete en fejl ved søgning.");
        setStatus("error");
      } finally {
        setLoading(false);
      }
    },
    [trip, radiusM, scope, baseRadiusKm]
  );

  // initial fetch
  useEffect(() => {
    if (hasLocation) {
      fetchSpots();
    }
  }, [hasLocation, fetchSpots]);

  // ========================================================================
  // AFSNIT 05 – UI
  // ========================================================================
  if (!hasLocation) {
    return (
      <div className="min-h-screen flex flex-col px-4 py-2 max-w-lg mx-auto animate-fade-in">
        <main className="flex-1 space-y-4 pb-6">
          <p>Vælg en destination for at finde hjælp.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-2 max-w-lg mx-auto animate-fade-in">
      <main className="flex-1 space-y-6 pb-6">
        {/* ------------------------------------------------------------
           AFSNIT 05A – Intro + Controls
        ------------------------------------------------------------ */}
        <NeonCard>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold leading-tight">Seværdigheder</h1>
              <p className="text-sm text-muted-foreground">
                Populære turistattraktioner
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Søger inden for {baseRadiusKm} km fra centrum.
              </p>

              {/* ✅ Fælles kontrol: radius + scope (country-aware + fallback) */}
              <div className="mt-3">
                <SearchControls
                  showRadius={true}
                  showScope={true}
                  radiusKm={baseRadiusKm}
                  scope={scope}
                  onRadiusChange={(km) => {
                    setBaseRadiusKm(km);
                    setTimeout(() => fetchSpots({ forceRefresh: true }), 0);
                  }}
                  onScopeChange={(next) => {
                    setScope(next);
                    writeScope(next); // skriver også legacy nv_spots_scope
                    setTimeout(() => fetchSpots({ forceRefresh: true }), 0);
                  }}
                />
              </div>
            </div>
          </div>
        </NeonCard>

        {/* ------------------------------------------------------------
           AFSNIT 05B – Status + Søg igen (force refresh)
        ------------------------------------------------------------ */}
        <SearchStatusBar
          status={status}
          onRetry={() => fetchSpots({ forceRefresh: true })}
        />

        {/* ------------------------------------------------------------
           AFSNIT 05C – Loading (skeletons)
        ------------------------------------------------------------ */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <PlaceSkeleton key={i} />
            ))}
          </div>
        )}

        {/* ------------------------------------------------------------
           AFSNIT 05D – Error state
        ------------------------------------------------------------ */}
        {!loading && error && (
          <ErrorState
            message={error}
            onRetry={() => fetchSpots({ forceRefresh: true })}
          />
        )}

        {/* ------------------------------------------------------------
           AFSNIT 05E – Resultater
        ------------------------------------------------------------ */}
        {!loading && !error && spots.length > 0 && (
          <div className="space-y-4">
            {spots.map((spot) => (
              <PlaceCard key={`${spot.type}_${spot.id}`} element={spot} />
            ))}
          </div>
        )}

        {/* ------------------------------------------------------------
           AFSNIT 05F – Empty state
        ------------------------------------------------------------ */}
        {!loading && !error && spots.length === 0 && (
          <EmptyState
            title="Ingen seværdigheder fundet"
            message="Tryk 'Søg igen' eller prøv at øge afstanden."
          />
        )}

        {/* ------------------------------------------------------------
           AFSNIT 05G – Datakilde
        ------------------------------------------------------------ */}
        <NeonCard padding="sm">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Datakilde</span>
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              © OpenStreetMap
            </a>
          </div>
        </NeonCard>
      </main>

      {/* ------------------------------------------------------------
         AFSNIT 05H – Debug (kan senere fjernes i production)
      ------------------------------------------------------------ */}
      <TripDebug />
    </div>
  );
}

// ============================================================================
// AFSNIT 06 – Export wrapper med TripGuard
// ============================================================================
export default function TouristSpots() {
  return (
    <TripGuard>
      <TouristSpotsContent />
    </TripGuard>
  );
}
