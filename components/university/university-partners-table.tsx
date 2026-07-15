"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { ArrowRight, UserPlus } from "lucide-react";

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
import { formatDateWithoutTime } from "@/lib/utils";

export interface UniversityBlacklistEntry {
  id: string;
  company_id: string;
  reason: string | null;
  created_at: string;
  actor_email: string | null;
  company: { id: string; registered_name: string };
}

export interface UniversityLegacyCompanySummary {
  id: string;
  company_name: string;
  company_details: Record<string, unknown>;
  moaCount: number;
  documentCount: number;
  valid_until: string | null;
  hasMoa: boolean;
  hasPerpetualMoa: boolean;
  latestMoaEffectiveDate: string | null;
  latestMoaExpiryDate: string | null;
  latestMoaIsPerpetual: boolean;
}

export interface UniversityPartnerTableRow {
  id: string;
  displayName: string;
  logoUrl: string | null;
  partnerCompany: {
    id: string;
    registered_name: string;
    company_type: string | null;
  } | null;
  latestMoaId: string | null;
  latestMoaStatus: string | null;
  hasActiveMoa: boolean;
  effectiveDate: string | null;
  expiryDate: string | null;
  isPartnerExpired: boolean | null;
  isBlacklisted: boolean;
  blacklistEntry: UniversityBlacklistEntry | null;
  legacyEntry: UniversityLegacyCompanySummary | null;
  isImported: boolean;
  contactEmail: string | null;
}

function getPartnerStatus(row: UniversityPartnerTableRow) {
  if (row.isBlacklisted) return "Blacklisted";
  if (row.isImported && row.legacyEntry) {
    if (!row.legacyEntry.hasMoa) return "None";
    if (row.legacyEntry.hasPerpetualMoa) return "Active";
    if (
      row.legacyEntry.valid_until &&
      row.legacyEntry.valid_until < new Date().toISOString()
    ) {
      return "Expired";
    }
    return "Active";
  }
  if (row.hasActiveMoa) return "Active";
  if (row.isPartnerExpired) return "Expired";
  if (row.latestMoaStatus === "revoked") return "Revoked";
  return row.latestMoaStatus ?? "None";
}

function getPartnerStartDate(row: UniversityPartnerTableRow) {
  if (row.isImported && row.legacyEntry) {
    return row.legacyEntry.latestMoaEffectiveDate
      ? formatDateWithoutTime(row.legacyEntry.latestMoaEffectiveDate)
      : "—";
  }
  return row.effectiveDate ? formatDateWithoutTime(row.effectiveDate) : "—";
}

function getPartnerEndDate(row: UniversityPartnerTableRow) {
  if (row.isImported && row.legacyEntry) {
    if (row.legacyEntry.latestMoaIsPerpetual) return null;
    return row.legacyEntry.latestMoaExpiryDate
      ? formatDateWithoutTime(row.legacyEntry.latestMoaExpiryDate)
      : "—";
  }
  if (!row.effectiveDate) return "—";
  return row.expiryDate ? formatDateWithoutTime(row.expiryDate) : null;
}

function PartnerStatus({ row }: { row: UniversityPartnerTableRow }) {
  const status = getPartnerStatus(row);
  return <PartnershipStatusBadge status={status} />;
}

function PartnerEndDate({ row }: { row: UniversityPartnerTableRow }) {
  const endDate = getPartnerEndDate(row);
  if (endDate === null) {
    return (
      <span className="bg-primary/20 text-primary inline-flex rounded-full px-2 py-1 text-sm">
        Perpetual
      </span>
    );
  }
  return <span className="text-muted-foreground text-sm">{endDate}</span>;
}

function companyInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function CompanyLogo({ row }: { row: UniversityPartnerTableRow }) {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-xs font-semibold text-gray-600">
      {row.logoUrl ? (
        // Company logos are user-uploaded external assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.logoUrl}
          alt={`${row.displayName} logo`}
          className="h-full w-full object-contain p-1"
        />
      ) : (
        <span aria-hidden="true">{companyInitials(row.displayName)}</span>
      )}
    </div>
  );
}

function PartnersTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Skeleton className="h-11 w-full max-w-xl" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
        <Skeleton className="h-11 w-full rounded-none" />
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className="flex h-16 items-center gap-6 border-t px-5"
          >
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="hidden h-4 w-48 md:block" />
            <Skeleton className="hidden h-7 w-20 md:block" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function UniversityPartnersTable({
  rows,
  isLoading,
  toolbarActions,
  onPartnerClick,
  onInvite,
}: {
  rows: UniversityPartnerTableRow[];
  isLoading: boolean;
  toolbarActions: ReactNode;
  onPartnerClick: (row: UniversityPartnerTableRow) => void;
  onInvite: (row: UniversityPartnerTableRow) => void;
}) {
  const statusOptions = Array.from(
    new Set(rows.map((row) => getPartnerStatus(row))),
  )
    .sort((left, right) => left.localeCompare(right))
    .map((status) => ({
      value: status.toLowerCase(),
      label: status,
      count: rows.filter((row) => getPartnerStatus(row) === status).length,
    }));

  const columns: Array<ResourceTableColumn<UniversityPartnerTableRow>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[12%]",
      getSortValue: getPartnerStatus,
      render: (row) => <PartnerStatus row={row} />,
    },
    {
      id: "company",
      header: "Company",
      width: "w-[44%]",
      getSortValue: (row) => row.displayName,
      render: (row) => (
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo row={row} />
          <div className="flex min-w-0 items-center gap-2">
            <p className="truncate font-medium text-gray-900">
              {row.displayName}
            </p>
            {row.isBlacklisted && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Blacklisted
              </span>
            )}
          </div>
        </div>
      ),
    },
    {
      id: "start-date",
      header: "Start Date",
      width: "w-[15%]",
      getSortValue: getPartnerStartDate,
      render: (row) => (
        <span className="text-muted-foreground text-sm">
          {getPartnerStartDate(row)}
        </span>
      ),
    },
    {
      id: "end-date",
      header: "End Date",
      width: "w-[15%]",
      getSortValue: getPartnerEndDate,
      render: (row) => <PartnerEndDate row={row} />,
    },
    {
      id: "actions",
      header: "Actions",
      width: "w-[14%]",
      sortable: false,
      render: (row) =>
        !row.isBlacklisted && !row.hasActiveMoa ? (
          <Button
            size="xs"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onInvite(row);
            }}
          >
            <UserPlus className="h-3.5 w-3.5" /> Invite
          </Button>
        ) : null,
    },
  ];

  const table = useResourceTable({
    data: rows,
    getRowId: (row) => row.id,
    columns,
    search: {
      placeholder: "Search by company...",
      ariaLabel: "Search partners by company",
      matches: (row, query) => row.displayName.toLowerCase().includes(query),
    },
    filters: {
      groups: [
        { id: "status", label: "Status", options: statusOptions },
        {
          id: "imported",
          label: "Imported",
          options: [
            {
              value: "yes",
              label: "Yes",
              count: rows.filter((row) => row.isImported).length,
            },
            {
              value: "no",
              label: "No",
              count: rows.filter((row) => !row.isImported).length,
            },
          ],
        },
      ],
      matches: (row, filters: ResourceFilterValue) => {
        const selectedStatuses = filters.status ?? [];
        const selectedImported = filters.imported ?? [];
        const importedValue = row.isImported ? "yes" : "no";
        return (
          (selectedStatuses.length === 0 ||
            selectedStatuses.includes(getPartnerStatus(row).toLowerCase())) &&
          (selectedImported.length === 0 ||
            selectedImported.includes(importedValue))
        );
      },
    },
    sort: { initialColumn: "company", initialDirection: "asc" },
    pagination: { pageSize: 15, pageSizeOptions: [5, 10, 15] },
  });

  if (isLoading) return <PartnersTableSkeleton />;

  const hasFilters = (table.filters?.activeCount ?? 0) > 0;

  const handleMobileKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    row: UniversityPartnerTableRow,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onPartnerClick(row);
  };

  return (
    <ResourceTable
      table={table}
      className="[&_td]:py-2.5"
      toolbarLeading={<div className="ml-auto flex">{toolbarActions}</div>}
      onRowClick={onPartnerClick}
      getRowClassName={(row) =>
        row.isBlacklisted ? "bg-red-50 hover:bg-red-100/70" : undefined
      }
      renderMobileRow={(row) => (
        <article
          role="button"
          tabIndex={0}
          onClick={() => onPartnerClick(row)}
          onKeyDown={(event) => handleMobileKeyDown(event, row)}
          className={
            row.isBlacklisted
              ? "cursor-pointer bg-red-50 px-4 py-3 transition-colors hover:bg-red-100/70 focus-visible:outline-none"
              : "cursor-pointer px-4 py-3 transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.035] focus-visible:outline-none"
          }
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <CompanyLogo row={row} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {row.displayName}
                </p>
                <div className="mt-1.5">
                  <PartnerStatus row={row} />
                </div>
              </div>
            </div>
            <ArrowRight className="text-primary mt-1 h-4 w-4 shrink-0" />
          </div>
          <div className="mt-2.5 flex items-end justify-between gap-4">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-gray-700">Start: </span>
                {getPartnerStartDate(row)}
              </p>
              <p className="text-muted-foreground">
                <span className="font-medium text-gray-700">End: </span>
                <PartnerEndDate row={row} />
              </p>
            </div>
            {!row.isBlacklisted && !row.hasActiveMoa && (
              <Button
                size="xs"
                variant="outline"
                className="shrink-0"
                onClick={(event) => {
                  event.stopPropagation();
                  onInvite(row);
                }}
              >
                <UserPlus className="h-3.5 w-3.5" /> Invite
              </Button>
            )}
          </div>
        </article>
      )}
      emptyState={{
        title: "No partners found",
        description: "Your partner companies will appear here.",
      }}
      noResultsState={{
        title: hasFilters
          ? "No partners match the selected filters"
          : "No partners match your search",
        description: hasFilters
          ? "Try changing or clearing your filters."
          : "Try searching with a different company name.",
        action: hasFilters ? (
          <Button variant="outline" onClick={table.filters?.clear}>
            Clear filters
          </Button>
        ) : undefined,
      }}
      rowLabelSingular="partner"
      rowLabelPlural="partners"
    />
  );
}
