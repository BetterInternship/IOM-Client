"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";

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
  const [pending, setPending] = useState<{ offer: TemplateOffer; next: boolean } | null>(null);

  useEffect(() => {
    if (!isLoading && !isSuperadmin) router.replace("/partners");
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
    mutationFn: ({ templateId, is_available }: { templateId: string; is_available: boolean }) =>
      preconfiguredAxios.put(`/api/university/templates/${templateId}`, { is_available }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["university-templates"] }),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
  });

  if (isLoading || !account || !isSuperadmin) return null;

  const offers = (data?.templates ?? []).filter((o) => !o.template.is_deleted);

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
        <div className="space-y-2.5">
          {offers.map((offer) => (
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
              <button
                type="button"
                className="flex flex-shrink-0 cursor-pointer items-center gap-2 disabled:opacity-50"
                onClick={() => setPending({ offer, next: !offer.is_available })}
                disabled={toggle.isPending}
              >
                <span
                  className={`text-xs font-medium ${
                    offer.is_available ? "text-supportive" : "text-muted-foreground"
                  }`}
                >
                  {offer.is_available ? "Offered" : "Hidden"}
                </span>
                <Switch
                  checked={offer.is_available}
                  onCheckedChange={() => setPending({ offer, next: !offer.is_available })}
                  className="data-[state=checked]:bg-supportive pointer-events-none"
                  tabIndex={-1}
                />
              </button>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.next ? "Offer" : "Hide"} this template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.next
                ? `Companies will be able to request MOAs using "${pending.offer.template.name}".`
                : `Companies will no longer be able to request new MOAs using "${pending.offer.template.name}". Existing active MOAs are unaffected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pending &&
                toggle.mutate({
                  templateId: pending.offer.template.id,
                  is_available: pending.next,
                })
              }
            >
              {toggle.isPending && <Loader2 className="animate-spin" />}
              {pending?.next ? "Offer" : "Hide"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
