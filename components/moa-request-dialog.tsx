"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  getCompanyControllerListMoasQueryKey,
  getCompanyControllerListPendingInvitesQueryKey,
  getCompanyControllerListQueuedMoasQueryKey,
  useCompanyControllerCreateQueuedMoa,
  useCompanyControllerGetRequestableTemplates,
  useCompanyControllerRequestMoa,
} from "@/app/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/auth-shell";
import { useModal } from "@/app/providers/modal-provider";
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

type ApiError = { code?: string; data?: { limit?: number }; response?: { data?: { code?: string; data?: { limit?: number } } } };

export function TemplatePreviewContent({ templateId, templateName, templateDescription }: { templateId: string; templateName: string; templateDescription: string | null }) {
  const { url: pdfUrl, loading: isLoading } = useResolvedFile("template_pdf", templateId);
  return (
    <>
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="text-muted-foreground h-5 w-5 animate-spin" />
        </div>
      ) : pdfUrl ? (
        <iframe src={pdfUrl} className="h-full w-full border-0" title={templateName} />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground text-sm">Couldn&apos;t load the template PDF.</p>
        </div>
      )}
    </>
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
  const { openModal } = useModal();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(defaultTemplateId);
  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<"type" | "upload">("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useCompanyControllerGetRequestableTemplates(universityId);

  const requestMoa = useCompanyControllerRequestMoa();
  const createQueuedMoa = useCompanyControllerCreateQueuedMoa();
  const isRequestPending = requestMoa.isPending || createQueuedMoa.isPending;

  const handleSuccess = (res: { moa?: { id: string }; queued?: { id: string } }) => {
      queryClient.invalidateQueries({ queryKey: getCompanyControllerListMoasQueryKey() });
      queryClient.invalidateQueries({ queryKey: getCompanyControllerListQueuedMoasQueryKey() });
      queryClient.invalidateQueries({ queryKey: getCompanyControllerListPendingInvitesQueryKey() });
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
    };

  const handleError = (e: unknown) => {
      const err = e as ApiError;
      const code = err.response?.data?.code || err.code || "";
      if (code === "AT_ACTIVE_MOA_CAP") {
        const limit = err.response?.data?.data?.limit ?? err.data?.limit ?? "the maximum";
        setError(`You have reached the maximum of ${limit} active MOAs with this university.`);
      } else if (code === "COMPANY_NOT_VERIFIED") {
        setError(
          "Your company must be verified by the platform team before you can request MOAs. " +
            "If you recently changed your details, they need to be re-verified.",
        );
      } else {
        setError("Couldn't request from this university at this time. Please contact us for help.");
      }
    };

  const submitRequest = () => {
    const requestData = {
      universityId,
      templateId: selectedTemplate!,
      repName,
      repTitle,
      ...(sigMode === "upload" && sigFile
        ? { signature: sigFile }
        : { repSignatureText: sigText }),
      ...(inviteId ? { invite_id: inviteId } : {}),
    };

    if (verified) {
      requestMoa.mutate({ data: requestData }, { onSuccess: handleSuccess, onError: handleError });
      return;
    }

    createQueuedMoa.mutate({ data: requestData }, { onSuccess: handleSuccess, onError: handleError });
  };

  const templates = data?.templates ?? [];
  const universityName = data?.university?.registered_name ?? "";
  const sigReady = sigMode === "upload" ? !!sigFile : !!sigText.trim();
  const step2Ready = !!repName.trim() && !!repTitle.trim() && sigReady;

  const content = step === 1 ? (
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
              onClick={() =>
                openModal("template-preview", <TemplatePreviewContent templateId={t.id} templateName={t.name} templateDescription={t.description} />, {
                  title: t.name,
                  panelClassName: "!w-full sm:!max-w-4xl",
                  contentClassName: "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                  showHeaderDivider: true,
                })
              }
            >
              Preview
            </div>
          </div>
        );
      })}
    </div>
  ) : (
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
  );

  const footer = step === 1 ? (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>Cancel</Button>
      <Button onClick={() => setStep(2)} disabled={!selectedTemplate || isLoading}>Next</Button>
    </div>
  ) : (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={() => { setStep(1); setError(null); }}>Back</Button>
      <Button onClick={submitRequest} disabled={!step2Ready || isRequestPending}>
        {isRequestPending && <Loader2 className="animate-spin" />}
        {isRequestPending ? "Requesting…" : "Request MOA"}
      </Button>
    </div>
  );

  return (
    <div className="space-y-4">
      {content}
      {footer}
    </div>
  );
}
