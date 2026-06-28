"use client";
import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ColumnDef } from "@tanstack/react-table";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import {
  Accordion,
  AccordionItem,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogBottomSheet,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft, Check, Eye, Loader2, X } from "lucide-react";

interface ReviewDoc {
  type: string;
  filename: string;
  url: string | null;
}

type ReviewFieldDetails = Record<string, { type?: string; document?: string; value: string }>;

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
  { key: "Date of Incorporation", type: "date", document: "SEC/DTI Registration" },
  { key: "Company Registry Number", type: "text", document: "SEC/DTI Registration" },
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
              className="h-7 text-xs"
              value={values[field.key] ?? ""}
              onChange={(e) => onChange({ ...values, [field.key]: e.target.value })}
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

function buildReviewDetails(values: Record<string, string>): ReviewFieldDetails {
  const out: ReviewFieldDetails = {};
  for (const field of REVIEW_FIELDS) {
    out[field.key] = { type: field.type, document: field.document, value: values[field.key] ?? "" };
  }
  return out;
}

function DocumentsReadOnly({ entry }: { entry: HistoryEntry }) {
  const [previewDoc, setPreviewDoc] = useState<ReviewDoc | null>(null);
  if (entry.documents.length === 0) return null;
  const isImage = (filename: string) => /\.(png|jpe?g|gif|webp)$/i.test(filename);
  return (
    <>
      <div className="divide-y divide-gray-100 rounded-[0.16em] border border-gray-200 bg-gray-50">
        {entry.documents.map((doc) => (
          <button
            key={doc.type}
            className="flex w-full cursor-pointer items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-gray-100 disabled:cursor-default disabled:opacity-50 bg-gray-50"
            onClick={() => setPreviewDoc(doc)}
            disabled={!doc.url}
          >
            <Eye className="text-muted-foreground h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-sm font-medium text-gray-900">
              View {DOC_LABELS[doc.type] ?? doc.type.replace(/_/g, " ")}
            </span>
            {!doc.url && (
              <span className="text-muted-foreground ml-auto text-xs">Unavailable</span>
            )}
          </button>
        ))}
      </div>

      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogBottomSheet className="flex h-[88vh] flex-col p-0">
          <div className="flex items-center border-b border-gray-100 px-5 py-3.5 pr-14">
            <DialogTitle className="text-sm font-medium text-gray-900">
              {previewDoc
                ? (DOC_LABELS[previewDoc.type] ?? previewDoc.type.replace(/_/g, " "))
                : ""}
            </DialogTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {previewDoc?.url &&
              (isImage(previewDoc.filename) ? (
                <img
                  src={previewDoc.url}
                  alt={DOC_LABELS[previewDoc.type] ?? previewDoc.type}
                  className="h-full w-full object-contain"
                />
              ) : (
                <iframe
                  src={previewDoc.url}
                  className="h-full w-full border-none"
                  title={DOC_LABELS[previewDoc.type] ?? previewDoc.type}
                />
              ))}
          </div>
        </DialogBottomSheet>
      </Dialog>
    </>
  );
}

function MaterialFields({ entry }: { entry: HistoryEntry }) {
  if (!entry.material) return null;
  const fields = Object.entries(entry.material).filter(([, v]) => v !== null && v !== "");
  if (fields.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
      {fields.map(([key, value]) => (
        <div key={key} className="flex items-start gap-4 px-3 py-2">
          <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">{key.replace(/_/g, " ")}</p>
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
          <p className="text-muted-foreground w-52 flex-shrink-0 text-xs">{key}</p>
          <p className="min-w-0 flex-1 text-sm font-medium text-gray-900">{field.value}</p>
        </div>
      ))}
    </div>
  );
}

const pastColumns: ColumnDef<HistoryEntry>[] = [
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => <ReviewStatusBadge status={row.original.status} />,
  },
  {
    id: "requested",
    header: "Request date",
    accessorFn: (row) => row.created_at,
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {formatDateWithoutTime(row.original.created_at)}
      </span>
    ),
  },
  {
    id: "reviewer",
    header: "Reviewer",
    accessorFn: (row) => row.reviewer_email ?? "—",
    cell: ({ row }) => (
      <span className="text-sm">{row.original.reviewer_email ?? "—"}</span>
    ),
  },
];

export default function AdminCompanyReviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");
  const [reviewValues, setReviewValues] = useState<Record<string, string>>({});
  const [approvalExpiresAt, setApprovalExpiresAt] = useState("");
  const [selectedPast, setSelectedPast] = useState<HistoryEntry | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-company-review", companyId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/companies/${companyId}/review`)
        .then((r) => r.data as ReviewDetail),
    enabled: !!companyId,
  });

  const invalidate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["admin-company-reviews"] });
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

  const approve = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post(`/api/admin/companies/${companyId}/approve`, {
        document_review_details: buildReviewDetails(reviewValues),
        approval_expires_at: approvalExpiresAt,
      }),
    onSuccess: () => {
      toast.success("Company verified");
      setReviewValues({});
      setApprovalExpiresAt("");
      invalidate();
    },
    onError: (e: Error) => {
      if (!onConflict(e)) toast.error(e.message);
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post(`/api/admin/companies/${companyId}/reject`, {
        reason: reason || undefined,
      }),
    onSuccess: () => {
      toast.success("Company review rejected");
      setShowReject(false);
      setReason("");
      invalidate();
    },
    onError: (e: Error) => {
      if (!onConflict(e)) toast.error(e.message);
    },
  });

  const { openEntry, pastEntries } = useMemo(() => {
    const visible = (data?.history ?? []).filter((h) => h.status !== "superseded");
    const open = data?.openReviewId ? visible.find((h) => h.id === data.openReviewId) : undefined;
    const past = visible.filter((h) => h.id !== data?.openReviewId);
    return { openEntry: open ?? null, pastEntries: past };
  }, [data]);

  const canApprove = openEntry
    ? reviewFieldsComplete(reviewValues) && !!approvalExpiresAt
    : false;

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
    return router.push('/reviews')
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
        <p className="text-muted-foreground mt-0.5 text-sm">
          {company.email}
        </p>
        <p className="text-muted-foreground mt-0.5 text-sm">
          Submitted {formatDateWithoutTime(openEntry.created_at)}
        </p>
      </div>

      {/* Pending review */}
      {openEntry ? (
        <>
          <DocumentsReadOnly entry={openEntry} />
          <br />
          <ReviewFieldsEditor values={reviewValues} onChange={setReviewValues} />
          <div className="space-y-1.5">
            <Label htmlFor="approval-expires" className="text-md">
              Approval expires on
            </Label>
            <Input
              id="approval-expires"
              type="date"
              className="h-8 text-xs"
              value={approvalExpiresAt}
              onChange={(e) => setApprovalExpiresAt(e.target.value)}
            />
          </div>
          <div className="flex gap-3 border-t border-gray-100 pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  scheme="supportive"
                  className="flex-1"
                  disabled={approve.isPending || !canApprove}
                >
                  {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                  Approve
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Verify {company.registered_name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The company will be able to request MOAs from any university and is emailed a
                    confirmation.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-supportive text-supportive-foreground hover:bg-supportive/90"
                    onClick={() => approve.mutate()}
                  >
                    Approve
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              variant="outline"
              scheme="destructive"
              className="flex-1"
              onClick={() => setShowReject(true)}
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
              <DataTable
                id="past-reviews"
                columns={pastColumns}
                data={pastEntries}
                enableSearch={false}
                rowLabelSingular="request"
                rowLabelPlural="requests"
                onRowClick={(entry) => setSelectedPast(entry)}
              />
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* Past request detail modal */}
      <Dialog open={!!selectedPast} onOpenChange={(o) => !o && setSelectedPast(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReviewStatusBadge status={selectedPast?.status ?? null} />
              <span>
                Request — {selectedPast ? formatDateWithoutTime(selectedPast.created_at) : ""}
              </span>
            </DialogTitle>
            {selectedPast?.reviewed_at && (
              <DialogDescription>
                {selectedPast.status === "approved" ? "Approved" : "Reviewed"} by{" "}
                {selectedPast.reviewer_email ?? "—"} on{" "}
                {formatDateWithoutTime(selectedPast.reviewed_at)}
              </DialogDescription>
            )}
          </DialogHeader>
          {selectedPast && (
            <div className="space-y-4">
              {selectedPast.rejection_reason && (
                <p className="text-destructive text-xs">
                  Reason: {selectedPast.rejection_reason}
                </p>
              )}
              {selectedPast.approval_expires_at && (
                <p className="text-muted-foreground text-xs">
                  Approval expires: {formatDateWithoutTime(selectedPast.approval_expires_at)}
                </p>
              )}
              <MaterialFields entry={selectedPast} />
              <DocumentsReadOnly entry={selectedPast} />
              <ReviewFieldsReadOnly details={selectedPast.document_review_details ?? {}} />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog
        open={showReject}
        onOpenChange={(o) => {
          setShowReject(o);
          if (!o) setReason("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject verification</DialogTitle>
            <DialogDescription>
              {company.registered_name} will be asked to update their details. The reason is emailed to
              the company.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Reason (optional — emailed to the company)"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReject(false)}>
              Cancel
            </Button>
            <Button
              scheme="destructive"
              disabled={reject.isPending}
              onClick={() => reject.mutate()}
            >
              {reject.isPending && <Loader2 className="animate-spin" />}
              {reject.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
