import { AlertCircle, Ban, CheckCircle2, Clock, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

export function PartnershipStatusBadge({
  status,
  label,
}: {
  status: string;
  label?: string;
}) {
  const normalizedStatus = status.toLowerCase();
  const isActive = normalizedStatus === "active";
  const isPending = normalizedStatus === "pending";
  const isBlocked = ["blacklisted", "revoked"].includes(normalizedStatus);
  const isDestructive = ["expired", "rejected"].includes(normalizedStatus);
  const isInactive = ["inactive", "none"].includes(normalizedStatus);
  const Icon = isActive
    ? CheckCircle2
    : isPending
      ? Clock
    : isBlocked
      ? Ban
      : isDestructive
        ? AlertCircle
        : isInactive
          ? Minus
          : null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-semibold whitespace-nowrap",
        isActive && "bg-supportive text-supportive-foreground",
        (isBlocked || isDestructive) &&
          "bg-destructive text-destructive-foreground",
        isInactive && "bg-gray-100 text-gray-600",
        !isActive &&
          !isBlocked &&
          !isDestructive &&
          !isInactive &&
          "bg-primary/10 text-primary",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
      {label ?? status}
    </span>
  );
}
