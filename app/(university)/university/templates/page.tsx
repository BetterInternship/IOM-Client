"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
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

  const { data, isLoading: tLoading } = useQuery({
    queryKey: ["university-templates"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/templates")
        .then((r) => r.data as { templates: TemplateOffer[] }),
    enabled: !!account && isSuperadmin,
  });

  const toggle = useMutation({
    mutationFn: ({
      templateId,
      is_available,
    }: {
      templateId: string;
      is_available: boolean;
    }) =>
      preconfiguredAxios.put(`/api/university/templates/${templateId}`, {
        is_available,
      }),
    onSuccess: (_res, variables) => {
      queryClient.invalidateQueries({ queryKey: ["university-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["university-templates-for-invite"],
      });
      confirmAction.close();
      toast(
        variables.is_available ? "Template offered." : "Template hidden.",
        toastPresets.success,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const offers = (data?.templates ?? []).filter((o) => !o.template.is_deleted);
  const availableMoaCount = offers.filter((offer) => offer.is_available).length;

  if (isLoading || !account || !isSuperadmin) return null;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="MOA Templates"
        description="Choose which catalog templates your university offers to companies. Your institution signatory must be set on your profile first."
      >
        {tLoading ? (
          <Skeleton className="h-[58px] w-32" />
        ) : (
          <div className="min-w-32 rounded-[0.33em] border border-gray-200 bg-white px-3 py-2">
            <p className="leading-none font-semibold text-gray-900">
              {availableMoaCount}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">Offered MOA/s</p>
          </div>
        )}
      </PageHeader>

      <UniversityTemplatesTable
        offers={offers}
        isLoading={tLoading}
        isPending={toggle.isPending}
        onToggle={(templateId, is_available) =>
          toggle.mutateAsync({ templateId, is_available })
        }
      />
    </PageContainer>
  );
}
