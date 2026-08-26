"use client";
import { useEffect, useState } from "react";
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
  type CompanyControllerCreateMoaRequestBody,
  getCompanyControllerListMoaRequestsQueryKey,
  useCompanyControllerCreateMoaRequest,
  useCompanyControllerGetRequestableTemplates,
} from "@/app/api";
import {
  CompanySignerForm,
  type CompanySignerMode,
} from "@/components/company-signer-form";
import { AutoRequestCta } from "@/components/auto-request-cta";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { FormError } from "@/components/auth-shell";
import type { MoaSignatureMode } from "@/components/moa-signature-input";
import { useResolvedFile } from "@/app/lib/resolve-file";
import { useIomModalRegistry } from "@/components/modal-registry";
import { TemplatePreviewRow } from "@/components/template-preview-row";
import { cn } from "@/lib/utils";
import { Check, Clock4, FileText, Loader2 } from "lucide-react";

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

function OutcomeShell({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
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
      <div className="mb-5 rounded-full bg-supportive/10 p-6">{icon}</div>
      <h2 className="text-3xl font-semibold tracking-tight text-foreground">
        {title}
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">
        {description}
      </p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

function MoaIssuedSuccess() {
  return (
    <OutcomeShell
      icon={<AnimatedCheck />}
      title="MOA issued"
      description="Opening your MOA…"
    />
  );
}

function MoaSubmittedSuccess({
  description,
  onDismiss,
  cta,
}: {
  description: string;
  onDismiss: () => void;
  cta?: React.ReactNode;
}) {
  return (
    <>
      <OutcomeShell
        icon={<Clock4 className="text-supportive h-9 w-9" />}
        title="Request submitted"
        description={description}
        action={<Button onClick={onDismiss}>Dismiss</Button>}
      />
      {cta && (
        <div className="mx-auto w-full px-4 pb-8 sm:w-[30rem] sm:px-0">
          {cta}
        </div>
      )}
    </>
  );
}

function MoaSubmittingState() {
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
        Submitting your request
      </h2>
      <p className="text-muted-foreground mt-2 max-w-sm text-sm">One moment…</p>
    </div>
  );
}

type RequestMode = CompanySignerMode;
type RequestPhase = "form" | "submitting" | "issued" | "submitted";
const DELEGATE_SIGNATORY_EMAIL_STORAGE_KEY =
  "iom-company-delegate-signatory-email";

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

function TemplatePdfViewer({ url }: { url: string }) {
  const { pdfDoc, pageCount, isLoading, error } = usePdfDocumentFromUrl(url);
  const [scale, setScale] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setScale(0.7);
  }, []);

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

/**
 * Two steps now (flow spec §7): who-signs + a quiet template line, then the
 * details form. One create path for every outcome — the server decides
 * whether it issues immediately, parks, or goes out for signature.
 */
export function RequestDialog({
  universityId,
  defaultTemplateId = null,
  successHref = "/company/requests",
  onClose,
  onSuccessClose = onClose,
}: {
  universityId: string;
  defaultTemplateId?: string | null;
  successHref?: string;
  onClose: () => void;
  onSuccessClose?: () => void;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const modal = useIomModalRegistry();
  const [mode, setMode] = useState<RequestMode | null>(null);
  const [isChangingMode, setIsChangingMode] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    defaultTemplateId,
  );
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  const [repName, setRepName] = useState("");
  const [repTitle, setRepTitle] = useState("");
  const [sigMode, setSigMode] = useState<MoaSignatureMode>("type");
  const [sigText, setSigText] = useState("");
  const [sigFile, setSigFile] = useState<File | null>(null);
  const [signatoryEmail, setSignatoryEmail] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<RequestPhase>("form");
  const [outcomeMessage, setOutcomeMessage] = useState("");

  useEffect(() => {
    const savedEmail = window.localStorage.getItem(
      DELEGATE_SIGNATORY_EMAIL_STORAGE_KEY,
    );
    if (savedEmail) setSignatoryEmail(savedEmail);
  }, []);

  const { data, isLoading } = useCompanyControllerGetRequestableTemplates(
    universityId,
    {
      query: { queryKey: ["university-templates-for-invite", universityId] },
    },
  );

  const templates = (data?.templates ?? []) as Template[];
  const universityName = data?.university?.registered_name ?? "";

  // Auto-select the platform default (or this university's first template)
  // once templates load, unless the caller already gave us one to start on.
  useEffect(() => {
    if (isLoading || selectedTemplateId) return;
    const fallback = data?.defaultTemplateId ?? templates[0]?.id ?? null;
    if (fallback) setSelectedTemplateId(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, data?.defaultTemplateId, templates.length]);

  useEffect(() => {
    if (
      !isLoading &&
      selectedTemplateId &&
      !templates.some((t) => t.id === selectedTemplateId)
    ) {
      setSelectedTemplateId(
        data?.defaultTemplateId ?? templates[0]?.id ?? null,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.templates, isLoading]);

  const createRequest = useCompanyControllerCreateMoaRequest();

  const handleSuccess = (res: {
    request?: { status?: string; moa_id?: string | null };
  }) => {
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerListMoaRequestsQueryKey(),
    });

    const status = res.request?.status;
    if (status === "issued" && res.request?.moa_id) {
      setPhase("issued");
      window.setTimeout(() => {
        router.push(`/company/moas/${res.request!.moa_id}?issued=1`);
      }, 550);
      return;
    }

    const message =
      mode === "delegate"
        ? `We emailed ${signatoryEmail} a link to sign — you'll see it here once it's signed.`
        : "Signed and on file — it will issue automatically once your company is verified.";
    setOutcomeMessage(message);
    setPhase("submitted");
  };

  const handleError = (e: unknown) => {
    setPhase("form");
    const err = e as ApiError;
    const code = err.response?.data?.code || err.code || "";
    if (code === "AT_ACTIVE_MOA_CAP") {
      const limit =
        err.response?.data?.data?.limit ?? err.data?.limit ?? "the maximum";
      setError(
        `You have reached the maximum of ${limit} active MOAs with this university.`,
      );
    } else if (code === "DOCUMENTS_INCOMPLETE") {
      setError("Upload your documents before you can request MOAs.");
    } else if (code === "REQUEST_ALREADY_IN_FLIGHT") {
      setError("You already have a request in flight with this university.");
    } else if (code === "UNIVERSITY_NOT_REQUESTABLE") {
      setError("Unable to request from this university at this time.");
    } else {
      setError(
        "Couldn't request from this university at this time. Please contact us for help.",
      );
    }
  };

  const submitRequest = () => {
    if (!mode || !selectedTemplateId) return;
    setError(null);
    setPhase("submitting");

    if (mode === "delegate") {
      window.localStorage.setItem(
        DELEGATE_SIGNATORY_EMAIL_STORAGE_KEY,
        signatoryEmail.trim(),
      );
    }

    const requestData: CompanyControllerCreateMoaRequestBody = {
      universityId,
      templateId: selectedTemplateId,
      mode,
      ...(mode === "self"
        ? {
            signatoryName: repName,
            signatoryTitle: repTitle,
            ...(sigMode !== "type" && sigFile
              ? { signature: sigFile }
              : { signatureText: sigText }),
          }
        : { signatoryEmail }),
    };

    createRequest.mutate(
      { data: requestData },
      { onSuccess: handleSuccess, onError: handleError },
    );
  };

  const selectedTemplateData = templates.find(
    (t) => t.id === selectedTemplateId,
  );
  const sigReady = sigMode === "type" ? !!sigText.trim() : !!sigFile;
  const selfReady = !!repName.trim() && !!repTitle.trim() && sigReady;
  const delegateReady = /\S+@\S+\.\S+/.test(signatoryEmail.trim());
  const step2Ready = mode === "self" ? selfReady : delegateReady;

  if (phase === "submitting") return <MoaSubmittingState />;
  if (phase === "issued") return <MoaIssuedSuccess />;
  if (phase === "submitted") {
    return (
      <MoaSubmittedSuccess
        description={outcomeMessage}
        onDismiss={() => {
          onSuccessClose();
          router.push(successHref);
        }}
        cta={
          mode === "self" && selectedTemplateId ? (
            <AutoRequestCta templateId={selectedTemplateId} />
          ) : undefined
        }
      />
    );
  }

  const content = (
    <div className="space-y-4">
      <div className="">
        {isLoading ? (
          <Skeleton className="my-3 h-10 w-full" />
        ) : selectedTemplateData ? (
          <TemplatePreviewRow
            name={selectedTemplateData.name}
            termMonths={selectedTemplateData.term_months}
            compact
            onPreview={() =>
              modal.previewTemplate.open({
                id: selectedTemplateData.id,
                name: selectedTemplateData.name,
                description: selectedTemplateData.description,
              })
            }
            onChange={
              templates.length > 1
                ? () => setShowTemplatePicker((visible) => !visible)
                : undefined
            }
          />
        ) : null}
      </div>

      {showTemplatePicker && (
        <div className="space-y-1.5 rounded-[0.33em] border border-gray-200 p-2">
          {templates.map((t) => {
            const selected = t.id === selectedTemplateId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setSelectedTemplateId(t.id);
                  setShowTemplatePicker(false);
                }}
                className={cn(
                  "flex w-full cursor-pointer items-start gap-2 rounded-[0.33em] px-3 py-2 text-left transition-colors",
                  selected ? "bg-primary/5" : "hover:bg-gray-50",
                )}
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
                </span>
              </button>
            );
          })}
        </div>
      )}

      <CompanySignerForm
        mode={mode}
        onModeChange={(nextMode) => {
          setMode(nextMode);
          setError(null);
        }}
        onModeChangingChange={setIsChangingMode}
        repName={repName}
        onRepNameChange={setRepName}
        repTitle={repTitle}
        onRepTitleChange={setRepTitle}
        signatureMode={sigMode}
        onSignatureModeChange={setSigMode}
        signatureText={sigText}
        onSignatureTextChange={setSigText}
        signatureFile={sigFile}
        onSignatureFileChange={setSigFile}
        signatoryEmail={signatoryEmail}
        onSignatoryEmailChange={setSignatoryEmail}
      />

      {!isLoading && templates.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No available templates at this university.
        </p>
      )}
      {error && <FormError>{error}</FormError>}
    </div>
  );

  const footer = (
    <div className="flex justify-end gap-2">
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      {mode && !isChangingMode && templates.length > 0 && (
        <Button
          onClick={submitRequest}
          disabled={!step2Ready || createRequest.isPending}
        >
          {createRequest.isPending && <Loader2 className="animate-spin" />}
          {createRequest.isPending
            ? "Submitting…"
            : mode === "delegate"
              ? "Send signing request"
              : "Sign & request MOA"}
        </Button>
      )}
    </div>
  );

  return (
    <div className="sm:w-[min(92vw,64rem)]">
      <div className="space-y-4">{content}</div>
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t bg-white px-4 pt-3 pb-3 sm:pb-0">
        {footer}
      </div>
    </div>
  );
}
