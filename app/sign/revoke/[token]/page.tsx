"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  useSignControllerResolveRevoke,
  useSignControllerRevoke,
} from "@/app/api";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Loader2, PowerOff } from "lucide-react";

function RevokePageShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10 sm:px-8">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white px-5 py-8 sm:px-8">
        {children}
      </div>
    </main>
  );
}

function CenteredIcon({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "supportive" | "warning";
}) {
  return (
    <span
      className={
        tone === "supportive"
          ? "bg-supportive/10 text-supportive mx-auto flex size-16 items-center justify-center rounded-full"
          : "bg-warning/10 text-warning mx-auto flex size-16 items-center justify-center rounded-full"
      }
    >
      {children}
    </span>
  );
}

/**
 * Granular auto-sign revoke page (Docs/plans/
 * AUTO_SIGN_CTA_IMPLEMENTATION_PLAN.md §5.6/D12) — resolves the token
 * without consuming it, then applies whatever state the switches are in on
 * Save, consuming the token then. Owner tokens get a switch per capability;
 * delegate tokens get one switch that can only be turned off.
 */
export default function SignRevokeTokenPage() {
  const { token } = useParams<{ token: string }>();
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [proactive, setProactive] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [delegateOn, setDelegateOn] = useState(true);

  const resolved = useSignControllerResolveRevoke(token, {
    query: { enabled: !!token, retry: false },
  });

  useEffect(() => {
    if (!resolved.data || initialized) return;
    if (resolved.data.kind === "owner") {
      setProactive(!!resolved.data.proactive);
      setAutoRenew(!!resolved.data.autoRenew);
    } else {
      setDelegateOn(!!resolved.data.active);
    }
    setInitialized(true);
  }, [resolved.data, initialized]);

  const apply = useSignControllerRevoke({
    mutation: { onError: (e: Error) => setError(e.message) },
  });

  if (resolved.isLoading) {
    return (
      <RevokePageShell>
        <div className="flex justify-center py-10">
          <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
        </div>
      </RevokePageShell>
    );
  }

  if (resolved.isError || !resolved.data) {
    return (
      <RevokePageShell>
        <CenteredIcon tone="warning">
          <PowerOff className="size-8" aria-hidden="true" />
        </CenteredIcon>
        <h1 className="mt-4 text-center text-lg font-semibold text-gray-900">
          This link is no longer active
        </h1>
        <p className="text-muted-foreground mt-2 text-center text-sm leading-6">
          It may already have been used, or it&apos;s expired. Any current
          settings can still be managed from Profile → Permissions.
        </p>
      </RevokePageShell>
    );
  }

  const { kind, templateName, isPerpetual } = resolved.data;

  if (apply.isSuccess) {
    return (
      <RevokePageShell>
        <CenteredIcon tone="supportive">
          <CheckCircle2 className="size-8" aria-hidden="true" />
        </CenteredIcon>
        <h1 className="mt-4 text-center text-lg font-semibold text-gray-900">
          Preferences updated
        </h1>
        <p className="text-muted-foreground mt-2 text-center text-sm leading-6">
          {kind === "delegate"
            ? "Future requests will be sent to your email for manual signing."
            : "Your auto-request preferences for " + templateName + " have been saved."}
        </p>
      </RevokePageShell>
    );
  }

  return (
    <RevokePageShell>
      <h1 className="text-lg font-semibold text-gray-900">
        {kind === "owner" ? "Auto-request" : "Auto-sign"} for {templateName}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm leading-6">
        {kind === "owner"
          ? "Manage the auto-request permissions you enabled for this template."
          : "You enabled auto-sign for future MOAs under your name on this template. Turning it off doesn't affect already-signed MOAs."}
      </p>

      <div className="mt-6 divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
        {kind === "owner" ? (
          <>
            <div className="flex items-center justify-between gap-4 px-4 py-3.5">
              <div>
                <p className="text-sm font-medium text-gray-900">
                  New universities
                </p>
                <p className="text-muted-foreground text-xs">
                  Automatically partner with new universities that use the same MOA.
                </p>
              </div>
              <Switch
                checked={proactive}
                onCheckedChange={setProactive}
                className="cursor-pointer"
              />
            </div>
            {!isPerpetual && (
              <div className="flex items-center justify-between gap-4 px-4 py-3.5">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    Auto-renew
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Sign a fresh agreement automatically when one expires.
                  </p>
                </div>
                <Switch
                  checked={autoRenew}
                  onCheckedChange={setAutoRenew}
                  className="cursor-pointer"
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <p className="text-sm font-medium text-gray-900">Auto-sign</p>
              <p className="text-muted-foreground text-xs">
                Future requests will be sent to your email for manual signing
                instead.
              </p>
            </div>
            <Switch
              checked={delegateOn}
              disabled={!delegateOn}
              onCheckedChange={setDelegateOn}
              className="cursor-pointer"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="text-destructive mt-3 text-sm leading-6">{error}</p>
      )}

      <Button
        size="lg"
        className="mt-6 w-full"
        disabled={!token || apply.isPending}
        onClick={() => {
          setError("");
          apply.mutate({
            token,
            data:
              kind === "owner" ? { proactive, autoRenew } : { proactive: false, autoRenew: false },
          });
        }}
      >
        {apply.isPending ? "Saving…" : "Save"}
      </Button>
    </RevokePageShell>
  );
}
