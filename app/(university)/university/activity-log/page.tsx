"use client";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { formatDateTime } from "@/lib/utils";

interface AuditEvent {
  id: string;
  event_type: string;
  actor_email: string | null;
  detail: string | null;
  created_at: string;
  company?: { registered_name: string } | null;
  moa?: { id: string } | null;
}

const EVENT_LABELS: Record<string, string> = {
  request_received: "MOA request received",
  moa_confirmed: "MOA confirmed",
  moa_rejected: "MOA rejected",
  partner_details_changed: "Partner details changed",
  moa_revoked: "MOA revoked",
  company_blacklisted: "Company blacklisted",
  company_unblacklisted: "Company removed from blacklist",
  company_invite_sent: "Company invite sent",
  company_invite_registered: "Company registered via invite",
  company_invite_accepted: "Company queued MOA via invite",
  legacy_moa_created: "Legacy MOA created",
  legacy_document_uploaded: "Legacy document uploaded",
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
  company_invite_registered: "warning",
  company_invite_accepted: "supportive",
  legacy_moa_created: "default",
  legacy_document_uploaded: "default",
};

const columns: ColumnDef<AuditEvent>[] = [
  {
    id: "event",
    header: "Event",
    accessorKey: "event_type",
    cell: ({ row }) => (
      <Badge type={EVENT_TYPES[row.original.event_type] ?? "default"}>
        {EVENT_LABELS[row.original.event_type] ?? row.original.event_type}
      </Badge>
    ),
  },
  {
    id: "by",
    header: "By",
    accessorFn: (row) => row.actor_email ?? "—",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.actor_email ?? "—"}</span>
    ),
  },
  {
    id: "date",
    header: "Date",
    accessorKey: "created_at",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{formatDateTime(row.original.created_at)}</span>
    ),
  },
  {
    id: "detail",
    header: "Detail",
    accessorKey: "detail",
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.detail ?? "—"}</span>
    ),
  },
];

export default function ActivityLogPage() {
  const { account } = useUniversityProfile();

  const { data, isLoading } = useQuery({
    queryKey: ["university-audit"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/audit?limit=100")
        .then((r) => r.data as { logs: AuditEvent[] }),
    enabled: !!account,
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Review your institution's activity."
      />
      {isLoading ? (
        <div className="space-y-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          id="activity-log"
          columns={columns}
          data={data?.logs ?? []}
          searchKey="event"
          searchPlaceholder="Search events..."
          rowLabelSingular="event"
          rowLabelPlural="events"
          pageSizes={[25, 50, 100]}
        />
      )}
    </PageContainer>
  );
}
