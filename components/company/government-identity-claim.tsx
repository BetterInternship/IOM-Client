"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Landmark } from "lucide-react";
import { toast } from "sonner";

import {
  getCompanyControllerGetVerificationQueryKey,
  getCompanyControllerMeQueryKey,
  useCompanyControllerPatchIdentityClaim,
} from "@/app/api";
import { getIdentityClaims, isGovernmentClaim } from "@/lib/identity-claim";
import { toastPresets } from "@/components/sonner-toaster";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/**
 * State + mutation behind the government agency/body claim (Docs/plans/
 * GOVERNMENT_BODY_REGISTRATION_PLAN.md §6.1). Unticking clears the claim
 * immediately (plan §4.7, no confirmation needed). Ticking only ever writes
 * when the host calls `submit()` from its own "Next"/"Submit" action —
 * every write reopens a review and re-notifies admins
 * (company-review.service.ts's onMaterialChange), so this must never fire
 * on a per-keystroke/blur basis.
 *
 * `onTickedChange` is a thin escape hatch for hosts whose *sibling* layout
 * depends on ticked state (a stepper heading, a neighbouring card's
 * visibility) — most callers don't need it.
 */
function useIdentityClaimForm(
  company: { identity_claims: Record<string, unknown> },
  onTickedChange?: (ticked: boolean) => void,
) {
  const queryClient = useQueryClient();
  const claims = getIdentityClaims(company.identity_claims);
  const [ticked, setTicked] = useState(() => isGovernmentClaim(claims));
  const [name, setName] = useState(claims.claimed_registered_name ?? "");
  const [address, setAddress] = useState(
    claims.claimed_registered_address ?? "",
  );

  useEffect(() => {
    onTickedChange?.(ticked);
    // Only the current value of `ticked` should retrigger this — the
    // callback is a plain prop, not meant to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticked]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerGetVerificationQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerMeQueryKey(),
    });
  };

  const patchClaim = useCompanyControllerPatchIdentityClaim({
    mutation: {
      onSuccess: invalidate,
      onError: (error: Error) => toast(error.message, toastPresets.destructive),
    },
  });

  function toggle(checked: boolean) {
    setTicked(checked);
    if (checked) return;
    patchClaim.mutate({ data: { claimed_company_type: null } });
  }

  async function submit(): Promise<boolean> {
    const claimedName = name.trim();
    const claimedAddress = address.trim();
    if (!claimedName || !claimedAddress) return false;
    try {
      await patchClaim.mutateAsync({
        data: {
          claimed_company_type: "government_agency",
          claimed_registered_name: claimedName,
          claimed_registered_address: claimedAddress,
        },
      });
      return true;
    } catch {
      return false;
    }
  }

  return {
    ticked,
    toggle,
    name,
    setName,
    address,
    setAddress,
    submit,
    isPending: patchClaim.isPending,
    valid: !!name.trim() && !!address.trim(),
  };
}

type IdentityClaimForm = ReturnType<typeof useIdentityClaimForm>;

/**
 * The checkbox + (when ticked) name/address fields — rendered identically on
 * all three document-collection surfaces. Purely presentational: the host
 * owns `useIdentityClaimForm` and whatever button actually calls `submit()`
 * (its own "Next" in a stepper, or a dedicated button where the page is
 * standalone), since submitting is a distinct, deliberate action this
 * component has no "proceed" affordance of its own to hang it on.
 *
 * `tall` matches this box's height to CompanyDocumentUploader's card grid so
 * toggling the checkbox doesn't shove a page's "Next" button up or down.
 */
function GovernmentIdentityClaim({
  form,
  tall = false,
}: {
  form: IdentityClaimForm;
  tall?: boolean;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        role="checkbox"
        aria-checked={form.ticked}
        disabled={form.isPending}
        onClick={() => form.toggle(!form.ticked)}
        className={cn(
          "flex w-full cursor-pointer items-center gap-3 rounded-[0.33em] border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
          form.ticked
            ? "border-primary bg-primary/5"
            : "border-gray-200 bg-white hover:border-gray-300",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
            form.ticked
              ? "bg-primary text-white"
              : "bg-gray-100 text-muted-foreground",
          )}
        >
          <Landmark className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-gray-900">
            I&apos;m a government agency/body
          </span>
          <span className="text-muted-foreground block text-xs">
            Skip the documents — verify with your agency name and address
            instead.
          </span>
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
            form.ticked
              ? "border-primary bg-primary text-white"
              : "border-gray-300 bg-white",
          )}
        >
          {form.ticked && <Check className="h-4 w-4" strokeWidth={3} />}
        </span>
      </button>

      {form.ticked && (
        <div
          className={cn(
            "space-y-4 rounded-[0.5em] border-2 border-dashed border-gray-300 bg-white px-4 py-6 sm:px-6 sm:py-8",
            tall && "flex min-h-44 flex-col justify-center sm:min-h-[19rem]",
          )}
        >
          <p className="text-muted-foreground text-sm">
            We will still need to verify your entity... Your email domain
            will be checked to verify your identity.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="claimed-registered-name">Agency name</Label>
              <Input
                id="claimed-registered-name"
                value={form.name}
                onChange={(event) => form.setName(event.target.value)}
                placeholder="e.g. Department of Trade and Industry"
                disabled={form.isPending}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="claimed-registered-address">Address</Label>
              <Input
                id="claimed-registered-address"
                value={form.address}
                onChange={(event) => form.setAddress(event.target.value)}
                disabled={form.isPending}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export { GovernmentIdentityClaim, useIdentityClaimForm, type IdentityClaimForm };
