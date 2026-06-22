"use client";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import Link from "next/link";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoaStatusBadge } from "@/components/status-badge";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CompanyDoc {
  id: string;
  type: string;
  filename: string;
  url: string | null;
}

interface CompanyMoaDetail {
  moa: {
    university: { registered_name: string };
    template: { name: string };
    effective_date: string;
    expiry_date: string;
    status: string;
    is_expired: boolean | null;
    rejection_reason: string | null;
  };
  pdfUrl: string | null;
  companyDocuments: CompanyDoc[];
}

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  or_registration: "OR Registration",
  sec_dti_registration: "SEC/DTI Registration",
};

export default function CompanyMoaDetailPage() {
  const { moaId } = useParams<{ moaId: string }>();
  const [previewDoc, setPreviewDoc] = useState<{ url: string; label: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["company-moa", moaId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/company/moas/${moaId}`)
        .then((r) => r.data as CompanyMoaDetail),
    enabled: !!moaId,
  });

  if (isLoading) {
    return (
      <PageContainer className="max-w-3xl space-y-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </PageContainer>
    );
  }
  if (!data?.moa) {
    return (
      <PageContainer className="max-w-3xl">
        <Card>
          <CardContent className="text-destructive py-8 text-center text-sm">
            MOA not found.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  const { moa, pdfUrl, companyDocuments = [] } = data;

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <Link
        href="/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Active MOAs
      </Link>

      <Card className="overflow-hidden">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-gray-900">
                {moa.university.registered_name}
                <span className="font-normal text-muted-foreground">
                  {" "}&ndash;{" "}({moa.template.name})
                </span>
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {formatDateWithoutTime(moa.effective_date)} &ndash;{" "}
                {formatDateWithoutTime(moa.expiry_date)}
              </p>
            </div>
            <MoaStatusBadge status={moa.status} isExpired={moa.is_expired} />
          </div>

          {moa.status === "rejected" && moa.rejection_reason && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-[0.33em] border p-3 text-sm">
              <span className="font-medium">Rejection reason:</span>{" "}
              {moa.rejection_reason}
            </div>
          )}
        </CardContent>

        {companyDocuments.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 space-y-2">
            {companyDocuments.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-3">
                <span className="text-sm text-gray-700">{DOC_LABELS[doc.type] ?? doc.type}</span>
                {doc.url ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewDoc({ url: doc.url!, label: DOC_LABELS[doc.type] ?? doc.type })}
                  >
                    Preview
                  </Button>
                ) : (
                  <span className="text-muted-foreground text-xs">Unavailable</span>
                )}
              </div>
            ))}
          </div>
        )}
        {pdfUrl ? (
          <div className="border-t border-gray-100 px-6 pb-4 pt-4">
            <iframe
              src={`${pdfUrl}#navpanes=0`}
              className="aspect-[210/297] w-full"
              title="MOA PDF"
            />
          </div>
        ) : (
          <p className="text-muted-foreground border-t border-gray-100 px-6 py-10 text-center text-sm">
            PDF not available.
          </p>
        )}
      </Card>
      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) setPreviewDoc(null); }}>
        <DialogBottomSheet className="flex flex-col" style={{ height: "90dvh" }}>
          <DialogHeader className="px-6 py-4 border-b border-gray-100 shrink-0">
            <DialogTitle>{previewDoc?.label ?? "Document"}</DialogTitle>
          </DialogHeader>
          {previewDoc && (
            <iframe
              src={`${previewDoc.url}#navpanes=0`}
              className="min-h-0 flex-1 w-full"
              title={previewDoc.label}
            />
          )}
        </DialogBottomSheet>
      </Dialog>
    </PageContainer>
  );
}
