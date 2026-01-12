// ============================================================================
// AFSNIT 01 – Imports
// ============================================================================
import React from "react";
import { NeonCard } from "@/components/ui/NeonCard";

// ============================================================================
// AFSNIT 02 – PlaceSkeleton
// Formål: bruges i TouristSpots (loading state)
// ============================================================================
export function PlaceSkeleton() {
  return (
    <NeonCard>
      <div className="animate-pulse space-y-3">
        {/* Titel-linje */}
        <div className="h-4 w-2/3 rounded bg-muted" />

        {/* Undertekst */}
        <div className="h-3 w-1/2 rounded bg-muted" />

        {/* “chips”/tags */}
        <div className="flex gap-2 pt-1">
          <div className="h-6 w-16 rounded bg-muted" />
          <div className="h-6 w-20 rounded bg-muted" />
          <div className="h-6 w-14 rounded bg-muted" />
        </div>

        {/* Kort tekst */}
        <div className="h-3 w-full rounded bg-muted" />
        <div className="h-3 w-5/6 rounded bg-muted" />
      </div>
    </NeonCard>
  );
}
