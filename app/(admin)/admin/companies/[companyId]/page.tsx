"use client";
import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminControllerGetCompanyQueryKey,
  getAdminControllerListCompaniesQueryKey,
  useAdminControllerDeactivateCompany,
  useAdminControllerGetCompany,
} from "@/app/api";
import type {
  AdminCompanyDetailReviewHistoryItemDto,
  AdminCompanyDetailVerificationDtoStatus,
} from "@/app/api";
import { PageContainer } from "@/components/page-header";
import { CompanyLogo } from "@/components/company-logo";
import { DocumentPreviewPane } from "@/components/document-preview-pane";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  CollapsibleCardGroup,
  CollapsibleCardSection,
} from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useIomModalRegistry } from "@/components/modal-registry";
import { cn, formatDateWithoutTime } from "@/lib/utils";
import {
  ArrowLeft,
  CircleAlert,
  CircleCheck,
  GripVertical,
  X,
} from "lucide-react";

const COMPANY_TYPE_LABELS: Record<string, string> = {
  corporation: "Corporation",
  partnership: "Partnership",
  sole_proprietorship: "Sole Proprietorship",
  government_agency: "Government Agency",
};

const DOC_TYPE_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  sec_dti_registration: "SEC/DTI Registration",
  mayor_permit: "Mayor's Permit",
};

const DOC_TYPES_LIST = Object.entries(DOC_TYPE_LABELS);

function VerificationBadge({
  status,
  isDeactivated,
}: {
  status: AdminCompanyDetailVerificationDtoStatus;
  isDeactivated: boolean;
}) {
  if (isDeactivated) {
    return <PartnershipStatusBadge status="rejected" label="Deactivated" />;
  }
  if (status === "verified") {
    return <PartnershipStatusBadge status="active" label="Verified" />;
  }
  if (status === "pending") {
    return <PartnershipStatusBadge status="pending" label="Pending" />;
  }
  if (status === "rejected") {
    return <PartnershipStatusBadge status="rejected" label="Rejected" />;
  }
  if (status === "expired") {
    return <PartnershipStatusBadge status="expired" label="Expired" />;
  }
  return <PartnershipStatusBadge status="inactive" label="Incomplete" />;
}

function reviewStatusBadge(
  status: AdminCompanyDetailReviewHistoryItemDto["status"],
) {
  if (status === "approved")
    return (
      <Badge type="supportive" strength="medium">
        Approved
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge type="destructive" strength="medium">
        Rejected
      </Badge>
    );
  if (status === "superseded")
    return (
      <Badge type="default" strength="medium">
        Superseded
      </Badge>
    );
  return (
    <Badge type="warning" strength="medium">
      Pending
    </Badge>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <DetailField label={label}>
      <span className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
        {value || <span className="text-muted-foreground font-normal">—</span>}
      </span>
    </DetailField>
  );
}

export default function AdminCompanyProfilePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const { confirmAction } = useIomModalRegistry();
  const [documentPreview, setDocumentPreview] = useState<{
    url: string;
    filename: string;
    label: string;
  } | null>(null);
  const [previewWidth, setPreviewWidth] = useState(50);

  useEffect(() => {
    const savedWidth = Number(
      window.localStorage.getItem("iom-admin-company-preview-width"),
    );
    if (savedWidth >= 30 && savedWidth <= 70) setPreviewWidth(savedWidth);
  }, []);

  const queryClient = useQueryClient();

  const { data, isLoading } = useAdminControllerGetCompany(companyId, {
    query: {
      queryKey: getAdminControllerGetCompanyQueryKey(companyId),
      refetchInterval: 25 * 60 * 1000,
    },
  });

  const deactivate = useAdminControllerDeactivateCompany({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getAdminControllerGetCompanyQueryKey(companyId),
        });
        queryClient.invalidateQueries({
          queryKey: getAdminControllerListCompaniesQueryKey(),
        });
        toast.success("Company deactivated");
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const updatePreviewWidth = (nextWidth: number) => {
    const clampedWidth = Math.min(70, Math.max(30, nextWidth));
    setPreviewWidth(clampedWidth);
    window.localStorage.setItem(
      "iom-admin-company-preview-width",
      String(clampedWidth),
    );
  };

  const resizePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    updatePreviewWidth(((bounds.right - event.clientX) / bounds.width) * 100);
  };

  if (isLoading) {
    return (
      <PageContainer className="max-w-7xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (!data) return null;

  const { company, documents, verification, reviewHistory } = data;
  const cosmetic = company.cosmetic ?? {};
  const logoUrl =
    typeof (cosmetic as Record<string, unknown>).logo_url === "string"
      ? ((cosmetic as Record<string, unknown>).logo_url as string)
      : null;

  return (
    <PageContainer
      className={cn(
        documentPreview ? "max-w-none py-0 pr-0 sm:pr-0" : "max-w-7xl py-0",
      )}
    >
      <div
        className={cn(
          "relative min-h-[calc(100dvh-5rem-1px)] lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0 lg:overflow-hidden",
          documentPreview && "lg:grid",
        )}
        style={
          documentPreview
            ? { gridTemplateColumns: `${100 - previewWidth}% ${previewWidth}%` }
            : undefined
        }
      >
        <div className="min-w-0 space-y-3 py-5 pr-4 lg:h-full lg:overflow-y-auto lg:px-6">
          <button
            onClick={() => router.back()}
            className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Companies
          </button>

          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo name={company.registered_name} logoUrl={logoUrl} />
              <div className="min-w-0 flex-1">
                <h1 className="text-lg leading-tight font-semibold text-gray-900">
                  {company.registered_name}
                </h1>
                <div className="mt-1.5">
                  <VerificationBadge
                    status={verification.status}
                    isDeactivated={!!company.is_deactivated}
                  />
                </div>
              </div>
            </div>
          </div>

          {verification.status === "rejected" &&
            verification.rejectionReason && (
              <Card className="gap-1 border-destructive/30 bg-destructive/5 px-5 py-4">
                <p className="text-sm font-medium text-gray-900">
                  Rejection reason
                </p>
                <p className="text-muted-foreground text-sm">
                  {verification.rejectionReason}
                </p>
              </Card>
            )}

          <CollapsibleCardGroup
            type="multiple"
            defaultValue={["company-details", "documents", "review-history"]}
            variant="grouped"
          >
            <CollapsibleCardSection
              value="company-details"
              trigger="Company details"
              contentClassName="space-y-4 px-5 pb-5"
            >
              <Field
                label="Date joined"
                value={formatDateWithoutTime(company.created_at)}
              />
              <Field label="Email" value={company.email} />
              <Field label="TIN" value={company.tin} />
              <Field
                label="Company type"
                value={
                  company.company_type
                    ? (COMPANY_TYPE_LABELS[company.company_type] ??
                      company.company_type)
                    : null
                }
              />
              <Field
                label="Registered address"
                value={company.registered_address}
              />
              {cosmetic.description && (
                <Field label="Description" value={cosmetic.description} />
              )}
              {cosmetic.website && (
                <Field label="Website" value={cosmetic.website} />
              )}
              {cosmetic.phone && <Field label="Phone" value={cosmetic.phone} />}
              {cosmetic.industry && (
                <Field label="Industry" value={cosmetic.industry} />
              )}
            </CollapsibleCardSection>

            <CollapsibleCardSection
              value="documents"
              trigger="Documents"
              contentClassName="px-5 pb-5"
            >
              <div className="overflow-hidden rounded-[0.33em] border border-blue-100 bg-white">
                {DOC_TYPES_LIST.map(([type, label]) => {
                  const doc = documents.find((d) => d.type === type);
                  return (
                    <button
                      type="button"
                      key={type}
                      disabled={!doc?.url}
                      className="flex w-full flex-row items-center border-b border-gray-100 px-4 text-left duration-200 last:border-b-0 enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:cursor-default"
                      onClick={() =>
                        doc?.url &&
                        setDocumentPreview({
                          url: doc.url,
                          filename: doc.filename,
                          label,
                        })
                      }
                    >
                      {doc ? (
                        <CircleCheck className="text-supportive flex-shrink-0" />
                      ) : (
                        <CircleAlert className="text-warning flex-shrink-0" />
                      )}
                      <div className="flex flex-1 items-center gap-3 rounded-[0.16em] p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {label}
                          </p>
                          {doc && (
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">
                              {doc.filename}
                            </p>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CollapsibleCardSection>

            <CollapsibleCardSection
              value="review-history"
              trigger="Review history"
            >
              {reviewHistory.length === 0 ? (
                <p className="text-muted-foreground px-5 pb-5 text-sm">
                  No reviews yet.
                </p>
              ) : (
                <div className="overflow-x-auto px-5 pb-5">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 text-left">
                        <th className="pb-2 pr-4 font-medium text-gray-500">
                          Status
                        </th>
                        <th className="pb-2 pr-4 font-medium text-gray-500">
                          Submitted
                        </th>
                        <th className="pb-2 pr-4 font-medium text-gray-500">
                          Reviewed
                        </th>
                        <th className="pb-2 pr-4 font-medium text-gray-500">
                          Reviewer
                        </th>
                        <th className="pb-2 font-medium text-gray-500">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {reviewHistory.map((r) => (
                        <tr key={r.id} className="align-top">
                          <td className="py-2.5 pr-4">
                            {reviewStatusBadge(r.status)}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600">
                            {formatDateWithoutTime(r.created_at)}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600">
                            {r.reviewed_at
                              ? formatDateWithoutTime(r.reviewed_at)
                              : "—"}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600">
                            {r.reviewer_email ?? "—"}
                          </td>
                          <td className="py-2.5 text-gray-600">
                            {r.rejection_reason ??
                              (r.approval_expires_at
                                ? `Expires ${formatDateWithoutTime(r.approval_expires_at)}`
                                : "—")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CollapsibleCardSection>

            {!company.is_deactivated && (
              <CollapsibleCardSection value="actions" trigger="Actions">
                <div className="flex flex-col items-start justify-between gap-4 px-5 pb-5 sm:flex-row sm:items-center">
                  <p className="text-muted-foreground text-sm">
                    Deactivate this company to revoke its platform access and
                    prevent new MOA requests.
                  </p>
                  <Button
                    scheme="destructive"
                    size="sm"
                    className="shrink-0"
                    onClick={() =>
                      confirmAction.open({
                        title: `Deactivate ${company.registered_name}?`,
                        description:
                          "The company will lose access and can no longer request MOAs. This can be reversed later.",
                        confirmLabel: "Deactivate",
                        onConfirm: () => deactivate.mutate({ companyId }),
                        isPending: deactivate.isPending,
                      })
                    }
                  >
                    Deactivate
                  </Button>
                </div>
              </CollapsibleCardSection>
            )}
          </CollapsibleCardGroup>
        </div>

        {documentPreview && (
          <>
            <div
              role="separator"
              aria-label="Resize document preview pane"
              aria-orientation="vertical"
              aria-valuemin={30}
              aria-valuemax={70}
              aria-valuenow={Math.round(previewWidth)}
              tabIndex={0}
              className="group absolute top-0 bottom-0 z-30 hidden w-5 -translate-x-1/2 cursor-col-resize touch-none lg:block"
              style={{ left: `${100 - previewWidth}%` }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={resizePreview}
              onPointerUp={(event) =>
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") {
                  updatePreviewWidth(previewWidth + 2);
                }
                if (event.key === "ArrowRight") {
                  updatePreviewWidth(previewWidth - 2);
                }
              }}
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover:bg-primary group-focus:bg-primary" />
              <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors group-hover:border-primary group-focus:border-primary">
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setDocumentPreview(null)}
                  className="flex h-8 w-7 items-center justify-center border-b border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Close preview"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="flex h-10 w-7 items-center justify-center group-hover:text-primary group-focus:text-primary">
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </div>
            <DocumentPreviewPane
              url={documentPreview.url}
              filename={documentPreview.filename}
              label={documentPreview.label}
              zoomStorageKey="iom-admin-company-preview-zoom"
            />
          </>
        )}
      </div>
    </PageContainer>
  );
}
