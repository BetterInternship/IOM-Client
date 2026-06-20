"use client";
import { useQuery } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import Link from "next/link";

interface MoaSummary {
  id: string;
  created_at: string;
  effective_date: string;
  expiry_date: string;
  company: { id: string; display_name: string; registered_name: string | null };
  template: { name: string };
}

export default function ReviewQueuePage() {
  const { account, isLoading } = useUniversityProfile();

  const { data, isLoading: qLoading } = useQuery({
    queryKey: ["university-review-queue"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/review-queue")
        .then((r) => r.data as { moas: MoaSummary[] }),
    enabled: !!account,
    refetchInterval: 30_000,
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account) return null;

  const moas = data?.moas ?? [];

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Review Queue</h1>

      {qLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!qLoading && moas.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500 text-sm">No pending MOAs to review.</p>
        </div>
      )}

      <div className="space-y-3">
        {moas.map((moa) => (
          <Link
            key={moa.id}
            href={`/university/moas/${moa.id}`}
            className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-sm text-gray-900">
                  {moa.company.display_name}
                  {moa.company.registered_name && moa.company.registered_name !== moa.company.display_name && (
                    <span className="text-gray-400 font-normal ml-1">
                      ({moa.company.registered_name})
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{moa.template.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Requested {new Date(moa.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="shrink-0 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                Pending review
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
