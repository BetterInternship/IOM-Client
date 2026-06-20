"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

interface Partner {
  company: { id: string; display_name: string; registered_name: string | null };
  latestMoaId: string;
  detailsChanged: boolean;
}

interface BlacklistEntry {
  id: string;
  company_id: string;
  reason: string | null;
  created_at: string;
  actor_email: string | null;
  company: { id: string; display_name: string; registered_name: string | null };
}

function BlacklistModal({
  company,
  activeMoaCount,
  onClose,
  onConfirm,
}: {
  company: { id: string; display_name: string };
  activeMoaCount: number;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Blacklist Company</h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
          <p>
            This will immediately <strong>revoke all {activeMoaCount} active MOA{activeMoaCount !== 1 ? "s" : ""}</strong> with{" "}
            <strong>{company.display_name}</strong> and block new requests.
          </p>
          <p>Revoked MOAs cannot be restored. {company.display_name} will not be notified.</p>
          <p className="text-xs text-red-600">This action is logged under your name.</p>
        </div>
        <textarea
          className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
          rows={2}
          placeholder="Internal reason (optional — never shown to the company)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setPending(true);
              onConfirm(reason);
            }}
            disabled={pending}
            className="flex-1 bg-red-600 text-white text-sm px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50"
          >
            {pending ? "Blacklisting…" : "Blacklist Company"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UnblacklistModal({
  company,
  onClose,
  onConfirm,
}: {
  company: { id: string; display_name: string };
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [pending, setPending] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Remove from Blacklist</h2>
        <p className="text-sm text-gray-600">
          This will re-enable <strong>future</strong> requests from{" "}
          <strong>{company.display_name}</strong>. Previously revoked MOAs will not be restored.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={pending}
            className="flex-1 border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setPending(true);
              onConfirm();
            }}
            disabled={pending}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {pending ? "Removing…" : "Remove from Blacklist"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BlacklistPage() {
  const { account, isLoading } = useUniversityProfile();
  const queryClient = useQueryClient();

  const [blacklistTarget, setBlacklistTarget] = useState<Partner | null>(null);
  const [unblacklistTarget, setUnblacklistTarget] = useState<BlacklistEntry | null>(null);

  const { data: partnersData } = useQuery({
    queryKey: ["university-partners"],
    queryFn: () =>
      preconfiguredAxios.get("/api/university/partners").then((r) => r.data as { partners: Partner[] }),
    enabled: !!account,
  });

  const { data: blacklistData, isLoading: blLoading } = useQuery({
    queryKey: ["university-blacklist"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/blacklist")
        .then((r) => r.data as { blacklist: BlacklistEntry[] }),
    enabled: !!account,
  });

  const blacklistMutation = useMutation({
    mutationFn: ({ companyId, reason }: { companyId: string; reason: string }) =>
      preconfiguredAxios.post("/api/university/blacklist", { companyId, reason: reason || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-partners"] });
      queryClient.invalidateQueries({ queryKey: ["university-blacklist"] });
      queryClient.invalidateQueries({ queryKey: ["university-review-queue"] });
      queryClient.invalidateQueries({ queryKey: ["university-audit"] });
      setBlacklistTarget(null);
    },
  });

  const unblacklistMutation = useMutation({
    mutationFn: (companyId: string) =>
      preconfiguredAxios.delete(`/api/university/blacklist/${companyId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-partners"] });
      queryClient.invalidateQueries({ queryKey: ["university-blacklist"] });
      queryClient.invalidateQueries({ queryKey: ["university-audit"] });
      setUnblacklistTarget(null);
    },
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account) return null;

  const partners = partnersData?.partners ?? [];
  const blacklist = blacklistData?.blacklist ?? [];
  const blacklistedIds = new Set(blacklist.map((b) => b.company_id));
  const eligiblePartners = partners.filter((p) => !blacklistedIds.has(p.company.id));

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Blacklist</h1>

      {/* Current partners (can be blacklisted) */}
      {eligiblePartners.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Current partners
          </h2>
          {eligiblePartners.map(({ company }) => (
            <div
              key={company.id}
              className="flex items-center justify-between border rounded-lg p-4 gap-4"
            >
              <div>
                <p className="font-medium text-sm text-gray-900">{company.display_name}</p>
                {company.registered_name && (
                  <p className="text-xs text-gray-500 mt-0.5">{company.registered_name}</p>
                )}
              </div>
              <button
                onClick={() => setBlacklistTarget({ company, latestMoaId: "", detailsChanged: false })}
                className="shrink-0 border border-red-300 text-red-600 text-sm px-3 py-1.5 rounded-md hover:bg-red-50"
              >
                Blacklist
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Blacklisted companies */}
      {blLoading && <p className="text-sm text-gray-500">Loading blacklist…</p>}

      {!blLoading && blacklist.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Blacklisted ({blacklist.length})
          </h2>
          {blacklist.map((entry) => (
            <div
              key={entry.id}
              className="flex items-start justify-between border border-red-100 bg-red-50 rounded-lg p-4 gap-4"
            >
              <div>
                <p className="font-medium text-sm text-gray-900">{entry.company.display_name}</p>
                {entry.reason && (
                  <p className="text-xs text-gray-600 mt-0.5">Reason: {entry.reason}</p>
                )}
                {entry.actor_email && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    By {entry.actor_email} · {new Date(entry.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
              <button
                onClick={() => setUnblacklistTarget(entry)}
                className="shrink-0 border border-gray-300 text-gray-700 text-sm px-3 py-1.5 rounded-md hover:bg-white"
              >
                Un-blacklist
              </button>
            </div>
          ))}
        </section>
      )}

      {!blLoading && blacklist.length === 0 && eligiblePartners.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500 text-sm">No companies to manage here yet.</p>
        </div>
      )}

      {blacklistTarget && (
        <BlacklistModal
          company={blacklistTarget.company}
          activeMoaCount={1}
          onClose={() => setBlacklistTarget(null)}
          onConfirm={(reason) =>
            blacklistMutation.mutate({ companyId: blacklistTarget.company.id, reason })
          }
        />
      )}

      {unblacklistTarget && (
        <UnblacklistModal
          company={unblacklistTarget.company}
          onClose={() => setUnblacklistTarget(null)}
          onConfirm={() => unblacklistMutation.mutate(unblacklistTarget.company_id)}
        />
      )}
    </div>
  );
}
