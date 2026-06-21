import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badge_variants = cva(
  [
    "border",
    "border-opacity-70",
    "cursor-default",
    "font-semibold",
    "inline-flex",
    "items-center",
    "px-[0.75em]",
    "py-[0.25em]",
    "rounded-[0.33em]",
    "select-none",
    "text-xs",
    "transition-colors",
    "whitespace-nowrap",
    "bg-transparent",
    "text-gray-700",
  ],
  {
    variants: {
      type: {
        default: ["border-gray-400", "text-gray-600"],
        primary: ["border-primary/80", "text-primary"],
        accent: ["border-accent/80", "text-accent"],
        supportive: ["border-supportive/80", "text-supportive"],
        warning: ["border-warning/80", "text-warning"],
        destructive: ["border-destructive/80", "text-destructive"],
      },
      strength: {
        default: ["opacity-100"],
        medium: ["opacity-80"],
        light: ["opacity-50"],
        invisible: ["opacity-0"],
      },
    },
    defaultVariants: {
      type: "default",
      strength: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badge_variants> {}

export function Badge({ className, type, strength, ...props }: BadgeProps) {
  return <div className={cn(badge_variants({ type, strength }), className)} {...props} />;
}

// ! to import: bool badge
