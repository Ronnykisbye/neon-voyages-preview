// ============================================================================
// AFSNIT 01 – Typer
// ============================================================================
export type TripLocation = {
  name?: string;
  lat?: number;
  lon?: number;
  countryCode?: string;
  country_code?: string; // legacy
};

export type Trip = {
  destination?: string;
  location?: TripLocation;
  countryCode?: string; // legacy
  [key: string]: any;
};

// ============================================================================
// AFSNIT 02 – Storage keys
// ============================================================================
const KEY_TRIP = "nv_trip";

// ============================================================================
// AFSNIT 03 – Read / Write
// ============================================================================
export function readTrip(): Trip | null {
  try {
    const raw = localStorage.getItem(KEY_TRIP);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Trip) : null;
  } catch {
    return null;
  }
}

export function writeTrip(trip: Trip | null): void {
  try {
    if (!trip) {
      localStorage.removeItem(KEY_TRIP);
      return;
    }
    localStorage.setItem(KEY_TRIP, JSON.stringify(trip));
  } catch {
    // no-op (fx private mode)
  }
}
