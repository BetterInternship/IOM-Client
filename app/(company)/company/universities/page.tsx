"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { useRouter } from "next/navigation";

interface University {
  id: string;
  registered_name: string;
  logo_url: string | null;
  address: string | null;
  requestable: boolean;
}

interface Template {
  id: string;
  name: string;
  description: string | null;
  term_months: number;
}

function RequestModal({
  university,
  onClose,
}: {
  university: University;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["university-templates", university.id],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/company/universities/${university.id}/templates`)
        .then((r) => r.data as { templates: Template[] }),
  });

  const request = useMutation({
    mutationFn: (templateId: string) =>
      preconfiguredAxios
        .post("/api/company/moas", { universityId: university.id, templateId })
        .then((r) => r.data as { moa: { id: string } }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["company-moas"] });
      onClose();
      router.push(`/company/moas/${res.moa.id}`);
    },
    onError: (e: any) => {
      const code = e?.response?.data?.code || "";
      if (code === "AT_ACTIVE_MOA_CAP") {
        const limit = e?.response?.data?.data?.limit ?? "the maximum";
        setError(`You have reached the maximum of ${limit} active MOAs with this university.`);
      } else if (code === "PROFILE_INCOMPLETE") {
        setError("Your profile is incomplete. Please complete your profile and try again.");
      } else if (code === "DOCUMENTS_MISSING") {
        setError("You must upload all required documents before requesting an MOA.");
      } else {
        setError("Couldn't request from this university at this time. Please contact us for help.");
      }
    },
  });

  const templates = data?.templates ?? [];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-md p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">
          Request MOA — {university.registered_name}
        </h2>

        {isLoading && <p className="text-sm text-gray-500">Loading templates…</p>}

        {!isLoading && templates.length === 0 && (
          <p className="text-sm text-gray-500">No available templates at this university.</p>
        )}

        {templates.map((t) => (
          <label
            key={t.id}
            className={`flex items-start gap-3 border rounded-lg p-3 cursor-pointer transition-colors ${
              selectedTemplate === t.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            <input
              type="radio"
              name="template"
              value={t.id}
              checked={selectedTemplate === t.id}
              onChange={() => setSelectedTemplate(t.id)}
              className="mt-0.5"
            />
            <div>
              <p className="text-sm font-medium text-gray-900">{t.name}</p>
              {t.description && <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>}
              <p className="text-xs text-gray-400 mt-0.5">Term: {t.term_months} months</p>
            </div>
          </label>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => selectedTemplate && request.mutate(selectedTemplate)}
            disabled={!selectedTemplate || request.isPending}
            className="flex-1 bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {request.isPending ? "Requesting…" : "Request MOA"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UniversityDirectoryPage() {
  const { company, isLoading } = useCompanyProfile();
  const [selected, setSelected] = useState<University | null>(null);

  const { data, isLoading: uniLoading } = useQuery({
    queryKey: ["company-universities"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/company/universities")
        .then((r) => r.data as { universities: University[] }),
    enabled: !!company,
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!company) return null;

  const universities = data?.universities ?? [];
  const profileComplete = !!(
    company.registered_name &&
    company.company_type &&
    company.registered_address &&
    company.rep_name &&
    company.rep_title
  );

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Universities</h1>

      {!profileComplete && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          Complete your profile and upload all required documents to request MOAs.
        </div>
      )}

      {uniLoading && <p className="text-sm text-gray-500">Loading…</p>}

      <div className="space-y-3">
        {universities.map((uni) => (
          <div
            key={uni.id}
            className="flex items-center justify-between border rounded-lg p-4 gap-4"
          >
            <div>
              <p className="font-medium text-sm text-gray-900">{uni.registered_name}</p>
              {uni.address && <p className="text-xs text-gray-500 mt-0.5">{uni.address}</p>}
            </div>
            {uni.requestable && profileComplete ? (
              <button
                onClick={() => setSelected(uni)}
                className="shrink-0 bg-blue-600 text-white text-sm px-4 py-2 rounded-md hover:bg-blue-700"
              >
                Request MOA
              </button>
            ) : (
              <span className="shrink-0 text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-md">
                Unavailable
              </span>
            )}
          </div>
        ))}

        {!uniLoading && universities.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-8">No universities found.</p>
        )}
      </div>

      {selected && <RequestModal university={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
