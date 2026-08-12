"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminControllerCompanyReviewDetailQueryKey,
  getAdminControllerCompanyReviewQueueQueryKey,
  getAdminControllerCompanyReviewQueueQueryOptions,
  getAdminControllerGetCompanyQueryKey,
  getAdminControllerListCompaniesQueryKey,
  getAdminControllerOverviewQueryKey,
  useAdminControllerApproveCompany,
  useAdminControllerCompanyReviewDetail,
  useAdminControllerRejectCompany,
} from "@/app/api";
import { PageContainer } from "@/components/page-header";
import { CompanyLogo } from "@/components/company-logo";
import { DocumentPreviewPane } from "@/components/document-preview-pane";
import { toastPresets } from "@/components/sonner-toaster";
import { Card, CardContent } from "@/components/ui/card";
import {
  CollapsibleCardGroup,
  CollapsibleCardSection,
} from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import { Button } from "@/components/ui/button";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { cn, formatDateWithoutTime } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  Eye,
  GripVertical,
  Loader2,
  X,
} from "lucide-react";

interface ReviewDoc {
  type: string;
  filename: string;
  url: string | null;
}

interface DocumentPreviewSelection {
  document: ReviewDoc;
  label: string;
}

type ReviewFieldDetails = Record<
  string,
  { type?: string; document?: string; value: string }
>;

interface HistoryEntry {
  id: string;
  status: "approved" | "rejected" | "superseded" | null;
  created_at: string;
  reviewed_at: string | null;
  approval_expires_at: string | null;
  reviewer_email: string | null;
  rejection_reason: string | null;
  document_review_details: ReviewFieldDetails;
  material: Record<string, string | null> | null;
  documents: ReviewDoc[];
}

interface ReviewDetail {
  company: {
    id: string;
    registered_name: string;
    email: string;
    company_type: string | null;
    cosmetic: { logo_url?: string | null } | null;
  };
  history: HistoryEntry[];
  openReviewId: string | null;
}

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

const COMPANY_TYPE_LABELS: Record<string, string> = {
  corporation: "Corporation",
  partnership: "Partnership",
  sole_proprietorship: "Sole Proprietorship",
  government_agency: "Government Agency",
};

function ReviewStatusBadge({ status }: { status: HistoryEntry["status"] }) {
  if (status === null) {
    return <PartnershipStatusBadge status="pending" label="Pending" />;
  }
  if (status === "approved") {
    return <PartnershipStatusBadge status="active" label="Approved" />;
  }
  if (status === "rejected") {
    return <PartnershipStatusBadge status="rejected" label="Rejected" />;
  }
  return <PartnershipStatusBadge status="inactive" label="Superseded" />;
}

const REVIEW_FIELDS = [
  {
    key: "Date of Incorporation",
    type: "date",
    document: "SEC/DTI Registration",
  },
  {
    key: "Company Registry Number",
    type: "text",
    document: "SEC/DTI Registration",
  },
] as const;

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const yearsFromToday = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return toDateInputValue(date);
};

function ReviewFieldsEditor({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-4 px-5 pb-5">
      {REVIEW_FIELDS.map((field) => (
        <DetailField
          key={field.key}
          label={<Label htmlFor={`review-${field.key}`}>{field.key}</Label>}
          labelClassName="sm:min-h-9"
        >
          {field.type === "date" ? (
            <DatePicker
              id={`review-${field.key}`}
              className="h-9 text-sm"
              value={values[field.key] ?? ""}
              onChange={(value) => onChange({ ...values, [field.key]: value })}
            />
          ) : (
            <Input
              id={`review-${field.key}`}
              type={field.type}
              className="h-9 text-sm"
              value={values[field.key] ?? ""}
              onChange={(event) =>
                onChange({ ...values, [field.key]: event.target.value })
              }
            />
          )}
        </DetailField>
      ))}
    </div>
  );
}

function reviewFieldsComplete(values: Record<string, string>): boolean {
  return REVIEW_FIELDS.every((f) => (values[f.key] ?? "").trim() !== "");
}

function buildReviewDetails(
  values: Record<string, string>,
): ReviewFieldDetails {
  const out: ReviewFieldDetails = {};
  for (const field of REVIEW_FIELDS) {
    out[field.key] = {
      type: field.type,
      document: field.document,
      value: values[field.key] ?? "",
    };
  }
  return out;
}

function DocumentsReadOnly({
  entry,
  openPreview,
}: {
  entry: HistoryEntry;
  openPreview: (url: string, title: string) => void;
}) {
  if (entry.documents.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
      {entry.documents.map((doc) => {
        const label = DOC_LABELS[doc.type] ?? doc.type.replace(/_/g, " ");
        return (
          <button
            key={doc.type}
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-50"
            onClick={() => doc.url && openPreview(doc.url, label)}
            disabled={!doc.url}
          >
            <span className="bg-primary/5 text-primary flex size-8 shrink-0 items-center justify-center rounded-[0.2em]">
              <Eye className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gray-900">
                {label}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {doc.filename}
              </span>
            </span>
            <span className="text-primary text-xs font-medium">
              {doc.url ? "View" : "Unavailable"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CompanyIdentity({
  name,
  email,
  logoUrl,
}: {
  name: string;
  email: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <CompanyLogo name={name} logoUrl={logoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg leading-tight font-semibold text-gray-900">
            {name}
          </h1>
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm">{email}</p>
      </div>
    </div>
  );
}

function PendingDocumentsContent({
  entry,
  onOpenDocument,
}: {
  entry: HistoryEntry;
  onOpenDocument: (document: ReviewDoc, label: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-[0.33em] border border-blue-100 bg-white">
      {Object.entries(DOC_LABELS).map(([type, label]) => {
        const document = entry.documents.find((item) => item.type === type);
        return (
          <button
            key={type}
            type="button"
            disabled={!document?.url}
            onClick={() => document?.url && onOpenDocument(document, label)}
            className="flex w-full items-center border-b border-gray-100 px-4 text-left transition-colors last:border-b-0 enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:cursor-default"
          >
            {document ? (
              <CircleCheck className="text-supportive shrink-0" />
            ) : (
              <CircleAlert className="text-warning shrink-0" />
            )}
            <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[0.16em] p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{label}</p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {document
                    ? document.filename
                    : "Not included with this request"}
                </p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function MaterialFields({ entry }: { entry: HistoryEntry }) {
  if (!entry.material) return null;
  const fields = Object.entries(entry.material).filter(
    (field): field is [string, string] => field[1] !== null && field[1] !== "",
  );
  if (fields.length === 0) return null;
  return (
    <div className="space-y-4 px-5 pb-5">
      {fields.map(([key, value]) => (
        <DetailField
          key={key}
          label={key.replace(/_/g, " ")}
          labelClassName="capitalize"
        >
          <p className="flex min-h-8 min-w-0 items-center break-words text-sm font-medium text-gray-900">
            {key === "company_type"
              ? (COMPANY_TYPE_LABELS[value] ?? value)
              : value}
          </p>
        </DetailField>
      ))}
    </div>
  );
}

function CompactHistorySection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  if (!rows.length) return null;
  return (
    <section>
      <h3 className="border-y border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-700 uppercase first:border-t-0">
        {title}
      </h3>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-1 border-b border-gray-100 px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(9rem,35%)_1fr] sm:items-center sm:gap-4"
          >
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd className="break-words text-sm font-medium text-gray-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PastReviewContent({
  entry,
  openPreview,
}: {
  entry: HistoryEntry;
  openPreview: (url: string, title: string) => void;
}) {
  const companyRows = Object.entries(entry.material ?? {})
    .filter((field): field is [string, string] => !!field[1])
    .map(([key, value]) => ({
      label: key.replace(/_/g, " "),
      value:
        key === "company_type" ? (COMPANY_TYPE_LABELS[value] ?? value) : value,
    }));
  const reviewRows = Object.entries(entry.document_review_details ?? {})
    .filter(([, field]) => !!field.value)
    .map(([key, field]) => ({ label: key, value: field.value }));
  const decisionRows = [
    { label: "Reviewed by", value: entry.reviewer_email ?? "Not reviewed" },
    {
      label: "Decision date",
      value: entry.reviewed_at
        ? formatDateWithoutTime(entry.reviewed_at)
        : "Not reviewed",
    },
    ...(entry.approval_expires_at
      ? [
          {
            label: "Approval expiry",
            value: formatDateWithoutTime(entry.approval_expires_at),
          },
        ]
      : []),
    ...(entry.rejection_reason
      ? [{ label: "Rejection reason", value: entry.rejection_reason }]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
        <CompactHistorySection title="Decision" rows={decisionRows} />
        <CompactHistorySection title="Company details" rows={companyRows} />
        <CompactHistorySection title="Review details" rows={reviewRows} />
      </div>

      {entry.documents.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
          <DocumentsReadOnly entry={entry} openPreview={openPreview} />
        </section>
      )}
    </div>
  );
}

function RejectCompanyForm({
  companyName,
  onReject,
}: {
  companyName: string;
  onReject: (reason: string) => Promise<unknown>;
}) {
  const { closeModal } = useModal();
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rejectCompany = async () => {
    setIsSubmitting(true);
    try {
      await onReject(reason);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {companyName} will be asked to update their details. The reason is
        emailed to the company.
      </p>
      <Textarea
        rows={3}
        placeholder="Reason (optional — emailed to the company)"
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={isSubmitting}
          onClick={() => closeModal("reject-company")}
        >
          Cancel
        </Button>
        <Button
          scheme="destructive"
          disabled={isSubmitting}
          onClick={rejectCompany}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminCompanyReviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const { confirmAction } = useIomModalRegistry();
  const [reviewValues, setReviewValues] = useState<Record<string, string>>({});
  const [approvalExpiresAt, setApprovalExpiresAt] = useState("");
  const [documentPreview, setDocumentPreview] =
    useState<DocumentPreviewSelection | null>(null);
  const [previewWidth, setPreviewWidth] = useState(50);
  const prefetchedReviewId = useRef<string | null>(null);

  useEffect(() => {
    const savedWidth = Number(
      window.localStorage.getItem("iom-admin-review-preview-width"),
    );
    if (savedWidth >= 30 && savedWidth <= 70) setPreviewWidth(savedWidth);
  }, []);

  const { data, isLoading, refetch } =
    useAdminControllerCompanyReviewDetail<ReviewDetail>(companyId, {
      query: {
        queryKey: getAdminControllerCompanyReviewDetailQueryKey(companyId),
        enabled: !!companyId,
        refetchInterval: 25 * 60 * 1000,
      },
    });

  const invalidate = () => {
    refetch();
    queryClient.invalidateQueries({
      queryKey: getAdminControllerCompanyReviewQueueQueryKey(),
    });
  };

  const onConflict = (e: Error) => {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 409) {
      toast.message("This review changed — reloading");
      invalidate();
      return true;
    }
    return false;
  };

  const approve = useAdminControllerApproveCompany({
    mutation: {
      onSuccess: async () => {
        toast("Company verified", toastPresets.success);
        confirmAction.close();
        setReviewValues({});
        setApprovalExpiresAt("");

        await queryClient.invalidateQueries({
          queryKey: getAdminControllerCompanyReviewQueueQueryKey(),
          exact: true,
          refetchType: "none",
        });

        const [queueResult] = await Promise.allSettled([
          queryClient.fetchQuery(
            getAdminControllerCompanyReviewQueueQueryOptions(),
          ),
          queryClient.refetchQueries({
            queryKey: getAdminControllerOverviewQueryKey(),
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: getAdminControllerListCompaniesQueryKey(),
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: getAdminControllerGetCompanyQueryKey(companyId),
            exact: true,
          }),
        ]);

        const hasNoPendingReviews =
          queueResult.status === "fulfilled" &&
          queueResult.value.reviews.length === 0;
        router.replace(hasNoPendingReviews ? "/companies" : "/reviews");
      },
      onError: (e: Error) => {
        if (!onConflict(e)) toast.error(e.message);
      },
    },
  });

  const reject = useAdminControllerRejectCompany({
    mutation: {
      onSuccess: () => {
        toast.success("Company review rejected");
        closeModal("reject-company");
        invalidate();
      },
      onError: (e: Error) => {
        if (!onConflict(e)) toast.error(e.message);
      },
    },
  });

  const { openEntry, pastEntries } = useMemo(() => {
    const visible = (data?.history ?? []).filter(
      (h) => h.status !== "superseded",
    );
    const open = data?.openReviewId
      ? visible.find((h) => h.id === data.openReviewId)
      : undefined;
    const past = visible.filter((h) => h.id !== data?.openReviewId);
    return { openEntry: open ?? null, pastEntries: past };
  }, [data]);

  useEffect(() => {
    if (!openEntry || prefetchedReviewId.current === openEntry.id) return;
    prefetchedReviewId.current = openEntry.id;
    const priorApproval = data?.history.find(
      (entry) => entry.status === "approved",
    );
    setReviewValues(
      Object.fromEntries(
        REVIEW_FIELDS.map((field) => [
          field.key,
          priorApproval?.document_review_details?.[field.key]?.value ?? "",
        ]),
      ),
    );
    setApprovalExpiresAt("");
  }, [data?.history, openEntry]);

  const canApprove = openEntry
    ? reviewFieldsComplete(reviewValues) && !!approvalExpiresAt
    : false;

  const updatePreviewWidth = (nextWidth: number) => {
    const clampedWidth = Math.min(70, Math.max(30, nextWidth));
    setPreviewWidth(clampedWidth);
    window.localStorage.setItem(
      "iom-admin-review-preview-width",
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
      <PageContainer className="max-w-3xl space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </PageContainer>
    );
  }
  if (!data?.company) {
    return (
      <PageContainer className="max-w-3xl">
        <Card>
          <CardContent className="text-destructive py-8 text-center text-sm">
            Company not found.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!openEntry) {
    return router.push("/reviews");
  }

  const { company } = data;

  return (
    <PageContainer
      className={cn(
        documentPreview ? "max-w-none py-0 pr-0 sm:pr-0" : "max-w-3xl py-0",
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
          <Link
            href="/reviews"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Company Reviews
          </Link>

          <CompanyIdentity
            name={company.registered_name}
            email={company.email}
            logoUrl={company.cosmetic?.logo_url}
          />
          <p className="text-muted-foreground text-sm">
            Submitted {formatDateWithoutTime(openEntry.created_at)}
          </p>

          <CollapsibleCardGroup
            type="multiple"
            defaultValue={[
              ...(openEntry.material ? ["submitted-details"] : []),
              "documents",
              "review-details",
            ]}
            variant="grouped"
          >
            {openEntry.material && (
              <CollapsibleCardSection
                value="submitted-details"
                trigger="Company details"
                triggerClassName="hover:bg-gray-50"
              >
                <MaterialFields entry={openEntry} />
              </CollapsibleCardSection>
            )}

            <CollapsibleCardSection
              value="documents"
              trigger="Documents"
              triggerClassName="hover:bg-gray-50"
              contentClassName="px-5 pb-5"
            >
              <PendingDocumentsContent
                entry={openEntry}
                onOpenDocument={(document, label) =>
                  setDocumentPreview({ document, label })
                }
              />
            </CollapsibleCardSection>

            {pastEntries.length > 0 && (
              <CollapsibleCardSection
                value="previous-requests"
                trigger={
                  <span className="flex w-full items-center justify-between gap-3 pr-2">
                    <span>Previous requests</span>
                    <span className="bg-gray-100 text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                      {pastEntries.length}
                    </span>
                  </span>
                }
                triggerClassName="items-center hover:bg-gray-50 [&>svg]:translate-y-0"
                contentClassName="px-5 pb-5"
              >
                <CollapsibleCardGroup
                  type="single"
                  collapsible
                  variant="separate"
                  className="space-y-3"
                >
                  {pastEntries.map((entry) => (
                    <CollapsibleCardSection
                      key={entry.id}
                      value={entry.id}
                      triggerClassName="items-center px-4 py-3.5 [&>svg]:translate-y-0"
                      contentClassName="border-t border-gray-200 px-4 pt-4 pb-4"
                      trigger={
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 pr-2 text-left">
                          <ReviewStatusBadge status={entry.status} />
                          <span className="text-sm font-semibold text-gray-900">
                            {formatDateWithoutTime(entry.created_at)}
                          </span>
                        </span>
                      }
                    >
                      <PastReviewContent
                        entry={entry}
                        openPreview={(url, title) => {
                          const document = entry.documents.find(
                            (item) => item.url === url,
                          );
                          if (document) {
                            setDocumentPreview({ document, label: title });
                          }
                        }}
                      />
                    </CollapsibleCardSection>
                  ))}
                </CollapsibleCardGroup>
              </CollapsibleCardSection>
            )}

            <CollapsibleCardSection
              value="review-details"
              trigger="Review details"
              triggerClassName="hover:bg-gray-50"
            >
              <ReviewFieldsEditor
                values={reviewValues}
                onChange={setReviewValues}
              />
              <DetailField
                label={
                  <Label htmlFor="approval-expires">Approval expires on</Label>
                }
                labelClassName="sm:min-h-9"
                className="px-5 pb-5"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <DatePicker
                    id="approval-expires"
                    className="h-9 text-sm"
                    value={approvalExpiresAt}
                    onChange={setApprovalExpiresAt}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setApprovalExpiresAt(yearsFromToday(1))}
                    >
                      +1 year
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setApprovalExpiresAt(yearsFromToday(3))}
                    >
                      +3 years
                    </Button>
                  </div>
                </div>
              </DetailField>
            </CollapsibleCardSection>
          </CollapsibleCardGroup>

          <div className="flex justify-end gap-3">
            <Button
              scheme="destructive"
              onClick={() =>
                openModal(
                  "reject-company",
                  <RejectCompanyForm
                    companyName={company.registered_name}
                    onReject={(reason) =>
                      reject.mutateAsync({
                        companyId,
                        data: { reason: reason || undefined },
                      })
                    }
                  />,
                  {
                    title: "Reject verification",
                    panelClassName: "!w-full sm:!max-w-md",
                  },
                )
              }
            >
              <X /> Reject
            </Button>
            <Button
              scheme="supportive"
              disabled={approve.isPending || !canApprove}
              onClick={() =>
                confirmAction.open({
                  title: `Verify ${company.registered_name}?`,
                  description:
                    "The company will be able to request MOAs from any university and is emailed a confirmation.",
                  confirmLabel: "Approve",
                  onConfirm: () =>
                    approve.mutate({
                      companyId,
                      data: {
                        document_review_details:
                          buildReviewDetails(reviewValues),
                        approval_expires_at: approvalExpiresAt,
                      },
                    }),
                  isPending: approve.isPending,
                })
              }
            >
              {approve.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Approve
            </Button>
          </div>
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
              url={documentPreview.document.url!}
              filename={documentPreview.document.filename}
              label={documentPreview.label}
              zoomStorageKey="iom-admin-review-preview-zoom"
            />
          </>
        )}
      </div>
    </PageContainer>
  );
}
