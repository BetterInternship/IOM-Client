"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import Link from "next/link";

interface MoaDetail {
  moa: any;
  snapshot: any;
  history: any[];
  detailsChanged: boolean;
  pdfUrl: string | null;
}

function RejectModal({
  moaId,
  companyName,
  onClose,
}: {
  moaId: string;
  companyName: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");

  const reject = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post(`/api/university/moas/${moaId}/reject`, { reason: reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["university-moa", moaId] });
      onClose();
      router.push("/university/review-queue");
    },
  });

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Reject MOA</h2>
        <p className="text-sm text-gray-600">
          Rejecting this MOA from <span className="font-medium">{companyName}</span>.
        </p>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
          rows={3}
          placeholder="Reason for rejection (optional — will be emailed to the company)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => reject.mutate()}
            disabled={reject.isPending}
            className="flex-1 bg-red-600 text-white text-sm px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {reject.isPending ? "Rejecting…" : "Reject MOA"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UniversityMoaDetailPage() {
  const { moaId } = useParams<{ moaId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showReject, setShowReject] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["university-moa", moaId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/university/moas/${moaId}`)
        .then((r) => r.data as MoaDetail),
    enabled: !!moaId,
  });

  const confirm = useMutation({
    mutationFn: () => preconfiguredAxios.post(`/api/university/moas/${moaId}/confirm`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["university-moa", moaId] });
      router.push("/university/review-queue");
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!data?.moa) return <div className="p-8 text-sm text-red-500">MOA not found.</div>;

  const { moa, snapshot, history, detailsChanged, pdfUrl } = data;
  const company = moa.company;
  const isPendingReview = moa.status === "active" && !moa.reviewed_at;

  const FIELD_LABELS: Record<string, string> = {
    registered_name: "Legal name",
    company_type: "Company type",
    registered_address: "Address",
    rep_name: "Representative name",
    rep_title: "Representative title",
  };

  const snapshotJson = snapshot?.snapshot_json ?? {};

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/university/review-queue" className="text-sm text-blue-600 hover:underline">
          ← Review Queue
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">{company.display_name}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {company.registered_name && `${company.registered_name} · `}
            {moa.template?.name}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Requested {new Date(moa.created_at).toLocaleDateString()} ·{" "}
            {new Date(moa.effective_date).toLocaleDateString()} –{" "}
            {new Date(moa.expiry_date).toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {detailsChanged && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              Details changed since request
            </span>
          )}
          {isPendingReview && (
            <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-medium">
              Pending review
            </span>
          )}
          {!isPendingReview && moa.reviewed_at && (
            <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full font-medium">
              Confirmed
            </span>
          )}
          {moa.status === "rejected" && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Profile diff */}
      {detailsChanged && (
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
            Company details changed since request
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {Object.entries(FIELD_LABELS).map(([key, label]) => {
              const atRequest = (snapshotJson as any)?.[key];
              const current = (company as any)?.[key];
              const changed = atRequest !== current;
              return (
                <div key={key} className={changed ? "col-span-2" : "hidden"}>
                  {changed && (
                    <div className="bg-white border border-amber-200 rounded p-2">
                      <p className="text-xs text-gray-400">{label}</p>
                      <p className="text-sm text-red-600 line-through">{atRequest ?? "—"}</p>
                      <p className="text-sm text-green-700">{current ?? "—"}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* History timeline */}
      {history.length > 0 && (
        <details className="border rounded-lg">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-gray-700">
            Company history ({history.length} update{history.length !== 1 ? "s" : ""} since request)
          </summary>
          <div className="p-4 space-y-3 border-t">
            {history.map((h: any) => (
              <div key={h.id} className="text-xs text-gray-600">
                <span className="text-gray-400">{new Date(h.created_at).toLocaleDateString()} —</span>{" "}
                Profile updated
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Actions */}
      {isPendingReview && (
        <div className="flex gap-3">
          <button
            onClick={() => confirm.mutate()}
            disabled={confirm.isPending}
            className="flex-1 bg-green-600 text-white text-sm px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
          >
            {confirm.isPending ? "Confirming…" : "Confirm MOA"}
          </button>
          <button
            onClick={() => setShowReject(true)}
            className="flex-1 border border-red-300 text-red-600 text-sm px-4 py-2 rounded-md hover:bg-red-50"
          >
            Reject
          </button>
        </div>
      )}

      {/* PDF */}
      {pdfUrl ? (
        <div className="border rounded-xl overflow-hidden">
          <div className="bg-gray-50 border-b px-4 py-3 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">MOA Document</p>
            <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
              Open in new tab
            </a>
          </div>
          <iframe src={pdfUrl} className="w-full h-[70vh]" title="MOA PDF" />
        </div>
      ) : (
        <div className="border rounded-xl p-8 text-center text-sm text-gray-500">PDF not available.</div>
      )}

      {showReject && (
        <RejectModal
          moaId={moaId}
          companyName={company.display_name}
          onClose={() => setShowReject(false)}
        />
      )}
    </div>
  );
}
