// =====================================================
// AFSNIT 01 – Imports
// =====================================================
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { readTrip, writeTrip } from "@/services/tripStore";

// =====================================================
// AFSNIT 02 – Types
// =====================================================
export type TripLocation = {
  id?: string;
  name?: string;
  displayName?: string;

  lat: number;
  lon: number;

  country?: string;
  countryCode?: string;
  type?: string;

  // Tillad ekstra felter uden at alt går i stykker (fx fra geocoding)
  [key: string]: any;
};

export type TripState = {
  destination?: string;

  location?: TripLocation;

  startDate?: Date;
  endDate?: Date;

  days?: number;

  countryName?: string;
  countryCode?: string;

  [key: string]: any;
};

type TripPatch = Partial<TripState>;

type TripContextValue = {
  trip: TripState;

  // VIGTIGT: merge/patch (så dato/GPS ikke overskriver hinanden)
  setTrip: (patch: TripPatch) => void;

  // Bruges i UI/guards
  hasLocation: boolean;
  isValid: boolean;
};

// =====================================================
// AFSNIT 03 – Context
// =====================================================
const TripContext = createContext<TripContextValue | null>(null);

// =====================================================
// AFSNIT 04 – Helpers (revive Dates)
// =====================================================
function reviveTrip(raw: any): TripState {
  if (!raw || typeof raw !== "object") return {};

  const t: TripState = { ...raw };

  // JSON gør Date til string → genskab Date
  if (typeof t.startDate === "string") t.startDate = new Date(t.startDate);
  if (typeof t.endDate === "string") t.endDate = new Date(t.endDate);

  // Hvis timestamps
  if (typeof t.startDate === "number") t.startDate = new Date(t.startDate);
  if (typeof t.endDate === "number") t.endDate = new Date(t.endDate);

  // Hvis nogen har gemt null, så ryd til undefined (DateRangePicker har det bedre sådan)
  if (t.startDate === null) delete (t as any).startDate;
  if (t.endDate === null) delete (t as any).endDate;

  return t;
}

// =====================================================
// AFSNIT 05 – Provider
// =====================================================
export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trip, setTripState] = useState<TripState>(() => reviveTrip(readTrip?.()));

  // MERGE/PATCH setter
  const setTrip = (patch: TripPatch) => {
    setTripState((prev) => ({ ...prev, ...patch }));
  };

  // Persist (localStorage)
  useEffect(() => {
    try {
      writeTrip?.(trip);
    } catch {
      // no-op
    }
  }, [trip]);

  const value = useMemo<TripContextValue>(() => {
    const lat = trip?.location?.lat;
    const lon = trip?.location?.lon;

    const hasLocation = typeof lat === "number" && typeof lon === "number";
    const hasDates = trip?.startDate instanceof Date && trip?.endDate instanceof Date;
    const hasDestination = !!trip?.destination && trip.destination.trim().length > 0;

    // “Klar til at fortsætte”
    const isValid = hasDestination && hasLocation && hasDates;

    return { trip, setTrip, hasLocation, isValid };
  }, [trip]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

// =====================================================
// AFSNIT 06 – Hook
// =====================================================
export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip skal bruges inde i <TripProvider>");
  return ctx;
}
