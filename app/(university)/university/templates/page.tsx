"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import {
  getUniversityControllerListTemplatesQueryKey,
  useUniversityControllerListTemplates,
  useUniversityControllerToggleTemplateOffer,
} from "@/app/api";
import { toastPresets } from "@/components/sonner-toaster";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useIomModalRegistry } from "@/components/modal-registry";
import {
  UniversityTemplatesTable,
  type TemplateOffer,
} from "@/components/university/university-templates-table";

export default function UniversityTemplatesPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirmAction, universityProfileComplete } = useIomModalRegistry();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup_complete") !== "1") return;

    const cleanUrl = () => router.replace("/university/templates");
    universityProfileComplete.open({
      onContinue: cleanUrl,
      onClose: cleanUrl,
    });
    // This is a one-time handoff from profile setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading && !isSuperadmin) router.replace("/university/partners");
  }, [isLoading, isSuperadmin, router]);

  const { data, isLoading: tLoading } = useUniversityControllerListTemplates({
    query: { enabled: !!account && isSuperadmin },
  });

  const toggle = useUniversityControllerToggleTemplateOffer({
    mutation: {
      onSuccess: (_res, variables) => {
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerListTemplatesQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: ["university-templates-for-invite"],
        });
        confirmAction.close();
        toast(
          variables.data.is_available
            ? "Template offered."
            : "Template hidden.",
          toastPresets.success,
        );
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const offers = (data?.templates ?? []).filter((o) => !o.template.is_deleted);
  const availableMoaCount = offers.filter((offer) => offer.is_available).length;

  if (isLoading || !account || !isSuperadmin) return null;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="MOA Templates"
        description="Choose which catalog templates your university offers to companies. Your institution signatory must be set on your profile first."
      ></PageHeader>

      <UniversityTemplatesTable
        offers={offers}
        isLoading={tLoading}
        isPending={toggle.isPending}
        onToggle={(templateId, is_available) =>
          toggle.mutateAsync({ templateId, data: { is_available } })
        }
      />
    </PageContainer>
  );
}
