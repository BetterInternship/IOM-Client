"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCompanyControllerGetPermissionsQueryKey,
  useCompanyControllerGetPermissions,
  useCompanyControllerEnableAutoRequest,
  type CompanyAutoRequestOfferDto,
} from "@/app/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { toastPresets } from "@/components/sonner-toaster";
import { cn } from "@/lib/utils";

function SignaturePreview({ type, data }: { type: string; data: string }) {
  if (type === "image") {
    return (
      // Signature images are resolved bucket URLs, not local assets.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data}
        alt="Your signature"
        className="h-12 max-w-[12rem] object-contain object-left"
      />
    );
  }
  return <p className="font-serif text-lg text-gray-900 italic">{data}</p>;
}

/**
 * Post-sign auto-request offer (Docs/plans/AUTO_SIGN_CTA_IMPLEMENTATION_PLAN.md
 * §6.1). Driven entirely by GET /company/permissions's `offers` — renders
 * nothing when no offer matches. Dismissal is local/session-only by design
 * (not persisted): the next self-signing re-offers, and the Permissions
 * card fallback is always available.
 */
export function AutoRequestCta({
  templateId,
  variant = "card",
  className,
  onDismiss,
}: {
  /** Exact template to offer. Omit to show the most-recently-signed offer. */
  templateId?: string;
  variant?: "card" | "plain";
  className?: string;
  /** Called when the user dismisses ("Not now") or successfully enables — lets a caller embedding this in a modal close it in step. */
  onDismiss?: () => void;
}) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [proactive, setProactive] = useState(true);
  const [autoRenew, setAutoRenew] = useState(true);

  const { data } = useCompanyControllerGetPermissions();
  const offers = data?.offers ?? [];
  const offer: CompanyAutoRequestOfferDto | undefined = templateId
    ? offers.find((o) => o.templateId === templateId)
    : [...offers].sort(
        (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime(),
      )[0];

  const enable = useCompanyControllerEnableAutoRequest({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetPermissionsQueryKey(),
        });
        toast("Auto-request enabled", toastPresets.success);
        setDismissed(true);
        onDismiss?.();
      },
      onError: (e: Error) => toast(e.message, toastPresets.destructive),
    },
  });

  if (dismissed) return null;

  if (!offer) {
    // No offer to show (e.g. already fully enabled for this template) but
    // the caller still needs a way to close — a bare dismiss action instead
    // of rendering nothing and stranding the modal with no way out.
    if (!onDismiss) return null;
    return (
      <div className={cn("flex justify-center", className)}>
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => {
            setDismissed(true);
            onDismiss();
          }}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  const renewChecked = autoRenew && !offer.isPerpetual;
  const canConfirm = proactive || renewChecked;

  const content = (
    <div className="space-y-4">
      <div className="space-y-2.5">
        {!offer.proactive && (
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={proactive}
              onCheckedChange={(checked) => setProactive(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">
              <span className="font-medium">
                Automatically partner with new universities that use this MOA.
              </span>
            </span>
          </label>
        )}
        {!offer.isPerpetual && !offer.autoRenew && (
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={autoRenew}
              onCheckedChange={(checked) => setAutoRenew(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">
              <span className="font-medium">
                Automatically renew for universities that use this MOA.
              </span>
            </span>
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
        >
          Leave Off
        </Button>
        <Button
          size="sm"
          className="cursor-pointer"
          disabled={!canConfirm || enable.isPending}
          onClick={() =>
            enable.mutate({
              templateId: offer.templateId,
              data: { proactive, autoRenew: renewChecked },
            })
          }
        >
          {enable.isPending ? "Enabling…" : "Turn On"}
        </Button>
      </div>
    </div>
  );

  if (variant === "plain") {
    return <div className={className}>{content}</div>;
  }
  return (
    <Card className={cn("border-primary/20 bg-primary/[0.03] p-4", className)}>
      {content}
    </Card>
  );
}
