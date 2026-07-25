"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getAdminControllerGetUniversityMoaDetailQueryKey,
  useAdminControllerGetUniversityMoaDetail,
} from "@/app/api";
import { PageContainer } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoaStatusBadge } from "@/components/status-badge";
import { useModal } from "@/app/providers/modal-provider";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft } from "lucide-react";

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

export default function AdminMoaDetailPage() {
  const { universityId, moaId } = useParams<{
    universityId: string;
    moaId: string;
  }>();
  const { openModal, closeModal } = useModal();

  const { data, isLoading } = useAdminControllerGetUniversityMoaDetail(
    universityId,
    moaId,
    {
      query: {
        queryKey: getAdminControllerGetUniversityMoaDetailQueryKey(
          universityId,
          moaId,
        ),
        enabled: !!universityId && !!moaId,
      },
    },
  );

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
        href={`/admin/universities/${universityId}`}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Partners
      </Link>

      <Card className="overflow-hidden">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-gray-900">
                {company.registered_name}
                <span className="font-normal text-muted-foreground">
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
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              <MoaStatusBadge status={moa.status} isExpired={moa.is_expired} />
            </div>
          </div>
        </CardContent>
        {companyDocuments.length > 0 && (
          <div className="border-t border-gray-100 px-6 py-4 space-y-2">
            {companyDocuments.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3"
              >
                <span className="text-sm text-gray-700">
                  {DOC_LABELS[doc.type] ?? doc.type}
                </span>
                {doc.url ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      openModal(
                        "preview-doc",
                        <iframe
                          src={`${doc.url!}#navpanes=0`}
                          className="min-h-0 h-full w-full"
                          title={DOC_LABELS[doc.type] ?? doc.type}
                        />,
                        {
                          title: DOC_LABELS[doc.type] ?? doc.type,
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
            ))}
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
          <div className="border-t border-gray-100 px-6 py-10 text-center text-sm text-muted-foreground">
            PDF not available.
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
