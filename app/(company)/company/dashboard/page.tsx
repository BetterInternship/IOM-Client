"use client";
import { useQuery } from "@tanstack/react-query";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import Link from "next/link";

interface Moa {
  id: string;
  status: "active" | "rejected";
  is_expired: boolean | null;
  effective_date: string;
  expiry_date: string;
  rejection_reason: string | null;
  university: { id: string; registered_name: string; logo_url: string | null };
}

function MoaCard({ moa }: { moa: Moa }) {
  const isActive = moa.status === "active" && !moa.is_expired;
  const isExpired = moa.is_expired;
  const isRejected = moa.status === "rejected";
  const badgeClass = isActive
    ? "bg-green-100 text-green-800"
    : isExpired
      ? "bg-gray-100 text-gray-600"
      : "bg-red-100 text-red-700";
  const label = isActive ? "Active" : isExpired ? "Expired" : "Rejected";

  return (
    <Link
      href={`/company/moas/${moa.id}`}
      className="block border rounded-lg p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-medium text-sm text-gray-900">{moa.university.registered_name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(moa.effective_date).toLocaleDateString()} –{" "}
            {new Date(moa.expiry_date).toLocaleDateString()}
          </p>
          {isRejected && moa.rejection_reason && (
            <p className="text-xs text-red-600 mt-1">{moa.rejection_reason}</p>
          )}
          {isRejected && !moa.rejection_reason && (
            <p className="text-xs text-gray-400 mt-1">Rejected</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>{label}</span>
      </div>
    </Link>
  );
}

export default function CompanyDashboardPage() {
  const { company, isLoading } = useCompanyProfile();

  const { data: moasData, isLoading: moasLoading } = useQuery({
    queryKey: ["company-moas"],
    queryFn: () => preconfiguredAxios.get("/api/company/moas?limit=100").then((r) => r.data),
    enabled: !!company,
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!company) return null;

  const moas: Moa[] = moasData?.moas ?? [];
  const active = moas.filter((m) => m.status === "active" && !m.is_expired);
  const expired = moas.filter((m) => m.is_expired);
  const rejected = moas.filter((m) => m.status === "rejected");

  const profileComplete = !!(
    company.registered_name &&
    company.company_type &&
    company.registered_address &&
    company.rep_name &&
    company.rep_title
  );

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">{company.display_name}</h1>
        <Link
          href="/company/universities"
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Request MOA
        </Link>
      </div>

      {!profileComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Complete your profile and upload all four required documents before you can request MOAs.{" "}
          <Link href="/company/profile" className="underline font-medium">
            Complete profile
          </Link>
        </div>
      )}

      {moasLoading && <p className="text-sm text-gray-500">Loading MOAs…</p>}

      {!moasLoading && moas.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500 text-sm mb-4">No MOAs yet.</p>
          <Link
            href="/company/universities"
            className="text-blue-600 text-sm font-medium hover:underline"
          >
            Browse universities and request your first MOA
          </Link>
        </div>
      )}

      {active.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Active MOAs ({active.length})
          </h2>
          {active.map((m) => (
            <MoaCard key={m.id} moa={m} />
          ))}
        </section>
      )}

      {rejected.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Rejected MOAs ({rejected.length})
          </h2>
          {rejected.map((m) => (
            <MoaCard key={m.id} moa={m} />
          ))}
        </section>
      )}

      {expired.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Expired MOAs ({expired.length})
          </h2>
          {expired.map((m) => (
            <MoaCard key={m.id} moa={m} />
          ))}
        </section>
      )}
    </div>
  );
}
