"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface SideTab {
  key: string;
  label: string;
  icon?: LucideIcon;
  badge?: React.ReactNode;
}

/**
 * Left-rail tab navigation (collapses to a horizontal scroller on mobile).
 * Content is controlled by the parent via `active` / `onChange`.
 */
export function SideTabs({
  tabs,
  active,
  onChange,
  children,
}: {
  tabs: SideTab[];
  active: string;
  onChange: (key: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6 md:flex-row md:gap-8">
      <nav className="flex gap-1 overflow-x-auto pb-1 md:w-52 md:flex-col md:gap-0.5 md:overflow-visible md:pb-0 [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onChange(t.key)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex flex-shrink-0 items-center gap-2 rounded-[0.33em] px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              {t.label}
              {t.badge}
            </button>
          );
        })}
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
