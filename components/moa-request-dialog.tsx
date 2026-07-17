"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  BasePdfViewer,
  Loader as PdfLoader,
  usePdfDocumentFromUrl,
  usePdfPageRenderer,
} from "@betterinternship/core/pdf-viewer";
import {
  type CompanyPendingInvitesResponse,
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
import {
  MoaSignatureInput,
  type MoaSignatureMode,
} from "@/components/moa-signature-input";
import { useResolvedFile } from "@/app/lib/resolve-file";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { cn } from "@/lib/utils";
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  PenLine,
} from "lucide-react";

function AnimatedCheck() {
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 52 52"
      fill="none"
      className="text-supportive"
    >
      <path
        d="M14 27 L22 35 L38 18"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength="1"
        className="check-path"
      />
    </svg>
  );
}

function MoaIssuedSuccess() {
  return (
    <div className="mx-auto flex min-h-[20rem] w-full flex-col items-center justify-center px-4 py-10 text-center sm:w-[30rem]">
      <style>{`
        .request-moa-header {
          display: none;
        }

        .check-path {
          stroke-dasharray: 1;
          stroke-dashoffset: 1;
          animation: drawCheck 300ms ease-out forwards;
        }

        @keyframes drawCheck {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
      <div className="mb-5 rounded-full bg-supportive/10 p-6">
        <AnimatedCheck />
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-foreground">
        MOA issued
      </h2>
      <p className="text-muted-foreground mt-2 text-sm">Opening your MOA...</p>
    </div>
  );
}

function MoaIssuingState() {
  return (
    <div className="mx-auto flex min-h-[20rem] w-full flex-col items-center justify-center px-4 py-10 text-center sm:w-[30rem]">
      <style>{`
        .request-moa-header {
          display: none;
        }
      `}</style>
      <div className="relative mb-6 flex h-28 w-28 items-center justify-center">
        <span className="absolute h-full w-full animate-ping rounded-full bg-primary/10" />
        <span className="absolute h-20 w-20 animate-pulse rounded-full bg-primary/10" />
        <FileText className="text-primary relative h-12 w-12" />
      </div>
      <h2 className="text-3xl font-semibold tracking-tight text-foreground">
        Issuing your MOA
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        We&apos;re generating the agreement and preparing the signed document.
      </p>
    </div>
  );
}

type RequestPhase = "form" | "issuing" | "issued";

interface Template {
  id: string;
  name: string;
  description: string | null;
  term_months: number | null;
}

type ApiError = {
  code?: string;
  data?: { limit?: number };
  response?: { data?: { code?: string; data?: { limit?: number } } };
};

const requestSteps = [
  { title: "Choose template", icon: FileText },
  { title: "Sign request", icon: PenLine },
];

function TemplatePdfViewer({ url }: { url: string }) {
  const { pdfDoc, pageCount, isLoading, error } = usePdfDocumentFromUrl(url);
  const [scale, setScale] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-center">
        <div>
          <p className="text-sm text-red-500">Failed to load PDF</p>
          <p className="text-muted-foreground mt-1 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  if (isLoading || !pdfDoc) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100">
        <PdfLoader />
      </div>
    );
  }

  return (
    <BasePdfViewer
      pdfDoc={pdfDoc}
      pageCount={pageCount}
      scale={scale}
      onScaleChange={setScale}
      visiblePage={visiblePage}
      onVisiblePageChange={setVisiblePage}
      renderPage={(pageNumber) => (
        <TemplatePdfPage
          key={pageNumber}
          pdfDoc={pdfDoc}
          pageNumber={pageNumber}
          scale={scale}
        />
      )}
    />
  );
}

function TemplatePdfPage({
  pdfDoc,
  pageNumber,
  scale,
}: {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const { canvasRef } = usePdfPageRenderer(pdfDoc, pageNumber, scale);

  return <canvas ref={canvasRef} className="block shadow-sm" />;
}

export function TemplatePreviewContent({
  templateId,
  templateName,
  templateDescription,
}: {
  templateId: string;
  templateName: string;
  templateDescription: string | null;
}) {
  const { url: pdfUrl, loading: isLoading } = useResolvedFile(
    "template_pdf",
    templateId,
  );
  return (
    <>
      {isLoading ? (
        <div className="flex h-full items-center justify-center bg-slate-100">
          <Loader2 className="text-primary h-6 w-6 animate-spin" />
        </div>
      ) : pdfUrl ? (
        <TemplatePdfViewer
          url={`/gcs-proxy?url=${encodeURIComponent(pdfUrl)}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground text-sm">
            Couldn&apos;t load the template PDF.
          </p>
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
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(
    defaultTemplateId,
  );
  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<MoaSignatureMode>("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [requestPhase, setRequestPhase] = useState<RequestPhase>("form");

  const { data, isLoading } =
    useCompanyControllerGetRequestableTemplates(universityId);

  const requestMoa = useCompanyControllerRequestMoa();
  const createQueuedMoa = useCompanyControllerCreateQueuedMoa();
  const isRequestPending = requestMoa.isPending || createQueuedMoa.isPending;

  const handleSuccess = (res: {
    moa?: { id: string };
    queued?: { id: string };
  }) => {
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerListMoasQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerListQueuedMoasQueryKey(),
    });
    const pendingInvitesQueryKey =
      getCompanyControllerListPendingInvitesQueryKey();
    if (inviteId) {
      queryClient.setQueriesData<CompanyPendingInvitesResponse>(
        { queryKey: pendingInvitesQueryKey },
        (current) =>
          current
            ? {
                ...current,
                invites: current.invites.filter(
                  (invite) => invite.id !== inviteId,
                ),
              }
            : current,
      );
    } else {
      queryClient.invalidateQueries({ queryKey: pendingInvitesQueryKey });
    }
    if (verified && res.moa) {
      setRequestPhase("issued");
      window.setTimeout(() => {
        router.push(`/company/moas/${res.moa!.id}?issued=1`);
      }, 550);
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
    setRequestPhase("form");
    const err = e as ApiError;
    const code = err.response?.data?.code || err.code || "";
    if (code === "AT_ACTIVE_MOA_CAP") {
      const limit =
        err.response?.data?.data?.limit ?? err.data?.limit ?? "the maximum";
      setError(
        `You have reached the maximum of ${limit} active MOAs with this university.`,
      );
    } else if (code === "COMPANY_NOT_VERIFIED") {
      setError(
        "Your company must be verified by the platform team before you can request MOAs. " +
          "If you recently changed your details, they need to be re-verified.",
      );
    } else {
      setError(
        "Couldn't request from this university at this time. Please contact us for help.",
      );
    }
  };

  const submitRequest = () => {
    setError(null);
    setRequestPhase("issuing");
    const requestData = {
      universityId,
      templateId: selectedTemplate!,
      repName,
      repTitle,
      ...(sigMode !== "type" && sigFile
        ? { signature: sigFile }
        : { repSignatureText: sigText }),
      ...(inviteId ? { invite_id: inviteId } : {}),
    };

    if (verified) {
      requestMoa.mutate(
        { data: requestData },
        { onSuccess: handleSuccess, onError: handleError },
      );
      return;
    }

    createQueuedMoa.mutate(
      { data: requestData },
      { onSuccess: handleSuccess, onError: handleError },
    );
  };

  const templates = data?.templates ?? [];
  const universityName = data?.university?.registered_name ?? "";
  const sigReady = sigMode === "type" ? !!sigText.trim() : !!sigFile;
  const step2Ready = !!repName.trim() && !!repTitle.trim() && sigReady;
  const currentStepIndex = step - 1;

  if (requestPhase === "issuing") {
    return <MoaIssuingState />;
  }

  if (requestPhase === "issued") {
    return <MoaIssuedSuccess />;
  }

  const content =
    step === 1 ? (
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
                "relative overflow-hidden rounded-[0.33em] border",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-gray-200 hover:border-gray-300",
              )}
            >
              <div className="relative">
                <Button
                  variant="ghost"
                  className="h-auto w-full items-start justify-start gap-3 rounded-none py-3 pr-28 pl-3 text-left hover:bg-transparent"
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
                    <span className="block text-sm font-medium text-gray-900">
                      {t.name}
                    </span>
                    {t.description && (
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {t.description}
                      </span>
                    )}
                    <span className="text-muted-foreground mt-1 block text-xs">
                      Term:{" "}
                      {t.term_months == null
                        ? "Perpetual (no expiry)"
                        : `${t.term_months} months`}
                    </span>
                  </span>
                </Button>
                <button
                  type="button"
                  className="absolute top-0 right-0 bottom-0 flex items-center gap-1 border px-4 text-sm text-muted-foreground duration-200"
                  onClick={() => setSelectedTemplate(t.id)}
                >
                  Preview
                </button>
              </div>
              {selected && (
                <div className="border-t border-primary/20 bg-white">
                  <div className="h-[45vh] min-h-72 border-t border-gray-100 bg-gray-50 sm:h-[50vh]">
                    <TemplatePreviewContent
                      templateId={t.id}
                      templateName={t.name}
                      templateDescription={t.description}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    ) : (
      <div className="space-y-4">
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

        <MoaSignatureInput
          mode={sigMode}
          onModeChange={setSigMode}
          text={sigText}
          onTextChange={setSigText}
          file={sigFile}
          onFileChange={setSigFile}
        />

        <p className="text-muted-foreground text-sm">
          These details will appear on the MOA document. They are not stored
          after generation.
        </p>

        {error && <FormError>{error}</FormError>}
      </div>
    );

  const footer =
    step === 1 ? (
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => setStep(2)}
          disabled={!selectedTemplate || isLoading}
        >
          Next <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    ) : (
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => {
            setStep(1);
            setError(null);
          }}
        >
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <Button
          onClick={submitRequest}
          disabled={!step2Ready || isRequestPending}
        >
          {isRequestPending && <Loader2 className="animate-spin" />}
          {isRequestPending
            ? verified
              ? "Requesting…"
              : "Queueing…"
            : verified
              ? "Request MOA"
              : "Queue MOA"}
        </Button>
      </div>
    );

  return (
    <div className="space-y-4 sm:w-[min(92vw,64rem)]">
      {!verified && (
        <div className="border-primary/20 bg-primary/5 rounded-[0.33em] border px-4 py-3 text-sm text-gray-700">
          Your company is still pending approval. This request will be queued
          and issued automatically once the platform team approves your company.
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
        {requestSteps.map((requestStep, index) => {
          const Icon = requestStep.icon;
          const active = index === currentStepIndex;
          const done = index < currentStepIndex;

          return (
            <div
              key={requestStep.title}
              className={cn(
                "flex min-w-0 items-center gap-2 rounded-[0.33em] border p-3",
                active
                  ? "border-primary/60 bg-primary/5"
                  : done
                    ? "border-supportive/40 bg-supportive/5"
                    : "border-border/60",
              )}
              aria-current={active ? "step" : undefined}
            >
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                  active ? "bg-primary/10" : "bg-gray-100",
                )}
              >
                {done ? (
                  <CheckCircle2 className="text-supportive h-5 w-5" />
                ) : (
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      active ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                )}
              </div>
              <div className="min-w-0 text-sm leading-tight font-medium">
                <div className="text-xs text-gray-400">Step {index + 1}</div>
                <div className="truncate">{requestStep.title}</div>
              </div>
            </div>
          );
        })}
      </div>
      {content}
      <div className="sticky bottom-0 z-20 -mx-4 border-t bg-white px-4 pt-3">
        {footer}
      </div>
    </div>
  );
}
