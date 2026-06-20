"use client";
import { useQuery } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

interface AuditEvent {
  id: string;
  event_type: string;
  actor_email: string | null;
  detail: string | null;
  created_at: string;
  company?: { display_name: string } | null;
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
};

const EVENT_COLORS: Record<string, string> = {
  request_received: "bg-blue-100 text-blue-800",
  moa_confirmed: "bg-green-100 text-green-800",
  moa_rejected: "bg-red-100 text-red-700",
  partner_details_changed: "bg-amber-100 text-amber-800",
  moa_revoked: "bg-red-100 text-red-700",
  company_blacklisted: "bg-red-100 text-red-700",
  company_unblacklisted: "bg-gray-100 text-gray-700",
};

export default function AuditPage() {
  const { account, isLoading } = useUniversityProfile();

  const { data, isLoading: aLoading } = useQuery({
    queryKey: ["university-audit"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/audit?limit=100")
        .then((r) => r.data as { logs: AuditEvent[] }),
    enabled: !!account,
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account) return null;

  const events = data?.logs ?? [];

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Audit Log</h1>

      {aLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!aLoading && events.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500 text-sm">No audit events yet.</p>
        </div>
      )}

      <div className="space-y-2">
        {events.map((ev) => (
          <div key={ev.id} className="border rounded-lg p-4 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${EVENT_COLORS[ev.event_type] ?? "bg-gray-100 text-gray-700"}`}
              >
                {EVENT_LABELS[ev.event_type] ?? ev.event_type}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(ev.created_at).toLocaleString()}
              </span>
            </div>
            {ev.company && (
              <p className="text-sm text-gray-700">{ev.company.display_name}</p>
            )}
            {ev.detail && <p className="text-xs text-gray-500">{ev.detail}</p>}
            {ev.actor_email && (
              <p className="text-xs text-gray-400">By {ev.actor_email}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
