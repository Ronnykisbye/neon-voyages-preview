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
  // Destination/GPS
  location?: TripLocation | null;

  // Datoer
  startDate?: Date | null;
  endDate?: Date | null;

  // Tillad ekstra felter uden at alt går i stykker
  [key: string]: any;
};

// Patch-type: vi opdaterer kun enkelte felter ad gangen
type TripPatch = Partial<TripState>;

// =====================================================
// AFSNIT 03 – Context shape
// =====================================================
type TripContextValue = {
  trip: TripState;

  // VIGTIGT: merge/patch i stedet for at overskrive hele trip
  setTrip: (patch: TripPatch) => void;

  hasLocation: boolean;
};

const TripContext = createContext<TripContextValue | null>(null);

// =====================================================
// AFSNIT 04 – Helpers (Date revive)
// =====================================================
function reviveTrip(raw: any): TripState {
  if (!raw || typeof raw !== "object") return {};

  const t: TripState = { ...raw };

  // Når vi gemmer i storage, bliver Date typisk til string
  if (typeof t.startDate === "string") t.startDate = new Date(t.startDate);
  if (typeof t.endDate === "string") t.endDate = new Date(t.endDate);

  // Hvis nogen har gemt timestamps
  if (typeof t.startDate === "number") t.startDate = new Date(t.startDate);
  if (typeof t.endDate === "number") t.endDate = new Date(t.endDate);

  return t;
}

// =====================================================
// AFSNIT 05 – Provider
// =====================================================
export function TripProvider({ children }: { children: React.ReactNode }) {
  const [trip, setTripState] = useState<TripState>(() => reviveTrip(readTrip?.()));

  // MERGE/PATCH setter – det er hele fixet for “dato sletter dato”
  const setTrip = (patch: TripPatch) => {
    setTripState((prev) => ({ ...prev, ...patch }));
  };

  // Persist
  useEffect(() => {
    try {
      writeTrip?.(trip);
    } catch {
      // ingen crash hvis storage fejler
    }
  }, [trip]);

  const value = useMemo<TripContextValue>(() => {
    const hasLocation =
      !!trip?.location &&
      typeof trip.location.lat === "number" &&
      typeof trip.location.lon === "number";

    return { trip, setTrip, hasLocation };
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
