"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared chrome for one signatory/representative. Bordered + titled for the
 * university profile editor's list of signatories, where the title is what
 * tells one entry from the next; borderless and title-less by default for a
 * page's single "your details" section, where a card boundary and label are
 * redundant with the surrounding layout.
 */
export function SignatoryCard({
  title,
  actions,
  complete = false,
  completeLabel = "This signatory is complete.",
  bordered = false,
  children,
}: {
  title?: string;
  actions?: ReactNode;
  complete?: boolean;
  completeLabel?: string;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "space-y-3",
        bordered && "rounded-[0.33em] border border-gray-200 bg-white p-4",
      )}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between">
          {title && (
            <p className="text-sm font-semibold text-gray-900">{title}</p>
          )}
          {actions}
        </div>
      )}
      {children}
      {complete && <p className="text-emerald-600 text-xs">{completeLabel}</p>}
    </div>
  );
}
