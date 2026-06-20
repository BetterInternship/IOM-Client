"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface TemplateOffer {
  id: string;
  is_available: boolean;
  template: {
    id: string;
    name: string;
    description: string | null;
    term_months: number;
    is_deleted: boolean | null;
  };
}

export default function UniversityTemplatesPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoading && !isSuperadmin) {
      router.replace("/university/dashboard");
    }
  }, [isLoading, isSuperadmin, router]);

  const { data, isLoading: tLoading } = useQuery({
    queryKey: ["university-templates"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/templates")
        .then((r) => r.data as { templates: TemplateOffer[] }),
    enabled: !!account && isSuperadmin,
  });

  const toggle = useMutation({
    mutationFn: ({ templateId, is_available }: { templateId: string; is_available: boolean }) =>
      preconfiguredAxios.put(`/api/university/templates/${templateId}`, { is_available }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["university-templates"] }),
  });

  if (isLoading) return <div className="p-8 text-sm text-gray-500">Loading…</div>;
  if (!account || !isSuperadmin) return null;

  const offers = data?.templates ?? [];
  const active = offers.filter((o) => !o.template.is_deleted);

  return (
    <div className="max-w-3xl mx-auto p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Offered Templates</h1>
        <p className="text-sm text-gray-500 mt-1">
          Toggle which catalog templates your university offers to companies. The institution signatory
          must be set on your profile for templates to be available.
        </p>
      </div>

      {tLoading && <p className="text-sm text-gray-500">Loading…</p>}

      {!tLoading && active.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-gray-50">
          <p className="text-gray-500 text-sm">No templates in the catalog yet.</p>
        </div>
      )}

      <div className="space-y-3">
        {active.map((offer) => (
          <div
            key={offer.id}
            className="flex items-start justify-between border rounded-lg p-4 gap-4"
          >
            <div className="flex-1">
              <p className="font-medium text-sm text-gray-900">{offer.template.name}</p>
              {offer.template.description && (
                <p className="text-xs text-gray-500 mt-0.5">{offer.template.description}</p>
              )}
              <p className="text-xs text-gray-400 mt-0.5">Term: {offer.template.term_months} months</p>
            </div>
            <button
              onClick={() => toggle.mutate({ templateId: offer.template.id, is_available: !offer.is_available })}
              disabled={toggle.isPending}
              className={`shrink-0 relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                offer.is_available ? "bg-blue-600" : "bg-gray-200"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  offer.is_available ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
