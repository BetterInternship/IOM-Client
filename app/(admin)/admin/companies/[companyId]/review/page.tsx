"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminControllerCompanyReviewDetailQueryKey,
  getAdminControllerCompanyReviewQueueQueryKey,
  useAdminControllerApproveCompany,
  useAdminControllerCompanyReviewDetail,
  useAdminControllerRejectCompany,
} from "@/app/api";
import { PageContainer } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft, Check, Eye, Loader2, X } from "lucide-react";

interface ReviewDoc {
  type: string;
  filename: string;
  url: string | null;
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
  };
  history: HistoryEntry[];
  openReviewId: string | null;
}

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

function ReviewStatusBadge({ status }: { status: HistoryEntry["status"] }) {
  if (status === null) return <Badge type="warning">Pending</Badge>;
  if (status === "approved") return <Badge type="supportive">Approved</Badge>;
  if (status === "rejected") return <Badge type="destructive">Rejected</Badge>;
  return <Badge type="default">{status}</Badge>;
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

function ReviewFieldsEditor({
  values,
  onChange,
}: {
  values: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="approval-expires" className="text-md">
        Review Details
      </Label>
      <div className="divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
        {REVIEW_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center gap-4 px-3 py-2.5">
            <Label className="text-muted-foreground w-52 flex-shrink-0 text-xs font-normal">
              {field.key}
            </Label>
            <Input
              type={field.type}
              className="h-8 text-xs"
              value={values[field.key] ?? ""}
              onChange={(e) =>
                onChange({ ...values, [field.key]: e.target.value })
              }
            />
          </div>
        ))}
      </div>
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
    <div className="divide-y divide-gray-100 rounded-[0.16em] border border-gray-200 bg-gray-50">
      {entry.documents.map((doc) => {
        const label = DOC_LABELS[doc.type] ?? doc.type.replace(/_/g, " ");
        const isImage = /\.(png|jpe?g|gif|webp)$/i.test(doc.filename);
        return (
          <button
            key={doc.type}
            className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-gray-100 disabled:cursor-default disabled:opacity-50 bg-gray-50"
            onClick={() => doc.url && openPreview(doc.url, label)}
            disabled={!doc.url}
          >
            <Eye className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900">
              View {label}
            </span>
            {!doc.url && (
              <span className="text-muted-foreground ml-auto text-xs">
                Unavailable
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function MaterialFields({ entry }: { entry: HistoryEntry }) {
  if (!entry.material) return null;
  const fields = Object.entries(entry.material).filter(
    ([, v]) => v !== null && v !== "",
  );
  if (fields.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
      {fields.map(([key, value]) => (
        <div key={key} className="flex items-start gap-4 px-3 py-2">
          <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">
            {key.replace(/_/g, " ")}
          </p>
          <p className="min-w-0 flex-1 text-sm text-gray-900">{value}</p>
        </div>
      ))}
    </div>
  );
}

function ReviewFieldsReadOnly({ details }: { details: ReviewFieldDetails }) {
  const entries = Object.entries(details).filter(([, v]) => v.value);
  if (entries.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
      {entries.map(([key, field]) => (
        <div key={key} className="flex items-start gap-4 px-3 py-2">
          <p className="text-muted-foreground w-52 flex-shrink-0 text-xs">
            {key}
          </p>
          <p className="min-w-0 flex-1 text-sm font-medium text-gray-900">
            {field.value}
          </p>
        </div>
      ))}
    </div>
  );
}

const pastColumns: Array<ResourceTableColumn<HistoryEntry>> = [
  {
    id: "status",
    header: "Status",
    sortable: false,
    render: (entry) => <ReviewStatusBadge status={entry.status} />,
  },
  {
    id: "requested",
    header: "Request date",
    getSortValue: (entry) => entry.created_at,
    render: (entry) => (
      <span className="text-muted-foreground text-sm">
        {formatDateWithoutTime(entry.created_at)}
      </span>
    ),
  },
  {
    id: "reviewer",
    header: "Reviewer",
    getSortValue: (entry) => entry.reviewer_email ?? "—",
    render: (entry) => (
      <span className="text-sm">{entry.reviewer_email ?? "—"}</span>
    ),
  },
];

function DocPreviewContent({ url, title }: { url: string; title: string }) {
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(url);
  if (isImage) {
    return (
      <img src={url} alt={title} className="h-full w-full object-contain" />
    );
  }
  return (
    <iframe src={url} className="h-full w-full border-none" title={title} />
  );
}

export default function AdminCompanyReviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const { confirmAction } = useIomModalRegistry();
  const [reason, setReason] = useState("");
  const [reviewValues, setReviewValues] = useState<Record<string, string>>({});
  const [approvalExpiresAt, setApprovalExpiresAt] = useState("");
  const [selectedPast, setSelectedPast] = useState<HistoryEntry | null>(null);

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
      onSuccess: () => {
        toast.success("Company verified");
        setReviewValues({});
        setApprovalExpiresAt("");
        invalidate();
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
        setReason("");
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

  const canApprove = openEntry
    ? reviewFieldsComplete(reviewValues) && !!approvalExpiresAt
    : false;

  const pastTable = useResourceTable({
    data: pastEntries,
    getRowId: (entry) => entry.id,
    columns: pastColumns,
    sort: { initialColumn: "requested", initialDirection: "asc" },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50, 100] },
  });

  const openPastReview = (entry: HistoryEntry) => {
    setSelectedPast(entry);
    const label = entry.status === "approved" ? "Approved" : "Reviewed";
    openModal(
      "past-review",
      <div className="space-y-4">
        {entry.rejection_reason && (
          <p className="text-destructive text-xs">
            Reason: {entry.rejection_reason}
          </p>
        )}
        {entry.approval_expires_at && (
          <p className="text-muted-foreground text-xs">
            Approval expires: {formatDateWithoutTime(entry.approval_expires_at)}
          </p>
        )}
        <MaterialFields entry={entry} />
        <DocumentsReadOnly
          entry={entry}
          openPreview={(url, title) =>
            openModal(
              "preview-doc",
              <DocPreviewContent url={url} title={title} />,
              {
                title,
                panelClassName: "!w-full sm:!max-w-4xl",
                contentClassName: "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                showHeaderDivider: true,
              },
            )
          }
        />
        <ReviewFieldsReadOnly details={entry.document_review_details ?? {}} />
      </div>,
      {
        title: (
          <div className="flex items-center gap-2">
            <ReviewStatusBadge status={entry.status} />
            <span>Request — {formatDateWithoutTime(entry.created_at)}</span>
          </div>
        ),
        description: entry.reviewed_at
          ? `${label} by ${entry.reviewer_email ?? "—"} on ${formatDateWithoutTime(entry.reviewed_at)}`
          : undefined,
        panelClassName: "!w-full sm:!max-w-lg",
      },
    );
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
    <PageContainer className="max-w-3xl space-y-6">
      <Link
        href="/reviews"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Company Reviews
      </Link>

      <div>
        <h1 className="flex flex-row items-center gap-2 text-xl font-semibold text-gray-900">
          {company.registered_name}
          <ReviewStatusBadge status={openEntry.status} />
        </h1>
        <p className="text-muted-foreground mt-0.5 text-sm">{company.email}</p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Submitted {formatDateWithoutTime(openEntry.created_at)}
        </p>
      </div>

      {/* Pending review */}
      {openEntry ? (
        <>
          <DocumentsReadOnly
            entry={openEntry}
            openPreview={(url, title) =>
              openModal(
                "preview-doc",
                <DocPreviewContent url={url} title={title} />,
                {
                  title,
                  panelClassName: "!w-full sm:!max-w-4xl",
                  contentClassName: "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                  showHeaderDivider: true,
                },
              )
            }
          />
          <br />
          <ReviewFieldsEditor
            values={reviewValues}
            onChange={setReviewValues}
          />
          <div className="space-y-1.5">
            <Label htmlFor="approval-expires" className="text-md">
              Approval expires on
            </Label>
            <DatePicker
              id="approval-expires"
              className="h-8 text-xs"
              value={approvalExpiresAt}
              onChange={setApprovalExpiresAt}
            />
          </div>
          <div className="flex gap-3 border-t border-gray-100 pt-4">
            <Button
              scheme="supportive"
              className="flex-1"
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
            <Button
              variant="outline"
              scheme="destructive"
              className="flex-1"
              onClick={() =>
                openModal(
                  "reject-company",
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                      {company.registered_name} will be asked to update their
                      details. The reason is emailed to the company.
                    </p>
                    <textarea
                      rows={3}
                      placeholder="Reason (optional — emailed to the company)"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full rounded-[0.33em] border border-gray-200 p-2 text-sm"
                    />
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => closeModal("reject-company")}
                      >
                        Cancel
                      </Button>
                      <Button
                        scheme="destructive"
                        disabled={reject.isPending}
                        onClick={() =>
                          reject.mutate({
                            companyId,
                            data: { reason: reason || undefined },
                          })
                        }
                      >
                        {reject.isPending && (
                          <Loader2 className="animate-spin" />
                        )}
                        {reject.isPending ? "Rejecting…" : "Reject"}
                      </Button>
                    </div>
                  </div>,
                  {
                    title: "Reject verification",
                    panelClassName: "!w-full sm:!max-w-md",
                  },
                )
              }
            >
              <X /> Reject
            </Button>
          </div>
        </>
      ) : !pastEntries.length ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No review history yet.
          </CardContent>
        </Card>
      ) : null}

      {/* Past requests table */}
      {pastEntries.length > 0 && (
        <Accordion type="single" collapsible>
          <AccordionItem value="past" className="border-none">
            <AccordionPrimitive.Header>
              <AccordionPrimitive.Trigger className="font-normal text-primary cursor-pointer py-1 text-sm outline-none underline">
                Previous requests
              </AccordionPrimitive.Trigger>
            </AccordionPrimitive.Header>
            <br />
            <AccordionContent className="pb-0">
              <ResourceTable
                table={pastTable}
                emptyState={{ title: "No previous requests." }}
                noResultsState={{ title: "No matching requests." }}
                rowLabelSingular="request"
                rowLabelPlural="requests"
                onRowClick={openPastReview}
                renderMobileRow={(entry) => (
                  <button
                    type="button"
                    onClick={() => openPastReview(entry)}
                    className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.035] focus-visible:outline-none"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <ReviewStatusBadge status={entry.status} />
                      <span className="text-muted-foreground text-xs">
                        {formatDateWithoutTime(entry.created_at)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm">
                      {entry.reviewer_email ?? "—"}
                    </p>
                  </button>
                )}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}
    </PageContainer>
  );
}
