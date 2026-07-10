"use client";
import { use } from "react";
import { useAdminControllerListTemplates } from "@/app/api";
import { useResolvedFile } from "@/app/lib/resolve-file";
import { TemplateEditor } from "@/components/templates/template-editor";
import { PageContainer } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  term_months: number;
  field_schema: unknown;
}

export default function EditTemplatePage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = use(params);
  const router = useRouter();

  const { data, isLoading } = useAdminControllerListTemplates();

  const templates = (data?.templates ?? []) as unknown as Template[];
  const tmpl = templates?.find((t) => t.id === templateId);

  const { url: pdfUrl, loading: urlLoading } = useResolvedFile(
    "template_pdf",
    tmpl ? templateId : null,
  );

  if (isLoading || (tmpl && urlLoading)) {
    return (
      <PageContainer className="space-y-4">
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading template…
        </div>
        <Skeleton className="h-[60vh] w-full" />
      </PageContainer>
    );
  }

  if (!tmpl) {
    return (
      <PageContainer className="space-y-4">
        <p className="text-sm text-gray-700">Template not found.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/templates")}>
          Back to catalog
        </Button>
      </PageContainer>
    );
  }

  if (!pdfUrl) {
    return (
      <PageContainer className="space-y-4">
        <p className="text-destructive text-sm">Couldn’t load this template’s PDF.</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/templates")}>
          Back to catalog
        </Button>
      </PageContainer>
    );
  }

  return (
    <TemplateEditor
      mode="edit"
      templateId={templateId}
      initial={{
        name: tmpl.name,
        description: tmpl.description ?? "",
        term_months: tmpl.term_months,
        field_schema: tmpl.field_schema,
        pdfUrl,
      }}
    />
  );
}
