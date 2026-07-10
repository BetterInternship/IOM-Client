"use client";
import { useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCompanyControllerGetMoa } from "@/app/api";
import { useModal } from "@/app/providers/modal-provider";
import { PageContainer } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoaStatusBadge } from "@/components/status-badge";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";

interface CompanyMoaDetail {
  moa: {
    university: { registered_name: string };
    template: { name: string };
    effective_date: string;
    expiry_date: string | null;
    status: string;
    is_expired: boolean | null;
    rejection_reason: string | null;
  };
  pdfUrl: string | null;
}

export default function CompanyMoaDetailPage() {
  const { moaId } = useParams<{ moaId: string }>();
  const searchParams = useSearchParams();
  const { closeModal } = useModal();
  const justIssued = searchParams.get("issued") === "1";

  const { data, isLoading } = useCompanyControllerGetMoa(moaId, {
    query: { refetchInterval: 25 * 60 * 1000 },
  });

  const detail = data as unknown as CompanyMoaDetail | undefined;

  useEffect(() => {
    if (!justIssued || isLoading || !data) return;

    const timer = window.setTimeout(() => {
      closeModal("request-moa", { skipOnClose: true });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [closeModal, data, isLoading, justIssued]);

  if (isLoading) {
    return (
      <PageContainer className="max-w-3xl space-y-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-[60vh] w-full" />
      </PageContainer>
    );
  }
  if (!data) {
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

  const { moa, pdfUrl } = detail!;
  const isActive = moa.status === "active" && !moa.is_expired;
  const downloadFilename = `${moa.university.registered_name} MOA.pdf`;

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <Link
        href="/company/dashboard"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dashboard
      </Link>

      <Card className="overflow-hidden">
        {isActive && (
          <div className="bg-supportive/10 border-b border-supportive/20 px-6 py-4 flex items-center gap-3">
            <ShieldCheck
              className="h-5 w-5 text-supportive flex-shrink-0"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-supportive">
                This MOA is signed and in effect
              </p>
              <p className="text-xs text-supportive/80 mt-0.5">
                {moa.expiry_date
                  ? `Valid until ${formatDateWithoutTime(moa.expiry_date)}`
                  : "Perpetual — no expiry"}
              </p>
            </div>
          </div>
        )}

        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-gray-900 text-wrap-balance">
                {moa.university.registered_name}
              </h1>
              <p className="text-muted-foreground mt-0.5 text-sm">
                {moa.template.name}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                {formatDateWithoutTime(moa.effective_date)} &ndash;{" "}
                {moa.expiry_date
                  ? formatDateWithoutTime(moa.expiry_date)
                  : "Perpetual"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              {!isActive && (
                <MoaStatusBadge
                  status={moa.status}
                  isExpired={moa.is_expired}
                />
              )}
              {pdfUrl && (
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/gcs-proxy?url=${encodeURIComponent(pdfUrl)}`}
                    download={downloadFilename}
                  >
                    <Download aria-hidden="true" />
                    Download MOA
                  </a>
                </Button>
              )}
            </div>
          </div>

          {moa.status === "rejected" && moa.rejection_reason && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-[0.33em] border p-3 text-sm">
              <span className="font-medium">Rejection reason:</span>{" "}
              {moa.rejection_reason}
            </div>
          )}
        </CardContent>

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
    </PageContainer>
  );
}
