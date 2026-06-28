"use client";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { MoaStatusBadge } from "@/components/status-badge";
import { formatDateWithoutTime } from "@/lib/utils";
import { AlertCircle, ArrowLeft, ClipboardList, Clock, Plus } from "lucide-react";

interface QueuedMoa {
  id: string;
  status: "pending" | "fulfilled" | "failed";
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

export default function CompanyDashboardPage() {
  const { company, isLoading } = useCompanyProfile();
  const router = useRouter();
  // `selectedUniId` drives the slide position; `lastSelectedId` keeps the detail
  // panel populated while it slides back out.
  const [selectedUniId, setSelectedUniId] = useState<string | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const { data: moasData, isLoading: moasLoading } = useQuery({
    queryKey: ["company-moas"],
    queryFn: () =>
      preconfiguredAxios.get("/api/company/moas?limit=100").then((r) => r.data),
    enabled: !!company,
  });

  const { data: queuedData } = useQuery({
    queryKey: ["company-queued-moas"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/company/queued-moas")
        .then((r) => r.data as { queued: QueuedMoa[] }),
    enabled: !!company,
  });

  const { data: invitesData } = useQuery({
    queryKey: ["company-pending-invites"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/company/invites/pending")
        .then((r) => r.data as { invites: PendingInvite[] }),
    enabled: !!company,
  });

  const { data: verification, isLoading: vLoading } = useCompanyVerification(!!company);

  // Keep the carousel's height matched to whichever panel is on screen so the
  // shorter history table doesn't leave dead space (and grows on pagination).
  const masterRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLDivElement>(null);
  const [trackHeight, setTrackHeight] = useState<number>();
  useEffect(() => {
    const el = selectedUniId ? detailRef.current : masterRef.current;
    if (!el) return;
    const update = () => setTrackHeight(el.offsetHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedUniId, isLoading, moasData]);

  if (isLoading) {
    return (
      <PageContainer className="space-y-8">
        <Skeleton className="h-8 w-56" />
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </PageContainer>
    );
  }
  if (!company) return null;

  const moas: Moa[] = moasData?.moas ?? [];

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
  const pendingQueued = (queuedData?.queued ?? []).filter((q) => q.status === "pending");
  const failedQueued = (queuedData?.queued ?? []).filter((q) => q.status === "failed");
  const pendingInvites = (invitesData?.invites ?? []).filter((inv) => inv.university !== null);
  const detail = lastSelectedId ? byUni.get(lastSelectedId) ?? null : null;
  const history = detail
    ? [...detail.moas].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    : [];

  const openUni = (id: string) => {
    setLastSelectedId(id);
    setSelectedUniId(id);
  };

  const PartnersView = () => {
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

    // Two-panel carousel: both panels stay mounted and the track slides, so the
    // master exits left as the detail enters from the right (and reverses on back).
    return (
      <div
        className="overflow-hidden"
        style={{ height: trackHeight }}
      >
        <div
          className="flex w-[200%] transition-transform duration-300 ease-out"
          style={{ transform: selectedUniId ? "translateX(-50%)" : "translateX(0%)" }}
        >
          {/* Master: partner universities */}
          <div
            ref={masterRef}
            aria-hidden={!!selectedUniId}
            className="w-1/2 shrink-0 self-start"
          >
            <DataTable
              id="company-partners"
              columns={partnerColumns}
              data={partners}
              searchKey="university"
              searchPlaceholder="Search by university..."
              rowLabelSingular="university"
              rowLabelPlural="universities"
              onRowClick={(p) => openUni(p.university.id)}
            />
          </div>

          {/* Detail: MOA history for the selected university */}
          <div
            ref={detailRef}
            aria-hidden={!selectedUniId}
            className="w-1/2 shrink-0 self-start"
          >
            {detail && (
              <div className="space-y-4">
                <button
                  onClick={() => setSelectedUniId(null)}
                  className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer items-center gap-1.5 text-sm"
                >
                  <ArrowLeft className="h-4 w-4" /> Partners
                </button>
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
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <PageContainer className="space-y-8">
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

      {pendingInvites.map((invite) => {
        const params = new URLSearchParams({ invite_id: invite.id });
        if (invite.template) params.set("template_id", invite.template.id);
        const href = `/company/universities/${invite.university!.id}/queue-moa?${params}`;
        return (
          <Card
            key={invite.id}
            className="gap-2 border-primary/30 bg-primary/5 px-5 py-4"
          >
            <p className="text-sm font-medium text-gray-900">
              MOA invitation from {invite.university!.registered_name}
            </p>
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
      })}

      {pendingQueued.length > 0 && (
        <Card className="flex-row items-start gap-3 border-primary/30 bg-primary/5 px-5 py-4">
          <Clock className="text-primary mt-0.5 h-5 w-5 flex-shrink-0" />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-gray-900">
              {pendingQueued.length === 1 ? "MOA request queued" : `${pendingQueued.length} MOA requests queued`}
            </p>
            <p className="text-muted-foreground text-sm">
              {pendingQueued.length === 1 ? "It" : "They"} will be issued automatically once the
              platform verifies your company.
            </p>
          </div>
        </Card>
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
          {partners.length > 0 && PartnersView()}
        </>
      ) : (
        PartnersView()
      )}
    </PageContainer>
  );
}
