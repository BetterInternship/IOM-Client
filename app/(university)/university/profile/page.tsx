"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

export default function UniversityProfilePage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const queryClient = useQueryClient();
  const sigRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { data } = useQuery({
    queryKey: ["university-profile"],
    queryFn: () =>
      preconfiguredAxios.get("/api/university/profile").then((r) => r.data as { university: any }),
    enabled: !!account,
  });

  const uni = data?.university;

  const patchProfile = useMutation({
    mutationFn: () =>
      preconfiguredAxios.patch("/api/university/profile", {
        registered_name: get("registered_name"),
        address: get("address"),
        rep_name: get("rep_name"),
        rep_title: get("rep_title"),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-profile"] });
      queryClient.invalidateQueries({ queryKey: ["university-me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const uploadLogo = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return preconfiguredAxios.post("/api/university/profile/logo", fd);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-profile"] }),
    onError: (e: any) => setError(e.message),
  });

  const uploadSig = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return preconfiguredAxios.post("/api/university/profile/signature", fd);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-profile"] }),
    onError: (e: any) => setError(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account) return null;

  function get(key: string): string {
    return key in form ? form[key] : (uni?.[key] ?? "");
  }

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const signatoryComplete = uni?.rep_name && uni?.rep_title && uni?.rep_signature_url;

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">University Profile</h1>

      {!signatoryComplete && isSuperadmin && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Complete the institution signatory (name, title, signature image) before you can offer MOA templates to companies.
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Institution info</h2>
        {[
          { key: "registered_name", label: "Registered name" },
          { key: "address", label: "Address (used as execution place in MOAs)" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-gray-500">{label}</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm mt-0.5 disabled:bg-gray-50 disabled:text-gray-500"
              value={get(key)}
              onChange={(e) => set(key, e.target.value)}
              disabled={!isSuperadmin}
            />
          </div>
        ))}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Institution signatory
          <span className="ml-2 text-xs font-normal text-gray-500 normal-case">
            Signs all offered MOA templates
          </span>
        </h2>
        {[
          { key: "rep_name", label: "Signatory name" },
          { key: "rep_title", label: "Signatory title" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-gray-500">{label}</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm mt-0.5 disabled:bg-gray-50 disabled:text-gray-500"
              value={get(key)}
              onChange={(e) => set(key, e.target.value)}
              disabled={!isSuperadmin}
            />
          </div>
        ))}
        <div>
          <p className="text-xs text-gray-500 mb-1">Signature image (required to offer templates)</p>
          {uni?.rep_signature_url && <p className="text-xs text-green-600 mb-1">Signature uploaded ✓</p>}
          <input ref={sigRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSig.mutate(f); }} />
          {isSuperadmin && (
            <button
              onClick={() => sigRef.current?.click()}
              disabled={uploadSig.isPending}
              className="border border-gray-300 text-sm px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {uploadSig.isPending ? "Uploading…" : uni?.rep_signature_url ? "Replace signature" : "Upload signature"}
            </button>
          )}
        </div>
      </section>

      {isSuperadmin && (
        <button
          onClick={() => patchProfile.mutate()}
          disabled={patchProfile.isPending}
          className="bg-blue-600 text-white text-sm px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {patchProfile.isPending ? "Saving…" : "Save profile"}
        </button>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Logo</h2>
        {uni?.logo_url && <p className="text-xs text-green-600">Logo uploaded ✓</p>}
        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo.mutate(f); }} />
        {isSuperadmin && (
          <button
            onClick={() => logoRef.current?.click()}
            disabled={uploadLogo.isPending}
            className="border border-gray-300 text-sm px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {uploadLogo.isPending ? "Uploading…" : uni?.logo_url ? "Replace logo" : "Upload logo"}
          </button>
        )}
      </section>
    </div>
  );
}
