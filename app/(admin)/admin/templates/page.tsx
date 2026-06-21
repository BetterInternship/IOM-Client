"use client";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { FileText, Pencil, Plus } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  term_months: number;
  page_count: number;
  field_schema: unknown;
}

export default function AdminTemplatesPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-templates"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/admin/templates")
        .then((r) => r.data.templates as Template[]),
  });

  const remove = useMutation({
    mutationFn: (id: string) => preconfiguredAxios.delete(`/api/admin/templates/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-templates"] });
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fieldCount = (t: Template) =>
    Array.isArray(t.field_schema) ? t.field_schema.length : 0;

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="MOA Templates"
        description="Author the shared catalog of MOA templates. Universities choose which to offer."
      >
        <Button onClick={() => router.push("/admin/templates/new")}>
          <Plus /> New template
        </Button>
      </PageHeader>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No templates yet"
          description="Create your first MOA template to make it available to universities."
        />
      ) : (
        <div className="space-y-2.5">
          {data.map((t) => (
            <Card
              key={t.id}
              className="flex-row items-center justify-between gap-4 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-muted text-muted-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.33em]">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">{t.name}</p>
                  {t.description && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {t.description}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge type="default" strength="medium">
                      {t.term_months} mo term
                    </Badge>
                    <Badge type="default" strength="medium">
                      {t.page_count} page{t.page_count === 1 ? "" : "s"}
                    </Badge>
                    <Badge type={fieldCount(t) === 0 ? "warning" : "default"} strength="medium">
                      {fieldCount(t)} field{fieldCount(t) === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="flex flex-shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/templates/${t.id}`)}
                >
                  <Pencil /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" scheme="destructive" size="sm">
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {t.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        It will be removed from the catalog and universities can no longer offer it.
                        Existing MOAs are unaffected (their PDFs are frozen). This can’t be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={() => remove.mutate(t.id)}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
