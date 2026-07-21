"use client";

import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useResourceTable,
  type ResourceFilterValue,
} from "@/components/ui/use-resource-table";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { TruncatedTooltip } from "@/components/ui/truncated-tooltip";
import { formatDateWithoutTime } from "@/lib/utils";

export interface UniversityRenewal {
  id: string;
  email: string;
  displayName: string;
  companyId: string | null;
  requestedAt: string;
  status: "renewed" | "awaiting" | "lapsed";
}

/** D10 — outcome-based vocabulary; the nudge-vs-invite mechanism stays invisible. */
const RENEWAL_STATUS_LABELS: Record<UniversityRenewal["status"], string> = {
  renewed: "Renewed",
  awaiting: "Awaiting",
  lapsed: "Lapsed",
};

function RenewalStatusBadge({ status }: { status: UniversityRenewal["status"] }) {
  if (status === "renewed") return <PartnershipStatusBadge status="active" label="Renewed" />;
  if (status === "lapsed") return <PartnershipStatusBadge status="expired" label="Lapsed" />;
  return <PartnershipStatusBadge status="inactive" label="Awaiting" />;
}

function RenewalsTableSkeleton() {
  return (
    <div className="space-y-1">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function UniversityRenewalsTable({
  renewals,
  isLoading,
}: {
  renewals: UniversityRenewal[];
  isLoading: boolean;
}) {
  const statusOptions = (["renewed", "awaiting", "lapsed"] as const).map((status) => ({
    value: status,
    label: RENEWAL_STATUS_LABELS[status],
    count: renewals.filter((r) => r.status === status).length,
  }));

  const columns: Array<ResourceTableColumn<UniversityRenewal>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[20%]",
      getSortValue: (r) => r.status,
      render: (r) => <RenewalStatusBadge status={r.status} />,
    },
    {
      id: "company",
      header: "Company",
      width: "w-[45%]",
      getSortValue: (r) => r.displayName,
      render: (r) => {
        const showEmail = r.displayName !== r.email;
        return (
          <div className="min-w-0">
            <TruncatedTooltip className="font-medium text-gray-900">
              {r.displayName}
            </TruncatedTooltip>
            {showEmail && (
              <p className="text-muted-foreground truncate text-xs">{r.email}</p>
            )}
          </div>
        );
      },
    },
    {
      id: "requested",
      header: "Requested",
      width: "w-[20%]",
      defaultSortDirection: "desc",
      getSortValue: (r) => r.requestedAt,
      render: (r) => (
        <span className="text-muted-foreground">{formatDateWithoutTime(r.requestedAt)}</span>
      ),
    },
  ];

  const table = useResourceTable({
    data: renewals,
    getRowId: (r) => r.id,
    columns,
    search: {
      placeholder: "Search by company…",
      ariaLabel: "Search renewal requests",
      matches: (r, query) =>
        [r.displayName, r.email, RENEWAL_STATUS_LABELS[r.status]].some((value) =>
          value.toLowerCase().includes(query),
        ),
    },
    filters: {
      groups: [{ id: "status", label: "Status", options: statusOptions }],
      matches: (r, filters: ResourceFilterValue) => {
        const selectedStatuses = filters.status ?? [];
        return selectedStatuses.length === 0 || selectedStatuses.includes(r.status);
      },
    },
    sort: { initialColumn: "requested", initialDirection: "desc" },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50] },
  });

  if (isLoading) return <RenewalsTableSkeleton />;

  return (
    <ResourceTable
      table={table}
      className="[&_table]:min-w-[600px]"
      renderMobileRow={(r) => {
        const showEmail = r.displayName !== r.email;
        return (
          <article className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <TruncatedTooltip className="text-sm font-semibold text-gray-900">
                  {r.displayName}
                </TruncatedTooltip>
                {showEmail && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">{r.email}</p>
                )}
              </div>
              <div className="shrink-0">
                <RenewalStatusBadge status={r.status} />
              </div>
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Requested {formatDateWithoutTime(r.requestedAt)}
            </p>
          </article>
        );
      }}
      emptyState={{ title: "No renewal requests yet." }}
      noResultsState={{ title: "No results." }}
      rowLabelSingular="renewal"
      rowLabelPlural="renewals"
    />
  );
}
