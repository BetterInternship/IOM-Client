import type { ComponentProps, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusNoticeVariant = "primary" | "warning" | "destructive";

const variantClasses: Record<
  StatusNoticeVariant,
  { container: string; icon: string }
> = {
  primary: {
    container:
      "border-primary/25 bg-primary/[0.035] transition-colors hover:bg-primary/[0.06]",
    icon: "bg-primary/5 text-primary",
  },
  warning: {
    container:
      "border-warning/30 bg-warning/10 transition-colors hover:bg-warning/15",
    icon: "bg-warning/10 text-warning",
  },
  destructive: {
    container:
      "border-destructive/30 bg-destructive/5 transition-colors hover:bg-destructive/10",
    icon: "bg-destructive/10 text-destructive",
  },
};

function StatusNotice({
  icon: Icon,
  media,
  title,
  description,
  action,
  actionClassName,
  variant = "primary",
  compact = false,
  className,
  ...props
}: ComponentProps<"div"> & {
  icon?: LucideIcon;
  media?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  actionClassName?: string;
  variant?: StatusNoticeVariant;
  compact?: boolean;
}) {
  const styles = variantClasses[variant];

  return (
    <div
      data-slot="status-notice"
      className={cn(
        "group/status-notice flex rounded-[0.33em] border",
        compact ? "items-start gap-2 p-3" : "items-stretch gap-3 px-5 py-4",
        styles.container,
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex min-w-0 flex-1",
          compact ? "items-start gap-2" : "items-stretch gap-3",
        )}
      >
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[0.33em]",
            compact ? "size-8" : "size-10 self-center",
            styles.icon,
          )}
        >
          {media ??
            (Icon && (
              <Icon
                className={compact ? "size-4" : "size-5"}
                aria-hidden="true"
              />
            ))}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          {description && (
            <div className="text-muted-foreground text-sm">{description}</div>
          )}
        </div>
      </div>
      {action && (
        <div className={cn("shrink-0 self-center", actionClassName)}>
          {action}
        </div>
      )}
    </div>
  );
}

export { StatusNotice, type StatusNoticeVariant };
