// =====================================================
// AFSNIT 01 – Imports
// =====================================================
import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { readTrip, writeTrip } from "@/services/tripStore";

// =====================================================
// AFSNIT 02 – Types
// =====================================================
export type TripLocation = {
  label?: string;        // fx "Paris, France"
  lat: number;
  lon: number;
  countryCode?: string;  // fx "FR"
};

export type TripState = {
  location?: TripLocation | null;
};

// =====================================================
// AFSNIT 03 – Context shape
// =====================================================
type TripContextValue = {
  trip: TripState;
  setTrip: React.Dispatch<React.SetStateAction<TripState>>;
  hasLocation: boolean;
};

const TripContext = createContext<TripContextValue | null>(null);

// =====================================================
// AFSNIT 04 – Provider
// =====================================================
export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trip, setTrip] = useState<TripState>(() => {
    // readTrip kan returnere null/undefined – vi normaliserer
    const stored = readTrip?.();
    return stored && typeof stored === "object" ? stored : {};
  });

  // Persist
  useEffect(() => {
    try {
      writeTrip?.(trip);
    } catch {
      // ingen crash hvis storage fejler
    }
  }, [trip]);

  const value = useMemo<TripContextValue>(() => {
    const hasLocation = !!trip?.location && typeof trip.location.lat === "number" && typeof trip.location.lon === "number";
    return { trip, setTrip, hasLocation };
  }, [trip]);

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}

// =====================================================
// AFSNIT 05 – Hook
// =====================================================
export function useTrip() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error("useTrip skal bruges inde i <TripProvider>");
  return ctx;
}
