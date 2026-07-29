"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import type { UniversityMoaDetailResponse } from "@/app/api";
import { useModal } from "@/app/providers/modal-provider";
import { PageContainer } from "@/components/page-header";
import { MoaStatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateWithoutTime } from "@/lib/utils";

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

export function UniversityMoaDetail({
  data,
  isLoading,
  backHref,
  backLabel,
}: {
  data?: UniversityMoaDetailResponse;
  isLoading: boolean;
  backHref: string;
  backLabel: string;
}) {
  const { openModal } = useModal();

  if (isLoading) {
    return (
      <PageContainer className="max-w-3xl space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-28 w-full" />
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
  const company = moa.company;

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> {backLabel}
      </Link>

      <Card className="overflow-hidden">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-gray-900">
                {company.registered_name}
                <span className="text-muted-foreground font-normal">
                  {" "}
                  &ndash; ({moa.template?.name})
                </span>
              </h1>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {formatDateWithoutTime(moa.effective_date)} &ndash;{" "}
                {moa.expiry_date
                  ? formatDateWithoutTime(moa.expiry_date)
                  : "Perpetual"}
              </p>
            </div>
            <MoaStatusBadge status={moa.status} isExpired={moa.is_expired} />
          </div>
        </CardContent>

        {companyDocuments.length > 0 && (
          <div className="space-y-2 border-t border-gray-100 px-6 py-4">
            {companyDocuments.map((doc) => {
              const label = DOC_LABELS[doc.type] ?? doc.type;
              return (
                <div
                  key={doc.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="text-sm text-gray-700">{label}</span>
                  {doc.url ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        openModal(
                          "preview-doc",
                          <iframe
                            src={`${doc.url}#navpanes=0`}
                            className="h-full min-h-0 w-full"
                            title={label}
                          />,
                          {
                            title: label,
                            panelClassName: "!w-full sm:!max-w-4xl",
                            contentClassName:
                              "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                            showHeaderDivider: true,
                          },
                        )
                      }
                    >
                      Preview
                    </Button>
                  ) : (
                    <span className="text-muted-foreground text-xs">
                      Unavailable
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {pdfUrl ? (
          <div className="border-t border-gray-100">
            <iframe
              src={`${pdfUrl}#navpanes=0`}
              className="aspect-[210/297] w-full"
              title="MOA PDF"
            />
          </div>
        ) : (
          <div className="text-muted-foreground border-t border-gray-100 px-6 py-10 text-center text-sm">
            PDF not available.
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
