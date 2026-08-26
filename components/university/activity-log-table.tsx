"use client";

import type { UniversityAuditLogEntryDto } from "@/app/api";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import {
  useResourceTable,
  type ResourceFilterValue,
} from "@/components/ui/use-resource-table";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/utils";

const EVENT_LABELS: Record<string, string> = {
  request_received: "MOA request received",
  moa_confirmed: "MOA confirmed",
  moa_rejected: "MOA rejected",
  partner_details_changed: "Partner details changed",
  moa_revoked: "MOA revoked",
  company_blacklisted: "Company blacklisted",
  company_unblacklisted: "Company removed from blacklist",
  company_invite_sent: "Company invite sent",
  company_invite_cancelled: "Company invite cancelled",
  company_invite_registered: "Company registered via invite",
  company_invite_accepted: "Company queued MOA via invite",
  legacy_moa_created: "Legacy MOA created",
  legacy_document_uploaded: "Legacy document uploaded",
  university_profile_updated: "University profile updated",
  university_account_invited: "Staff invited",
  university_account_role_changed: "Staff role changed",
  university_account_deactivated: "Staff deactivated",
  university_account_reactivated: "Staff reactivated",
  university_account_signed_in: "Signed in",
};

const EVENT_TYPES: Record<string, BadgeProps["type"]> = {
  request_received: "primary",
  moa_confirmed: "supportive",
  moa_rejected: "destructive",
  partner_details_changed: "warning",
  moa_revoked: "destructive",
  company_blacklisted: "destructive",
  company_unblacklisted: "default",
  company_invite_sent: "primary",
  company_invite_cancelled: "default",
  company_invite_registered: "warning",
  company_invite_accepted: "supportive",
  legacy_moa_created: "default",
  legacy_document_uploaded: "default",
  university_profile_updated: "default",
  university_account_invited: "primary",
  university_account_role_changed: "warning",
  university_account_deactivated: "destructive",
  university_account_reactivated: "supportive",
  university_account_signed_in: "default",
};

function EventBadge({ eventType }: { eventType: string }) {
  return (
    <Badge type={EVENT_TYPES[eventType] ?? "default"}>
      {EVENT_LABELS[eventType] ?? eventType}
    </Badge>
  );
}

export function ActivityLogTable({
  logs,
  isLoading,
}: {
  logs: UniversityAuditLogEntryDto[];
  isLoading: boolean;
}) {
  const eventOptions = Array.from(new Set(logs.map((log) => log.event_type)))
    .sort((left, right) =>
      (EVENT_LABELS[left] ?? left).localeCompare(EVENT_LABELS[right] ?? right),
    )
    .map((eventType) => ({
      value: eventType,
      label: EVENT_LABELS[eventType] ?? eventType,
      count: logs.filter((log) => log.event_type === eventType).length,
    }));

  const columns: Array<ResourceTableColumn<UniversityAuditLogEntryDto>> = [
    {
      id: "event",
      header: "Event",
      width: "w-[24%]",
      getSortValue: (log) => log.event_type,
      render: (log) => <EventBadge eventType={log.event_type} />,
    },
    {
      id: "by",
      header: "By",
      width: "w-[24%]",
      getSortValue: (log) => log.actor_email ?? "—",
      render: (log) => (
        <span className="text-muted-foreground">{log.actor_email ?? "—"}</span>
      ),
    },
    {
      id: "date",
      header: "Date",
      width: "w-[20%]",
      defaultSortDirection: "desc",
      getSortValue: (log) => log.created_at,
      render: (log) => (
        <span className="text-muted-foreground">
          {formatDateTime(log.created_at)}
        </span>
      ),
    },
    {
      id: "detail",
      header: "Detail",
      width: "w-[32%]",
      getSortValue: (log) => log.detail ?? "—",
      render: (log) => (
        <span className="text-muted-foreground">{log.detail ?? "—"}</span>
      ),
    },
  ];

  const table = useResourceTable({
    data: logs,
    getRowId: (log) => log.id,
    columns,
    search: {
      placeholder: "Search events...",
      ariaLabel: "Search events",
      matches: (log, query) =>
        [
          log.event_type,
          log.actor_email ?? "—",
          log.created_at,
          log.detail,
        ].some((value) => value?.toLowerCase().includes(query)),
    },
    filters:
      eventOptions.length > 0
        ? {
            groups: [{ id: "event", label: "Event", options: eventOptions }],
            matches: (log, filters: ResourceFilterValue) => {
              const selectedEvents = filters.event ?? [];
              return (
                selectedEvents.length === 0 ||
                selectedEvents.includes(log.event_type)
              );
            },
          }
        : undefined,
    sort: { initialColumn: "date", initialDirection: "desc" },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50, 100] },
  });

  if (isLoading) {
    return (
      <div className="space-y-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <ResourceTable
      table={table}
      className="[&_table]:min-w-[800px]"
      renderMobileRow={(log) => (
        <article className="px-4 py-3">
          <EventBadge eventType={log.event_type} />
          <dl className="text-muted-foreground mt-3 space-y-1.5 text-sm">
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-gray-700">By</dt>
              <dd className="min-w-0 break-words">{log.actor_email ?? "—"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-gray-700">Date</dt>
              <dd>{formatDateTime(log.created_at)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="shrink-0 font-medium text-gray-700">Detail</dt>
              <dd className="min-w-0 break-words">{log.detail ?? "—"}</dd>
            </div>
          </dl>
        </article>
      )}
      emptyState={{ title: "No results." }}
      noResultsState={{ title: "No results." }}
      rowLabelSingular="event"
      rowLabelPlural="events"
    />
  );
}
