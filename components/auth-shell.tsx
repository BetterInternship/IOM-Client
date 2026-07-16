import * as React from "react";
import Image from "next/image";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthShellProps {
  portal?: string;
  title: string;
  description?: React.ReactNode;
  headerBefore?: React.ReactNode;
  progress?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  variant?: "card" | "split";
  splitFlush?: boolean;
}

/**
 * Centered, branded shell for the unauthenticated auth pages
 * (login / register / forgot / reset) across all three portals.
 */
export function AuthShell({
  portal,
  title,
  description,
  headerBefore,
  progress,
  children,
  footer,
  className,
  variant = "card",
  splitFlush = false,
}: AuthShellProps) {
  if (variant === "split") {
    return (
      <div
        className={cn(
          "bg-background min-h-screen w-full",
          splitFlush ? "p-0" : "p-3",
        )}
      >
        <div
          className={cn(
            "grid w-full grid-cols-1 lg:grid-cols-5",
            splitFlush
              ? "min-h-screen gap-0"
              : "min-h-[calc(100vh-1.5rem)] gap-6",
          )}
        >
          <div
            className={cn(
              "relative hidden overflow-hidden border-blue-100 bg-blue-50 lg:col-span-3 lg:block",
              !splitFlush && "rounded-[0.33em] border",
            )}
          >
            <div
              className="absolute inset-0 bg-cover bg-center opacity-90"
              style={{ backgroundImage: "url('/bg2.png')" }}
            />
            <div className="relative flex h-full flex-col justify-between p-8 xl:p-12">
              <div className="flex items-center gap-2">
                <Image
                  src="/betterinternship-logo.png"
                  alt="BetterInternship"
                  width={28}
                  height={28}
                />
                <span className="font-display text-lg font-bold text-gray-900">
                  Partners
                </span>
              </div>

              <div className="mx-auto w-full max-w-xl">
                <div className="rotate-[-1.5deg] rounded-[0.33em] border border-blue-200/80 bg-white/90 p-7 shadow-xl shadow-blue-200/40 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-5 border-b border-gray-200 pb-5">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.18em] text-primary uppercase">
                        Memorandum of Agreement
                      </p>
                      <p className="mt-2 text-xl font-semibold text-gray-900">
                        One partnership. One clear agreement.
                      </p>
                    </div>
                    <CheckCircle2 className="text-supportive h-7 w-7 shrink-0" />
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="h-2.5 w-full rounded-full bg-gray-100" />
                    <div className="h-2.5 w-[88%] rounded-full bg-gray-100" />
                    <div className="h-2.5 w-[72%] rounded-full bg-gray-100" />
                  </div>
                  <div className="mt-10 grid grid-cols-2 gap-8">
                    <div className="border-t border-gray-300 pt-2 text-xs text-gray-500">
                      University representative
                    </div>
                    <div className="border-t border-gray-300 pt-2 text-xs text-gray-500">
                      Company representative
                    </div>
                  </div>
                </div>
              </div>

              <div className="max-w-xl">
                <h2 className="text-3xl leading-tight font-semibold tracking-tight text-gray-800 xl:text-4xl">
                  Better partnerships start with simpler paperwork.
                </h2>
                <p className="mt-3 max-w-lg text-sm leading-6 text-gray-600">
                  Create, sign, and manage institutional MOAs in one secure
                  place.
                </p>
              </div>
            </div>
          </div>

          <div
            className={cn(
              "flex w-full items-center border-gray-300 px-5 py-10 lg:col-span-2 lg:border-l lg:px-8 xl:px-12",
              splitFlush
                ? "min-h-screen bg-white"
                : "bg-muted/70 min-h-[calc(100vh-1.5rem)]",
            )}
          >
            <div className="mx-auto w-full max-w-md">
              <div className="mb-8 flex items-center gap-2">
                <Image
                  src="/betterinternship-logo.png"
                  alt="BetterInternship"
                  width={26}
                  height={26}
                />
                <span className="font-display font-bold text-gray-900">
                  Partners
                </span>
                {portal && (
                  <>
                    <span className="mx-1 text-gray-300" aria-hidden="true">
                      |
                    </span>
                    <span className="font-display text-sm font-medium text-gray-500">
                      {portal}
                    </span>
                  </>
                )}
              </div>

              <div className="mb-7 space-y-2">
                {headerBefore}
                <div className="flex items-center justify-between gap-4">
                  <h1 className="text-3xl font-bold tracking-tight text-gray-700">
                    {title}
                  </h1>
                  {progress}
                </div>
                {description && (
                  <p className="text-muted-foreground text-sm leading-6">
                    {description}
                  </p>
                )}
              </div>

              <div className={className}>{children}</div>
              {footer && (
                <div className="text-muted-foreground mt-6 text-sm">
                  {footer}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted/40 flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {portal && (
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <span className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {portal === "Platform Admin" ? `${portal} · ` : ""}Institutional
              MOA Platform
            </span>
          </div>
        )}

        <div
          className={cn(
            "rounded-[0.33em] border border-gray-300 bg-white p-6 shadow-sm sm:p-8",
            className,
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
