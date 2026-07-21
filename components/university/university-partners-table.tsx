"use client";

import type { KeyboardEvent, ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, type Transition } from "framer-motion";
import { ChevronRight, UserPlus } from "lucide-react";

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
  registered_company_id: string | null;
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
  lastRenewalRequestedAt: string | null;
}

/** D1 — the tab boundary IS the invite-kind boundary. */
export type PartnerTab = "outstanding" | "expired" | "blacklisted";
export type BulkInviteAction = "listing" | "moa" | "renew";

function hasResolvableEmail(row: UniversityPartnerTableRow): boolean {
  // §4.2: registered companies always have an account email — only
  // imported/legacy rows can be missing a contact email (D7).
  return !row.isImported || !!row.contactEmail;
}

function getPartnerStatus(row: UniversityPartnerTableRow) {
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

function getPartnerEndDateIso(row: UniversityPartnerTableRow): string | null {
  if (row.isImported && row.legacyEntry) {
    if (row.legacyEntry.latestMoaIsPerpetual) return null;
    return row.legacyEntry.latestMoaExpiryDate ?? null;
  }
  if (!row.effectiveDate) return null;
  return row.expiryDate ?? null;
}

function getPartnerEndDateLabel(row: UniversityPartnerTableRow) {
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

/** D5 — amber within the expiring-soon window, with days remaining appended. */
function PartnerEndDate({
  row,
  tab,
  expiringSoonDays,
}: {
  row: UniversityPartnerTableRow;
  tab: PartnerTab;
  expiringSoonDays: number;
}) {
  const endDateIso = getPartnerEndDateIso(row);
  const label = getPartnerEndDateLabel(row);
  if (label === null) {
    return (
      <span className="bg-primary/20 text-primary inline-flex rounded-full px-2 py-1 text-sm">
        Perpetual
      </span>
    );
  }
  if (tab === "outstanding" && endDateIso) {
    const daysRemaining = Math.ceil(
      (new Date(endDateIso).getTime() - Date.now()) / 86_400_000,
    );
    if (daysRemaining >= 0 && daysRemaining <= expiringSoonDays) {
      return (
        <span className="text-sm font-medium text-amber-600">
          {label} · {daysRemaining}d
        </span>
      );
    }
  }
  return <span className="text-muted-foreground text-sm">{label}</span>;
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

function partnerHref(row: UniversityPartnerTableRow) {
  if (row.isImported && row.legacyEntry) {
    return `/partners/legacy/${row.legacyEntry.id}`;
  }
  return `/partners/registered/${row.partnerCompany?.id ?? row.id.replace("registered:", "")}`;
}

function PartnerLink({
  row,
  children,
  className,
}: {
  row: UniversityPartnerTableRow;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={partnerHref(row)}
      onClick={(event) => event.stopPropagation()}
      className={className}
    >
      {children}
    </Link>
  );
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

function relativeDays(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

const SECOND_LINE_TRANSITION = { duration: 0.15 } satisfies Transition;
// Matches the easing modal-provider.tsx uses for its fade-exit panels.
const BULK_BAR_TRANSITION = { duration: 0.22, ease: [0.16, 1, 0.3, 1] } satisfies Transition;

/**
 * D15/D7/D11 — the name cell's second line: at most one of these applies.
 * "Cannot invite" is informational only — it used to offer an inline "Add
 * email" link, but that was a button nested inside the row's own
 * PartnerLink, which fought the row-click navigation. Adding an email
 * happens from the partner's detail page instead. Only shown while the
 * university is actively mid-selection (1+ rows checked) — before that,
 * calling out an unselectable row is just noise, since selection isn't in
 * play yet. Gone entirely on the blacklisted tab, where there's no
 * bulk-select to begin with (D3).
 *
 * The wrapper below always reserves one line's worth of height, whether or
 * not it has content — row height stays constant across every state
 * (selecting/deselecting, with/without a renewal) instead of reflowing;
 * only the text's opacity animates.
 */
function CompanySecondLine({
  row,
  isBulkSelecting,
}: {
  row: UniversityPartnerTableRow;
  isBulkSelecting: boolean;
}) {
  const showCannotInvite = isBulkSelecting && row.isImported && !row.contactEmail;
  const renewalRequestedAt = showCannotInvite ? null : row.lastRenewalRequestedAt;

  return (
    <div className="mt-0.5 h-4">
      <AnimatePresence initial={false}>
        {showCannotInvite && (
          <motion.p
            key="cannot-invite"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SECOND_LINE_TRANSITION}
            className="text-muted-foreground truncate text-xs"
          >
            Cannot invite (missing email)
          </motion.p>
        )}
        {renewalRequestedAt && (
          <motion.p
            key="renewal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={SECOND_LINE_TRANSITION}
            className="text-muted-foreground truncate text-xs"
          >
            Renewal requested · {relativeDays(renewalRequestedAt)}
          </motion.p>
        )}
      </AnimatePresence>
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

const TAB_LABELS: Record<PartnerTab, { singular: string; plural: string }> = {
  outstanding: { singular: "partner", plural: "partners" },
  expired: { singular: "partner", plural: "partners" },
  blacklisted: { singular: "blacklisted company", plural: "blacklisted companies" },
};

export function UniversityPartnersTable({
  rows,
  isLoading,
  tab,
  expiringSoonDays,
  toolbarActions,
  onPartnerClick,
  onInvite,
  onBulkAction,
}: {
  rows: UniversityPartnerTableRow[];
  isLoading: boolean;
  tab: PartnerTab;
  expiringSoonDays: number;
  toolbarActions?: ReactNode;
  onPartnerClick: (row: UniversityPartnerTableRow) => void;
  // Unused for tab="blacklisted" — no invite affordance renders there (D3).
  onInvite?: (row: UniversityPartnerTableRow) => void;
  onBulkAction?: (action: BulkInviteAction, rows: UniversityPartnerTableRow[]) => void;
}) {
  const showStatusColumn = tab === "expired";
  const showSelection = tab !== "blacklisted";

  const statusOptions = showStatusColumn
    ? Array.from(new Set(rows.map((row) => getPartnerStatus(row))))
        .sort((left, right) => left.localeCompare(right))
        .map((status) => ({
          value: status.toLowerCase(),
          label: status,
          count: rows.filter((row) => getPartnerStatus(row) === status).length,
        }))
    : [];

  const columns: Array<ResourceTableColumn<UniversityPartnerTableRow>> = [];

  if (showStatusColumn) {
    columns.push({
      id: "status",
      header: "Status",
      width: "w-[12%]",
      getSortValue: getPartnerStatus,
      render: (row) => (
        <PartnerLink row={row} className="inline-flex text-inherit">
          <PartnerStatus row={row} />
        </PartnerLink>
      ),
    });
  }

  columns.push({
    id: "company",
    header: "Company",
    width: showStatusColumn ? "w-[38%]" : "w-[46%]",
    getSortValue: (row) => row.displayName,
    render: (row) => (
      <PartnerLink
        row={row}
        className="flex min-w-0 items-center gap-3 text-inherit"
      >
        <CompanyLogo row={row} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <TruncatedTooltip className="font-medium text-gray-900">
              {row.displayName}
            </TruncatedTooltip>
            {tab !== "blacklisted" &&
              row.isImported &&
              !row.legacyEntry?.registered_company_id && (
                <span className="text-muted-foreground shrink-0 rounded-full border border-gray-300 px-2 py-0.5 text-xs">
                  No account yet
                </span>
              )}
          </div>
          <CompanySecondLine
            row={row}
            isBulkSelecting={!!table.selection && table.selection.selectedCount > 0}
          />
        </div>
      </PartnerLink>
    ),
  });

  if (tab === "blacklisted") {
    columns.push({
      id: "reason",
      header: "Reason",
      width: "w-[28%]",
      sortable: false,
      render: (row) => (
        <PartnerLink row={row} className="block text-inherit">
          <TruncatedTooltip className="text-muted-foreground text-sm">
            {row.blacklistEntry?.reason ?? "—"}
          </TruncatedTooltip>
        </PartnerLink>
      ),
    });
    columns.push({
      id: "blacklisted-date",
      header: "Blacklisted",
      width: "w-[18%]",
      getSortValue: (row) => row.blacklistEntry?.created_at ?? "",
      defaultSortDirection: "desc",
      render: (row) => (
        <PartnerLink row={row} className="block text-inherit">
          <span className="text-muted-foreground text-sm">
            {row.blacklistEntry
              ? formatDateWithoutTime(row.blacklistEntry.created_at)
              : "—"}
          </span>
        </PartnerLink>
      ),
    });
  } else {
    columns.push({
      id: "start-date",
      header: "Start Date",
      width: showStatusColumn ? "w-[15%]" : "w-[17%]",
      getSortValue: getPartnerStartDate,
      render: (row) => (
        <PartnerLink row={row} className="block text-inherit">
          <span className="text-muted-foreground text-sm">
            {getPartnerStartDate(row)}
          </span>
        </PartnerLink>
      ),
    });
    columns.push({
      id: "end-date",
      header: "End Date",
      width: showStatusColumn ? "w-[15%]" : "w-[17%]",
      getSortValue: (row) => getPartnerEndDateIso(row) ?? "",
      render: (row) => (
        <PartnerLink row={row} className="block text-inherit">
          <PartnerEndDate row={row} tab={tab} expiringSoonDays={expiringSoonDays} />
        </PartnerLink>
      ),
    });
  }

  columns.push({
    id: "actions",
    header: "Actions",
    width: "w-[14%]",
    sortable: false,
    render: (row) => (
      <div className="flex items-center justify-end gap-2">
        {tab !== "blacklisted" && (
          <Button
            size="xs"
            variant="outline"
            onClick={(event) => {
              event.stopPropagation();
              onInvite?.(row);
            }}
          >
            <UserPlus className="h-3.5 w-3.5" /> Invite
          </Button>
        )}
        <PartnerLink
          row={row}
          className="text-primary inline-flex h-8 w-8 items-center justify-center"
        >
          <ChevronRight
            className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
          <span className="sr-only">Open {row.displayName}</span>
        </PartnerLink>
      </div>
    ),
  });

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
        ...(showStatusColumn
          ? [{ id: "status", label: "Status", options: statusOptions }]
          : []),
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
    selection: showSelection
      ? { enabled: true, isSelectable: hasResolvableEmail }
      : undefined,
  });

  if (isLoading) return <PartnersTableSkeleton />;

  const hasFilters = (table.filters?.activeCount ?? 0) > 0;
  const selection = table.selection;

  const handleMobileKeyDown = (
    event: KeyboardEvent<HTMLElement>,
    row: UniversityPartnerTableRow,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onPartnerClick(row);
  };

  const labels = TAB_LABELS[tab];

  return (
    <div className="relative">
      <ResourceTable
        table={table}
        className="[&_td]:py-2.5"
        toolbarLeading={
          toolbarActions ? <div className="ml-auto flex">{toolbarActions}</div> : undefined
        }
        onRowClick={onPartnerClick}
        renderMobileRow={(row) => (
          <article
            role="button"
            tabIndex={0}
            onClick={() => onPartnerClick(row)}
            onKeyDown={(event) => handleMobileKeyDown(event, row)}
            className="cursor-pointer px-4 py-3 transition-colors hover:bg-primary/[0.035] focus-visible:bg-primary/[0.035] focus-visible:outline-none"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <CompanyLogo row={row} />
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <TruncatedTooltip className="text-sm font-semibold text-gray-900">
                      {row.displayName}
                    </TruncatedTooltip>
                    {tab !== "blacklisted" &&
                      row.isImported &&
                      !row.legacyEntry?.registered_company_id && (
                        <span className="text-muted-foreground shrink-0 rounded-full border border-gray-300 px-1.5 py-0.5 text-[10px]">
                          No account yet
                        </span>
                      )}
                  </div>
                  <CompanySecondLine
                    row={row}
                    isBulkSelecting={!!table.selection && table.selection.selectedCount > 0}
                  />
                  {showStatusColumn && (
                    <div className="mt-1.5">
                      <PartnerStatus row={row} />
                    </div>
                  )}
                </div>
              </div>
              <PartnerLink
                row={row}
                className="text-primary mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
                <span className="sr-only">Open {row.displayName}</span>
              </PartnerLink>
            </div>
            {tab === "blacklisted" ? (
              <div className="mt-2.5 grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
                <p className="text-muted-foreground">
                  <span className="font-medium text-gray-700">Reason: </span>
                  {row.blacklistEntry?.reason ?? "—"}
                </p>
                <p className="text-muted-foreground">
                  <span className="font-medium text-gray-700">Date: </span>
                  {row.blacklistEntry ? formatDateWithoutTime(row.blacklistEntry.created_at) : "—"}
                </p>
              </div>
            ) : (
              <div className="mt-2.5 flex items-end justify-between gap-4">
                <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-gray-700">Start: </span>
                    {getPartnerStartDate(row)}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-gray-700">End: </span>
                    <PartnerEndDate row={row} tab={tab} expiringSoonDays={expiringSoonDays} />
                  </p>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  className="shrink-0"
                  onClick={(event) => {
                    event.stopPropagation();
                    onInvite?.(row);
                  }}
                >
                  <UserPlus className="h-3.5 w-3.5" /> Invite
                </Button>
              </div>
            )}
          </article>
        )}
        emptyState={{
          title: tab === "blacklisted" ? "No blacklisted companies" : "No partners found",
          description:
            tab === "blacklisted"
              ? "Companies you blacklist will appear here."
              : "Your partner companies will appear here.",
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
        rowLabelSingular={labels.singular}
        rowLabelPlural={labels.plural}
      />

      <AnimatePresence>
        {selection && selection.selectedCount > 0 && (
          <motion.div
            key="bulk-action-bar"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={BULK_BAR_TRANSITION}
            className="sticky bottom-4 z-40 mt-4 flex w-full justify-center"
          >
            <div className="flex flex-wrap items-center gap-3 rounded-[0.33em] border border-gray-200 bg-white px-4 py-3 shadow-lg">
              <span className="text-sm font-medium text-gray-700">
                {selection.selectedCount} selected
              </span>
              <Button variant="ghost" size="sm" onClick={selection.clear}>
                Clear
              </Button>
              {tab === "outstanding" ? (
                <>
                  <Button size="sm" onClick={() => onBulkAction?.("listing", selection.selectedRows)}>
                    Invite to post a listing
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onBulkAction?.("renew", selection.selectedRows)}
                  >
                    Invite to renew their MOA
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => onBulkAction?.("moa", selection.selectedRows)}>
                  Invite to sign an MOA
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
