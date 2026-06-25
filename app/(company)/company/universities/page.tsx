"use client";
import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import { preconfiguredAxios, type ApiError } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/auth-shell";
import {
  Dialog,
  DialogBottomSheet,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { resolveFile } from "@/app/lib/resolve-file";
import { cn } from "@/lib/utils";
import { Building2, Check, Eye, Loader2, Upload, X } from "lucide-react";

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
      <DialogBottomSheet showCloseButton={false} className="flex h-[85vh] flex-col overflow-hidden">
        <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="text-sm font-medium text-gray-900">{template.name}</DialogTitle>
            {template.description && (
              <p className="text-muted-foreground truncate text-xs">{template.description}</p>
            )}
          </div>
          <Button variant="ghost" size="icon" className="ml-4 flex-shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
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
              <p className="text-muted-foreground text-sm">Couldn't load the template PDF.</p>
            </div>
          )}
        </div>
      </DialogBottomSheet>
    </Dialog>
  );
}

function RequestDialog({
  university,
  onClose,
}: {
  university: University;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<"type" | "upload">("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["university-templates", university.id],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/company/universities/${university.id}/templates`)
        .then((r) => r.data as { templates: Template[] }),
  });

  const request = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append("universityId", university.id);
      fd.append("templateId", selectedTemplate!);
      fd.append("repName", repName);
      fd.append("repTitle", repTitle);
      if (sigMode === "upload" && sigFile) {
        fd.append("signature", sigFile);
      } else {
        fd.append("repSignatureText", sigText);
      }
      return preconfiguredAxios
        .post("/api/company/moas", fd)
        .then((r) => r.data as { moa: { id: string } });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["company-moas"] });
      onClose();
      router.push(`/moas/${res.moa.id}`);
    },
    onError: (e: Error) => {
      const err = e as ApiError;
      const code = err.response?.data?.code || "";
      if (code === "AT_ACTIVE_MOA_CAP") {
        const limit = err.response?.data?.data?.limit ?? "the maximum";
        setError(`You have reached the maximum of ${limit} active MOAs with this university.`);
      } else if (code === "COMPANY_NOT_VERIFIED") {
        setError(
          "Your company must be verified by the platform team before you can request MOAs. " +
            "If you recently changed your details, they need to be re-verified."
        );
      } else {
        setError("Couldn't request from this university at this time. Please contact us for help.");
      }
    },
  });

  const templates = data?.templates ?? [];
  const sigReady = sigMode === "upload" ? !!sigFile : !!sigText.trim();
  const step2Ready = !!repName.trim() && !!repTitle.trim() && sigReady;

  return (
    <>
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request MOA</DialogTitle>
          <DialogDescription>{university.registered_name}</DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-3">
            {isLoading && (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </>
            )}
            {!isLoading && templates.length === 0 && (
              <p className="text-muted-foreground text-sm">No available templates at this university.</p>
            )}
            {templates.map((t) => {
              const selected = selectedTemplate === t.id;
              return (
                <div
                  key={t.id}
                  className={cn(
                    "relative flex items-stretch rounded-[0.33em] border",
                    selected ? "border-primary bg-primary/5" : "border-gray-200 hover:border-gray-300"
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
                        selected ? "border-primary bg-primary text-white" : "border-gray-300"
                      )}
                    >
                      {selected && <Check className="h-3 w-3" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-gray-900">{t.name}</span>
                      {t.description && (
                        <span className="text-muted-foreground mt-0.5 block text-xs">{t.description}</span>
                      )}
                      <span className="text-muted-foreground mt-1 block text-xs">Term: {t.term_months} months</span>
                    </span>
                  </Button>
                  <div
                    className="flex flex-row items-center text-muted-foreground bg-gray-50 p-2 px-4 gap-1 hover:cursor-pointer hover:bg-gray-200 duration-200 text-sm"
                    onClick={() => setPreviewTemplate(t)}
                  >
                    Preview
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-muted-foreground text-xs">
              These details will appear on the MOA document. They are not stored after generation.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="rep-name">Representative name</Label>
              <Input id="rep-name" value={repName} onChange={(e) => setRepName(e.target.value)} placeholder="Full name" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rep-title">Representative title</Label>
              <Input id="rep-title" value={repTitle} onChange={(e) => setRepTitle(e.target.value)} placeholder="e.g. CEO, HR Manager" />
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
                      <span className="text-xs text-gray-700 truncate">{sigFile.name}</span>
                      <Button variant="ghost" size="xs" className="ml-2 flex-shrink-0" onClick={() => setSigFile(null)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" className="w-full" onClick={() => fileRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Choose image (PNG or JPEG)
                    </Button>
                  )}
                </div>
              )}
            </div>

            {error && <FormError>{error}</FormError>}
          </div>
        )}

        <DialogFooter>
          {step === 1 ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={() => setStep(2)} disabled={!selectedTemplate}>Next</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setStep(1); setError(null); }}>Back</Button>
              <Button onClick={() => request.mutate()} disabled={!step2Ready || request.isPending}>
                {request.isPending && <Loader2 className="animate-spin" />}
                {request.isPending ? "Requesting…" : "Request MOA"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {previewTemplate && (
      <TemplatePreviewSheet
        template={previewTemplate}
        onClose={() => setPreviewTemplate(null)}
      />
    )}
    </>
  );
}

export default function UniversityDirectoryPage() {
  const { company, isLoading } = useCompanyProfile();
  const [selected, setSelected] = useState<University | null>(null);

  const { data: verification, isLoading: vLoading } = useCompanyVerification(!!company);
  const verified = verification?.status === "verified";

  const { data, isLoading: uniLoading } = useQuery({
    queryKey: ["company-universities"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/company/universities")
        .then((r) => r.data as { universities: University[] }),
    enabled: !!company && verified,
  });

  if (isLoading || vLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-20 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  // Global gate: the request surface is hidden entirely until the company is
  // platform-verified. Per-university conditions apply only after this passes.
  if (!verified) {
    const status = verification?.status;
    return (
      <PageContainer className="space-y-6">
        <PageHeader
          title="Request MOA"
          description="This is a list of universities you can request a MOA with."
        />
        <div className="border-warning/30 bg-warning/10 rounded-[0.33em] border p-4 text-sm text-gray-700">
          {status === "rejected"
            ? verification?.rejectionReason ||
              "Your company could not be verified. Please review your profile and documents."
            : status === "incomplete"
              ? "Complete your profile and upload all required documents so the platform team can verify your company."
              : status === "expired"
                ? "Your company verification has expired. Please re-upload your documents to request re-review."
                : "Your company is pending verification by the platform team. You can request MOAs once it's approved."}{" "}
          <Link href="/profile" className="text-primary underline">
            Go to your profile
          </Link>
          .
        </div>
      </PageContainer>
    );
  }

  const universities = data?.universities ?? [];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Request MOA"
        description="This is a list of universities you can request a MOA with."
      />

      {uniLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : universities.length === 0 ? (
        <EmptyState title="No universities found" />
      ) : (
        <div className="space-y-2.5">
          {universities.map((uni) => (
            <Card
              key={uni.id}
              className="flex-row items-center justify-between gap-4 px-5 py-4"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-muted text-muted-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.33em]">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-gray-900">
                    {uni.registered_name}
                  </p>
                  {uni.address && (
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {uni.address}
                    </p>
                  )}
                </div>
              </div>
              {uni.requestable ? (
                <Button
                  className="flex-shrink-0"
                  size="sm"
                  onClick={() => setSelected(uni)}
                >
                  Request MOA
                </Button>
              ) : (
                <Badge type="default" className="flex-shrink-0">
                  Unavailable
                </Badge>
              )}
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <RequestDialog university={selected} onClose={() => setSelected(null)} />
      )}
    </PageContainer>
  );
}
