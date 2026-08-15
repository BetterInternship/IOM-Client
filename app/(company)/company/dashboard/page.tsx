"use client";
import { type KeyboardEvent, type ReactNode, Suspense, useEffect } from "react";
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
import { StatusNotice } from "@/components/ui/status-notice";
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
  ClipboardList,
  Clock,
  FileSignature,
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

function NotificationCenter({
  count,
  children,
}: {
  count: number;
  children: ReactNode;
}) {
  if (count === 0) return null;

  return (
    <section className="border-primary/20 overflow-hidden rounded-[0.33em] border shadow-sm">
      <div className="divide-y divide-gray-200 [&>[data-slot=status-notice]]:rounded-none [&>[data-slot=status-notice]]:border-0">
        {children}
      </div>
    </section>
  );
}

function VerificationBanner({
  status,
  rejectionReason,
}: {
  status: "incomplete" | "pending" | "rejected" | "expired";
  rejectionReason: string | null;
}) {
  const router = useRouter();
  const destination =
    status === "incomplete" ? "/complete-profile" : "/profile";
  const openDestination = () => router.push(destination);
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openDestination();
    }
  };

  if (status === "incomplete") {
    return (
      <StatusNotice
        icon={ClipboardList}
        title="Finish setting up your account"
        description="Complete your company profile and upload all required documents. Once everything's in, the platform team will verify your company so you can request MOAs."
        className="hover:bg-primary/[0.025] cursor-pointer transition-colors"
        role="link"
        tabIndex={0}
        onClick={openDestination}
        onKeyDown={handleKeyDown}
        action={
          <Button asChild variant="outline" scheme="primary" expandIcon>
            <Link
              href="/complete-profile"
              onClick={(event) => event.stopPropagation()}
            >
              <ClipboardList aria-hidden="true" />
              <span className="button-label">Complete profile</span>
            </Link>
          </Button>
        }
      />
    );
  }

  if (status === "pending") {
    return (
      <StatusNotice
        icon={Clock}
        title="Pending approval"
        description="You can submit MOA requests now. They'll be queued and issued automatically once the platform team verifies your company."
        variant="warning"
        className="hover:bg-warning/15 cursor-pointer transition-colors"
        role="link"
        tabIndex={0}
        onClick={openDestination}
        onKeyDown={handleKeyDown}
      />
    );
  }

  if (status === "expired") {
    return (
      <StatusNotice
        icon={AlertCircle}
        title="Verification expired"
        description={
          <>
            Your company verification has expired. Please re-upload your
            documents to request re-review.{" "}
            <Link
              href="/profile"
              className="text-primary underline"
              onClick={(event) => event.stopPropagation()}
            >
              Update your profile
            </Link>
            .
          </>
        }
        variant="destructive"
        className="hover:bg-destructive/10 cursor-pointer transition-colors"
        role="link"
        tabIndex={0}
        onClick={openDestination}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <StatusNotice
      icon={AlertCircle}
      title="Verification needs attention"
      description={
        <>
          {rejectionReason ||
            "Your company could not be verified. Please review your profile and documents."}{" "}
          <br />
          <br />
          <Link
            href="/profile"
            className="text-primary underline"
            onClick={(event) => event.stopPropagation()}
          >
            Update your profile
          </Link>
          .
        </>
      }
      variant="destructive"
      className="hover:bg-destructive/10 cursor-pointer transition-colors"
      role="link"
      tabIndex={0}
      onClick={openDestination}
      onKeyDown={handleKeyDown}
    />
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
  const status = verification?.status;
  const verified = verification?.status === "verified";
  const canRequest = verified || status === "pending";
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
    if (vLoading) return;
    if (!canRequest) {
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
    canRequest,
    vLoading,
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
        pendingCount: 0,
      } as PartnerUniversity);
    entry.moas.push(m);
    if (m.status === "active" && !m.is_expired) entry.activeCount += 1;
    byUni.set(m.university.id, entry);
  }
  for (const queued of pendingQueued) {
    if (!queued.university) continue;
    const entry =
      byUni.get(queued.university.id) ??
      ({
        university: queued.university,
        moas: [],
        activeCount: 0,
        pendingCount: 0,
      } as PartnerUniversity);
    entry.pendingCount += 1;
    byUni.set(queued.university.id, entry);
  }
  const partners = [...byUni.values()].sort(
    (a, b) =>
      b.activeCount - a.activeCount ||
      b.pendingCount - a.pendingCount ||
      a.university.registered_name.localeCompare(b.university.registered_name),
  );

  const pendingInvites = (invitesData?.invites ?? []).filter(
    (inv) => inv.university !== null,
  );
  const navigateToDetail = (uniId: string) => {
    router.push(`/partners/${uniId}`);
  };

  return (
    <PageContainer className="space-y-8">
      <NotificationCenter
        count={
          (verified || verification?.canPostListing ? 1 : 0) +
          (canRequest && pendingInvites.length > 0 ? 1 : 0) +
          (failedQueued.length > 0 ? 1 : 0) +
          (status && status !== "verified" ? 1 : 0)
        }
      >
        {(verified || verification?.canPostListing) && <CareerListingCta />}

        {canRequest &&
          pendingInvites.length > 0 &&
          (() => {
            const invite = pendingInvites[0];
            const params = new URLSearchParams({
              open_university_id: invite.university!.id,
              invite_id: invite.id,
            });
            if (invite.template) params.set("template_id", invite.template.id);
            const href = `/company/dashboard?${params}`;
            return (
              <StatusNotice
                media={
                  invite.university!.logo_url ? (
                    // University logos are user-uploaded external assets.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={invite.university!.logo_url}
                      alt={`${invite.university!.registered_name} logo`}
                      className="h-full w-full bg-white object-contain p-1.5"
                    />
                  ) : (
                    <span aria-hidden="true" className="text-sm font-semibold">
                      {invite
                        .university!.registered_name.split(/\s+/)
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")
                        .toUpperCase()}
                    </span>
                  )
                }
                title={`${invite.university!.registered_name} invited you to sign an MOA`}
                description={
                  <>
                    MOA invitation
                    {invite.template ? ` · ${invite.template.name}` : ""}
                  </>
                }
                action={
                  <Button
                    asChild
                    variant="outline"
                    scheme="primary"
                    expandIcon
                    className="shrink-0"
                  >
                    <Link
                      href={href}
                      onClick={(event) => event.stopPropagation()}
                    >
                      <FileSignature aria-hidden="true" />
                      <span className="button-label">Sign MOA</span>
                    </Link>
                  </Button>
                }
                className="bg-primary/[0.035] hover:bg-primary/[0.06] cursor-pointer transition-colors"
                key={invite.id}
                role="link"
                tabIndex={0}
                onClick={() => router.push(href)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(href);
                  }
                }}
              />
            );
          })()}

        {failedQueued.length > 0 && (
          <StatusNotice
            icon={AlertCircle}
            title={
              failedQueued.length === 1
                ? "A queued MOA failed"
                : `${failedQueued.length} queued MOAs failed`
            }
            description={
              <>
                Please contact us for help at{" "}
                <a
                  href="mailto:hello@betterinternship.com"
                  className="text-primary underline"
                  onClick={(event) => event.stopPropagation()}
                >
                  hello@betterinternship.com
                </a>
                .
              </>
            }
            variant="destructive"
            className="hover:bg-destructive/10 cursor-pointer transition-colors"
            role="link"
            tabIndex={0}
            onClick={() => {
              window.location.href = "mailto:hello@betterinternship.com";
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                window.location.href = "mailto:hello@betterinternship.com";
              }
            }}
          />
        )}

        {!vLoading && status && status !== "verified" && (
          <VerificationBanner
            status={status}
            rejectionReason={verification?.rejectionReason ?? null}
          />
        )}
      </NotificationCenter>

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

      {vLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
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
