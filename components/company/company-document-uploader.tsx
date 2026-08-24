"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleAlert, CircleCheck, Eye, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  type CompanyDocumentDto,
  getCompanyControllerGetDocumentsQueryKey,
  getCompanyControllerGetVerificationQueryKey,
  useCompanyControllerGetDocuments,
  useCompanyControllerUploadDocument,
} from "@/app/api";
import { useCompanyVerification } from "@/app/providers/company-profile.provider";
import { DocumentPreview } from "@/components/company/document-preview";
import { useModal } from "@/app/providers/modal-provider";
import { toastPresets } from "@/components/sonner-toaster";
import { Button } from "@/components/ui/button";
import { FileDropTarget } from "@/components/ui/use-file-drop";
import { REQUIRED_DOCUMENT_TYPES, documentLabel } from "@/lib/document-types";
import { cn } from "@/lib/utils";

type DocumentSlot =
  | { kind: "missing" }
  | { kind: "rejected"; reason: string }
  | { kind: "expired"; reason: string }
  | { kind: "on-file"; doc: CompanyDocumentDto };

function CompanyDocumentUploader({
  onAllUploaded,
  onCompletionChange,
}: {
  onAllUploaded?: () => void;
  onCompletionChange?: (isComplete: boolean) => void;
}) {
  const { openModal } = useModal();
  const queryClient = useQueryClient();
  const { data: verification } = useCompanyVerification(true);
  const { data: docsData } = useCompanyControllerGetDocuments();
  const documentInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const [uploadingType, setUploadingType] = useState<string | null>(null);
  // Completion is determined before the upload starts so concurrent uploads
  // cannot race the final-document transition.
  const pendingCompletionRef = useRef(false);

  const docs = docsData?.documents ?? [];
  const latestDoc = (type: string) => docs.find((doc) => doc.type === type);
  const docCount = REQUIRED_DOCUMENT_TYPES.filter((type) =>
    latestDoc(type),
  ).length;

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
          onAllUploaded?.();
        }
      },
      onError: (error: Error) => {
        setUploadingType(null);
        toast(error.message, toastPresets.destructive);
      },
    },
  });

  function slotState(type: string): DocumentSlot {
    if (
      verification?.reason === "rejected" &&
      verification.documentRejections[type]
    ) {
      return {
        kind: "rejected",
        reason: verification.documentRejections[type],
      };
    }
    if (
      verification?.reason === "expired" &&
      verification.expiredDocument === type
    ) {
      return {
        kind: "expired",
        reason:
          verification.documentRejections[type] ?? "This document expired.",
      };
    }

    const doc = latestDoc(type);
    return doc ? { kind: "on-file", doc } : { kind: "missing" };
  }

  const documentsComplete = REQUIRED_DOCUMENT_TYPES.every(
    (type) => slotState(type).kind === "on-file",
  );

  useEffect(() => {
    onCompletionChange?.(documentsComplete);
  }, [documentsComplete, onCompletionChange]);

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
      contentClassName:
        "h-[75dvh] overflow-hidden sm:h-[75vh] sm:min-h-[32rem]",
      showHeaderDivider: false,
    });
  }

  return (
    <div className="grid gap-5 sm:grid-cols-3">
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
              <div className="text-primary border-primary/50 bg-primary/5 flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded-[0.5em] border-2 border-dashed text-sm font-medium sm:min-h-[19rem]">
                <Upload className="h-6 w-6" />
                Drop PDF to {slot.kind === "on-file" ? "replace" : "upload"}
              </div>
            }
            className={cn(
              "flex min-h-44 flex-col items-center justify-center gap-3 rounded-[0.5em] border-2 border-dashed px-4 py-6 text-center transition-colors sm:min-h-[19rem] sm:gap-4 sm:px-6 sm:py-10",
              slot.kind === "on-file"
                ? "border-supportive/40 bg-supportive/12 hover:border-supportive/60"
                : "border-gray-300 bg-white hover:border-primary/40",
            )}
          >
            <span
              className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full sm:h-16 sm:w-16",
                slot.kind === "on-file"
                  ? "bg-supportive/10 text-supportive"
                  : flagged
                    ? "bg-destructive/10 text-destructive"
                    : "bg-primary/10 text-primary",
              )}
            >
              {slot.kind === "on-file" ? (
                <CircleCheck className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : flagged ? (
                <CircleAlert className="h-6 w-6 sm:h-7 sm:w-7" />
              ) : (
                <Upload className="h-6 w-6 sm:h-8 sm:w-8" />
              )}
            </span>

            <div>
              <p className="font-semibold text-gray-900">{label}</p>

              {flagged && (
                <p className="text-destructive mt-1 text-xs">{slot.reason}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={slot.kind === "on-file" ? "ghost" : "outline"}
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
              {slot.kind === "on-file" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => preview(slot.doc)}
                >
                  <Eye />
                  View
                </Button>
              )}
            </div>
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
          </FileDropTarget>
        );
      })}
    </div>
  );
}

export { CompanyDocumentUploader };
