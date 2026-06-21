"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { preconfiguredAxios, type ApiError } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/auth-shell";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Building2, Check, Loader2 } from "lucide-react";

interface University {
  id: string;
  registered_name: string;
  logo_url: string | null;
  address: string | null;
  requestable: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  term_months: number;
}

function RequestDialog({
  university,
  onClose,
}: {
  university: University;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["university-templates", university.id],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/company/universities/${university.id}/templates`)
        .then((r) => r.data as { templates: Template[] }),
  });

  const request = useMutation({
    mutationFn: (templateId: string) =>
      preconfiguredAxios
        .post("/api/company/moas", { universityId: university.id, templateId })
        .then((r) => r.data as { moa: { id: string } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["company-moas"] });
      onClose();
      router.push(`/company/moas/${res.moa.id}`);
    },
    onError: (e: Error) => {
      const err = e as ApiError;
      const code = err.response?.data?.code || "";
      if (code === "AT_ACTIVE_MOA_CAP") {
        const limit = err.response?.data?.data?.limit ?? "the maximum";
        setError(
          `You have reached the maximum of ${limit} active MOAs with this university.`
        );
      } else if (code === "PROFILE_INCOMPLETE") {
        setError(
          "Your profile is incomplete. Please complete your profile and try again."
        );
      } else if (code === "DOCUMENTS_MISSING") {
        setError("You must upload all required documents before requesting an MOA.");
      } else {
        setError(
          "Couldn't request from this university at this time. Please contact us for help."
        );
      }
    },
  });

  const templates = data?.templates ?? [];

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request MOA</DialogTitle>
          <DialogDescription>{university.registered_name}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading && (
            <>
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          )}

          {!isLoading && templates.length === 0 && (
            <p className="text-muted-foreground text-sm">
              No available templates at this university.
            </p>
          )}

          {templates.map((t) => {
            const selected = selectedTemplate === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedTemplate(t.id)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-[0.33em] border p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-gray-200 hover:border-gray-300"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-primary bg-primary text-white" : "border-gray-300"
                  )}
                >
                  {selected && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">
                    {t.name}
                  </span>
                  {t.description && (
                    <span className="text-muted-foreground mt-0.5 block text-xs">
                      {t.description}
                    </span>
                  )}
                  <span className="text-muted-foreground mt-1 block text-xs">
                    Term: {t.term_months} months
                  </span>
                </span>
              </button>
            );
          })}

          {error && <FormError>{error}</FormError>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => selectedTemplate && request.mutate(selectedTemplate)}
            disabled={!selectedTemplate || request.isPending}
          >
            {request.isPending && <Loader2 className="animate-spin" />}
            {request.isPending ? "Requesting…" : "Request MOA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UniversityDirectoryPage() {
  const { company, isLoading } = useCompanyProfile();
  const [selected, setSelected] = useState<University | null>(null);

  const { data, isLoading: uniLoading } = useQuery({
    queryKey: ["company-universities"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/company/universities")
        .then((r) => r.data as { universities: University[] }),
    enabled: !!company,
  });

  if (isLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  const universities = data?.universities ?? [];
  const profileComplete = !!(
    company.registered_name &&
    company.company_type &&
    company.registered_address &&
    company.rep_name &&
    company.rep_title
  );

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Request MOA"
        description="This is a list of universities you can request a MOA with."
      />

      {!profileComplete && (
        <div className="border-warning/30 bg-warning/10 rounded-[0.33em] border p-4 text-sm text-gray-700">
          Complete your profile and upload all required documents to request MOAs.
        </div>
      )}

      {uniLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : universities.length === 0 ? (
        <EmptyState title="No universities found" />
      ) : (
        <div className="space-y-2.5">
          {universities.map((uni) => (
            <Card
              key={uni.id}
              className="flex-row items-center justify-between gap-4 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-muted text-muted-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.33em]">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {uni.registered_name}
                  </p>
                  {uni.address && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {uni.address}
                    </p>
                  )}
                </div>
              </div>
              {uni.requestable && profileComplete ? (
                <Button
                  className="flex-shrink-0"
                  size="sm"
                  onClick={() => setSelected(uni)}
                >
                  Request MOA
                </Button>
              ) : (
                <Badge type="default" className="flex-shrink-0">
                  Unavailable
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <RequestDialog university={selected} onClose={() => setSelected(null)} />
      )}
    </PageContainer>
  );
}
