"use client";
import { Suspense, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/auth-shell";
import {
  Dialog,
  DialogBottomSheet,
  DialogTitle,
} from "@/components/ui/dialog";
import { resolveFile } from "@/app/lib/resolve-file";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { cn } from "@/lib/utils";
import { Check, Loader2, Upload } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string | null;
  term_months: number;
}

interface University {
  id: string;
  registered_name: string;
}

function TemplatePreviewSheet({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const { data: pdfUrl, isLoading } = useQuery({
    queryKey: ["template-preview-url", template.id],
    queryFn: () => resolveFile("template_pdf", template.id),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogBottomSheet
        showCloseButton={false}
        className="flex h-[85vh] flex-col overflow-hidden"
      >
        <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-sm font-medium text-gray-900">
              {template.name}
            </DialogTitle>
            {template.description && (
              <p className="text-muted-foreground truncate text-xs">{template.description}</p>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
            </div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} className="h-full w-full border-0" title={template.name} />
          ) : (
            <div className="flex h-full items-center justify-center">
              <p className="text-muted-foreground text-sm">Couldn&apos;t load the template PDF.</p>
            </div>
          )}
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

function QueueMoaContent() {
  const { universityId } = useParams<{ universityId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const defaultTemplateId = searchParams.get("template_id") ?? null;

  const { company, isLoading: companyLoading } = useCompanyProfile();
  const { data: verification, isLoading: vLoading } = useCompanyVerification(!!company);
  const verified = verification?.status === "verified";
  const incomplete = verification?.status === "incomplete";

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(defaultTemplateId);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<"type" | "upload">("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: templateData, isLoading: tLoading } = useQuery({
    queryKey: ["university-templates", universityId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/company/universities/${universityId}/templates`)
        .then((r) => r.data as { templates: Template[]; university: University }),
    enabled: !!company && !incomplete,
  });

  const submit = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("universityId", universityId);
      fd.append("templateId", selectedTemplate!);
      fd.append("repName", repName);
      fd.append("repTitle", repTitle);
      if (sigMode === "upload" && sigFile) {
        fd.append("signature", sigFile);
      } else {
        fd.append("repSignatureText", sigText);
      }
      const endpoint = verified ? "/api/company/moas" : "/api/company/queued-moas";
      return preconfiguredAxios
        .post(endpoint, fd)
        .then((r) => r.data as { moa?: { id: string }; queued?: { id: string } });
    },
    onSuccess: (res) => {
      if (verified && res.moa) {
        toast("MOA Issued", toastPresets.success);
        router.push(`/company/moas/${res.moa.id}`);
      } else {
        toast(
          "MOA queued — it will be issued automatically once your company is verified.",
          toastPresets.success,
        );
        router.push("/company/dashboard");
      }
    },
    onError: (e: Error) => setError(e.message),
  });

  if (companyLoading || vLoading) {
    return (
      <PageContainer className="max-w-lg space-y-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  const university = templateData?.university ?? null;
  const templates = templateData?.templates ?? [];

  if (incomplete) {
    return (
      <PageContainer className="max-w-lg space-y-6">
        <PageHeader
          title="Queue MOA"
          description={university ? `With ${university.registered_name}` : undefined}
        />
        <Card className="gap-3 px-5 py-5">
          <p className="text-sm font-medium text-gray-900">Complete your profile first</p>
          <p className="text-muted-foreground text-sm">
            Fill in your company details and upload all required documents before you can queue
            or request a MOA.
          </p>
          <Button asChild className="mt-1 w-fit">
            <Link href="/company/profile">Go to profile</Link>
          </Button>
        </Card>
      </PageContainer>
    );
  }

  const sigReady = sigMode === "upload" ? !!sigFile : !!sigText.trim();
  const step2Ready = !!repName.trim() && !!repTitle.trim() && sigReady;

  const pageTitle = verified ? "Request MOA" : "Queue MOA";
  const submitLabel = verified ? "Request MOA" : "Queue MOA";

  return (
    <>
      <PageContainer className="max-w-lg space-y-6">
        <PageHeader
          title={pageTitle}
          description={university ? `With ${university.registered_name}` : undefined}
        />

        {!verified && (
          <div className="border-primary/30 bg-primary/5 rounded-[0.33em] border px-4 py-3 text-sm text-gray-700">
            Your company is not yet verified. This MOA will be queued and issued automatically
            once the platform approves your company.
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            {tLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            ) : templates.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                This university has no available MOA templates.
              </p>
            ) : (
              templates.map((t) => {
                const selected = selectedTemplate === t.id;
                return (
                  <div
                    key={t.id}
                    className={cn(
                      "relative flex items-stretch rounded-[0.33em] border",
                      selected
                        ? "border-primary bg-primary/5"
                        : "border-gray-200 hover:border-gray-300",
                    )}
                  >
                    <Button
                      variant="ghost"
                      className="h-auto flex-1 items-start justify-start gap-3 rounded-r-none p-3 text-left hover:bg-transparent"
                      onClick={() => setSelectedTemplate(t.id)}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border",
                          selected
                            ? "border-primary bg-primary text-white"
                            : "border-gray-300",
                        )}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-gray-900">{t.name}</span>
                        {t.description && (
                          <span className="text-muted-foreground mt-0.5 block text-xs">
                            {t.description}
                          </span>
                        )}
                        <span className="text-muted-foreground mt-1 block text-xs">
                          Term: {t.term_months} months
                        </span>
                      </span>
                    </Button>
                    <div
                      className="text-muted-foreground flex cursor-pointer items-center gap-1 bg-gray-50 px-4 py-2 text-sm duration-200 hover:bg-gray-200"
                      onClick={() => setPreviewTemplate(t)}
                    >
                      Preview
                    </div>
                  </div>
                );
              })
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button onClick={() => setStep(2)} disabled={!selectedTemplate}>
                Next
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs">
              These details will appear on the MOA document.
              {verified
                ? " They are not stored after generation."
                : " They are stored until the MOA is issued."}
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="rep-name">Representative name</Label>
              <Input
                id="rep-name"
                value={repName}
                onChange={(e) => setRepName(e.target.value)}
                placeholder="Full name"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="rep-title">Representative title</Label>
              <Input
                id="rep-title"
                value={repTitle}
                onChange={(e) => setRepTitle(e.target.value)}
                placeholder="e.g. CEO, HR Manager"
              />
            </div>

            <div className="space-y-2">
              <Label>Signature</Label>
              <div className="flex gap-1 rounded-[0.33em] border border-gray-200 p-0.5">
                <Button
                  variant={sigMode === "type" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSigMode("type")}
                >
                  Type
                </Button>
                <Button
                  variant={sigMode === "upload" ? "default" : "ghost"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setSigMode("upload")}
                >
                  Upload image
                </Button>
              </div>

              {sigMode === "type" ? (
                <Input
                  value={sigText}
                  onChange={(e) => setSigText(e.target.value)}
                  placeholder="Type your signature"
                  className="font-serif italic"
                />
              ) : (
                <div className="space-y-2">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setSigFile(f);
                      e.target.value = "";
                    }}
                  />
                  {sigFile ? (
                    <div className="flex items-center justify-between rounded-[0.33em] border border-gray-200 px-3 py-2">
                      <span className="truncate text-xs text-gray-700">{sigFile.name}</span>
                      <Button
                        variant="ghost"
                        size="xs"
                        className="ml-2 flex-shrink-0"
                        onClick={() => setSigFile(null)}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" /> Choose image (PNG or JPEG)
                    </Button>
                  )}
                </div>
              )}
            </div>

            {error && <FormError>{error}</FormError>}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setStep(1);
                  setError(null);
                }}
              >
                Back
              </Button>
              <Button
                onClick={() => submit.mutate()}
                disabled={!step2Ready || submit.isPending}
              >
                {submit.isPending && <Loader2 className="animate-spin" />}
                {submit.isPending ? "Submitting…" : submitLabel}
              </Button>
            </div>
          </div>
        )}
      </PageContainer>

      {previewTemplate && (
        <TemplatePreviewSheet
          template={previewTemplate}
          onClose={() => setPreviewTemplate(null)}
        />
      )}
    </>
  );
}

export default function QueueMoaPage() {
  return (
    <Suspense
      fallback={
        <PageContainer className="max-w-lg space-y-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-48 w-full" />
        </PageContainer>
      }
    >
      <QueueMoaContent />
    </Suspense>
  );
}
