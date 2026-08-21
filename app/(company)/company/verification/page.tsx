"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  useCompanyControllerUploadDocument,
  type CompanyDocumentDto,
} from "@/app/api";
import { useModal } from "@/app/providers/modal-provider";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { FileDropTarget } from "@/components/ui/use-file-drop";
import { Skeleton } from "@/components/ui/skeleton";
import { toastPresets } from "@/components/sonner-toaster";
import { DocumentPreview } from "@/components/company/document-preview";
import { REQUIRED_DOCUMENT_TYPES, documentLabel } from "@/lib/document-types";
import { cn } from "@/lib/utils";
import { CircleAlert, CircleCheck, FileText, Loader2, Upload } from "lucide-react";

export default function VerificationPage() {
  const router = useRouter();
  const { openModal } = useModal();
  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();

  const { data: docsData } = useCompanyControllerGetDocuments({
    query: { enabled: !!company },
  });
  const { data: verification, isLoading: verificationLoading } =
    useCompanyVerification(!!company);
  const status = verification?.status;

  const documentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  // Set right before an upload fires, read back in its onSuccess — see
  // the same pattern (and why) in the invite-continue stepper's
  // DocumentsStep.
  const pendingCompletionRef = useRef(false);

  const uploadSingle = useCompanyControllerUploadDocument({
    mutation: {
      onSuccess: () => {
        setUploadingType(null);
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetDocumentsQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerGetVerificationQueryKey(),
        });
        if (pendingCompletionRef.current) {
          toast(
            "All documents submitted — your account is now under review.",
            toastPresets.success,
          );
          window.setTimeout(() => router.replace("/company/dashboard"), 1200);
        } else {
          toast("Document uploaded", toastPresets.success);
        }
      },
      onError: (e: Error) => {
        setUploadingType(null);
        toast(e.message, toastPresets.destructive);
      },
    },
  });

  // Nothing left to verify — move on. Covers arriving here directly once
  // already pending/verified, not just the just-finished-uploading case
  // above (which redirects faster, without waiting on this refetch).
  useEffect(() => {
    if (status && status !== "incomplete") router.replace("/company/dashboard");
  }, [status, router]);

  if (isLoading || verificationLoading || !company) {
    return (
      <PageContainer className="space-y-8">
        <Skeleton className="h-8 w-96" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-60 w-full" />
          <Skeleton className="h-60 w-full" />
        </div>
      </PageContainer>
    );
  }

  const docs = docsData?.documents ?? [];
  const latestDoc = (type: string) => docs.find((d) => d.type === type);
  const docCount = REQUIRED_DOCUMENT_TYPES.filter((t) => latestDoc(t)).length;

  function slotState(
    type: string,
  ):
    | { kind: "missing" }
    | { kind: "rejected"; reason: string }
    | { kind: "expired"; reason: string }
    | { kind: "on-file"; doc: CompanyDocumentDto } {
    if (
      verification?.reason === "rejected" &&
      verification.documentRejections[type]
    ) {
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
    setUploadingType(type);
    pendingCompletionRef.current =
      docCount === REQUIRED_DOCUMENT_TYPES.length - 1 && !latestDoc(type);
    uploadSingle.mutate({ data: { file, type } });
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
          title="Verify your company to start partnering with universities"
          description="Upload your documents for your company. We will verify your account within a day."
        />

        <div className="grid gap-4 sm:grid-cols-3">
          {REQUIRED_DOCUMENT_TYPES.map((type) => {
            const label = documentLabel(type);
            const slot = slotState(type);
            const busy = uploadingType === type;
            const flagged = slot.kind === "rejected" || slot.kind === "expired";
            return (
              <FileDropTarget
                key={type}
                accept="application/pdf"
                disabled={busy}
                onFiles={([file]) => file && handleFileSelected(type, file)}
                dragOverlay={
                  <div className="text-primary border-primary/50 bg-primary/5 flex min-h-[15rem] w-full flex-col items-center justify-center gap-2 rounded-[0.5em] border-2 border-dashed text-sm font-medium">
                    <Upload className="h-6 w-6" />
                    Drop PDF to {slot.kind === "on-file" ? "replace" : "upload"}
                  </div>
                }
                className="hover:border-primary/40 flex min-h-[15rem] flex-col items-center justify-center gap-3 rounded-[0.5em] border-2 border-dashed border-gray-300 bg-white px-6 py-8 text-center transition-colors"
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-full",
                    slot.kind === "on-file"
                      ? "bg-supportive/10 text-supportive"
                      : flagged
                        ? "bg-destructive/10 text-destructive"
                        : "bg-gray-100 text-muted-foreground",
                  )}
                >
                  {slot.kind === "on-file" ? (
                    <CircleCheck className="h-6 w-6" />
                  ) : flagged ? (
                    <CircleAlert className="h-6 w-6" />
                  ) : (
                    <FileText className="h-6 w-6" />
                  )}
                </span>

                <div>
                  <p className="font-semibold text-gray-900">{label}</p>
                  {slot.kind === "missing" && (
                    <p className="text-muted-foreground mt-1 text-xs">
                      Not uploaded yet
                    </p>
                  )}
                  {slot.kind === "on-file" && (
                    <p className="text-supportive mt-1 text-xs">On file</p>
                  )}
                  {flagged && (
                    <p className="text-destructive mt-1 text-xs">{slot.reason}</p>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => documentInputRefs.current[type]?.click()}
                >
                  {busy ? <Loader2 className="animate-spin" /> : <Upload />}
                  {busy
                    ? "Uploading..."
                    : slot.kind === "on-file"
                      ? "Replace"
                      : "Upload PDF"}
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
                  <button
                    type="button"
                    onClick={() => preview(slot.doc)}
                    className="text-primary cursor-pointer text-xs font-medium hover:underline"
                  >
                    View
                  </button>
                )}
              </FileDropTarget>
            );
          })}
        </div>
      </PageContainer>
    </div>
  );
}
