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

export interface CompanyInvite {
  id: string;
  invited_email: string;
  company_name: string | null;
  template_id: string | null;
  template_name: string | null;
  personal_message: string | null;
  status: "pending" | "accepted" | "expired" | "used_waiting";
  kind: "moa" | "listing";
  created_at: string;
  expires_at: string;
  registered_company: { registered_name: string } | null;
}

function InviteStatusBadge({ status }: { status: CompanyInvite["status"] }) {
  if (status === "accepted") {
    return <PartnershipStatusBadge status="active" label="Accepted" />;
  }
  if (status === "used_waiting") {
    return (
      <span className="bg-primary/10 text-primary inline-flex max-w-full items-center rounded-full px-2.5 py-1.5 text-sm leading-tight font-semibold whitespace-normal">
        Registered · awaiting MOA
      </span>
    );
  }
  if (status === "expired") {
    return <PartnershipStatusBadge status="expired" label="Expired" />;
  }
  return <PartnershipStatusBadge status="inactive" label="Pending" />;
}

const INVITE_STATUS_LABELS: Record<CompanyInvite["status"], string> = {
  pending: "Pending",
  accepted: "Accepted",
  expired: "Expired",
  used_waiting: "Registered — awaiting MOA",
};

function resolveDisplayName(invite: CompanyInvite): string {
  const registeredName =
    (invite.status === "accepted" || invite.status === "used_waiting") &&
    invite.registered_company
      ? invite.registered_company.registered_name
      : null;
  if (registeredName) {
    return invite.company_name && invite.company_name !== registeredName
      ? `${registeredName} (${invite.company_name})`
      : registeredName;
  }
  return invite.company_name ?? invite.invited_email;
}

function InvitesTableSkeleton() {
  return (
    <div className="space-y-1">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function UniversityInvitesTable({
  invites,
  isLoading,
}: {
  invites: CompanyInvite[];
  isLoading: boolean;
}) {
  const statusOptions = Array.from(
    new Set(invites.map((invite) => invite.status)),
  ).map((status) => ({
    value: status,
    label: INVITE_STATUS_LABELS[status],
    count: invites.filter((invite) => invite.status === status).length,
  }));

  const columns: Array<ResourceTableColumn<CompanyInvite>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[22%]",
      getSortValue: (invite) => invite.status,
      render: (invite) => <InviteStatusBadge status={invite.status} />,
    },
    {
      id: "company",
      header: "Company",
      width: "w-[24%]",
      getSortValue: resolveDisplayName,
      render: (invite) => {
        const name = resolveDisplayName(invite);
        const showEmail = name !== invite.invited_email;
        return (
          <div className="min-w-0">
            <TruncatedTooltip className="font-medium text-gray-900">
              {name}
            </TruncatedTooltip>
            {showEmail && (
              <p className="text-muted-foreground truncate text-xs">
                {invite.invited_email}
              </p>
            )}
          </div>
        );
      },
    },
    {
      id: "template",
      header: "Template",
      width: "w-[23%]",
      getSortValue: (invite) => invite.template_name ?? "",
      render: (invite) => (
        <span className="text-muted-foreground">
          {invite.template_name ?? "—"}
        </span>
      ),
    },
    {
      id: "sent",
      header: "Sent",
      width: "w-[15%]",
      defaultSortDirection: "desc",
      getSortValue: (invite) => invite.created_at,
      render: (invite) => (
        <span className="text-muted-foreground">
          {formatDateWithoutTime(invite.created_at)}
        </span>
      ),
    },
    {
      id: "expires",
      header: "Expires",
      width: "w-[16%]",
      getSortValue: (invite) => invite.expires_at,
      render: (invite) => (
        <span className="text-muted-foreground">
          {formatDateWithoutTime(invite.expires_at)}
        </span>
      ),
    },
  ];

  const table = useResourceTable({
    data: invites,
    getRowId: (invite) => invite.id,
    columns,
    search: {
      placeholder: "Search by company…",
      ariaLabel: "Search company invites",
      matches: (invite, query) =>
        [
          resolveDisplayName(invite),
          invite.template_name ?? "—",
          formatDateWithoutTime(invite.created_at),
          formatDateWithoutTime(invite.expires_at),
          invite.status,
        ].some((value) => value.toLowerCase().includes(query)),
    },
    filters: {
      groups: [{ id: "status", label: "Status", options: statusOptions }],
      matches: (invite, filters: ResourceFilterValue) => {
        const selectedStatuses = filters.status ?? [];
        return (
          selectedStatuses.length === 0 ||
          selectedStatuses.includes(invite.status)
        );
      },
    },
    sort: { initialColumn: "sent", initialDirection: "desc" },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50] },
  });

  if (isLoading) return <InvitesTableSkeleton />;

  return (
    <ResourceTable
      table={table}
      className="[&_table]:min-w-[760px]"
      renderMobileRow={(invite) => {
        const name = resolveDisplayName(invite);
        const showEmail = name !== invite.invited_email;
        return (
          <article className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <TruncatedTooltip className="text-sm font-semibold text-gray-900">
                  {name}
                </TruncatedTooltip>
                {showEmail && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {invite.invited_email}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <InviteStatusBadge status={invite.status} />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div className="min-w-0">
                <dt className="text-muted-foreground">Template</dt>
                <dd className="mt-0.5 truncate text-gray-700">
                  {invite.template_name ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sent</dt>
                <dd className="mt-0.5 text-gray-700">
                  {formatDateWithoutTime(invite.created_at)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expires</dt>
                <dd className="mt-0.5 text-gray-700">
                  {formatDateWithoutTime(invite.expires_at)}
                </dd>
              </div>
            </dl>
          </article>
        );
      }}
      emptyState={{ title: "No results." }}
      noResultsState={{ title: "No results." }}
      rowLabelSingular="invite"
      rowLabelPlural="invites"
    />
  );
}
