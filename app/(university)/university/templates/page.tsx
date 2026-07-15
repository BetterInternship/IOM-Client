"use client";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { useIomModalRegistry } from "@/components/modal-registry";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";

interface TemplateOffer {
  id: string;
  is_available: boolean;
  template: {
    id: string;
    name: string;
    description: string | null;
    term_months: number | null;
    is_deleted: boolean | null;
  };
}

export default function UniversityTemplatesPage() {
  const { account, isLoading, isSuperadmin } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirmAction, previewTemplate } = useIomModalRegistry();

  useEffect(() => {
    if (!isLoading && !isSuperadmin) router.replace("/university/partners");
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
    mutationFn: ({
      templateId,
      is_available,
    }: {
      templateId: string;
      is_available: boolean;
    }) =>
      preconfiguredAxios.put(`/api/university/templates/${templateId}`, {
        is_available,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["university-templates"] });
      queryClient.invalidateQueries({
        queryKey: ["university-templates-for-invite"],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const offers = (data?.templates ?? []).filter((o) => !o.template.is_deleted);

  const templateColumns = useMemo<ColumnDef<TemplateOffer>[]>(
    () => [
      {
        id: "template",
        header: "Template",
        accessorFn: (row) => row.template.name,
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-gray-900">
              {row.original.template.name}
            </p>
            {row.original.template.description && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {row.original.template.description}
              </p>
            )}
          </div>
        ),
      },
      {
        id: "term",
        header: "Term",
        accessorFn: (row) => row.template.term_months ?? Infinity,
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.template.term_months == null
              ? "Perpetual"
              : `${row.original.template.term_months} months`}
          </span>
        ),
      },
      {
        id: "available",
        header: "Available",
        enableSorting: false,
        enableResizing: false,
        size: 160,
        cell: ({ row }) => (
          <button
            type="button"
            className="flex cursor-pointer items-center gap-2 disabled:opacity-50"
            onClick={() =>
              confirmAction.open({
                title: `${row.original.is_available ? "Hide" : "Offer"} this template?`,
                description: row.original.is_available
                  ? `Companies will no longer be able to request new MOAs using "${row.original.template.name}". Existing active MOAs are unaffected.`
                  : `Companies will be able to request MOAs using "${row.original.template.name}".`,
                confirmLabel: row.original.is_available ? "Hide" : "Offer",
                onConfirm: () =>
                  toggle.mutate({
                    templateId: row.original.template.id,
                    is_available: !row.original.is_available,
                  }),
                isPending: toggle.isPending,
              })
            }
            disabled={toggle.isPending}
          >
            <span
              className={`text-xs font-medium ${
                row.original.is_available
                  ? "text-supportive"
                  : "text-muted-foreground"
              }`}
            >
              {row.original.is_available ? "Offered" : "Hidden"}
            </span>
            <Switch
              checked={row.original.is_available}
              className="data-[state=checked]:bg-supportive pointer-events-none"
              tabIndex={-1}
            />
          </button>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        enableSorting: false,
        enableResizing: false,
        size: 140,
        cell: ({ row }) => (
          <Button
            variant="outline"
            onClick={() => previewTemplate.open(row.original.template)}
          >
            <Eye className="mr-1 h-3.5 w-3.5" /> Preview
          </Button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [previewTemplate, toggle.isPending],
  );

  if (isLoading || !account || !isSuperadmin) return null;

  return (
    <PageContainer className="space-y-8">
      <PageHeader
        title="MOA Templates"
        description="Choose which catalog templates your university offers to companies. Your institution signatory must be set on your profile first."
      />

      {tLoading ? (
        <div className="space-y-1">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          id="moa-templates"
          columns={templateColumns}
          data={offers}
          searchKey="template"
          searchPlaceholder="Search templates..."
          rowLabelSingular="template"
          rowLabelPlural="templates"
        />
      )}
    </PageContainer>
  );
}
