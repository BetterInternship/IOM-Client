"use client";
import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  useCompanyControllerListMoas,
  useCompanyControllerListQueuedMoas,
  useCompanyControllerListPendingInvites,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompanyPartnersTable,
  parseActiveMoaRanges,
  parsePartnerStatuses,
  type ActiveMoaRange,
  type CompanyPartnerUniversity,
  type PartnerStatus,
} from "@/components/company/company-partners-table";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import {
  AlertCircle,
  ArrowUpRight,
  ClipboardList,
  Clock,
  Mail,
  Plus,
} from "lucide-react";
import { RequestDialog } from "@/components/moa-request-dialog";
import { CareerListingCta } from "@/components/career-listing-cta";

interface Moa {
  id: string;
  status: "active" | "rejected";
  is_expired: boolean | null;
  effective_date: string;
  expiry_date: string | null;
  created_at: string;
  rejection_reason: string | null;
  university: {
    id: string;
    registered_name: string;
    logo_url: string | null;
    address: string | null;
  };
}

interface PartnerUniversity extends CompanyPartnerUniversity {
  moas: Moa[];
}

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
            You can submit MOA requests now. They&apos;ll be queued and issued
            automatically once the platform team verifies your company.
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
          <p className="text-sm font-medium text-gray-900">
            Verification expired
          </p>
          <p className="text-muted-foreground text-sm">
            Your company verification has expired. Please re-upload your
            documents to request re-review.{" "}
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
        <p className="text-sm font-medium text-gray-900">
          Verification needs attention
        </p>
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
  const searchParams = useSearchParams();
  const initialPartnerSearch = searchParams.get("search") ?? "";
  const initialPartnerStatuses = parsePartnerStatuses(
    searchParams.get("status"),
  );
  const initialActiveMoaRanges = parseActiveMoaRanges(
    searchParams.get("moa_ranges"),
  );
  const initialPartnerPage = Math.max(Number(searchParams.get("page")) || 1, 1);
  const { company, isLoading } = useCompanyProfile();
  const router = useRouter();
  const { openModal, closeModal } = useModal();
  const { approvalPending } = useIomModalRegistry();
  const openUniversityId = searchParams.get("open_university_id");
  const inviteTemplateId = searchParams.get("template_id");
  const inviteId = searchParams.get("invite_id");
  const showApprovalPending =
    searchParams.get("approval_pending") === "1" ||
    (process.env.NODE_ENV !== "production" &&
      searchParams.get("debug_approval_pending") === "1");

  const updatePartnerQuery = (
    search: string,
    statuses: PartnerStatus[],
    ranges: ActiveMoaRange[],
    page: number,
  ) => {
    const params = new URLSearchParams(window.location.search);
    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete("search", search.trim());
    setOrDelete("status", statuses.join(","));
    setOrDelete("moa_ranges", ranges.join(","));
    if (page > 1) params.set("page", String(page));
    else params.delete("page");

    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${query ? `?${query}` : ""}`,
    );
  };

  const { data: moasData, isLoading: moasLoading } =
    useCompanyControllerListMoas(
      { limit: 100 },
      { query: { enabled: !!company } },
    );

  const { data: queuedData } = useCompanyControllerListQueuedMoas({
    query: { enabled: !!company },
  });

  const { data: invitesData } = useCompanyControllerListPendingInvites({
    query: { enabled: !!company },
  });

  const { data: verification, isLoading: vLoading } =
    useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const openUniversityName = (invitesData?.invites ?? []).find(
    (invite) =>
      (inviteId && invite.id === inviteId) ||
      invite.university?.id === openUniversityId,
  )?.university?.registered_name;

  useEffect(() => {
    if (!showApprovalPending) return;
    approvalPending.open({
      onQueueMoa: () => router.replace("/company/universities"),
      onClose: () => router.replace("/company/dashboard"),
    });
  }, [router, showApprovalPending]);

  useEffect(() => {
    if (!openUniversityId) {
      closeModal("request-moa");
      return;
    }

    openModal(
      "request-moa",
      <RequestDialog
        universityId={openUniversityId}
        defaultTemplateId={inviteTemplateId}
        inviteId={inviteId}
        verified={verified}
        onClose={() => closeModal("request-moa")}
      />,
      {
        title: (
          <h2 className="text-2xl leading-snug font-semibold tracking-tight">
            Requesting a MOA with{" "}
            <span className="text-primary">
              {openUniversityName ?? "this university"}
            </span>
          </h2>
        ),
        description:
          "Choose a university template, then add the representative and signature details.",
        panelClassName: "sm:!max-w-none",
        headerClassName: "request-moa-header",
        exitAnimation: "fade",
        onClose: () => router.replace("/company/dashboard"),
      },
    );
  }, [
    closeModal,
    inviteId,
    inviteTemplateId,
    openModal,
    openUniversityId,
    openUniversityName,
    router,
    verified,
  ]);

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
      </>
    );
  }
  if (!company) return null;

  const moas = (moasData?.moas ?? []) as unknown as Moa[];
  const pendingQueued = (queuedData?.queued ?? []).filter(
    (q) => q.status === "pending",
  );
  const failedQueued = (queuedData?.queued ?? []).filter(
    (q) => q.status === "failed",
  );

  // Group MOAs by university into partner rows (newest MOA first within each).
  const byUni = new Map<string, PartnerUniversity>();
  for (const m of moas) {
    if (!m.university) continue;
    const entry =
      byUni.get(m.university.id) ??
      ({
        university: m.university,
        moas: [],
        activeCount: 0,
      } as PartnerUniversity);
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
  const canRequest = verified || status === "pending";
  const pendingInvites = (invitesData?.invites ?? []).filter(
    (inv) => inv.university !== null,
  );
  const navigateToDetail = (uniId: string) => {
    router.push(`/partners/${uniId}`);
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

      {(verified || verification?.canPostListing) && <CareerListingCta />}

      {pendingInvites.length > 0 &&
        (() => {
          const invite = pendingInvites[0];
          const params = new URLSearchParams({
            open_university_id: invite.university!.id,
            invite_id: invite.id,
          });
          if (invite.template) params.set("template_id", invite.template.id);
          const href = `/company/dashboard?${params}`;
          return (
            <Card className="flex-row items-start gap-3 border-primary/30 bg-primary/5 px-5 py-4" key={invite.id}>
              <Mail className="text-primary h-5 w-5" aria-hidden="true" />
              <div className="w-full flex items-start justify-between gap-3">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium text-gray-900">
                    MOA invitation from {invite.university!.registered_name}
                  </p>
                  <p className="text-muted-foreground text-sm">
                    You were invited to sign a MOA
                    {invite.template
                      ? ` using the "${invite.template.name}" template`
                      : ""}
                    .
                  </p>
                  <div className="pt-1">
                    <Button asChild size="sm">
                      <Link href={href}>Sign MOA</Link>
                    </Button>
                  </div>
                </div>
                <Link
                  href="/invites"
                  className="text-muted-foreground hover:text-foreground flex flex-shrink-0 items-center gap-1 text-xs transition-colors"
                >
                  {pendingInvites.length > 1 && (
                    <span className="font-medium">
                      {pendingInvites.length - 1} more
                    </span>
                  )}
                  View all
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
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
            <Card
              key={q.id}
              className="flex-row items-center gap-3 border-primary/20 bg-primary/5 px-5 py-3.5"
            >
              <Clock className="text-primary h-5 w-5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-gray-900">
                  {q.university?.registered_name ?? "Unknown university"}
                </p>
                {q.template && (
                  <p className="text-muted-foreground truncate text-xs">
                    {q.template.name}
                  </p>
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
              {failedQueued.length === 1
                ? "A queued MOA failed"
                : `${failedQueued.length} queued MOAs failed`}
            </p>
            <p className="text-muted-foreground text-sm">
              Please contact us for help at{" "}
              <a
                href="mailto:hello@betterinternship.com"
                className="text-primary underline"
              >
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
          {partners.length > 0 && (
            <CompanyPartnersTable
              partners={partners}
              isLoading={moasLoading}
              canRequest={canRequest}
              initialSearch={initialPartnerSearch}
              initialStatuses={initialPartnerStatuses}
              initialRanges={initialActiveMoaRanges}
              initialPage={initialPartnerPage}
              onPartnerClick={(partner) =>
                navigateToDetail(partner.university.id)
              }
              onQueryChange={updatePartnerQuery}
            />
          )}
        </>
      ) : (
        <CompanyPartnersTable
          partners={partners}
          isLoading={moasLoading}
          canRequest={canRequest}
          initialSearch={initialPartnerSearch}
          initialStatuses={initialPartnerStatuses}
          initialRanges={initialActiveMoaRanges}
          initialPage={initialPartnerPage}
          onPartnerClick={(partner) => navigateToDetail(partner.university.id)}
          onQueryChange={updatePartnerQuery}
        />
      )}
    </PageContainer>
  );
}

export default function CompanyDashboardPage() {
  return (
    <Suspense>
      <CompanyDashboardContent />
    </Suspense>
  );
}
