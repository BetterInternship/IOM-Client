"use client";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminControllerListTemplatesQueryKey,
  useAdminControllerDeleteTemplate,
  useAdminControllerListTemplates,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { useIomModalRegistry } from "@/components/modal-registry";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  term_months: number | null;
}

function ActionsCell({ template }: { template: Template }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirmAction } = useIomModalRegistry();

  const remove = useAdminControllerDeleteTemplate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getAdminControllerListTemplatesQueryKey(),
        });
        toast.success("Template deleted");
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  return (
    <div
      className="flex items-center gap-2"
      onClick={(e) => e.stopPropagation()}
    >
      <Button
        variant="outline"
        size="sm"
        onClick={() => router.push(`/templates/${template.id}`)}
      >
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
      <Button
        variant="outline"
        scheme="destructive"
        size="sm"
        onClick={() =>
          confirmAction.open({
            title: `Delete ${template.name}?`,
            description:
              "It will be removed from the catalog and universities can no longer offer it. Existing MOAs are unaffected (their PDFs are frozen). This can't be undone.",
            confirmLabel: "Delete",
            onConfirm: () => remove.mutate({ templateId: template.id }),
            isPending: remove.isPending,
          })
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

const columns: Array<ResourceTableColumn<Template>> = [
  {
    id: "name",
    header: "Template",
    width: "w-[55%]",
    getSortValue: (template) => template.name,
    render: (template) => (
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{template.name}</p>
        {template.description && (
          <p className="text-muted-foreground truncate text-xs">
            {template.description}
          </p>
        )}
      </div>
    ),
  },
  {
    id: "term",
    header: "Term",
    width: "w-[20%]",
    getSortValue: (template) => template.term_months ?? Infinity,
    render: (template) => (
      <Badge type="default" strength="medium">
        {template.term_months == null
          ? "Perpetual"
          : `${template.term_months} mo`}
      </Badge>
    ),
  },
  {
    id: "actions",
    header: <span className="sr-only">Actions</span>,
    width: "w-[25%]",
    align: "right",
    sortable: false,
    render: (template) => <ActionsCell template={template} />,
  },
];

export default function AdminTemplatesPage() {
  const router = useRouter();

  const { data, isLoading } = useAdminControllerListTemplates<Template[]>({
    query: {
      queryKey: getAdminControllerListTemplatesQueryKey(),
      select: (response) => response.templates as Template[],
    },
  });
  const templates = data ?? [];
  const table = useResourceTable({
    data: templates,
    getRowId: (template) => template.id,
    columns,
    search: {
      placeholder: "Search templates...",
      ariaLabel: "Search templates",
      matches: (template, query) =>
        template.name.toLowerCase().includes(query) ||
        String(template.term_months ?? Infinity)
          .toLowerCase()
          .includes(query),
    },
    sort: { initialColumn: "name", initialDirection: "asc" },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50] },
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="MOA Templates"
        description="Author the shared catalog of MOA templates. Universities choose which to offer."
      >
        <Button onClick={() => router.push("/templates/new")}>
          <Plus /> New template
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <ResourceTable
          table={table}
          renderMobileRow={(template) => (
            <article
              className="cursor-pointer px-4 py-4"
              onClick={() => router.push(`/templates/${template.id}`)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{template.name}</p>
                  {template.description && (
                    <p className="text-muted-foreground mt-1 text-sm leading-5">
                      {template.description}
                    </p>
                  )}
                </div>
                <Badge type="default" strength="medium">
                  {template.term_months == null
                    ? "Perpetual"
                    : `${template.term_months} mo`}
                </Badge>
              </div>
              <div className="mt-4">
                <ActionsCell template={template} />
              </div>
            </article>
          )}
          emptyState={{ title: "No templates" }}
          noResultsState={{ title: "No templates match your search" }}
          rowLabelSingular="template"
          rowLabelPlural="templates"
          onRowClick={(t) => router.push(`/templates/${t.id}`)}
        />
      )}
    </PageContainer>
  );
}
