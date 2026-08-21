"use client";

import type { ReactNode } from "react";

import {
  useUniversityControllerCancelMoaInvite,
  useUniversityControllerCancelListingInvite,
} from "@/app/api";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useResourceTable,
  type ResourceFilterValue,
} from "@/components/ui/use-resource-table";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { TruncatedTooltip } from "@/components/ui/truncated-tooltip";
import { toastPresets } from "@/components/sonner-toaster";
import { formatDateWithoutTime } from "@/lib/utils";
import { toast } from "sonner";

export interface CompanyInvite {
  id: string;
  invited_email: string;
  company_name: string | null;
  template_id: string | null;
  template_name: string | null;
  personal_message: string | null;
  status: "pending" | "accepted" | "expired" | "used_waiting" | "cancelled";
  created_at: string;
  expires_at: string;
  // Unapproved companies have no registered_name yet (flow spec §3) —
  // resolveDisplayName() already falls back to company_name/invited_email.
  registered_company: { registered_name: string | null } | null;
}

// §8.5 — the two tabs share every label except "accepted": MOA invites are
// signed, listing invites are posted. Keep DB values semantic — this maps
// client-side only, never rename the enum to match copy.
function acceptedLabel(kind: "moa" | "listing"): string {
  return kind === "moa" ? "Signed MOA" : "Posted listing";
}

function InviteStatusBadge({
  status,
  kind,
}: {
  status: CompanyInvite["status"];
  kind: "moa" | "listing";
}) {
  if (status === "accepted") {
    return <PartnershipStatusBadge status="active" label={acceptedLabel(kind)} />;
  }
  if (status === "used_waiting") {
    return <PartnershipStatusBadge status="pending" label="Waiting" />;
  }
  if (status === "expired") {
    return <PartnershipStatusBadge status="expired" label="Expired" />;
  }
  if (status === "cancelled") {
    return <PartnershipStatusBadge status="cancelled" label="Cancelled" />;
  }
  return <PartnershipStatusBadge status="inactive" label="Not yet used" />;
}

function inviteStatusLabels(
  kind: "moa" | "listing",
): Record<CompanyInvite["status"], string> {
  return {
    pending: "Not yet used",
    accepted: acceptedLabel(kind),
    expired: "Expired",
    used_waiting: "Waiting",
    cancelled: "Cancelled",
  };
}

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

// §6.3 — the D4 escape hatch: Cancel on pending rows only. No re-send
// action — every invite is presumed sent the moment it's created (D3), so
// there's nothing to resend; it's already sitting in the recipient's inbox.
function InviteActions({
  invite,
  kind,
  onCancelled,
}: {
  invite: CompanyInvite;
  kind: "moa" | "listing";
  onCancelled: () => void;
}) {
  const mutationOptions = {
    onSuccess: () => {
      toast("Invite cancelled", toastPresets.success);
      onCancelled();
    },
    onError: (e: Error) =>
      toast(
        e.message ?? "Failed to cancel invite.",
        toastPresets.destructive,
      ),
  };
  // Kind is fixed per table instance (each tab renders its own), so exactly
  // one of these two mutations is ever actually invoked below.
  const cancelMoaInvite = useUniversityControllerCancelMoaInvite({
    mutation: mutationOptions,
  });
  const cancelListingInvite = useUniversityControllerCancelListingInvite({
    mutation: mutationOptions,
  });
  const cancelInvite = kind === "moa" ? cancelMoaInvite : cancelListingInvite;

  if (invite.status !== "pending") return null;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        variant="outline"
        scheme="destructive"
        size="sm"
        onClick={() => cancelInvite.mutate({ id: invite.id })}
        disabled={cancelInvite.isPending}
      >
        Cancel
      </Button>
    </div>
  );
}

function InvitesTableSkeleton({ toolbarStart }: { toolbarStart?: ReactNode }) {
  return (
    <div className="space-y-4">
      {toolbarStart && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 max-w-full overflow-hidden">
            {toolbarStart}
          </div>
          <Skeleton className="ml-auto h-11 w-full max-w-xl sm:w-80" />
        </div>
      )}
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function UniversityInvitesTable({
  invites,
  kind,
  isLoading,
  toolbarStart,
  onChanged,
}: {
  invites: CompanyInvite[];
  kind: "moa" | "listing";
  isLoading: boolean;
  toolbarStart?: ReactNode;
  onChanged: () => void;
}) {
  const statusLabels = inviteStatusLabels(kind);
  const statusOptions = Array.from(
    new Set(invites.map((invite) => invite.status)),
  ).map((status) => ({
    value: status,
    label: statusLabels[status],
    count: invites.filter((invite) => invite.status === status).length,
  }));

  const columns: Array<ResourceTableColumn<CompanyInvite>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[16%]",
      getSortValue: (invite) => invite.status,
      render: (invite) => (
        <InviteStatusBadge status={invite.status} kind={kind} />
      ),
    },
    {
      id: "company",
      header: "Company",
      width: kind === "moa" ? "w-[28%]" : "w-[46%]",
      getSortValue: resolveDisplayName,
      render: (invite) => {
        const name = resolveDisplayName(invite);
        const showEmail = name !== invite.invited_email;
        return (
          <div className="min-w-0">
            <TruncatedTooltip className="font-medium text-gray-900">
              <span className="uppercase">{name}</span>
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
    // Listing invites have no template — the column would just be an empty
    // "—" on every row, so it's dropped entirely on that tab.
    ...(kind === "moa"
      ? [
          {
            id: "template",
            header: "Template",
            width: "w-[18%]",
            getSortValue: (invite: CompanyInvite) => invite.template_name ?? "",
            render: (invite: CompanyInvite) => (
              <span className="text-muted-foreground">
                {invite.template_name ?? "—"}
              </span>
            ),
          } satisfies ResourceTableColumn<CompanyInvite>,
        ]
      : []),
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
      width: "w-[15%]",
      getSortValue: (invite) => invite.expires_at,
      render: (invite) => (
        <span className="text-muted-foreground">
          {formatDateWithoutTime(invite.expires_at)}
        </span>
      ),
    },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      width: "w-[8%]",
      align: "right",
      sortable: false,
      render: (invite) => (
        <InviteActions invite={invite} kind={kind} onCancelled={onChanged} />
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

  if (isLoading) return <InvitesTableSkeleton toolbarStart={toolbarStart} />;

  return (
    <ResourceTable
      table={table}
      className="[&_table]:min-w-[760px] [&_table]:text-sm"
      toolbarStart={toolbarStart}
      renderMobileRow={(invite) => {
        const name = resolveDisplayName(invite);
        const showEmail = name !== invite.invited_email;
        return (
          <article className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <TruncatedTooltip className="text-sm font-semibold text-gray-900">
                  <span className="uppercase">{name}</span>
                </TruncatedTooltip>
                {showEmail && (
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {invite.invited_email}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                <InviteStatusBadge status={invite.status} kind={kind} />
              </div>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {kind === "moa" && (
                <div className="min-w-0">
                  <dt className="text-muted-foreground">Template</dt>
                  <dd className="mt-0.5 truncate text-gray-700">
                    {invite.template_name ?? "—"}
                  </dd>
                </div>
              )}
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
