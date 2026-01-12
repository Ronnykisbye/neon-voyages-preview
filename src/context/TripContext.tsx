// ============================================================================
// AFSNIT 01 – Compatibility re-export
// Formål: Sikre at imports fra "@/context/TripContext" bruger samme context
// som "@/contexts/TripContext" (kun ÉN TripContext i hele appen)
// ============================================================================
export * from "@/contexts/TripContext";
export { default } from "@/contexts/TripContext";
