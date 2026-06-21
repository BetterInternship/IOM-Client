import * as React from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  portal?: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

/**
 * Centered, branded shell for the unauthenticated auth pages
 * (login / register / forgot / reset) across all three portals.
 */
export function AuthShell({
  portal,
  title,
  description,
  children,
  footer,
  className,
}: AuthShellProps) {
  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/betterinternship-logo.png"
            alt="BetterInternship"
            className="h-8 w-auto"
          />
          {portal && (
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {portal} &middot; IOM Portal
            </span>
          )}
        </div>

        <div
          className={cn(
            "rounded-[0.33em] border border-gray-300 bg-white p-6 shadow-sm sm:p-8",
            className
          )}
        >
          <div className="mb-6 space-y-1.5">
            <h1 className="text-xl font-semibold tracking-tight text-gray-900">
              {title}
            </h1>
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          {children}
        </div>

        {footer && (
          <div className="text-muted-foreground mt-5 text-center text-sm">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function FormError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="alert"
      className="text-destructive border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-[0.33em] border px-3 py-2 text-sm"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export function FormSuccess({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <div
      role="status"
      className="text-supportive border-supportive/30 bg-supportive/5 flex items-start gap-2 rounded-[0.33em] border px-3 py-2 text-sm"
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
