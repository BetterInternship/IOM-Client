"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useCompanyControllerCareerLinkStatus,
  useCompanyControllerCareerListingLink,
} from "@/app/api";
import type { ApiError } from "@/app/api/preconfig.axios";

// Mirrors preconfig.axios.ts's getAPIBase() — hostname-based, no env var,
// so dev/prod resolve without extra config per environment.
function getCareerHireUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.startsWith("dev.")) return "https://dev.hire.betterinternship.com";
    if (host.endsWith(".betterinternship.com")) return "https://hire.betterinternship.com";
  }
  return "http://hire.localhost:3000";
}

/**
 * "Post listings on BetterInternship" CTA (plan §4.2) — only ever rendered
 * by the caller when the company's verification status is 'verified' (that
 * much is already implied by the card being visible, so it isn't repeated
 * in the copy — the Linked/Not Linked tag is the more useful signal here).
 * Handles both account-creation and returning-user cases identically: the
 * user never sees which one happened, they just land on a magic link.
 *
 * EMAIL_MANAGES_OTHER_EMPLOYER doesn't dead-end into "go link it yourself":
 * it sends the user to the career site's login, prefilled with the email and
 * carrying a signed auto-link token that the Client redeems right after
 * sign-in (see Client's app/hire/login/page.tsx). Manual TIN-linking from
 * the career hire dashboard still exists as a fallback for anyone who lands
 * there some other way — it's just no longer the primary path out of this
 * conflict.
 *
 * Both outcomes open in a new tab (the destination is a different app on a
 * different domain — replacing this dashboard tab would lose the user's
 * place). The target URL isn't known until the mutation resolves, and by
 * then we're outside the click's call stack, so a plain `window.open` in
 * onSuccess/onError would get popup-blocked. The fix is the standard one:
 * open a blank tab synchronously inside the click handler (still a direct
 * user gesture) and navigate *that* tab once the response arrives.
 */
export function CareerListingCta() {
  const [conflictCode, setConflictCode] = useState<string | null>(null);
  const pendingTabRef = useRef<Window | null>(null);

  const { data: linkStatus, isLoading: linkStatusLoading } =
    useCompanyControllerCareerLinkStatus();
  const linked = linkStatus?.linked ?? false;
  // "Link to marketplace account" only makes sense when there's an actual
  // existing career account to link to (an employer_user already owns this
  // email). If not, clicking through just creates a brand new account
  // transparently, so the button should read "Post a listing" the same as
  // the linked case — the Not Linked tag alone already communicates state.
  const hasExistingAccount = linkStatus?.hasExistingAccount ?? false;
  const showLinkCopy = !linked && hasExistingAccount;

  const linkMutation = useCompanyControllerCareerListingLink({
    mutation: {
      onSuccess: (data) => {
        if (data.magicLink && pendingTabRef.current) {
          pendingTabRef.current.location.href = data.magicLink;
        } else {
          pendingTabRef.current?.close();
        }
        pendingTabRef.current = null;
      },
      onError: (e: Error) => {
        const error = e as ApiError;
        if (error.code === "EMAIL_MANAGES_OTHER_EMPLOYER" && error.email && error.autoLinkToken) {
          const url = new URL("/login", getCareerHireUrl());
          url.searchParams.set("email", error.email);
          url.searchParams.set("auto_link", error.autoLinkToken);
          if (pendingTabRef.current) {
            pendingTabRef.current.location.href = url.toString();
          }
          pendingTabRef.current = null;
          return;
        }
        pendingTabRef.current?.close();
        pendingTabRef.current = null;
        if (error.code === "NO_EMAIL") {
          setConflictCode(error.code);
        } else {
          toast.error(error.message || "Could not start BetterInternship listing setup.");
        }
      },
    },
  });

  const handleClick = () => {
    setConflictCode(null);
    // No noopener/noreferrer here — we need the reference to navigate this
    // tab once the mutation resolves. The destination is always our own
    // hire site, never arbitrary/user-controlled, so the usual tabnabbing
    // concern that noopener guards against doesn't apply.
    pendingTabRef.current = window.open("about:blank", "_blank");
    linkMutation.mutate();
  };

  const isBusy = linkMutation.isPending;

  const ctaLabel = linkMutation.isPending
    ? "Setting up…"
    : showLinkCopy
      ? "Link to marketplace account"
      : "Post a listing";

  return (
    <Card className="flex-row items-start gap-3 border-primary/30 bg-primary/5 px-5 py-4">
      <ArrowUpRight className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-gray-900">
            Post internship openings straight to BetterInternship&apos;s
            marketplace
          </p>
          {!linkStatusLoading && (
            <Badge type={linked ? "supportive" : "warning"} className="flex-shrink-0">
              {linked ? "Linked" : "Not Linked"}
            </Badge>
          )}
        </div>

        {conflictCode === "NO_EMAIL" && (
          <p className="text-destructive text-sm">
            Set an account email on your{" "}
            <Link href="/profile" className="underline">
              company profile
            </Link>{" "}
            first.
          </p>
        )}

        <div className="pt-1">
          <Button size="sm" onClick={handleClick} disabled={isBusy}>
            {ctaLabel}
          </Button>
        </div>
      </div>
    </Card>
  );
}
