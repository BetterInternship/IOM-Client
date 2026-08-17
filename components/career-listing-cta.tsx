"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusNotice } from "@/components/ui/status-notice";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import {
  useCompanyControllerCareerLinkStatus,
  useCompanyControllerCareerListingLink,
} from "@/app/api";
import type { ApiError } from "@/app/api/preconfig.axios";

// Mirrors preconfig.axios.ts's getAPIBase() — hostname-based, no env var,
// so dev/prod resolve without extra config per environment. Exported so the
// listing-invite accept flow (app/invite, company/register) can mirror the
// same EMAIL_MANAGES_OTHER_EMPLOYER conflict redirect.
export function getCareerHireUrl(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host.startsWith("dev.")) return "https://hire.dev.betterinternship.com";
    if (host.endsWith(".betterinternship.com"))
      return "https://hire.betterinternship.com";
  }
  return "http://hire.localhost:3000";
}

/**
 * "Post listings on BetterInternship" CTA (plan §4.2) — only ever rendered
 * by the caller when the company is verified OR has an accepted listing
 * invite (LISTING_INVITE_IMPLEMENTATION_PLAN.md D9; that much is already
 * implied by the card being visible, so it isn't repeated in the copy — the
 * Linked/Not Linked tag is the more useful signal here). Handles both
 * account-creation and returning-user cases identically: the user never
 * sees which one happened, they just land on a magic link.
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
        if (
          error.code === "EMAIL_MANAGES_OTHER_EMPLOYER" &&
          error.email &&
          error.autoLinkToken
        ) {
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
          toast.error(
            error.message || "Could not start BetterInternship listing setup.",
          );
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
    <StatusNotice
      icon={BriefcaseBusiness}
      title="Reach more students with an internship listing"
      description={
        <>
          <div className="flex flex-wrap items-center gap-2">
            <span>Post openings directly to BetterInternship&apos;s marketplace.</span>
            {!linkStatusLoading && (
              <PartnershipStatusBadge
                status={linked ? "active" : "inactive"}
                label={linked ? "Linked" : "Not linked"}
                showIcon={linked}
                className="px-2 py-1 text-xs"
              />
            )}
          </div>
          {conflictCode === "NO_EMAIL" && (
            <p className="text-destructive mt-1">
              Set an account email on your{" "}
              <Link href="/profile" className="underline">
                company profile
              </Link>{" "}
              first.
            </p>
          )}
        </>
      }
      action={
        <Button
          variant="outline"
          scheme="primary"
          expandIcon
          onClick={(event) => {
            event.stopPropagation();
            handleClick();
          }}
          disabled={isBusy}
          className="w-full bg-transparent sm:shrink-0 sm:bg-background"
          aria-label={ctaLabel}
        >
          <BriefcaseBusiness aria-hidden="true" />
          <span className="button-label">{ctaLabel}</span>
        </Button>
      }
      className="cursor-pointer border-gray-200 bg-gray-50/50 transition-colors hover:bg-gray-100"
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(event) => {
        if (
          event.currentTarget === event.target &&
          (event.key === "Enter" || event.key === " ")
        ) {
          event.preventDefault();
          handleClick();
        }
      }}
    />
  );
}
