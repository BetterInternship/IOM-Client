"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
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
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft, Check, Loader2, X } from "lucide-react";

interface ReviewDoc {
  type: string;
  filename: string;
  url: string | null;
}

interface HistoryEntry {
  id: string;
  status: "approved" | "rejected" | "superseded" | null;
  created_at: string;
  reviewed_at: string | null;
  reviewer_email: string | null;
  rejection_reason: string | null;
  material: Record<string, string | null> | null;
  documents: ReviewDoc[];
}

interface ReviewDetail {
  company: {
    id: string;
    display_name: string;
    registered_name: string | null;
    rep_email: string;
    company_type: string | null;
  };
  history: HistoryEntry[];
  openReviewId: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  registered_name: "Legal name",
  company_type: "Company type",
  registered_address: "Address",
  rep_name: "Representative name",
  rep_title: "Representative title",
};

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  or_registration: "OR Registration",
  sec_dti_registration: "SEC/DTI Registration",
};

function ReviewStatusBadge({ status }: { status: HistoryEntry["status"] }) {
  if (status === null) return <Badge type="warning">Pending</Badge>;
  if (status === "approved") return <Badge type="supportive">Approved</Badge>;
  if (status === "rejected") return <Badge type="destructive">Rejected</Badge>;
  return <Badge type="default">{status}</Badge>;
}

function MaterialFields({ entry }: { entry: HistoryEntry }) {
  return (
    <div className="divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
      {Object.entries(FIELD_LABELS).map(([key, label]) => (
        <div key={key} className="flex items-start gap-4 px-3 py-2">
          <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">{label}</p>
          <p className="min-w-0 flex-1 text-sm font-medium text-gray-900">
            {entry.material?.[key]
              ? key === "company_type"
                ? entry.material[key]!.replace(/_/g, " ")
                : entry.material[key]
              : "—"}
          </p>
        </div>
      ))}
    </div>
  );
}

function DocumentsList({ entry }: { entry: HistoryEntry }) {
  if (entry.documents.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100 rounded-[0.33em] border border-gray-200">
      {entry.documents.map((doc, i) => (
        <div key={i} className="flex items-center gap-4 px-3 py-2">
          <span className="text-muted-foreground w-44 flex-shrink-0 text-xs">
            {DOC_LABELS[doc.type] ?? doc.type}
          </span>
          <div className="min-w-0 flex-1">
            {doc.url ? (
              <a
                href={doc.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary text-sm underline"
              >
                Open
              </a>
            ) : (
              <span className="text-muted-foreground text-xs">Unavailable</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function AdminCompanyReviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

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
    mutationFn: () => preconfiguredAxios.post(`/api/admin/companies/${companyId}/approve`),
    onSuccess: () => {
      toast.success("Company verified");
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

  const { company, history, openReviewId } = data;
  // Show only states that were actually acted on, plus the current pending one.
  const visible = history.filter((h) => h.status !== "superseded");

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <Link
        href="/reviews"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Company Reviews
      </Link>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">{company.display_name}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {company.rep_email}
          {company.company_type && ` · ${company.company_type.replace(/_/g, " ")}`}
        </p>
      </div>

      {visible.length === 0 ? (
        <Card>
          <CardContent className="text-muted-foreground py-8 text-center text-sm">
            No review history yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((entry) => {
            const isOpen = entry.id === openReviewId;
            return (
              <Card key={entry.id} className="overflow-hidden">
                <CardContent className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <ReviewStatusBadge status={entry.status} />
                        <span className="text-muted-foreground text-xs">
                          Submitted {formatDateWithoutTime(entry.created_at)}
                        </span>
                      </div>
                      {entry.reviewed_at && (
                        <p className="text-muted-foreground mt-1 text-xs">
                          {entry.status === "approved" ? "Approved" : "Reviewed"} by{" "}
                          {entry.reviewer_email ?? "—"} on{" "}
                          {formatDateWithoutTime(entry.reviewed_at)}
                        </p>
                      )}
                      {entry.rejection_reason && (
                        <p className="text-destructive mt-1 text-xs">
                          Reason: {entry.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Material + documents: visible for the pending review, collapsed for past ones */}
                  {isOpen ? (
                    <div className="space-y-4">
                      <MaterialFields entry={entry} />
                      <DocumentsList entry={entry} />
                    </div>
                  ) : (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="details" className="border-none">
                        <AccordionTrigger className="cursor-pointer py-2 text-sm font-medium text-gray-700 hover:no-underline">
                          View submitted details
                        </AccordionTrigger>
                        <AccordionContent className="space-y-4 pt-1">
                          <MaterialFields entry={entry} />
                          <DocumentsList entry={entry} />
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}

                  {/* Actions for the open (pending) review */}
                  {isOpen && (
                    <div className="flex gap-3 border-t border-gray-100 pt-4">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button scheme="supportive" className="flex-1" disabled={approve.isPending}>
                            {approve.isPending ? <Loader2 className="animate-spin" /> : <Check />}
                            Approve
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Verify {company.display_name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The company will be able to request MOAs from any university and is
                              emailed a confirmation.
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
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

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
              {company.display_name} will be asked to update their details. The reason is emailed to
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
            <Button scheme="destructive" disabled={reject.isPending} onClick={() => reject.mutate()}>
              {reject.isPending && <Loader2 className="animate-spin" />}
              {reject.isPending ? "Rejecting…" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
