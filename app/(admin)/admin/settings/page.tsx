"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminControllerGetSettingsQueryKey,
  useAdminControllerGetSettings,
  useAdminControllerListTemplates,
  useAdminControllerPatchSettings,
  useAdminControllerUploadWitnessSignature,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailField } from "@/components/ui/detail-field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Loader2, Upload } from "lucide-react";

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useAdminControllerGetSettings({
    query: { queryKey: getAdminControllerGetSettingsQueryKey() },
  });
  const { data: templatesData, isLoading: templatesLoading } =
    useAdminControllerListTemplates();
  // Immutable templates (plan §13) — only a current, non-retired version
  // can be the platform default.
  const templates = (templatesData?.templates ?? []).filter(
    (t) => !t.retired_at,
  );

  const [defaultTemplateId, setDefaultTemplateId] = useState("");
  const [witnessName, setWitnessName] = useState("");
  const [witnessTitle, setWitnessTitle] = useState("");

  useEffect(() => {
    if (!settings) return;
    setDefaultTemplateId(settings.default_template_id ?? "");
    setWitnessName(settings.witness_name ?? "");
    setWitnessTitle(settings.witness_title ?? "");
  }, [settings]);

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: getAdminControllerGetSettingsQueryKey(),
    });

  const patch = useAdminControllerPatchSettings({
    mutation: {
      onSuccess: () => {
        toast.success("Settings saved");
        invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const uploadSignature = useAdminControllerUploadWitnessSignature({
    mutation: {
      onSuccess: () => {
        toast.success("Witness signature updated");
        invalidate();
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const identityDirty =
    witnessName !== (settings?.witness_name ?? "") ||
    witnessTitle !== (settings?.witness_title ?? "");

  if (isLoading) {
    return (
      <PageContainer className="max-w-2xl space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-56 w-full" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-2xl space-y-6">
      <PageHeader
        title="Platform Settings"
        description="Configured once, applied to every company's MOA request."
      />

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Default template
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Pre-selected on the company request form when the university
            offers it; otherwise their first available template is used
            instead (flow spec §7).
          </p>
        </div>
        <DetailField label="Platform-wide default">
          <Select
            value={defaultTemplateId || undefined}
            disabled={templatesLoading}
            onValueChange={(v) => {
              setDefaultTemplateId(v);
              patch.mutate({ data: { default_template_id: v } });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="No default set" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </DetailField>
      </Card>

      <Card className="space-y-4 p-6">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">
            Witness identity
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Auto-injected as company signatory 2 on templates that reserve a
            witness slot — the company is never asked for a second signer
            (flow spec §7).
          </p>
        </div>

        <DetailField label={<Label htmlFor="witness-name">Name</Label>}>
          <Input
            id="witness-name"
            value={witnessName}
            onChange={(e) => setWitnessName(e.target.value)}
          />
        </DetailField>
        <DetailField label={<Label htmlFor="witness-title">Title</Label>}>
          <Input
            id="witness-title"
            value={witnessTitle}
            onChange={(e) => setWitnessTitle(e.target.value)}
          />
        </DetailField>

        <div className="flex justify-end">
          <Button
            size="sm"
            disabled={!identityDirty || patch.isPending}
            onClick={() =>
              patch.mutate({
                data: { witness_name: witnessName, witness_title: witnessTitle },
              })
            }
          >
            {patch.isPending && <Loader2 className="animate-spin" />}
            Save
          </Button>
        </div>

        <div className="border-t border-gray-100 pt-4">
          <Label>Signature</Label>
          <div className="mt-2 flex items-center gap-4">
            {settings?.witness_signature_url ? (
              // Signed platform-asset URL, not user content.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.witness_signature_url}
                alt="Witness signature"
                className="h-16 max-w-48 rounded-[0.33em] border border-gray-200 bg-white object-contain p-2"
              />
            ) : (
              <span className="text-muted-foreground text-sm">
                No signature uploaded yet
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={uploadSignature.isPending}
              onClick={() => document.getElementById("witness-sig-file")?.click()}
            >
              {uploadSignature.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Upload />
              )}
              {settings?.witness_signature_url ? "Replace" : "Upload"}
            </Button>
            <input
              id="witness-sig-file"
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              disabled={uploadSignature.isPending}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadSignature.mutate({ data: { file } });
                event.target.value = "";
              }}
            />
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
