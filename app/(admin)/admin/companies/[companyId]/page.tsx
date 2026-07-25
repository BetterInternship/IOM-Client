"use client";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft, CircleAlert, CircleCheck } from "lucide-react";

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

function verificationBadge(status: AdminCompanyDetailVerificationDtoStatus) {
  if (status === "verified")
    return (
      <Badge type="supportive" strength="medium">
        Verified
      </Badge>
    );
  if (status === "pending")
    return (
      <Badge type="warning" strength="medium">
        Pending review
      </Badge>
    );
  if (status === "rejected")
    return (
      <Badge type="destructive" strength="medium">
        Rejected
      </Badge>
    );
  if (status === "expired")
    return (
      <Badge type="destructive" strength="medium">
        Expired
      </Badge>
    );
  return (
    <Badge type="default" strength="medium">
      Incomplete
    </Badge>
  );
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
    <div className="flex items-start gap-4">
      <span className="w-44 flex-shrink-0 text-sm text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-900">
        {value || <span className="text-muted-foreground font-normal">—</span>}
      </span>
    </div>
  );
}

export default function AdminCompanyProfilePage() {
  const { companyId } = useParams<{ companyId: string }>();
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const { confirmAction } = useIomModalRegistry();

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

  if (isLoading) {
    return (
      <PageContainer className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-64 w-full" />
      </PageContainer>
    );
  }

  if (!data) return null;

  const { company, documents, verification, reviewHistory } = data;
  const cosmetic = company.cosmetic ?? {};

  return (
    <PageContainer className="max-w-2xl space-y-6">
      <div>
        <button
          onClick={() => router.back()}
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="h-4 w-4" /> Companies
        </button>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {company.registered_name}
            </h1>
            <p className="text-muted-foreground text-sm">
              Joined {formatDateWithoutTime(company.created_at)}
            </p>
            <div className="flex items-center gap-2 pt-0.5">
              {verificationBadge(verification.status)}
              {company.is_deactivated && (
                <Badge type="destructive" strength="medium">
                  Deactivated
                </Badge>
              )}
            </div>
          </div>
          {!company.is_deactivated && (
            <Button
              variant="outline"
              scheme="destructive"
              size="sm"
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
          )}
        </div>
      </div>

      {verification.status === "rejected" && verification.rejectionReason && (
        <Card className="gap-1 border-destructive/30 bg-destructive/5 px-5 py-4">
          <p className="text-sm font-medium text-gray-900">Rejection reason</p>
          <p className="text-muted-foreground text-sm">
            {verification.rejectionReason}
          </p>
        </Card>
      )}

      <Card className="gap-4 px-5 py-5">
        <p className="text-sm font-semibold text-gray-900">Company details</p>
        <div className="space-y-3">
          <Field label="Registered name" value={company.registered_name} />
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
        </div>
      </Card>

      <Card className="gap-4 py-5">
        <p className="px-5 text-sm font-semibold text-gray-900">Documents</p>
        <div className="space-y-1">
          {DOC_TYPES_LIST.map(([type, label]) => {
            const doc = documents.find((d) => d.type === type);
            return (
              <div
                key={type}
                className="flex flex-row items-center px-5 duration-200 hover:cursor-pointer hover:bg-gray-50"
                onClick={() =>
                  doc?.url &&
                  openModal(
                    "preview-doc",
                    <iframe
                      src={doc.url}
                      className="h-full w-full border-none"
                      title={doc.filename}
                    />,
                    {
                      title: doc.filename,
                      panelClassName: "!w-full sm:!max-w-4xl",
                      contentClassName:
                        "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                      showHeaderDivider: true,
                    },
                  )
                }
              >
                {doc ? (
                  <CircleCheck className="text-supportive flex-shrink-0" />
                ) : (
                  <CircleAlert className="text-warning flex-shrink-0" />
                )}
                <div className="flex flex-1 items-center gap-3 rounded-[0.16em] p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    {doc && (
                      <p className="text-muted-foreground mt-0.5 truncate text-xs">
                        {doc.filename}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="space-y-3">
        <p className="text-sm font-semibold text-gray-900">Review history</p>
        {reviewHistory.length === 0 ? (
          <p className="text-muted-foreground text-sm">No reviews yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left">
                <th className="pb-2 pr-4 font-medium text-gray-500">Status</th>
                <th className="pb-2 pr-4 font-medium text-gray-500">
                  Submitted
                </th>
                <th className="pb-2 pr-4 font-medium text-gray-500">
                  Reviewed
                </th>
                <th className="pb-2 pr-4 font-medium text-gray-500">
                  Reviewer
                </th>
                <th className="pb-2 font-medium text-gray-500">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reviewHistory.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="py-2.5 pr-4">{reviewStatusBadge(r.status)}</td>
                  <td className="py-2.5 pr-4 text-gray-600">
                    {formatDateWithoutTime(r.created_at)}
                  </td>
                  <td className="py-2.5 pr-4 text-gray-600">
                    {r.reviewed_at ? formatDateWithoutTime(r.reviewed_at) : "—"}
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
        )}
      </div>
    </PageContainer>
  );
}
