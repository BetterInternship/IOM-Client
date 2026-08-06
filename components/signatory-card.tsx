"use client";

import type { ReactNode } from "react";

/**
 * Shared card chrome for one signatory/representative in the university
 * profile editor and the company MOA request dialog: white card with a header
 * row (title + optional actions) and an optional completion indicator.
 */
export function SignatoryCard({
  title,
  actions,
  complete = false,
  completeLabel = "This signatory is complete.",
  children,
}: {
  title: string;
  actions?: ReactNode;
  complete?: boolean;
  completeLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-[0.33em] border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {actions}
      </div>
      {children}
      {complete && <p className="text-emerald-600 text-xs">{completeLabel}</p>}
    </div>
  );
}
