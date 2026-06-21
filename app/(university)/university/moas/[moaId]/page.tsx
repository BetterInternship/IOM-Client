"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
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
import { formatDateWithoutTime } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  ExternalLink,
  FileText,
  Loader2,
  X,
} from "lucide-react";

interface MoaCompany {
  display_name: string;
  registered_name: string | null;
  [key: string]: string | null;
}

interface MoaRecord {
  company: MoaCompany;
  template: { name: string } | null;
  status: string;
  reviewed_at: string | null;
  created_at: string;
  effective_date: string;
  expiry_date: string;
}

interface MoaHistoryEntry {
  id: string;
  created_at: string;
}

interface MoaDetail {
  moa: MoaRecord;
  snapshot: { snapshot_json: Record<string, string | null> | null } | null;
  history: MoaHistoryEntry[];
  detailsChanged: boolean;
  pdfUrl: string | null;
}

const FIELD_LABELS: Record<string, string> = {
  registered_name: "Legal name",
  company_type: "Company type",
  registered_address: "Address",
  rep_name: "Representative name",
  rep_title: "Representative title",
};

export default function UniversityMoaDetailPage() {
  const { moaId } = useParams<{ moaId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showReject, setShowReject] = useState(false);
  const [reason, setReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["university-moa", moaId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/university/moas/${moaId}`)
        .then((r) => r.data as MoaDetail),
    enabled: !!moaId,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["university-review-queue"] });
    queryClient.invalidateQueries({ queryKey: ["university-moa", moaId] });
  };

  const confirm = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post(`/api/university/moas/${moaId}/confirm`),
    onSuccess: () => {
      invalidate();
      router.push("/university/partners");
    },
  });

  const reject = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post(`/api/university/moas/${moaId}/reject`, {
        reason: reason || undefined,
      }),
    onSuccess: () => {
      invalidate();
      setShowReject(false);
      router.push("/university/partners");
    },
  });

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

  const { moa, snapshot, history, detailsChanged, pdfUrl } = data;
  const company = moa.company;
  const isPendingReview = moa.status === "active" && !moa.reviewed_at;
  const snapshotJson: Record<string, string | null> = snapshot?.snapshot_json ?? {};

  const statusBadge = isPendingReview ? (
    <Badge type="warning">Pending review</Badge>
  ) : moa.status === "rejected" ? (
    <Badge type="destructive">Rejected</Badge>
  ) : moa.reviewed_at ? (
    <Badge type="supportive">Confirmed</Badge>
  ) : null;

  return (
    <PageContainer className="max-w-3xl space-y-6">
      <Link
        href="/university/partners"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Partners
      </Link>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold text-gray-900">
                {company.display_name}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {company.registered_name && `${company.registered_name} · `}
                {moa.template?.name}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Requested {formatDateWithoutTime(moa.created_at)} &middot;{" "}
                {formatDateWithoutTime(moa.effective_date)} &ndash;{" "}
                {formatDateWithoutTime(moa.expiry_date)}
              </p>
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              {detailsChanged && (
                <Badge type="warning" strength="medium">
                  Details changed
                </Badge>
              )}
              {statusBadge}
            </div>
          </div>

          {detailsChanged && (
            <div className="border-warning/30 bg-warning/10 space-y-2 rounded-[0.33em] border p-4">
              <p className="text-warning text-xs font-semibold tracking-wide uppercase">
                Company details changed since request
              </p>
              <div className="space-y-2">
                {Object.entries(FIELD_LABELS).map(([key, label]) => {
                  const atRequest = snapshotJson[key];
                  const current = company[key];
                  if (atRequest === current) return null;
                  return (
                    <div
                      key={key}
                      className="rounded-[0.33em] border border-gray-200 bg-white p-2"
                    >
                      <p className="text-muted-foreground text-xs">{label}</p>
                      <p className="text-destructive text-sm line-through">
                        {atRequest ?? "—"}
                      </p>
                      <p className="text-supportive text-sm">{current ?? "—"}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {history.length > 0 && (
            <details className="rounded-[0.33em] border border-gray-200">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
                Company history ({history.length} update
                {history.length !== 1 ? "s" : ""} since request)
              </summary>
              <div className="space-y-2 border-t border-gray-100 p-4">
                {history.map((h) => (
                  <p key={h.id} className="text-muted-foreground text-xs">
                    <span className="text-gray-400">
                      {formatDateWithoutTime(h.created_at)} —
                    </span>{" "}
                    Profile updated
                  </p>
                ))}
              </div>
            </details>
          )}

          {isPendingReview && (
            <div className="flex gap-3 border-t border-gray-100 pt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button scheme="supportive" className="flex-1">
                    <Check /> Confirm MOA
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm this MOA?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This activates the agreement with {company.display_name} and
                      notifies the company.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-supportive text-supportive-foreground hover:bg-supportive/90"
                      onClick={() => confirm.mutate()}
                    >
                      Confirm
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

      {pdfUrl ? (
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="text-muted-foreground h-4 w-4" /> MOA document
            </p>
            <Button asChild variant="ghost" size="sm">
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                Open <ExternalLink />
              </a>
            </Button>
          </div>
          <iframe src={pdfUrl} className="h-[70vh] w-full" title="MOA PDF" />
        </Card>
      ) : (
        <Card>
          <CardContent className="text-muted-foreground py-10 text-center text-sm">
            PDF not available.
          </CardContent>
        </Card>
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
            <DialogTitle>Reject MOA</DialogTitle>
            <DialogDescription>
              Rejecting the request from {company.display_name}.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            placeholder="Reason for rejection (optional — emailed to the company)"
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
              {reject.isPending ? "Rejecting…" : "Reject MOA"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
