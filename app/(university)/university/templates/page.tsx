"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Loader2, Plus } from "lucide-react";

interface TemplateOffer {
  id: string;
  is_available: boolean;
  template: {
    id: string;
    name: string;
    description: string | null;
    term_months: number;
    is_deleted: boolean | null;
  };
}

export default function UniversityTemplatesPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();

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
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["university-templates"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !account || !isSuperadmin) return null;

  const offers = (data?.templates ?? []).filter((o) => !o.template.is_deleted);
  const selected = offers.filter((o) => o.is_available);
  const available = offers.filter((o) => !o.is_available);

  const row = (offer: TemplateOffer, mode: "selected" | "available") => (
    <Card
      key={offer.id}
      className="flex-row items-center justify-between gap-4 px-5 py-4"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900">{offer.template.name}</p>
        {offer.template.description && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {offer.template.description}
          </p>
        )}
        <p className="text-muted-foreground mt-0.5 text-xs">
          Term: {offer.template.term_months} months
        </p>
      </div>
      {mode === "selected" ? (
        <Button
          variant="outline"
          scheme="destructive"
          size="sm"
          className="flex-shrink-0"
          disabled={toggle.isPending}
          onClick={() =>
            toggle.mutate({ templateId: offer.template.id, is_available: false })
          }
        >
          Remove
        </Button>
      ) : (
        <Button
          size="sm"
          className="flex-shrink-0"
          disabled={toggle.isPending}
          onClick={() =>
            toggle.mutate({ templateId: offer.template.id, is_available: true })
          }
        >
          <Plus /> Offer
        </Button>
      )}
    </Card>
  );

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="MOA Templates"
        description="Choose which catalog templates your university offers to companies. Your institution signatory must be set on your profile first."
      />

      {tLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : offers.length === 0 ? (
        <EmptyState title="No templates in the catalog yet" />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold tracking-wide text-gray-700 uppercase">
              <Check className="text-supportive h-4 w-4" /> Selected ({selected.length})
            </h2>
            {selected.length === 0 ? (
              <p className="text-muted-foreground rounded-[0.33em] border border-dashed border-gray-300 bg-white px-5 py-6 text-center text-sm">
                You aren&apos;t offering any templates yet. Add one from below.
              </p>
            ) : (
              <div className="space-y-2.5">{selected.map((o) => row(o, "selected"))}</div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Available ({available.length})
            </h2>
            {available.length === 0 ? (
              <p className="text-muted-foreground rounded-[0.33em] border border-dashed border-gray-300 bg-white px-5 py-6 text-center text-sm">
                Every catalog template is already being offered.
              </p>
            ) : (
              <div className="space-y-2.5">
                {available.map((o) => row(o, "available"))}
              </div>
            )}
          </section>
        </>
      )}
    </PageContainer>
  );
}
