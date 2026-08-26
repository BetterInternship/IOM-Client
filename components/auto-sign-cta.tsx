"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getCompanyControllerGetAutoSignQueryKey,
  useCompanyControllerGetAutoSign,
  useCompanyControllerEnableAutoSign,
  type CompanyAutoSignOfferDto,
} from "@/app/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { toastPresets } from "@/components/sonner-toaster";
import { cn } from "@/lib/utils";
import { ShieldCheck, X } from "lucide-react";

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
 * Post-sign auto-sign offer (Docs/plans/AUTO_SIGN_CTA_IMPLEMENTATION_PLAN.md
 * §6.1). Driven entirely by GET /company/auto-sign's `offers` — renders
 * nothing when no offer matches. Dismissal is local/session-only by design
 * (not persisted): the next self-signing re-offers, and the Permissions
 * card fallback is always available.
 */
export function AutoSignCta({
  templateId,
  variant = "card",
  className,
}: {
  /** Exact template to offer. Omit to show the most-recently-signed offer. */
  templateId?: string;
  variant?: "card" | "plain";
  className?: string;
}) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [proactive, setProactive] = useState(true);
  const [autoRenew, setAutoRenew] = useState(true);

  const { data } = useCompanyControllerGetAutoSign();
  const offers = data?.offers ?? [];
  const offer: CompanyAutoSignOfferDto | undefined = templateId
    ? offers.find((o) => o.templateId === templateId)
    : [...offers].sort(
        (a, b) => new Date(b.signedAt).getTime() - new Date(a.signedAt).getTime(),
      )[0];

  const enable = useCompanyControllerEnableAutoSign({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetAutoSignQueryKey(),
        });
        toast("Auto-sign enabled", toastPresets.success);
        setDismissed(true);
      },
      onError: (e: Error) => toast(e.message, toastPresets.destructive),
    },
  });

  if (!offer || dismissed) return null;

  const renewChecked = autoRenew && !offer.isPerpetual;
  const canConfirm = proactive || renewChecked;

  const content = (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-full">
          <ShieldCheck className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">
            Set up auto-sign for {offer.templateName}?
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            We can sign future agreements on this template for you, using the
            details from your signing.
          </p>
        </div>
        <button
          type="button"
          aria-label="Dismiss"
          className="text-muted-foreground shrink-0 cursor-pointer hover:text-gray-700"
          onClick={() => setDismissed(true)}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>

      <div className="rounded-[0.33em] border border-gray-200 bg-gray-50/60 px-4 py-3">
        <SignaturePreview type={offer.signatureType} data={offer.signatureData} />
        <p className="mt-1.5 text-sm font-medium text-gray-900">
          {offer.signatoryName}
        </p>
        <p className="text-muted-foreground text-xs">{offer.signatoryTitle}</p>
      </div>

      <div className="space-y-2.5">
        <label className="flex cursor-pointer items-start gap-2.5">
          <Checkbox
            checked={proactive}
            onCheckedChange={(checked) => setProactive(checked === true)}
            className="mt-0.5"
          />
          <span className="text-sm text-gray-800">
            <span className="font-medium">
              Sign automatically with new universities
            </span>
            <span className="text-muted-foreground block text-xs">
              Whenever a new university adopts this same agreement,
              we&apos;ll sign it for you using these details.
            </span>
          </span>
        </label>
        {!offer.isPerpetual && (
          <label className="flex cursor-pointer items-start gap-2.5">
            <Checkbox
              checked={autoRenew}
              onCheckedChange={(checked) => setAutoRenew(checked === true)}
              className="mt-0.5"
            />
            <span className="text-sm text-gray-800">
              <span className="font-medium">
                Renew automatically when it expires
              </span>
              <span className="text-muted-foreground block text-xs">
                When an agreement on this template expires, we&apos;ll
                request and sign a fresh one with that university.
              </span>
            </span>
          </label>
        )}
      </div>

      <p className="text-muted-foreground text-xs">
        Your company information is always pulled fresh. Turn either off any
        time under Profile → Permissions.
      </p>

      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => setDismissed(true)}
        >
          Not now
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
          {enable.isPending ? "Confirming…" : "Confirm"}
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
