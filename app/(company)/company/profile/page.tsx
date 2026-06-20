"use client";
import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";

const COMPANY_TYPES = [
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "government_agency", label: "Government Agency" },
];

const DOC_TYPES = [
  { value: "business_permit", label: "Business Permit" },
  { value: "sec_dti_registration", label: "SEC/DTI Registration" },
  { value: "mayor_permit", label: "Mayor's Permit" },
  { value: "or_registration", label: "Official Receipt (OR)" },
];

export default function CompanyProfilePage() {
  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();
  const sigRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const { data: docsData, refetch: refetchDocs } = useQuery({
    queryKey: ["company-docs"],
    queryFn: () => preconfiguredAxios.get("/api/company/documents").then((r) => r.data),
    enabled: !!company,
  });

  const patchProfile = useMutation({
    mutationFn: () => preconfiguredAxios.patch("/api/company/profile", {
      registered_name: get("registered_name"),
      company_type: get("company_type") || undefined,
      registered_address: get("registered_address"),
      rep_name: get("rep_name"),
      rep_title: get("rep_title"),
      description: get("description"),
      website: get("website"),
      phone: get("phone"),
      industry: get("industry"),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-me"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      setError("");
    },
    onError: (e: any) => setError(e.message),
  });

  const uploadSig = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return preconfiguredAxios.post("/api/company/profile/signature", fd);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["company-me"] }),
    onError: (e: any) => setError(e.message),
  });

  const uploadDoc = useMutation({
    mutationFn: ({ file, type }: { file: File; type: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      return preconfiguredAxios.post("/api/company/documents", fd);
    },
    onSuccess: () => refetchDocs(),
    onError: (e: any) => setError(e.message),
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!company) return null;

  function get(key: string): string {
    return key in form ? form[key] : ((company as any)?.[key] ?? (company?.cosmetic as any)?.[key] ?? "");
  }

  function set(key: string, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  const docs = (docsData?.documents ?? []) as Array<{ id: string; type: string; filename: string; uploaded_at: string }>;
  const latestDoc = (type: string) => docs.find((d) => d.type === type);

  return (
    <div className="max-w-2xl mx-auto p-8 space-y-8">
      <h1 className="text-2xl font-semibold text-gray-900">Company Profile</h1>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && <p className="text-sm text-green-600">Saved.</p>}

      {/* Read-only rep email */}
      <div className="bg-gray-50 border rounded-lg p-4 text-sm">
        <p className="text-xs text-gray-400 mb-1">Representative email (managed by platform admin)</p>
        <p className="text-gray-700">{company.rep_email}</p>
      </div>

      {/* Material fields */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Material fields
          <span className="ml-2 text-xs font-normal text-amber-600 normal-case">Editing these notifies active MOA partners</span>
        </h2>
        {[
          { key: "registered_name", label: "Legal / registered name" },
          { key: "registered_address", label: "Registered address" },
          { key: "rep_name", label: "Representative name" },
          { key: "rep_title", label: "Representative title" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-gray-500">{label}</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm mt-0.5"
              value={get(key)}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500">Company type</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm mt-0.5 bg-white"
            value={get("company_type")}
            onChange={(e) => set("company_type", e.target.value)}
          >
            <option value="">— select —</option>
            {COMPANY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </section>

      {/* Cosmetic fields */}
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Other info</h2>
        {[
          { key: "description", label: "Description" },
          { key: "website", label: "Website" },
          { key: "phone", label: "Phone" },
          { key: "industry", label: "Industry" },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="text-xs text-gray-500">{label}</label>
            <input
              className="w-full border rounded px-3 py-2 text-sm mt-0.5"
              value={get(key)}
              onChange={(e) => set(key, e.target.value)}
            />
          </div>
        ))}
      </section>

      <button
        onClick={() => patchProfile.mutate()}
        disabled={patchProfile.isPending}
        className="bg-blue-600 text-white text-sm px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
      >
        {patchProfile.isPending ? "Saving…" : "Save profile"}
      </button>

      {/* Signature */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Representative signature</h2>
        {company.rep_signature_url && (
          <p className="text-xs text-green-600">Signature uploaded ✓</p>
        )}
        <input ref={sigRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadSig.mutate(f); }} />
        <button
          onClick={() => sigRef.current?.click()}
          disabled={uploadSig.isPending}
          className="border border-gray-300 text-sm px-4 py-2 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {uploadSig.isPending ? "Uploading…" : company.rep_signature_url ? "Replace signature" : "Upload signature"}
        </button>
      </section>

      {/* Required documents */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Required documents
          <span className="ml-2 text-xs font-normal text-gray-500 normal-case">All four required to request MOAs</span>
        </h2>
        {DOC_TYPES.map(({ value, label }) => {
          const existing = latestDoc(value);
          return (
            <div key={value} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <p className="text-sm font-medium text-gray-800">{label}</p>
                {existing ? (
                  <p className="text-xs text-green-600 mt-0.5">
                    {existing.filename} · {new Date(existing.uploaded_at).toLocaleDateString()}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Not uploaded</p>
                )}
              </div>
              <label className="cursor-pointer border border-gray-300 text-sm px-3 py-1.5 rounded-md hover:bg-gray-50">
                {existing ? "Replace" : "Upload"}
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) uploadDoc.mutate({ file: f, type: value });
                  }}
                />
              </label>
            </div>
          );
        })}
      </section>
    </div>
  );
}
