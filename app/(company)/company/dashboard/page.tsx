"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  useCompanyControllerListMoas,
  useCompanyControllerListMoaRequests,
  useCompanyControllerListPendingInvites,
  useCompanyControllerListUniversities,
  type CompanyUniversityDirectoryItemDto,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusNotice } from "@/components/ui/status-notice";
import { CompanyProfileStatusNotice } from "@/components/company/company-profile-status-notice";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompanyPartnersTable,
  parseActiveMoaRanges,
  parsePartnerStatuses,
  type ActiveMoaRange,
  type CompanyPartnerUniversity,
  type PartnerStatus,
} from "@/components/company/company-partners-table";
import {
  RequestableUniversitiesTable,
  type InFlightRequestStatus,
} from "@/components/company/requestable-universities-table";
import { useModal } from "@/app/providers/modal-provider";
import { FileSignature } from "lucide-react";
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
  className,
}: {
  count: number;
  children: React.ReactNode;
  className?: string;
}) {
  if (count === 0) return null;

  return (
    <section
      className={`overflow-hidden rounded-[0.33em] border ${className ?? "border-primary/20"}`}
    >
      <div className="divide-y divide-gray-200 [&>[data-slot=status-notice]]:rounded-none [&>[data-slot=status-notice]]:border-0">
        {children}
      </div>
    </section>
  );
}

// Mirrors the university side's partner tabs (app/(university)/university/partners/page.tsx's
// PartnerTabs) so the two portals share the same tabbed-table structure.
function DashboardTabs({
  activeCount,
  requestableCount,
}: {
  activeCount: number;
  requestableCount: number;
}) {
  return (
    <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-none border-0 border-b border-gray-200 bg-transparent">
      <TabsTrigger
        value="active"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        Active partners
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground">
          {activeCount}
        </span>
      </TabsTrigger>
      <TabsTrigger
        value="requestable"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        Available to request
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-gray-900 group-data-[state=active]:text-white">
          {requestableCount}
        </span>
      </TabsTrigger>
    </TabsList>
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
  const [dashboardTab, setDashboardTab] = useState<"active" | "requestable">(
    "active",
  );
  const hasSelectedDefaultTab = useRef(false);

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

  const { data: requestsData } = useCompanyControllerListMoaRequests({
    query: { enabled: !!company },
  });

  const { data: universitiesData, isLoading: universitiesLoading } =
    useCompanyControllerListUniversities({
      query: { enabled: !!company },
    });

  const { data: invitesData } = useCompanyControllerListPendingInvites({
    query: { enabled: !!company },
  });

  const { data: verification, isLoading: vLoading } =
    useCompanyVerification(!!company);
  const status = verification?.status;
  const hasActivePartners = (moasData?.moas ?? []).some(
    (moa) => moa.status === "active" && !moa.is_expired,
  );

  useEffect(() => {
    if (!company || moasLoading || hasSelectedDefaultTab.current) return;

    hasSelectedDefaultTab.current = true;
    if (!hasActivePartners) setDashboardTab("requestable");
  }, [company, hasActivePartners, moasLoading]);

  const openRequestDialog = (university: {
    id: string;
    registered_name: string;
  }) => {
    openModal(
      "request-moa",
      <RequestDialog
        universityId={university.id}
        onClose={() => closeModal("request-moa")}
      />,
      {
        title: (
          <h2 className="text-lg leading-snug font-semibold tracking-tight sm:text-2xl">
            Requesting a MOA with{" "}
            <span className="text-primary">{university.registered_name}</span>
          </h2>
        ),
        description:
          "Choose a university template, then add the representative and signature details.",
        panelClassName: "sm:!max-w-none",
        headerClassName: "request-moa-header",
        exitAnimation: "fade",
      },
    );
  };

  const pendingInvites = (invitesData?.invites ?? []).filter(
    (inv) => inv.university !== null,
  );

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
  const requests = requestsData?.requests ?? [];

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

  // In-flight requests contribute to both a partner row's pending count and
  // the requestable table's per-university "already requested" state.
  const inFlightByUniversityId: Record<string, InFlightRequestStatus> = {};
  for (const r of requests) {
    if (!r.university) continue;
    if (
      r.status !== "awaiting_signature" &&
      r.status !== "awaiting_verification"
    )
      continue;
    inFlightByUniversityId[r.university.id] = r.status;

    const entry =
      byUni.get(r.university.id) ??
      ({
        university: r.university,
        moas: [],
        activeCount: 0,
        pendingCount: 0,
      } as PartnerUniversity);
    entry.pendingCount += 1;
    byUni.set(r.university.id, entry);
  }

  const partners = [...byUni.values()].sort(
    (a, b) =>
      b.activeCount - a.activeCount ||
      b.pendingCount - a.pendingCount ||
      a.university.registered_name.localeCompare(b.university.registered_name),
  );

  const requestableUniversities = (universitiesData?.universities ?? []).filter(
    (u): u is CompanyUniversityDirectoryItemDto => u.requestable,
  );
  const hasActiveMoaByUniversityId = Object.fromEntries(
    moas
      .filter((moa) => moa.status === "active" && !moa.is_expired)
      .map((moa) => [moa.university.id, true]),
  );

  const hasCareerTask = !vLoading && !!verification?.canPostListing;
  const hasInviteTask = pendingInvites.length > 0;
  // "Incomplete" already has a persistent notice in the header on every
  // page (including this one) — showing it again here would be the
  // duplicate banner. "Pending" has no header equivalent, so it still
  // belongs here.
  const hasVerificationTask = status === "pending";
  const notificationCount =
    (hasCareerTask ? 1 : 0) +
    (hasInviteTask ? 1 : 0) +
    (hasVerificationTask ? 1 : 0);
  const notificationBorderClass =
    notificationCount > 1 ? "border-gray-200" : "border-primary/25";
  const navigateToDetail = (uniId: string) => {
    router.push(`/partners/${uniId}`);
  };
  const locked = status === "incomplete";

  return (
    <PageContainer className="space-y-8">
      <NotificationCenter
        className={notificationBorderClass}
        count={notificationCount}
      >
        {hasCareerTask && <CareerListingCta />}

        {hasVerificationTask && <CompanyProfileStatusNotice status="pending" />}

        {hasInviteTask &&
          (() => {
            const invite = pendingInvites[0];
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
                    variant="outline"
                    scheme="primary"
                    expandIcon
                    className="w-full bg-transparent sm:shrink-0 sm:bg-background"
                    onClick={(event) => {
                      event.stopPropagation();
                      router.push(`/invite/continue?invite_id=${invite.id}`);
                    }}
                  >
                    <FileSignature aria-hidden="true" />
                    <span className="button-label">Sign MOA</span>
                  </Button>
                }
                className="cursor-pointer"
                key={invite.id}
                role="button"
                tabIndex={0}
                onClick={() =>
                  router.push(`/invite/continue?invite_id=${invite.id}`)
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    router.push(`/invite/continue?invite_id=${invite.id}`);
                  }
                }}
              />
            );
          })()}
      </NotificationCenter>

      <PageHeader
        title="Partners"
        description="Active partnerships and universities available to request an MOA from."
      />

      <Tabs
        value={dashboardTab}
        onValueChange={(value) =>
          setDashboardTab(value === "requestable" ? "requestable" : "active")
        }
      >
        <TabsContent value="active">
          <CompanyPartnersTable
            partners={partners}
            isLoading={moasLoading || vLoading}
            canRequest={!locked}
            initialSearch={initialPartnerSearch}
            initialStatuses={initialPartnerStatuses}
            initialRanges={initialActiveMoaRanges}
            initialPage={initialPartnerPage}
            onPartnerClick={(partner) =>
              navigateToDetail(partner.university.id)
            }
            onQueryChange={updatePartnerQuery}
            onBrowseRequestable={() => setDashboardTab("requestable")}
            toolbarStart={
              <DashboardTabs
                activeCount={partners.length}
                requestableCount={requestableUniversities.length}
              />
            }
          />
        </TabsContent>
        <TabsContent value="requestable">
          <RequestableUniversitiesTable
            universities={requestableUniversities}
            isLoading={universitiesLoading || vLoading}
            onRequest={openRequestDialog}
            inFlightByUniversityId={inFlightByUniversityId}
            hasActiveMoaByUniversityId={hasActiveMoaByUniversityId}
            locked={locked}
            toolbarStart={
              <DashboardTabs
                activeCount={partners.length}
                requestableCount={requestableUniversities.length}
              />
            }
          />
        </TabsContent>
      </Tabs>
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
