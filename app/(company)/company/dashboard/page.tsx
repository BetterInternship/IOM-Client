"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  useCompanyControllerListMoas,
  useCompanyControllerListQueuedMoas,
  useCompanyControllerListPendingInvites,
} from "@/app/api";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { MoaStatusBadge } from "@/components/status-badge";
import { formatDateWithoutTime, cn } from "@/lib/utils";
import { AlertCircle, ArrowLeft, ArrowUpRight, ClipboardList, Clock, Plus } from "lucide-react";
import { RequestDialog } from "@/components/moa-request-dialog";

// "list" and "detail" are stable states; "to-detail" / "to-list" are mid-transition.
type Phase = "list" | "to-detail" | "detail" | "to-list";

const ANIM_DURATION = 200;

interface QueuedMoa {
  id: string;
  status: "pending" | "fulfilled" | "failed";
  failure_reason: string | null;
  university: { id: string; registered_name: string; logo_url: string | null } | null;
  template: { id: string; name: string; description: string | null } | null;
}

interface PendingInvite {
  id: string;
  university: { id: string; registered_name: string } | null;
  template: { id: string; name: string } | null;
}

interface Moa {
  id: string;
  status: "active" | "rejected";
  is_expired: boolean | null;
  effective_date: string;
  expiry_date: string;
  created_at: string;
  rejection_reason: string | null;
  university: { id: string; registered_name: string; logo_url: string | null };
}

interface PartnerUniversity {
  university: { id: string; registered_name: string; logo_url: string | null };
  moas: Moa[];
  activeCount: number;
}

const partnerColumns: ColumnDef<PartnerUniversity>[] = [
  {
    id: "university",
    header: "University",
    accessorFn: (row) => row.university.registered_name,
    cell: ({ row }) => (
      <span className="font-medium text-gray-900">
        {row.original.university.registered_name}
      </span>
    ),
  },
  {
    id: "moas",
    header: "MOAs",
    accessorFn: (row) => row.moas.length,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.moas.length}</span>
    ),
  },
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) =>
      row.original.activeCount > 0 ? (
        <Badge type="supportive">Active partner</Badge>
      ) : (
        <Badge type="default">No active MOA</Badge>
      ),
  },
];

const moaHistoryColumns: ColumnDef<Moa>[] = [
  {
    id: "status",
    header: "Status",
    enableSorting: false,
    cell: ({ row }) => (
      <div className="whitespace-normal">
        <MoaStatusBadge status={row.original.status} isExpired={row.original.is_expired} />
        {row.original.status === "rejected" && row.original.rejection_reason && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {row.original.rejection_reason}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "period",
    header: "Period",
    accessorFn: (row) => row.effective_date,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateWithoutTime(row.original.effective_date)} –{" "}
        {formatDateWithoutTime(row.original.expiry_date)}
      </span>
    ),
  },
  {
    id: "requested",
    header: "Requested",
    accessorFn: (row) => row.created_at,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateWithoutTime(row.original.created_at)}
      </span>
    ),
  },
];

function VerificationBanner({
  status,
  rejectionReason,
}: {
  status: "incomplete" | "pending" | "rejected" | "expired";
  rejectionReason: string | null;
}) {
  if (status === "incomplete") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Card className="w-full max-w-lg items-center gap-4 px-6 py-12 text-center">
          <span className="bg-primary/10 text-primary flex h-14 w-14 items-center justify-center rounded-full">
            <ClipboardList className="h-7 w-7" />
          </span>
          <div className="space-y-1.5">
            <h2 className="text-xl font-semibold tracking-tight text-gray-900">
              Finish setting up your account
            </h2>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">
              Complete your company profile and upload all required documents.
              Once everything&apos;s in, the platform team will verify your
              company so you can request MOAs.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/profile">Complete your profile</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (status === "pending") {
    return (
      <Card className="flex-row items-start gap-3 border-warning/30 bg-warning/10 px-5 py-4">
        <Clock className="text-warning mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-gray-900">Pending approval</p>
          <p className="text-muted-foreground text-sm">
            You can request MOAs once the platform team verifies your company.
            We&apos;ll email you when it&apos;s done.
          </p>
        </div>
      </Card>
    );
  }

  if (status === "expired") {
    return (
      <Card className="flex-row items-start gap-3 border-destructive/30 bg-destructive/5 px-5 py-4">
        <AlertCircle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium text-gray-900">Verification expired</p>
          <p className="text-muted-foreground text-sm">
            Your company verification has expired. Please re-upload your documents to request
            re-review.{" "}
            <Link href="/profile" className="text-primary underline">
              Update your profile
            </Link>
            .
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="flex-row items-start gap-3 border-destructive/30 bg-destructive/5 px-5 py-4">
      <AlertCircle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-gray-900">Verification needs attention</p>
        <p className="text-muted-foreground text-sm">
          {rejectionReason ||
            "Your company could not be verified. Please review your profile and documents."}{" "}
          <br />
          <br />
          <Link href="/profile" className="text-primary underline">
            Update your profile
          </Link>
          .
        </p>
      </div>
    </Card>
  );
}

function CompanyDashboardContent() {
  const { company, isLoading } = useCompanyProfile();
  const router = useRouter();
  const searchParams = useSearchParams();
  const openUniversityId = searchParams.get("open_university_id");
  const inviteTemplateId = searchParams.get("template_id");
  const inviteId = searchParams.get("invite_id");

  const [phase, setPhase] = useState<Phase>("list");
  const [currentUniId, setCurrentUniId] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const { data: moasData, isLoading: moasLoading } = useCompanyControllerListMoas(
    { limit: 100 },
    { query: { enabled: !!company } },
  );

  const { data: queuedData } = useCompanyControllerListQueuedMoas({
    query: { enabled: !!company },
  });

  const { data: invitesData } = useCompanyControllerListPendingInvites({
    query: { enabled: !!company },
  });

  const { data: verification, isLoading: vLoading } = useCompanyVerification(!!company);
  const verified = verification?.status === "verified";

  const inviteDialog = openUniversityId ? (
    <RequestDialog
      universityId={openUniversityId}
      defaultTemplateId={inviteTemplateId}
      inviteId={inviteId}
      verified={verified}
      onClose={() => router.replace("/company/dashboard")}
    />
  ) : null;

  // Clean up timer on unmount.
  useEffect(() => () => clearTimeout(timerRef.current), []);

  // Capture hash on first render, then navigate once MOA data is available.
  const [hashId, setHashId] = useState<string | null>(null);
  useEffect(() => {
    const h = window.location.hash.slice(1);
    if (h) setHashId(h);
  }, []);
  useEffect(() => {
    if (!hashId || moasLoading || !moasData) return;
    const exists = (moasData?.moas ?? []).some((m) => m.university?.id === hashId);
    if (exists) {
      setCurrentUniId(hashId);
      setPhase("detail");
    } else {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
    setHashId(null);
  }, [hashId, moasLoading, moasData]);

  if (isLoading) {
    return (
      <>
        <PageContainer className="space-y-8">
          <Skeleton className="h-8 w-56" />
          <div className="space-y-2.5">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </PageContainer>
        {inviteDialog}
      </>
    );
  }
  if (!company) return null;

  const moas = (moasData?.moas ?? []) as unknown as Moa[];
  const pendingQueued = (queuedData?.queued ?? []).filter((q) => q.status === "pending");
  const failedQueued = (queuedData?.queued ?? []).filter((q) => q.status === "failed");

  // Group MOAs by university into partner rows (newest MOA first within each).
  const byUni = new Map<string, PartnerUniversity>();
  for (const m of moas) {
    if (!m.university) continue;
    const entry =
      byUni.get(m.university.id) ??
      ({ university: m.university, moas: [], activeCount: 0 } as PartnerUniversity);
    entry.moas.push(m);
    if (m.status === "active" && !m.is_expired) entry.activeCount += 1;
    byUni.set(m.university.id, entry);
  }
  const partners = [...byUni.values()].sort(
    (a, b) =>
      b.activeCount - a.activeCount ||
      a.university.registered_name.localeCompare(b.university.registered_name),
  );

  const status = verification?.status;
  const canRequest = status === "verified";
  const pendingInvites = (invitesData?.invites ?? []).filter((inv) => inv.university !== null);
  const detail = currentUniId ? byUni.get(currentUniId) ?? null : null;
  const history = detail
    ? [...detail.moas].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    : [];

  const navigateToDetail = (uniId: string) => {
    clearTimeout(timerRef.current);
    setCurrentUniId(uniId);
    setPhase("to-detail");
    window.history.replaceState(null, "", "#" + uniId);
    timerRef.current = setTimeout(() => setPhase("detail"), ANIM_DURATION + 10);
  };

  const navigateToList = () => {
    clearTimeout(timerRef.current);
    setPhase("to-list");
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    timerRef.current = setTimeout(() => {
      setPhase("list");
      setCurrentUniId(null);
    }, ANIM_DURATION + 10);
  };

  // During "to-detail": list is in-flow (exiting left), detail is absolute (entering from right).
  // During "to-list":  detail is in-flow (exiting right), list is absolute (entering from left).
  const showList = phase !== "detail";
  const showDetail = phase !== "list";

  const PartnersTable = () => {
    if (moasLoading) {
      return (
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      );
    }

    if (partners.length === 0) {
      return (
        <EmptyState
          title="No partner universities yet"
          description={
            canRequest
              ? "Browse partner universities and request your first memorandum of agreement."
              : "Once your company is verified, you can request MOAs from partner universities."
          }
        >
          {canRequest && (
            <Button asChild variant="outline" scheme="primary">
              <Link href="/universities">Browse universities</Link>
            </Button>
          )}
        </EmptyState>
      );
    }

    return (
      <DataTable
        id="company-partners"
        columns={partnerColumns}
        data={partners}
        searchKey="university"
        searchPlaceholder="Search by university..."
        rowLabelSingular="university"
        rowLabelPlural="universities"
        onRowClick={(p) => navigateToDetail(p.university.id)}
      />
    );
  };

  return (
    <>
    {inviteDialog}
    <PageContainer>
      {/* overflow-hidden clips the sliding panels; relative enables absolute children */}
      <div className="relative overflow-hidden">

        {/* ── List panel ───────────────────────────────────────────────────── */}
        {showList && (
          <div
            className={cn(
              "space-y-8",
              phase === "to-detail" &&
                `animate-out slide-out-to-left fade-out duration-${ANIM_DURATION}`,
              phase === "to-list" &&
                `absolute inset-x-0 top-0 animate-in slide-in-from-left fade-in duration-${ANIM_DURATION}`,
            )}
          >
            <PageHeader
              title="Partners"
              description="Universities you have MOAs with."
            >
              {canRequest && (
                <Button asChild>
                  <Link href="/universities">
                    <Plus /> Request MOA
                  </Link>
                </Button>
              )}
            </PageHeader>

            {pendingInvites.length > 0 && (() => {
              const invite = pendingInvites[0];
              const params = new URLSearchParams({ open_university_id: invite.university!.id, invite_id: invite.id });
              if (invite.template) params.set("template_id", invite.template.id);
              const href = `/company/dashboard?${params}`;
              return (
                <Card
                  key={invite.id}
                  className="gap-2 border-primary/30 bg-primary/5 px-5 py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      MOA invitation from {invite.university!.registered_name}
                    </p>
                    <Link
                      href="/invites"
                      className="text-muted-foreground hover:text-foreground flex flex-shrink-0 items-center gap-1 text-xs transition-colors"
                    >
                      {pendingInvites.length > 1 && (
                        <span className="font-medium">{pendingInvites.length - 1} more</span>
                      )}
                      View all
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </Link>
                  </div>
                  <p className="text-muted-foreground text-sm">
                    You were invited to sign a MOA
                    {invite.template ? ` using the "${invite.template.name}" template` : ""}.
                  </p>
                  <div className="pt-1">
                    <Button asChild size="sm">
                      <Link href={href}>Sign MOA</Link>
                    </Button>
                  </div>
                </Card>
              );
            })()}

            {pendingQueued.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold text-gray-900">Pending MOAs</h2>
                <p className="text-muted-foreground -mt-1 text-xs">
                  These will be issued automatically once your company is verified.
                </p>
                {pendingQueued.map((q) => (
                  <Card key={q.id} className="flex-row items-center gap-3 border-primary/20 bg-primary/5 px-5 py-3.5">
                    <Clock className="text-primary h-4 w-4 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {q.university?.registered_name ?? "Unknown university"}
                      </p>
                      {q.template && (
                        <p className="text-muted-foreground truncate text-xs">{q.template.name}</p>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            )}

            {failedQueued.length > 0 && (
              <Card className="flex-row items-start gap-3 border-destructive/30 bg-destructive/5 px-5 py-4">
                <AlertCircle className="text-destructive mt-0.5 h-5 w-5 flex-shrink-0" />
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-gray-900">
                    {failedQueued.length === 1 ? "A queued MOA failed" : `${failedQueued.length} queued MOAs failed`}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    Please contact us for help at{" "}
                    <a href="mailto:hello@betterinternship.com" className="text-primary underline">
                      hello@betterinternship.com
                    </a>
                    .
                  </p>
                </div>
              </Card>
            )}

            {vLoading ? (
              <div className="space-y-2.5">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-20 w-full" />
              </div>
            ) : status && status !== "verified" ? (
              <>
                <VerificationBanner
                  status={status}
                  rejectionReason={verification?.rejectionReason ?? null}
                />
                {partners.length > 0 && <PartnersTable />}
              </>
            ) : (
              <PartnersTable />
            )}
          </div>
        )}

        {/* ── Detail panel ─────────────────────────────────────────────────── */}
        {showDetail && (
          <div
            className={cn(
              "space-y-4",
              phase === "to-detail" &&
                `absolute inset-x-0 top-0 animate-in slide-in-from-right fade-in duration-${ANIM_DURATION}`,
              phase === "to-list" &&
                `animate-out slide-out-to-right fade-out duration-${ANIM_DURATION}`,
            )}
          >
            <button
              onClick={navigateToList}
              className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 text-sm"
            >
              <ArrowLeft className="h-4 w-4" /> Partners
            </button>

            {detail && (
              <>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {detail.university.registered_name}
                  </h3>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {detail.activeCount} active MOA{detail.activeCount === 1 ? "" : "s"} ·{" "}
                    {detail.moas.length} total
                  </p>
                </div>
                <DataTable
                  id={`company-uni-moas-${detail.university.id}`}
                  columns={moaHistoryColumns}
                  data={history}
                  rowLabelSingular="MOA"
                  rowLabelPlural="MOAs"
                  onRowClick={(moa) => router.push(`/company/moas/${moa.id}`)}
                />
              </>
            )}
          </div>
        )}
      </div>
    </PageContainer>
    </>
  );
}

export default function CompanyDashboardPage() {
  return (
    <Suspense>
      <CompanyDashboardContent />
    </Suspense>
  );
}
