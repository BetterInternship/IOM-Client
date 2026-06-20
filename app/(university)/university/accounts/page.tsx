"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface StaffAccount {
  id: string;
  email: string;
  display_name: string;
  role: "superadmin" | "staff";
  is_deactivated: boolean | null;
  created_at: string;
}

export default function AccountsPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isLoading && !isSuperadmin) router.replace("/university/dashboard");
  }, [isLoading, isSuperadmin, router]);

  const { data, isLoading: aLoading } = useQuery({
    queryKey: ["university-accounts"],
    queryFn: () =>
      preconfiguredAxios.get("/api/university/accounts").then((r) => r.data as { accounts: StaffAccount[] }),
    enabled: !!account && isSuperadmin,
  });

  const createStaff = useMutation({
    mutationFn: () =>
      preconfiguredAxios.post("/api/university/accounts", { email: newEmail, display_name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-accounts"] });
      setShowCreate(false);
      setNewEmail("");
      setNewName("");
      setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => preconfiguredAxios.patch(`/api/university/accounts/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-accounts"] }),
  });

  const reactivate = useMutation({
    mutationFn: (id: string) => preconfiguredAxios.patch(`/api/university/accounts/${id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-accounts"] }),
  });

  const resendInvite = useMutation({
    mutationFn: (id: string) => preconfiguredAxios.post(`/api/university/accounts/${id}/resend-invite`),
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account || !isSuperadmin) return null;

  const accounts = data?.accounts ?? [];
  const staff = accounts.filter((a) => a.role === "staff");

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Staff Accounts</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700"
        >
          Invite staff
        </button>
      </div>

      {showCreate && (
        <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
          <h2 className="text-sm font-medium text-gray-700">Invite staff member</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input
            type="email"
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
          />
          <input
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Display name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => createStaff.mutate()}
              disabled={!newEmail || !newName || createStaff.isPending}
              className="bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {createStaff.isPending ? "Sending invite…" : "Send invite"}
            </button>
            <button onClick={() => { setShowCreate(false); setError(""); }}
              className="border border-gray-300 text-sm px-4 py-2 rounded-md hover:bg-white">
              Cancel
            </button>
          </div>
        </div>
      )}

      {aLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!aLoading && staff.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-8">No staff accounts yet.</p>
      )}

      <div className="space-y-3">
        {staff.map((a) => (
          <div
            key={a.id}
            className={`flex items-center justify-between border rounded-lg p-4 gap-4 ${
              a.is_deactivated ? "opacity-60 bg-gray-50" : ""
            }`}
          >
            <div>
              <p className="text-sm font-medium text-gray-900">{a.display_name}</p>
              <p className="text-xs text-gray-500">{a.email}</p>
              {a.is_deactivated && <p className="text-xs text-red-500 mt-0.5">Deactivated</p>}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => resendInvite.mutate(a.id)}
                disabled={resendInvite.isPending}
                className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded hover:bg-gray-50"
              >
                Resend invite
              </button>
              {a.is_deactivated ? (
                <button
                  onClick={() => reactivate.mutate(a.id)}
                  disabled={reactivate.isPending}
                  className="text-xs text-green-600 border border-green-200 px-2 py-1 rounded hover:bg-green-50"
                >
                  Reactivate
                </button>
              ) : (
                <button
                  onClick={() => deactivate.mutate(a.id)}
                  disabled={deactivate.isPending}
                  className="text-xs text-red-600 border border-red-200 px-2 py-1 rounded hover:bg-red-50"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
