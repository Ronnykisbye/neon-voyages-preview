// =============================================================
// AFSNIT 01 – Imports
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { ArrowLeft, CloudRain, CloudSun, Cloudy, Sun, Wind } from "lucide-react";

import { readTrip } from "@/services/tripStore";

// =============================================================
// AFSNIT 02 – Types
// =============================================================
type DailyForecast = {
  dateISO: string; // YYYY-MM-DD
  tempMinC?: number;
  tempMaxC?: number;
  windMaxMs?: number;
  precipitationSumMm?: number;
  weatherCode?: number;
};

type WeatherState = {
  isLoading: boolean;
  error?: string;
  days: DailyForecast[];
};

// =============================================================
// AFSNIT 03 – Helpers
// =============================================================
function toISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function clampDays(days: DailyForecast[], maxDays: number) {
  return Array.isArray(days) ? days.slice(0, maxDays) : [];
}

function fmtNumber(n?: number, suffix = "") {
  if (n === undefined || n === null || Number.isNaN(n)) return "—";
  return `${Math.round(n)}${suffix}`;
}

// Open-Meteo weathercode mapping (simplified)
function weatherLabel(code?: number) {
  if (code === undefined || code === null) return "Ukendt vejr";
  if (code === 0) return "Klart vejr";
  if (code === 1 || code === 2) return "Let skyet";
  if (code === 3) return "Skyet";
  if (code >= 45 && code <= 48) return "Tåge";
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return "Regn";
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) return "Sne";
  if (code >= 95) return "Torden";
  return "Skiftende vejr";
}

function weatherIcon(code?: number) {
  if (code === 0) return <Sun className="h-5 w-5" />;
  if (code === 1 || code === 2) return <CloudSun className="h-5 w-5" />;
  if (code === 3) return <Cloudy className="h-5 w-5" />;
  if ((code !== undefined && code >= 51 && code <= 82) || (code !== undefined && code >= 61 && code <= 67))
    return <CloudRain className="h-5 w-5" />;
  return <Cloudy className="h-5 w-5" />;
}

// =============================================================
// AFSNIT 04 – Data fetch (Open-Meteo)
// =============================================================
async function fetchDailyWeather(lat: number, lon: number): Promise<DailyForecast[]> {
  const url =
    "https://api.open-meteo.com/v1/forecast" +
    `?latitude=${encodeURIComponent(lat)}` +
    `&longitude=${encodeURIComponent(lon)}` +
    "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weather_code" +
    "&timezone=auto";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Vejrdata kunne ikke hentes (${res.status})`);

  const json = await res.json();

  const times: string[] = json?.daily?.time ?? [];
  const tmax: number[] = json?.daily?.temperature_2m_max ?? [];
  const tmin: number[] = json?.daily?.temperature_2m_min ?? [];
  const precip: number[] = json?.daily?.precipitation_sum ?? [];
  const wind: number[] = json?.daily?.wind_speed_10m_max ?? [];
  const code: number[] = json?.daily?.weather_code ?? [];

  const out: DailyForecast[] = times.map((dateISO, i) => ({
    dateISO,
    tempMaxC: tmax[i],
    tempMinC: tmin[i],
    precipitationSumMm: precip[i],
    windMaxMs: wind[i],
    weatherCode: code[i],
  }));

  return out;
}

// =============================================================
// AFSNIT 05 – Component
// =============================================================
export default function Weather() {
  const navigate = useNavigate();

  const trip = useMemo(() => readTrip(), []);
  const hasLocation = Boolean(trip?.location?.lat && trip?.location?.lon);

  const [state, setState] = useState<WeatherState>({
    isLoading: true,
    days: [],
  });

  // =============================================================
  // AFSNIT 06 – Effects
  // =============================================================
  useEffect(() => {
    let alive = true;

    async function run() {
      try {
        if (!trip?.location?.lat || !trip?.location?.lon) {
          setState({
            isLoading: false,
            error: "Ingen destination valgt endnu.",
            days: [],
          });
          return;
        }

        setState((s) => ({ ...s, isLoading: true, error: undefined }));

        const days = await fetchDailyWeather(trip.location.lat, trip.location.lon);

        if (!alive) return;
        setState({
          isLoading: false,
          error: undefined,
          days: clampDays(days, 7),
        });
      } catch (e: any) {
        if (!alive) return;
        setState({
          isLoading: false,
          error: e?.message ?? "Der skete en fejl ved hentning af vejrdata.",
          days: [],
        });
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [trip?.location?.lat, trip?.location?.lon]);

  // =============================================================
  // AFSNIT 07 – UI (No location)
  // =============================================================
  if (!hasLocation) {
    return (
      <div className="min-h-screen flex flex-col px-4 py-2 max-w-lg mx-auto animate-fade-in">
        <div className="mb-3">
          <Button
            variant="ghost"
            className="inline-flex items-center gap-2"
            onClick={() => navigate("/menu")}
          >
            <ArrowLeft className="h-4 w-4" /> Tilbage til menu
          </Button>
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-5 space-y-2">
            <div className="text-lg font-semibold">Vejr</div>
            <div className="text-sm text-muted-foreground">
              Vælg en destination først, så kan vi vise vejret.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // =============================================================
  // AFSNIT 08 – UI (Main)
  // =============================================================
  return (
    <div className="min-h-screen flex flex-col px-4 py-2 max-w-lg mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 py-2">
        <Button
          variant="ghost"
          className="inline-flex items-center gap-2"
          onClick={() => navigate("/menu")}
        >
          <ArrowLeft className="h-4 w-4" /> Menu
        </Button>

        <div className="text-center">
          <div className="text-base font-semibold">Vejr</div>
          <div className="text-xs text-muted-foreground">{trip?.destination ?? "Destination"}</div>
        </div>

        <div className="w-[72px]" />
      </div>

      {/* Error */}
      {state.error && (
        <Card className="rounded-2xl border-red-300 bg-red-50">
          <CardContent className="p-4 text-sm">{state.error}</CardContent>
        </Card>
      )}

      {/* Loading */}
      {state.isLoading && (
        <div className="space-y-3 mt-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}

      {/* Days */}
      {!state.isLoading && !state.error && (
        <div className="space-y-3 mt-3">
          {state.days.map((d) => {
            const date = new Date(d.dateISO + "T00:00:00");
            const label = date.toLocaleDateString("da-DK", {
              weekday: "long",
              day: "2-digit",
              month: "short",
            });

            return (
              <Card key={d.dateISO} className="rounded-2xl">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold capitalize">{label}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        {weatherIcon(d.weatherCode)}
                        <span>{weatherLabel(d.weatherCode)}</span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-semibold">
                        {fmtNumber(d.tempMaxC, "°")}{" "}
                        <span className="text-muted-foreground text-sm font-normal">
                          / {fmtNumber(d.tempMinC, "°")}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">max / min</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">Nedbør</div>
                      <div className="mt-1 flex items-center gap-2">
                        <CloudRain className="h-4 w-4" />
                        <div className="font-medium">{fmtNumber(d.precipitationSumMm, " mm")}</div>
                      </div>
                    </div>

                    <div className="rounded-xl border p-3">
                      <div className="text-xs text-muted-foreground">Vind</div>
                      <div className="mt-1 flex items-center gap-2">
                        <Wind className="h-4 w-4" />
                        <div className="font-medium">{fmtNumber(d.windMaxMs, " m/s")}</div>
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Kilde: Open-Meteo (vejret er en prognose – kan ændre sig).
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Footer spacing */}
      <div className="h-6" />
    </div>
  );
}
