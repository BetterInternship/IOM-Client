"use client";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import Link from "next/link";

export default function CompanyMoaDetailPage() {
  const { moaId } = useParams<{ moaId: string }>();

  const { data, isLoading } = useQuery({
    queryKey: ["company-moa", moaId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/company/moas/${moaId}`)
        .then((r) => r.data as { moa: any; pdfUrl: string | null }),
    enabled: !!moaId,
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!data?.moa) return <div className="p-8 text-sm text-red-500">MOA not found.</div>;

  const { moa, pdfUrl } = data;
  const isActive = moa.status === "active" && !moa.is_expired;
  const isExpired = !!moa.is_expired;
  const isRejected = moa.status === "rejected";

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/company/dashboard" className="text-sm text-blue-600 hover:underline">
          ← Dashboard
        </Link>
      </div>

      <div className="border rounded-xl p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">{moa.university.registered_name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {new Date(moa.effective_date).toLocaleDateString()} –{" "}
              {new Date(moa.expiry_date).toLocaleDateString()}
            </p>
          </div>
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-medium ${
              isActive
                ? "bg-green-100 text-green-800"
                : isExpired
                  ? "bg-gray-100 text-gray-600"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {isActive ? "Active" : isExpired ? "Expired" : "Rejected"}
          </span>
        </div>

        {isRejected && moa.rejection_reason && (
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
            <span className="font-medium">Rejection reason:</span> {moa.rejection_reason}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-1">Template</p>
            <p className="text-gray-700">{moa.template?.name ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1">Requested</p>
            <p className="text-gray-700">{new Date(moa.created_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>

      {pdfUrl ? (
        <div className="border rounded-xl overflow-hidden">
          <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">MOA Document</p>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-blue-600 hover:underline"
            >
              Open in new tab
            </a>
          </div>
          <iframe src={pdfUrl} className="w-full h-[70vh]" title="MOA PDF" />
        </div>
      ) : (
        <div className="border rounded-xl p-8 text-center text-sm text-gray-500">
          PDF not available.
        </div>
      )}
    </div>
  );
}
