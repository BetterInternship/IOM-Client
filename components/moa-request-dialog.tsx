"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { preconfiguredAxios, type ApiError } from "@/app/api/preconfig.axios";
import { Button } from "@/components/ui/button";
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
import { useResolvedFile } from "@/app/lib/resolve-file";
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

export function TemplatePreviewSheet({
  template,
  onClose,
}: {
  template: Template;
  onClose: () => void;
}) {
  const { url: pdfUrl, loading: isLoading } = useResolvedFile("template_pdf", template.id);

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

export function RequestDialog({
  universityId,
  defaultTemplateId = null,
  inviteId = null,
  verified = true,
  onClose,
}: {
  universityId: string;
  defaultTemplateId?: string | null;
  inviteId?: string | null;
  verified?: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(defaultTemplateId);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<"type" | "upload">("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["university-templates", universityId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/company/universities/${universityId}/templates`)
        .then((r) => r.data as { templates: Template[]; university: { registered_name: string } }),
  });

  const request = useMutation({
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
      if (inviteId) fd.append("invite_id", inviteId);
      const endpoint = verified ? "/api/company/moas" : "/api/company/queued-moas";
      return preconfiguredAxios
        .post(endpoint, fd)
        .then((r) => r.data as { moa?: { id: string }; queued?: { id: string } });
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["company-moas"] });
      queryClient.invalidateQueries({ queryKey: ["company-pending-invites"] });
      if (verified && res.moa) {
        toast("MOA Issued", toastPresets.success);
        onClose();
        router.push(`/company/moas/${res.moa.id}`);
      } else {
        toast(
          "MOA request submitted — it will be issued automatically once your company is verified.",
          toastPresets.success,
        );
        onClose();
        router.push("/company/dashboard");
      }
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
            "If you recently changed your details, they need to be re-verified.",
        );
      } else {
        setError("Couldn't request from this university at this time. Please contact us for help.");
      }
    },
  });

  const templates = data?.templates ?? [];
  const universityName = data?.university?.registered_name ?? "";
  const sigReady = sigMode === "upload" ? !!sigFile : !!sigText.trim();
  const step2Ready = !!repName.trim() && !!repTitle.trim() && sigReady;

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Request MOA</DialogTitle>
            {universityName ? (
              <DialogDescription>{universityName}</DialogDescription>
            ) : isLoading ? (
              <Skeleton className="h-4 w-32" />
            ) : null}
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
                <p className="text-muted-foreground text-sm">
                  No available templates at this university.
                </p>
              )}
              {templates.map((t) => {
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
                          selected ? "border-primary bg-primary text-white" : "border-gray-300",
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
                      className="flex cursor-pointer flex-row items-center gap-1 bg-gray-50 p-2 px-4 text-sm text-muted-foreground duration-200 hover:bg-gray-200"
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
            </div>
          )}

          <DialogFooter>
            {step === 1 ? (
              <>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedTemplate || isLoading}
                >
                  Next
                </Button>
              </>
            ) : (
              <>
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
                  onClick={() => request.mutate()}
                  disabled={!step2Ready || request.isPending}
                >
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
