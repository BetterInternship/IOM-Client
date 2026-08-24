"use client";
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useCompanyProfile,
  useCompanyVerification,
} from "@/app/providers/company-profile.provider";
import {
  getCompanyControllerGetDocumentsQueryKey,
  getCompanyControllerGetVerificationQueryKey,
  useCompanyControllerGetDocuments,
  useCompanyControllerUploadDocuments,
  type CompanyDocumentDto,
} from "@/app/api";
import { formatDateWithoutTime } from "@/lib/utils";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FileDropTarget } from "@/components/ui/use-file-drop";
import {
  CollapsibleCardGroup,
  CollapsibleCardSection,
  CollapsibleCardSectionTitle,
} from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useModal } from "@/app/providers/modal-provider";
import { toastPresets } from "@/components/sonner-toaster";
import { REQUIRED_DOCUMENT_TYPES, documentLabel } from "@/lib/document-types";
import {
  Building2,
  CircleAlert,
  CircleCheck,
  Eye,
  FileText,
  Info,
  Loader2,
  Upload,
} from "lucide-react";
import { DocumentPreview } from "@/components/company/document-preview";

const COMPANY_TYPE_LABELS: Record<string, string> = {
  corporation: "Corporation",
  partnership: "Partnership",
  sole_proprietorship: "Sole Proprietorship",
  government_agency: "Government Agency",
};

export function CompanyProfileContent() {
  const { openModal } = useModal();
  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();

  const documentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: docsData } = useCompanyControllerGetDocuments({
    query: { enabled: !!company },
  });

  const { data: verification } = useCompanyVerification(!!company);
  const status = verification?.status;

  const invalidateDocuments = () => {
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerGetDocumentsQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getCompanyControllerGetVerificationQueryKey(),
    });
  };

  const uploadReplacement = useCompanyControllerUploadDocuments({
    mutation: {
      onSuccess: (_data, variables) => {
        const type = Object.keys(variables.data)[0];
        setUploadingType(null);
        invalidateDocuments();
        toast(
          status === "verified"
            ? "Document replaced — your verification stays active while it's reviewed."
            : "Document replaced — still under review.",
          toastPresets.success,
        );
        void type;
      },
      onError: (e: Error) => {
        setUploadingType(null);
        toast(e.message, toastPresets.destructive);
      },
    },
  });

  const [uploadingType, setUploadingType] = useState<string | null>(null);

  if (isLoading || !company) return null;

  const docs = docsData?.documents ?? [];
  const latestDoc = (type: string) => docs.find((d) => d.type === type);
  const docCount = REQUIRED_DOCUMENT_TYPES.filter((type) => latestDoc(type)).length;
  const documentsComplete = docCount === REQUIRED_DOCUMENT_TYPES.length;

  function slotState(
    type: string,
  ):
    | { kind: "missing" }
    | { kind: "rejected"; reason: string }
    | { kind: "expired"; reason: string }
    | { kind: "on-file"; doc: CompanyDocumentDto } {
    if (verification?.reason === "rejected" && verification.documentRejections[type]) {
      return { kind: "rejected", reason: verification.documentRejections[type] };
    }
    if (verification?.reason === "expired" && verification.expiredDocument === type) {
      return {
        kind: "expired",
        reason:
          verification.documentRejections[type] ?? "This document expired.",
      };
    }
    const doc = latestDoc(type);
    return doc ? { kind: "on-file", doc } : { kind: "missing" };
  }

  function handleFileSelected(type: string, file: File) {
    // This page only ever renders once status has left "incomplete" — the
    // landing guard sends onboarding companies to /verification instead,
    // which owns the singular first-upload path.
    setUploadingType(type);
    uploadReplacement.mutate({ data: { [type]: file } });
  }

  function preview(doc: CompanyDocumentDto) {
    openModal("preview-doc", <DocumentPreview docId={doc.id} />, {
      title: documentLabel(doc.type),
      panelClassName: "!w-full sm:!max-w-4xl",
      contentClassName: "h-[75dvh] overflow-hidden sm:h-[75vh] sm:min-h-[32rem]",
      showHeaderDivider: false,
    });
  }

  return (
    <div className="relative isolate flex-1 bg-slate-50/70">
      <div className="pointer-events-none absolute inset-0 z-0 bg-[url('/bg2.png')] bg-cover bg-center bg-no-repeat opacity-30" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-56 bg-gradient-to-b from-white/90 via-white/50 to-transparent" />
      <PageContainer className="relative z-10 space-y-8 pb-12">
        <PageHeader
          title={company.registered_name ?? company.email}
          description={
            company.registered_name
              ? undefined
              : "An admin will transcribe your registered name when your company is verified."
          }
        />

        <CollapsibleCardGroup type="multiple" defaultValue={["documents", "company"]} variant="grouped">
          {/* 1 — Required documents: three named slots, per-slot state */}
          <CollapsibleCardSection
            value="documents"
            trigger={
              <CollapsibleCardSectionTitle
                icon={FileText}
                title="Required Documents"
                requiredComplete={documentsComplete}
              />
            }
            contentClassName="space-y-4 px-5 pb-5"
          >
            <div id="documents" className="scroll-mt-24" />
            <div className="overflow-hidden rounded-[0.33em] border border-blue-100 bg-white">
              {REQUIRED_DOCUMENT_TYPES.map((type) => {
                const label = documentLabel(type);
                const slot = slotState(type);
                const busy = uploadingType === type;
                return (
                  <FileDropTarget
                    key={type}
                    accept="application/pdf"
                    disabled={busy}
                    onFiles={([file]) => file && handleFileSelected(type, file)}
                    dragOverlay={
                      <div className="text-primary flex min-h-[72px] w-full items-center justify-center gap-2 rounded-[0.33em] border-2 border-dashed border-primary/50 bg-primary/5 text-sm font-medium">
                        <Upload className="h-4 w-4" />
                        Drop PDF to {slot.kind === "on-file" ? "replace" : "upload"}
                      </div>
                    }
                    className="flex min-h-[72px] flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 sm:flex-row sm:items-center sm:gap-0 sm:py-0"
                  >
                    {slot.kind === "on-file" ? (
                      <CircleCheck className="text-supportive" />
                    ) : (
                      <CircleAlert className="text-warning" />
                    )}
                    <div className="flex min-w-0 flex-1 flex-col gap-2 rounded-[0.16em] p-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:p-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{label}</p>
                        {slot.kind === "on-file" && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Uploaded{" "}
                            {formatDateWithoutTime(slot.doc.uploaded_at)}
                            {slot.doc.expires_at &&
                              ` · Expires ${formatDateWithoutTime(slot.doc.expires_at)}`}
                          </p>
                        )}
                        {slot.kind === "missing" && (
                          <p className="text-muted-foreground mt-0.5 text-xs">
                            Not uploaded
                          </p>
                        )}
                        {slot.kind === "rejected" && (
                          <p className="text-destructive mt-0.5 text-xs">
                            Rejected: {slot.reason}
                          </p>
                        )}
                        {slot.kind === "expired" && (
                          <p className="text-destructive mt-0.5 text-xs">
                            {slot.reason}
                          </p>
                        )}
                      </div>
                      <div className="flex w-full flex-shrink-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full sm:w-auto"
                          disabled={busy}
                          onClick={() => documentInputRefs.current[type]?.click()}
                        >
                          {busy ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <Upload />
                          )}
                          {busy
                            ? "Uploading..."
                            : slot.kind === "on-file"
                              ? "Drop or replace"
                              : "Drop or upload"}
                        </Button>
                        <input
                          ref={(input) => {
                            documentInputRefs.current[type] = input;
                          }}
                          type="file"
                          accept="application/pdf"
                          className="hidden"
                          disabled={busy}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) handleFileSelected(type, file);
                            event.target.value = "";
                          }}
                        />
                        {slot.kind === "on-file" && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full sm:w-auto"
                            onClick={() => preview(slot.doc)}
                          >
                            <Eye /> View
                          </Button>
                        )}
                      </div>
                    </div>
                  </FileDropTarget>
                );
              })}
            </div>
          </CollapsibleCardSection>

          {/* 2 — Company identity, read-only (admin-owned per flow spec §3) */}
          <CollapsibleCardSection
            value="company"
            trigger={
              <CollapsibleCardSectionTitle icon={Building2} title="Company Profile" />
            }
            contentClassName="space-y-4 px-5 pb-5"
          >
            <DetailField label="Account email">
              <p className="flex min-h-8 items-center break-all text-sm font-medium text-gray-900">
                {company.email}
              </p>
            </DetailField>
            <DetailField label="Registered name">
              <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
                {company.registered_name ?? (
                  <span className="text-muted-foreground font-normal">
                    Set by an admin at verification
                  </span>
                )}
              </p>
            </DetailField>
            <DetailField label="TIN">
              <p className="flex min-h-8 items-center text-sm font-medium text-gray-900">
                {company.tin ?? (
                  <span className="text-muted-foreground font-normal">
                    Set by an admin at verification
                  </span>
                )}
              </p>
            </DetailField>
            <DetailField label="Company type">
              <p className="flex min-h-8 items-center text-sm font-medium text-gray-900">
                {company.company_type
                  ? (COMPANY_TYPE_LABELS[company.company_type] ?? company.company_type)
                  : (
                      <span className="text-muted-foreground font-normal">
                        Set by an admin at verification
                      </span>
                    )}
              </p>
            </DetailField>
            <DetailField label="Registered address">
              <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
                {company.registered_address ?? (
                  <span className="text-muted-foreground font-normal">
                    Set by an admin at verification
                  </span>
                )}
              </p>
            </DetailField>
            {status === "verified" && verification?.approvalExpiresAt && (
              <DetailField label="Verified until">
                <div className="flex min-h-8 items-center gap-2 text-sm font-medium text-gray-900">
                  <span>
                    {new Date(verification.approvalExpiresAt).toLocaleDateString(
                      "en-PH",
                      { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Manila" },
                    )}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label="About this verification expiry"
                        className="text-muted-foreground hover:text-primary focus-visible:ring-primary/30 inline-flex cursor-help rounded-full outline-none focus-visible:ring-2"
                      >
                        <Info className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={6} className="max-w-64">
                      This reflects the earliest expiry date recorded across
                      your documents. We&apos;ll notify you when it&apos;s
                      time to renew.
                    </TooltipContent>
                  </Tooltip>
                </div>
              </DetailField>
            )}
          </CollapsibleCardSection>
        </CollapsibleCardGroup>
      </PageContainer>
    </div>
  );
}
