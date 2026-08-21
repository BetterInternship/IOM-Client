"use client";
import { Suspense } from "react";
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

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {description && (
        <p className="text-muted-foreground text-sm">{description}</p>
      )}
    </div>
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

  const openInviteDialog = (invite: (typeof pendingInvites)[number]) => {
    openModal(
      "request-moa",
      <RequestDialog
        universityId={invite.university!.id}
        defaultTemplateId={invite.template?.id ?? null}
        inviteId={invite.id}
        onClose={() => closeModal("request-moa")}
      />,
      {
        title: (
          <h2 className="text-2xl leading-snug font-semibold tracking-tight">
            Signing a MOA with{" "}
            <span className="text-primary">
              {invite.university!.registered_name}
            </span>
          </h2>
        ),
        panelClassName: "sm:!max-w-none",
        headerClassName: "request-moa-header",
        exitAnimation: "fade",
      },
    );
  };

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
    if (r.status !== "awaiting_signature" && r.status !== "awaiting_verification")
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

  const hasCareerTask = !vLoading && !!verification?.canPostListing;
  const hasInviteTask = pendingInvites.length > 0;
  const hasVerificationTask = !!status && status !== "verified";
  const notificationCount =
    (hasCareerTask ? 1 : 0) +
    (hasInviteTask ? 1 : 0) +
    (hasVerificationTask ? 1 : 0);
  const notificationBorderClass =
    notificationCount > 1
      ? "border-gray-200"
      : status === "incomplete" &&
          (verification?.reason === "rejected" ||
            verification?.reason === "expired")
        ? "border-destructive/30"
        : status === "incomplete"
          ? "border-warning/30"
          : "border-primary/25";
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

        {!vLoading && status && status !== "verified" && (
          <CompanyProfileStatusNotice
            status={status}
            reason={verification?.reason}
            documentRejections={verification?.documentRejections}
            expiredDocument={verification?.expiredDocument}
          />
        )}

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
                      openInviteDialog(invite);
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
                onClick={() => openInviteDialog(invite)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openInviteDialog(invite);
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

      {partners.length > 0 && (
        <div className="space-y-4">
          <SectionHeading title="Active partners" />
          {vLoading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <CompanyPartnersTable
              partners={partners}
              isLoading={moasLoading}
              canRequest={!locked}
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
        </div>
      )}

      <div className="space-y-4">
        {partners.length > 0 && <SectionHeading title="Available to request" />}
        <RequestableUniversitiesTable
          universities={requestableUniversities}
          isLoading={universitiesLoading || vLoading}
          onRequest={openRequestDialog}
          inFlightByUniversityId={inFlightByUniversityId}
          locked={locked}
        />
      </div>
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
