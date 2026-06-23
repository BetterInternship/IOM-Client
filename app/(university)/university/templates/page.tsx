"use client";
import { useEffect, useMemo, useState } from "react";
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
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

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
  const [pending, setPending] = useState<{ offer: TemplateOffer; next: boolean } | null>(null);

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
    mutationFn: ({ templateId, is_available }: { templateId: string; is_available: boolean }) =>
      preconfiguredAxios.put(`/api/university/templates/${templateId}`, { is_available }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["university-templates"] }),
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setPending(null),
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
            <p className="font-medium text-gray-900">{row.original.template.name}</p>
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
        accessorFn: (row) => row.template.term_months,
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.template.term_months} months</span>
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
            onClick={() => setPending({ offer: row.original, next: !row.original.is_available })}
            disabled={toggle.isPending}
          >
            <span
              className={`text-xs font-medium ${
                row.original.is_available ? "text-supportive" : "text-muted-foreground"
              }`}
            >
              {row.original.is_available ? "Offered" : "Hidden"}
            </span>
            <Switch
              checked={row.original.is_available}
              onCheckedChange={() =>
                setPending({ offer: row.original, next: !row.original.is_available })
              }
              className="data-[state=checked]:bg-supportive pointer-events-none"
              tabIndex={-1}
            />
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [toggle.isPending],
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

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pending?.next ? "Offer" : "Hide"} this template?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.next
                ? `Companies will be able to request MOAs using "${pending?.offer?.template?.name}".`
                : `Companies will no longer be able to request new MOAs using "${pending?.offer?.template?.name}". Existing active MOAs are unaffected.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                pending &&
                toggle.mutate({
                  templateId: pending.offer.template.id,
                  is_available: pending.next,
                })
              }
            >
              {toggle.isPending && <Loader2 className="animate-spin" />}
              {pending?.next ? "Offer" : "Hide"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
