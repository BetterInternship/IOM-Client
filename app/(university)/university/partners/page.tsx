"use client";
import { useQuery } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import Link from "next/link";

interface Partner {
  company: {
    id: string;
    display_name: string;
    registered_name: string | null;
    company_type: string | null;
  };
  latestMoaId: string;
  detailsChanged: boolean;
}

export default function PartnersPage() {
  const { account, isLoading } = useUniversityProfile();

  const { data, isLoading: pLoading } = useQuery({
    queryKey: ["university-partners"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/partners")
        .then((r) => r.data as { partners: Partner[] }),
    enabled: !!account,
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account) return null;

  const partners = data?.partners ?? [];

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Partner Companies</h1>

      {pLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!pLoading && partners.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500 text-sm">No active partners yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {partners.map(({ company, latestMoaId, detailsChanged }) => (
          <Link
            key={company.id}
            href={`/university/moas/${latestMoaId}`}
            className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm text-gray-900">{company.display_name}</p>
                  {detailsChanged && (
                    <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
                      Details changed
                    </span>
                  )}
                </div>
                {company.registered_name && (
                  <p className="text-xs text-gray-500 mt-0.5">{company.registered_name}</p>
                )}
                {company.company_type && (
                  <p className="text-xs text-gray-400 mt-0.5">{company.company_type.replace(/_/g, " ")}</p>
                )}
              </div>
              <span className="shrink-0 text-xs text-blue-600 hover:underline">View →</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
