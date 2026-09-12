"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import {
  getCompanyControllerGetVerificationQueryKey,
  getCompanyControllerMeQueryKey,
  useCompanyControllerPatchIdentityClaim,
} from "@/app/api";
import { getIdentityClaims, isGovernmentClaim } from "@/lib/identity-claim";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Government agency/body registration checkbox (Docs/plans/
 * GOVERNMENT_BODY_REGISTRATION_PLAN.md §6.1) — rendered identically on all
 * three document-collection surfaces. Owns the claim mutation itself:
 * ticking reveals two required fields and this component's own submit
 * button stands in for whatever "proceed" action the host page would
 * otherwise render, since submitting a claim is a distinct action the
 * document path doesn't have. Unticking clears the claim immediately, no
 * confirmation needed — the untick is always available (plan §4.7).
 */
function GovernmentIdentityClaim({
  company,
  onActiveChange,
  onSubmitted,
  submitLabel = "Submit for verification",
}: {
  company: { identity_claims: Record<string, unknown> };
  onActiveChange?: (active: boolean) => void;
  onSubmitted?: () => void;
  submitLabel?: string;
}) {
  const queryClient = useQueryClient();
  const claims = getIdentityClaims(company.identity_claims);
  const [ticked, setTicked] = useState(() => isGovernmentClaim(claims));
  const [name, setName] = useState(claims.claimed_registered_name ?? "");
  const [address, setAddress] = useState(
    claims.claimed_registered_address ?? "",
  );

  useEffect(() => {
    onActiveChange?.(ticked);
    // Only the mount-time value of onActiveChange matters per toggle — it's
    // a plain callback prop, not a dependency that should retrigger this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticked]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerGetVerificationQueryKey(),
    });
    queryClient.invalidateQueries({ queryKey: getCompanyControllerMeQueryKey() });
  };

  const patchClaim = useCompanyControllerPatchIdentityClaim({
    mutation: {
      onError: (error: Error) => toast(error.message, toastPresets.destructive),
    },
  });

  function handleToggle(checked: boolean) {
    setTicked(checked);
    if (checked) return;
    patchClaim.mutate(
      { data: { claimed_company_type: null } },
      { onSuccess: invalidate },
    );
  }

  function handleSubmit() {
    const claimedName = name.trim();
    const claimedAddress = address.trim();
    if (!claimedName || !claimedAddress) return;
    patchClaim.mutate(
      {
        data: {
          claimed_company_type: "government_agency",
          claimed_registered_name: claimedName,
          claimed_registered_address: claimedAddress,
        },
      },
      {
        onSuccess: () => {
          invalidate();
          onSubmitted?.();
        },
      },
    );
  }

  return (
    <div className="space-y-4">
      <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
        <Checkbox
          checked={ticked}
          disabled={patchClaim.isPending}
          onCheckedChange={(checked) => handleToggle(checked === true)}
        />
        I&apos;m a government agency/body
      </label>

      {ticked && (
        <div className="space-y-4 rounded-[0.5em] border-2 border-dashed border-gray-300 bg-white px-4 py-6 sm:px-6 sm:py-8">
          <p className="text-muted-foreground text-sm">
            We will still need to verify your entity... Your email domain
            will be checked to verify your identity.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="claimed-registered-name">Agency name</Label>
              <Input
                id="claimed-registered-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Department of Trade and Industry"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="claimed-registered-address">Address</Label>
              <Input
                id="claimed-registered-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={!name.trim() || !address.trim() || patchClaim.isPending}
              onClick={handleSubmit}
            >
              {patchClaim.isPending && <Loader2 className="animate-spin" />}
              {patchClaim.isPending ? "Submitting..." : submitLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export { GovernmentIdentityClaim };
