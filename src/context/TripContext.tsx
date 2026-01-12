// ============================================================================
// AFSNIT 01 – Imports
// ============================================================================
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { readTrip, writeTrip } from "@/services/tripStore";

// ============================================================================
// AFSNIT 02 – Types
// ============================================================================
export type TripLocation = {
  id?: string;
  name?: string;
  displayName?: string;
  lat?: number;
  lon?: number;
  country?: string;
  countryCode?: string;
  type?: string;
  // legacy felter (vi tolererer dem)
  country_code?: string;
};

export type TripState = {
  destination?: string;
  location?: TripLocation | null;

  startDate?: Date;
  endDate?: Date;
  days?: number;

  countryName?: string;
  countryCode?: string;

  // allow ekstra felter uden at det går i stykker
  [key: string]: any;
};

type TripPatch = Partial<TripState>;

type TripContextValue = {
  trip: TripState;
  setTrip: (patch: TripPatch) => void; // IMPORTANT: merge-patch
  hasLocation: boolean;
  isValid: boolean;
};

// ============================================================================
// AFSNIT 03 – Helpers (revive dates fra localStorage)
// ============================================================================
function reviveTrip(raw: any): TripState {
  if (!raw || typeof raw !== "object") return {};

  const t: TripState = { ...raw };

  // JSON gør Date til string -> vi genskaber Date objekter
  if (typeof t.startDate === "string") t.startDate = new Date(t.startDate);
  if (typeof t.endDate === "string") t.endDate = new Date(t.endDate);

  // Hvis nogen har gemt timestamps som number
  if (typeof t.startDate === "number") t.startDate = new Date(t.startDate);
  if (typeof t.endDate === "number") t.endDate = new Date(t.endDate);

  return t;
}

// ============================================================================
// AFSNIT 04 – Context
// ============================================================================
const TripContext = createContext<TripContextValue | null>(null);

// ============================================================================
// AFSNIT 05 – Provider
// ============================================================================
export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trip, setTripState] = useState<TripState>(() => reviveTrip(readTrip()));

  // MERGE-SETTER (det er hele fixet)
  const setTrip = (patch: TripPatch) => {
    setTripState((prev) => ({ ...prev, ...patch }));
  };

  // Persist
  useEffect(() => {
    try {
      writeTrip(trip);
    } catch {
      // no-op
    }
  }, [trip]);

  const value = useMemo<TripContextValue>(() => {
    const lat = trip?.location?.lat;
    const lon = trip?.location?.lon;

    const hasLocation = typeof lat === "number" && typeof lon === "number";
    const isValid = !!trip?.destination && hasLocation;

    return { trip, setTrip, hasLocation, isValid };
  }, [trip]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

// ============================================================================
// AFSNIT 06 – Hook
// ============================================================================
export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip skal bruges inde i <TripProvider>");
  return ctx;
}

