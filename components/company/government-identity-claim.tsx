"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Briefcase, Check, Landmark } from "lucide-react";
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
import { MorphHeight } from "@/components/ui/morph-height";
import { cn } from "@/lib/utils";

type IdentityChoice = "company" | "government";

/**
 * State + mutation behind the company-vs-government-agency verification
 * method choice (Docs/plans/GOVERNMENT_BODY_REGISTRATION_PLAN.md §6.1).
 * Starts unselected — neither documents nor claim fields render until the
 * host's radio picker is clicked, so a fresh visitor is never shown one
 * path by default. Switching away from "government" clears any in-progress
 * claim immediately (mirrors the original checkbox-untick, plan §4.7);
 * switching TO "government" only ever writes when the host calls
 * `submit()` — every write reopens a review and re-notifies admins
 * (company-review.service.ts's onMaterialChange), so this must never fire
 * on a per-keystroke/blur/selection basis.
 *
 * `onChoiceChange` is a thin escape hatch for hosts whose *sibling* layout
 * depends on the current choice (a stepper heading, a neighbouring card's
 * visibility) — most callers don't need it.
 */
function useIdentityClaimForm(
  company: { identity_claims: Record<string, unknown> },
  suggestGovernment?: boolean,
  onChoiceChange?: (choice: IdentityChoice | null) => void,
) {
  const queryClient = useQueryClient();
  const claims = getIdentityClaims(company.identity_claims);
  const [choice, setChoice] = useState<IdentityChoice | null>(() =>
    isGovernmentClaim(claims)
      ? "government"
      : suggestGovernment
        ? "government"
        : null,
  );
  const [name, setName] = useState(claims.claimed_registered_name ?? "");
  const [address, setAddress] = useState(
    claims.claimed_registered_address ?? "",
  );

  useEffect(() => {
    onChoiceChange?.(choice);
    // Only the current value of `choice` should retrigger this — the
    // callback is a plain prop, not meant to be a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [choice]);

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

  function choose(next: IdentityChoice) {
    if (choice === "government" && next === "company") {
      patchClaim.mutate({ data: { claimed_company_type: null } });
    }
    setChoice(next);
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
    choice,
    choose,
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

const CHOICES: Array<{
  value: IdentityChoice;
  icon: typeof Briefcase;
  title: string;
  description: string;
}> = [
  {
    value: "company",
    icon: Briefcase,
    title: "I'm a legally registered company",
    description: "Upload your BIR, SEC/DTI, and Mayor's Permit.",
  },
  {
    value: "government",
    icon: Landmark,
    title: "I'm a government agency/body",
    description:
      "Skip the documents — verify with your agency name and address instead.",
  },
];

// direction: 0 on first appearance (fade + grow only, no slide since there's
// no previous card to slide against), then +1/-1 on a switch between the two
// options — same slide+fade shape as the invite stepper's own step
// transition (app/(company)/invite/continue/page.tsx's stepVariants).
const cardVariants = {
  enter: (direction: number) => ({
    x: direction === 0 ? 0 : direction > 0 ? 24 : -24,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction === 0 ? 0 : direction > 0 ? -24 : 24,
    opacity: 0,
  }),
};
const cardTransition = { duration: 0.3, ease: [0.22, 1, 0.36, 1] as const };

/**
 * The company-vs-government radio picker + (for government) name/address
 * fields — rendered identically on all three document-collection surfaces.
 * Purely presentational: the host owns `useIdentityClaimForm` and whatever
 * button actually calls `submit()` (its own "Next" in a stepper, or a
 * dedicated button where the page is standalone).
 *
 * When the host passes `companyContent` (its CompanyDocumentUploader), the
 * two panels crossfade+slide against each other in one shared
 * AnimatePresence — direction is left when switching to "government", right
 * otherwise (see `cardVariants`). The profile page's document list has to
 * outlive this component's own mount (it must keep showing once
 * verification status moves past "incomplete", long after the picker
 * itself stops rendering), so it can't be handed in as `companyContent`
 * without breaking that — it stays a sibling the host renders itself, and
 * this component only animates the claim box's own appearance there.
 *
 * `tall` matches the claim-fields box's height to CompanyDocumentUploader's
 * card grid so switching between the two options doesn't shove a page's
 * "Next" button up or down.
 */
function GovernmentIdentityClaim({
  form,
  tall = false,
  companyContent,
}: {
  form: IdentityClaimForm;
  tall?: boolean;
  companyContent?: ReactNode;
}) {
  const previousChoiceRef = useRef<IdentityChoice | null>(null);
  const previousChoice = previousChoiceRef.current;
  useEffect(() => {
    previousChoiceRef.current = form.choice;
  }, [form.choice]);
  const direction =
    previousChoice === null ? 0 : form.choice === "government" ? 1 : -1;

  const claimBox = (
    <div
      className={cn(
        "space-y-4 rounded-[0.5em] border-2 border-dashed border-gray-300 bg-white px-4 py-6 sm:px-6 sm:py-8",
        tall && "flex min-h-44 flex-col justify-center sm:min-h-[19rem]",
      )}
    >
      <p className="text-muted-foreground text-sm">
        We will still need to verify your entity... Your email domain will be
        checked to verify your identity.
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
  );

  return (
    <div className="space-y-4">
      <div
        role="radiogroup"
        aria-label="Verification method"
        className="grid gap-3 sm:grid-cols-2"
      >
        {CHOICES.map(({ value, icon: Icon, title, description }) => {
          const selected = form.choice === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              disabled={form.isPending}
              onClick={() => form.choose(value)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-[0.33em] border px-4 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 bg-white hover:border-gray-300",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-colors",
                  selected
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-muted-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold text-gray-900">
                  {title}
                </span>
                <span className="text-muted-foreground block text-xs">
                  {description}
                </span>
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  selected
                    ? "border-primary bg-primary text-white"
                    : "border-gray-300 bg-white",
                )}
              >
                {selected && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>

      <MorphHeight duration={300}>
        {companyContent ? (
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            {form.choice && (
              <motion.div
                key={form.choice}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={cardTransition}
              >
                {form.choice === "government" ? claimBox : companyContent}
              </motion.div>
            )}
          </AnimatePresence>
        ) : (
          <AnimatePresence initial={false}>
            {form.choice === "government" && (
              <motion.div
                key="government"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={cardTransition}
              >
                {claimBox}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </MorphHeight>
    </div>
  );
}

export {
  GovernmentIdentityClaim,
  useIdentityClaimForm,
  type IdentityClaimForm,
  type IdentityChoice,
};
