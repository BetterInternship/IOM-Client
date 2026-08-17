import * as React from "react";
import { cn } from "@/lib/utils";

/** Consistent page container width for authenticated pages. */
export function PageContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-7xl px-4 py-8 sm:px-6", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  children,
  actionsClassName,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  actionsClassName?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-2xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-sm">{description}</p>
        )}
      </div>
      {children && (
        <div className={cn("flex items-center gap-2", actionsClassName)}>
          {children}
        </div>
      )}
    </div>
  );
}

/** Centered empty/placeholder state inside a dashed card. */
export function EmptyState({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-[0.33em] border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {description && (
        <p className="text-muted-foreground max-w-sm text-sm">{description}</p>
      )}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
