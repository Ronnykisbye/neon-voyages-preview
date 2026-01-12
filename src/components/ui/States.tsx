// ============================================================================
// AFSNIT 01 – Imports
// ============================================================================
import React from "react";
import { Button } from "@/components/ui/button";
import { NeonCard } from "@/components/ui/NeonCard";

// ============================================================================
// AFSNIT 02 – Types
// ============================================================================
type EmptyStateProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

type ErrorStateProps = {
  title?: string;
  message: string;
  retryLabel?: string;
  onRetry?: () => void;
};

// ============================================================================
// AFSNIT 03 – EmptyState
// ============================================================================
export function EmptyState({
  title = "Ingen resultater",
  message = "Prøv igen eller justér din søgning.",
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <NeonCard>
      <div className="space-y-2">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        {message && <p className="text-sm text-muted-foreground">{message}</p>}

        {actionLabel && onAction && (
          <div className="pt-2">
            <Button type="button" onClick={onAction}>
              {actionLabel}
            </Button>
          </div>
        )}
      </div>
    </NeonCard>
  );
}

// ============================================================================
// AFSNIT 04 – ErrorState
// ============================================================================
export function ErrorState({
  title = "Der opstod en fejl",
  message,
  retryLabel = "Søg igen",
  onRetry,
}: ErrorStateProps) {
  return (
    <NeonCard>
      <div className="space-y-2">
        <h2 className="text-base font-semibold leading-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{message}</p>

        {onRetry && (
          <div className="pt-2">
            <Button type="button" onClick={onRetry}>
              {retryLabel}
            </Button>
          </div>
        )}
      </div>
    </NeonCard>
  );
}
