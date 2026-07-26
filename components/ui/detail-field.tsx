import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function DetailField({
  label,
  children,
  className,
  labelClassName,
  contentClassName,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
  labelClassName?: string;
  contentClassName?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-1 sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-8",
        className,
      )}
    >
      <div
        className={cn(
          "self-start text-sm font-medium text-slate-500 sm:flex sm:min-h-8 sm:items-center",
          labelClassName,
        )}
      >
        {label}
      </div>
      <div className={cn("min-w-0 flex-1", contentClassName)}>{children}</div>
    </div>
  );
}

export { DetailField };
