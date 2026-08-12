"use client";
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import {
  getUniversityControllerGetAuditLogQueryKey,
  getUniversityControllerListTemplatesQueryKey,
  useUniversityControllerListTemplates,
  useUniversityControllerToggleTemplateOffer,
} from "@/app/api";
import { toastPresets } from "@/components/sonner-toaster";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useIomModalRegistry } from "@/components/modal-registry";
import { useResolvedFile } from "@/app/lib/resolve-file";
import { DocumentPreviewPane } from "@/components/document-preview-pane";
import { GripVertical, Loader2, X } from "lucide-react";
import {
  UniversityTemplatesTable,
  type TemplateOffer,
} from "@/components/university/university-templates-table";

export default function UniversityTemplatesPage() {
  const { account, isLoading, canManageUniversity } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { confirmAction, universityProfileComplete } = useIomModalRegistry();
  const [previewTemplate, setPreviewTemplate] = useState<TemplateOffer["template"] | null>(null);
  const [previewWidth, setPreviewWidth] = useState(50);

  const { url: previewUrl, loading: previewLoading } = useResolvedFile(
    "template_pdf",
    previewTemplate?.id,
  );

  useEffect(() => {
    const savedWidth = Number(
      window.localStorage.getItem("iom-university-template-preview-width"),
    );
    if (savedWidth >= 30 && savedWidth <= 70) setPreviewWidth(savedWidth);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("setup_complete") !== "1") return;

    const cleanUrl = () => router.replace("/university/templates");
    universityProfileComplete.open({
      onContinue: cleanUrl,
      onClose: cleanUrl,
    });
    // This is a one-time handoff from profile setup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isLoading && !canManageUniversity)
      router.replace("/university/partners");
  }, [isLoading, canManageUniversity, router]);

  const { data, isLoading: tLoading } = useUniversityControllerListTemplates({
    query: { enabled: !!account && canManageUniversity },
  });

  const toggle = useUniversityControllerToggleTemplateOffer({
    mutation: {
      onSuccess: (_res, variables) => {
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerListTemplatesQueryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: ["university-templates-for-invite"],
        });
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerGetAuditLogQueryKey(),
        });
        confirmAction.close();
        toast(
          variables.data.is_available
            ? "Template offered."
            : "Template hidden.",
          toastPresets.success,
        );
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const offers = (data?.templates ?? []).filter((o) => !o.template.is_deleted);
  const availableMoaCount = offers.filter((offer) => offer.is_available).length;

  const updatePreviewWidth = (nextWidth: number) => {
    const clampedWidth = Math.min(70, Math.max(30, nextWidth));
    setPreviewWidth(clampedWidth);
    window.localStorage.setItem(
      "iom-university-template-preview-width",
      String(clampedWidth),
    );
  };

  const resizePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    updatePreviewWidth(((bounds.right - event.clientX) / bounds.width) * 100);
  };

  if (isLoading || !account || !canManageUniversity) return null;

  return (
    <PageContainer
      className={
        previewTemplate ? "max-w-none py-8 pr-0 sm:pr-0" : "space-y-8"
      }
    >
      <div
        className={
          previewTemplate
            ? "relative min-h-[calc(100dvh-5rem-1px)] lg:grid lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0 lg:overflow-hidden"
            : "space-y-8"
        }
        style={
          previewTemplate
            ? { gridTemplateColumns: `${100 - previewWidth}% ${previewWidth}%` }
            : undefined
        }
      >
        <div className="min-w-0 space-y-8 py-5 pr-4 lg:h-full lg:overflow-y-auto lg:px-6">
          <PageHeader
            title="MOA Templates"
            description="Choose which catalog templates your university offers to companies. Your institution signatory must be set on your profile first."
          />

          <UniversityTemplatesTable
            offers={offers}
            isLoading={tLoading}
            isPending={toggle.isPending}
            onToggle={(templateId, is_available) =>
              toggle.mutateAsync({ templateId, data: { is_available } })
            }
            onPreview={setPreviewTemplate}
          />
        </div>

        {previewTemplate && (
          <>
            <div
              role="separator"
              aria-label="Resize template preview pane"
              aria-orientation="vertical"
              aria-valuemin={30}
              aria-valuemax={70}
              aria-valuenow={Math.round(previewWidth)}
              tabIndex={0}
              className="group absolute top-0 bottom-0 z-30 hidden w-5 -translate-x-1/2 cursor-col-resize touch-none lg:block"
              style={{ left: `${100 - previewWidth}%` }}
              onPointerDown={(event) => {
                event.preventDefault();
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={resizePreview}
              onPointerUp={(event) =>
                event.currentTarget.releasePointerCapture(event.pointerId)
              }
              onKeyDown={(event) => {
                if (event.key === "ArrowLeft") updatePreviewWidth(previewWidth + 2);
                if (event.key === "ArrowRight") updatePreviewWidth(previewWidth - 2);
              }}
            >
              <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover:bg-primary group-focus:bg-primary" />
              <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors group-hover:border-primary group-focus:border-primary">
                <button
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setPreviewTemplate(null)}
                  className="flex h-8 w-7 items-center justify-center border-b border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                  aria-label="Close preview"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="flex h-10 w-7 items-center justify-center group-hover:text-primary group-focus:text-primary">
                  <GripVertical className="h-4 w-4" aria-hidden="true" />
                </span>
              </div>
            </div>
            {previewLoading ? (
              <aside className="relative flex h-[70vh] min-h-[520px] items-center justify-center overflow-hidden border-l border-gray-200 bg-slate-100 lg:h-full lg:min-h-0">
                <Loader2 className="text-primary h-6 w-6 animate-spin" />
              </aside>
            ) : previewUrl ? (
              <DocumentPreviewPane
                url={previewUrl}
                label={`${previewTemplate.name}.pdf`}
                zoomStorageKey="iom-university-template-preview-zoom"
              />
            ) : (
              <aside className="relative flex h-[70vh] min-h-[520px] items-center justify-center overflow-hidden border-l border-gray-200 bg-slate-100 text-sm text-muted-foreground lg:h-full lg:min-h-0">
                PDF not available.
              </aside>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}
