"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";

import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import {
  useResourceTable,
  type ResourceFilterValue,
} from "@/components/ui/use-resource-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { TruncatedTooltip } from "@/components/ui/truncated-tooltip";

export interface CompanyPartnerUniversity {
  university: {
    id: string;
    registered_name: string;
    logo_url: string | null;
  };
  activeCount: number;
  pendingCount: number;
}

export type PartnerStatus = "active" | "pending" | "inactive";
export type ActiveMoaRange = "0" | "1-2" | "3-5" | "6+";

const PARTNERS_PER_PAGE = 20;
const ACTIVE_MOA_RANGES: Array<{
  value: ActiveMoaRange;
  label: string;
  matches: (count: number) => boolean;
}> = [
  { value: "0", label: "0", matches: (count) => count === 0 },
  { value: "1-2", label: "1-2", matches: (count) => count >= 1 && count <= 2 },
  { value: "3-5", label: "3-5", matches: (count) => count >= 3 && count <= 5 },
  { value: "6+", label: "6+", matches: (count) => count >= 6 },
];

function universityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function PartnerLogo({ partner }: { partner: CompanyPartnerUniversity }) {
  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600">
      {partner.university.logo_url ? (
        // University logos are user-uploaded external assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={partner.university.logo_url}
          alt={`${partner.university.registered_name} logo`}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <span aria-hidden="true">
          {universityInitials(partner.university.registered_name)}
        </span>
      )}
    </div>
  );
}

export function parsePartnerStatuses(value: string | null): PartnerStatus[] {
  return (value?.split(",") ?? []).filter(
    (status): status is PartnerStatus =>
      status === "active" || status === "pending" || status === "inactive",
  );
}

export function parseActiveMoaRanges(value: string | null): ActiveMoaRange[] {
  return (value?.split(",") ?? []).filter((range): range is ActiveMoaRange =>
    ACTIVE_MOA_RANGES.some((option) => option.value === range),
  );
}

function PartnerStatusBadge({
  partner,
}: {
  partner: CompanyPartnerUniversity;
}) {
  const isActive = partner.activeCount > 0;
  const isPending = !isActive && partner.pendingCount > 0;

  return (
    <PartnershipStatusBadge
      status={isActive ? "active" : isPending ? "pending" : "inactive"}
      label={
        isActive
          ? "Active Partner"
          : isPending
            ? "Pending MOA"
            : "Inactive Partnership"
      }
    />
  );
}

function MoaCounts({ partner }: { partner: CompanyPartnerUniversity }) {
  return (
    <span className="inline-flex items-center gap-3 text-left">
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500">
        <FileText className="h-4 w-4" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-900">
          {partner.activeCount + partner.pendingCount}
        </span>
        <span className="text-muted-foreground block text-xs whitespace-nowrap">
          {[
            partner.activeCount > 0 && `${partner.activeCount} active`,
            partner.pendingCount > 0 && `${partner.pendingCount} pending`,
          ]
            .filter(Boolean)
            .join(" · ") || "No MOAs"}
        </span>
      </span>
    </span>
  );
}

function PartnersTableSkeleton({ toolbarStart }: { toolbarStart?: ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {toolbarStart}
        <div className="flex min-w-0 flex-1 justify-end gap-2">
          <Skeleton className="h-11 w-full max-w-xl" />
          <Skeleton className="h-11 w-11 shrink-0" />
        </div>
      </div>
      <div className="overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
        <Skeleton className="h-11 w-full rounded-none" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex h-24 items-center gap-4 border-t px-5">
            <Skeleton className="h-12 w-12 shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48 max-w-full" />
            </div>
            <Skeleton className="hidden h-4 w-20 md:block" />
            <Skeleton className="hidden h-4 w-12 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompanyPartnersTable({
  partners,
  isLoading,
  canRequest,
  initialSearch,
  initialStatuses,
  initialRanges,
  initialPage,
  onPartnerClick,
  onQueryChange,
  onBrowseRequestable,
  toolbarStart,
}: {
  partners: CompanyPartnerUniversity[];
  isLoading: boolean;
  canRequest: boolean;
  initialSearch: string;
  initialStatuses: PartnerStatus[];
  initialRanges: ActiveMoaRange[];
  initialPage: number;
  onPartnerClick: (partner: CompanyPartnerUniversity) => void;
  onQueryChange: (
    search: string,
    statuses: PartnerStatus[],
    ranges: ActiveMoaRange[],
    page: number,
  ) => void;
  /** Switches the dashboard to the "Available to request" tab, if it's tabbed. */
  onBrowseRequestable?: () => void;
  toolbarStart?: ReactNode;
}) {
  const statusCounts = {
    active: partners.filter((partner) => partner.activeCount > 0).length,
    pending: partners.filter(
      (partner) => partner.activeCount === 0 && partner.pendingCount > 0,
    ).length,
    inactive: partners.filter(
      (partner) => partner.activeCount === 0 && partner.pendingCount === 0,
    ).length,
  };

  const readCurrentQuery = () => {
    const params = new URLSearchParams(window.location.search);
    return {
      search: params.get("search") ?? "",
      statuses: parsePartnerStatuses(params.get("status")),
      ranges: parseActiveMoaRanges(params.get("moa_ranges")),
    };
  };

  const partnerHref = (partner: CompanyPartnerUniversity) =>
    `/partners/${partner.university.id}`;

  const columns: Array<ResourceTableColumn<CompanyPartnerUniversity>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[15%]",
      defaultSortDirection: "desc",
      getSortValue: (partner) =>
        partner.activeCount > 0 ? 2 : partner.pendingCount > 0 ? 1 : 0,
      render: (partner) => (
        <Link
          href={partnerHref(partner)}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex text-inherit"
        >
          <PartnerStatusBadge partner={partner} />
        </Link>
      ),
    },
    {
      id: "university",
      header: "University",
      width: "w-[25%]",
      getSortValue: (partner) => partner.university.registered_name,
      render: (partner) => (
        <Link
          href={partnerHref(partner)}
          onClick={(event) => event.stopPropagation()}
          className="flex min-w-0 items-center gap-3 text-inherit"
        >
          <PartnerLogo partner={partner} />
          <TruncatedTooltip className="text-sm font-semibold text-gray-900">
            {partner.university.registered_name}
          </TruncatedTooltip>
        </Link>
      ),
    },
    {
      id: "active-moas",
      header: "MOAs",
      width: "w-[20%]",
      defaultSortDirection: "desc",
      getSortValue: (partner) => partner.activeCount + partner.pendingCount,
      render: (partner) => (
        <Link
          href={partnerHref(partner)}
          onClick={(event) => event.stopPropagation()}
          className="inline-flex text-inherit"
        >
          <MoaCounts partner={partner} />
        </Link>
      ),
    },
    {
      id: "action",
      header: <span className="sr-only">Action</span>,
      width: "w-[10%]",
      align: "right",
      sortable: false,
      render: (partner) => (
        <Link
          href={partnerHref(partner)}
          onClick={(event) => event.stopPropagation()}
          aria-label={`Open ${partner.university.registered_name}`}
          className="text-primary ml-auto inline-flex h-9 w-9 items-center justify-center"
        >
          <ChevronRight
            className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      ),
    },
  ];

  const table = useResourceTable<CompanyPartnerUniversity>({
    data: partners,
    getRowId: (partner) => partner.university.id,
    columns,
    search: {
      initialValue: initialSearch,
      placeholder: "Search universities...",
      ariaLabel: "Search partner universities",
      matches: (partner, query) =>
        partner.university.registered_name.toLowerCase().includes(query),
      onChange: (value) => {
        const current = readCurrentQuery();
        onQueryChange(value, current.statuses, current.ranges, 1);
      },
    },
    filters: {
      initialValue: {
        status: initialStatuses,
        activeMoaRanges: initialRanges,
      },
      groups: [
        {
          id: "status",
          label: "Status",
          options: [
            { value: "active", label: "Active", count: statusCounts.active },
            {
              value: "pending",
              label: "Pending",
              count: statusCounts.pending,
            },
            {
              value: "inactive",
              label: "Inactive",
              count: statusCounts.inactive,
            },
          ],
        },
        {
          id: "activeMoaRanges",
          label: "Active MOAs",
          options: ACTIVE_MOA_RANGES.map((range) => ({
            value: range.value,
            label: range.label,
          })),
        },
      ],
      matches: (partner, filters: ResourceFilterValue) => {
        const statuses = parsePartnerStatuses((filters.status ?? []).join(","));
        const ranges = parseActiveMoaRanges(
          (filters.activeMoaRanges ?? []).join(","),
        );
        const status: PartnerStatus =
          partner.activeCount > 0
            ? "active"
            : partner.pendingCount > 0
              ? "pending"
              : "inactive";
        const matchesStatus =
          statuses.length === 0 || statuses.includes(status);
        const matchesMoaRange =
          ranges.length === 0 ||
          ACTIVE_MOA_RANGES.some(
            (range) =>
              ranges.includes(range.value) &&
              range.matches(partner.activeCount),
          );
        return matchesStatus && matchesMoaRange;
      },
      onApply: (filters) => {
        const current = readCurrentQuery();
        onQueryChange(
          current.search,
          parsePartnerStatuses((filters.status ?? []).join(",")),
          parseActiveMoaRanges((filters.activeMoaRanges ?? []).join(",")),
          1,
        );
      },
    },
    sort: {
      initialColumn: "active-moas",
      initialDirection: "desc",
    },
    pagination: {
      initialPage,
      pageSize: PARTNERS_PER_PAGE,
      onPageChange: (page) => {
        const current = readCurrentQuery();
        onQueryChange(current.search, current.statuses, current.ranges, page);
      },
    },
  });

  if (isLoading) return <PartnersTableSkeleton toolbarStart={toolbarStart} />;

  const hasFilters = (table.filters?.activeCount ?? 0) > 0;

  return (
    <ResourceTable
      table={table}
      toolbarStart={toolbarStart}
      onRowClick={onPartnerClick}
      renderMobileRow={(partner) => (
        <Link
          href={partnerHref(partner)}
          className="group flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.035] focus-visible:outline-none"
        >
          <PartnerLogo partner={partner} />
          <div className="min-w-0 flex-1">
            <TruncatedTooltip className="text-sm font-semibold text-gray-900">
              {partner.university.registered_name}
            </TruncatedTooltip>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <PartnerStatusBadge partner={partner} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">
                {[
                  partner.activeCount > 0 && `${partner.activeCount} active`,
                  partner.pendingCount > 0 && `${partner.pendingCount} pending`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No MOAs"}
              </span>
            </div>
          </div>
          <ChevronRight className="text-primary h-4 w-4 shrink-0" />
        </Link>
      )}
      emptyState={{
        title: "No partner universities yet",
        description: canRequest
          ? "Browse partner universities and request your first memorandum of agreement. Pending companies can queue requests for automatic issuance after approval."
          : "Complete your company verification requirements to request MOAs from partner universities.",
        action: canRequest ? (
          onBrowseRequestable ? (
            <Button
              variant="outline"
              scheme="primary"
              onClick={onBrowseRequestable}
            >
              Browse universities
            </Button>
          ) : (
            <Button asChild variant="outline" scheme="primary">
              <Link href="/dashboard">Browse universities</Link>
            </Button>
          )
        ) : undefined,
      }}
      noResultsState={{
        title: hasFilters
          ? "No partners match the selected filters"
          : "No university partners match your search",
        description: hasFilters
          ? "Try changing or clearing your filters."
          : "Try another university name.",
        action: hasFilters ? (
          <Button
            variant="outline"
            scheme="primary"
            onClick={table.filters?.clear}
          >
            Clear filters
          </Button>
        ) : undefined,
      }}
      rowLabelSingular="partner"
      rowLabelPlural="partners"
    />
  );
}
