"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/preconfig.axios";

export default function AdminUniversitiesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ registered_name: "", superadmin_email: "", superadmin_display_name: "" });
  const [error, setError] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-universities"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/admin/universities");
      return res.data.universities as any[];
    },
  });

  const create = useMutation({
    mutationFn: () => preconfiguredAxios.post("/api/admin/universities", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-universities"] });
      setShowCreate(false);
      setForm({ registered_name: "", superadmin_email: "", superadmin_display_name: "" });
    },
    onError: (e: any) => setError(e.message),
  });

  const deactivate = useMutation({
    mutationFn: (id: string) => preconfiguredAxios.patch(`/api/admin/universities/${id}/deactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-universities"] }),
  });

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Universities</h1>
        <button className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700" onClick={() => setShowCreate(true)}>
          Add University
        </button>
      </div>

      {showCreate && (
        <div className="bg-white border rounded-lg p-6 space-y-4 max-w-lg">
          <h2 className="font-medium">Create University</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Registered name" value={form.registered_name} onChange={(e) => setForm({ ...form, registered_name: e.target.value })} />
          <input type="email" className="w-full border rounded px-3 py-2 text-sm" placeholder="Superadmin email" value={form.superadmin_email} onChange={(e) => setForm({ ...form, superadmin_email: e.target.value })} />
          <input className="w-full border rounded px-3 py-2 text-sm" placeholder="Superadmin name" value={form.superadmin_display_name} onChange={(e) => setForm({ ...form, superadmin_display_name: e.target.value })} />
          <div className="flex gap-2">
            <button className="bg-blue-600 text-white rounded px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50" onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Creating…" : "Create"}
            </button>
            <button className="border rounded px-4 py-2 text-sm" onClick={() => setShowCreate(false)}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-sm text-gray-500">Loading…</p>}
      <div className="space-y-3">
        {data?.map((uni: any) => (
          <div key={uni.id} className="bg-white border rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">{uni.registered_name}</p>
              <p className="text-sm text-gray-500">{uni.university_accounts?.[0]?.email ?? "No superadmin"}</p>
              {uni.is_deactivated && <span className="text-xs text-red-600 font-medium">Deactivated</span>}
            </div>
            {!uni.is_deactivated && (
              <button className="text-sm text-red-600 hover:underline" onClick={() => deactivate.mutate(uni.id)}>
                Deactivate
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
