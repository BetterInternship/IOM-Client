"use client";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { useQuery } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import Link from "next/link";

export default function UniversityDashboardPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();

  const { data: queueData } = useQuery({
    queryKey: ["university-review-queue"],
    queryFn: () =>
      preconfiguredAxios.get("/api/university/review-queue?limit=5").then((r) => r.data),
    enabled: !!account,
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account) return null;

  const pendingCount = queueData?.moas?.length ?? 0;

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">{account.university.registered_name}</h1>
        <p className="text-sm text-gray-500 mt-1">
          Logged in as {account.display_name} · {account.role}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/university/review-queue"
          className="border rounded-xl p-5 hover:bg-gray-50 transition-colors space-y-1"
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Review Queue</p>
            {pendingCount > 0 && (
              <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                {pendingCount}
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400">Unreviewed MOA requests</p>
        </Link>

        <Link
          href="/university/partners"
          className="border rounded-xl p-5 hover:bg-gray-50 transition-colors space-y-1"
        >
          <p className="text-sm font-medium text-gray-700">Partners</p>
          <p className="text-xs text-gray-400">Companies with active MOAs</p>
        </Link>

        <Link
          href="/university/blacklist"
          className="border rounded-xl p-5 hover:bg-gray-50 transition-colors space-y-1"
        >
          <p className="text-sm font-medium text-gray-700">Blacklist</p>
          <p className="text-xs text-gray-400">Manage blocked companies</p>
        </Link>

        <Link
          href="/university/audit"
          className="border rounded-xl p-5 hover:bg-gray-50 transition-colors space-y-1"
        >
          <p className="text-sm font-medium text-gray-700">Audit Log</p>
          <p className="text-xs text-gray-400">Activity history</p>
        </Link>

        {isSuperadmin && (
          <Link
            href="/university/templates"
            className="border rounded-xl p-5 hover:bg-gray-50 transition-colors space-y-1"
          >
            <p className="text-sm font-medium text-gray-700">Offered Templates</p>
            <p className="text-xs text-gray-400">Manage available MOA templates</p>
          </Link>
        )}

        {isSuperadmin && (
          <Link
            href="/university/profile"
            className="border rounded-xl p-5 hover:bg-gray-50 transition-colors space-y-1"
          >
            <p className="text-sm font-medium text-gray-700">University Profile</p>
            <p className="text-xs text-gray-400">Signatory & institution info</p>
          </Link>
        )}
      </div>
    </div>
  );
}
