"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { createWorker, type Worker as TesseractWorker } from "tesseract.js";
import {
  BasePdfViewer,
  Loader as PdfLoader,
  usePdfDocumentFromFile,
  usePdfPageRenderer,
} from "@betterinternship/core/pdf-viewer";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Plus,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { extractLegacyMoaFields } from "./legacy-moa-ocr";

const MAX_PDF_BYTES = 7 * 1024 * 1024;
const MAX_FILES = 20;

type ImportItem = {
  id: string;
  file: File;
  companyName: string;
  effectiveDate: string;
  expiryDate: string;
  isPerpetual: boolean;
  ocrStatus: "waiting" | "processing" | "done" | "failed";
  ocrSuggested: boolean;
  ocrMessage: string;
};

type BulkResult = {
  summary: {
    createdCompanies: number;
    appendedMoas: number;
    invalid: number;
    failed: number;
  };
  results: Array<{
    row: number;
    company_name: string;
    status: string;
    message?: string;
  }>;
};

type LegacyCompanySummary = {
  id: string;
  company_name: string;
};

function PdfPage({
  pdf,
  pageNumber,
  scale,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
}) {
  const { canvasRef } = usePdfPageRenderer(pdf, pageNumber, scale);

  return <canvas ref={canvasRef} className="block shadow-sm" />;
}

function LocalPdfPreview({
  file,
  scale,
  onScaleChange,
}: {
  file: File;
  scale: number;
  onScaleChange: (scale: number) => void;
}) {
  const { pdfDoc, pageCount, isLoading, error } = usePdfDocumentFromFile(file);
  const [visiblePage, setVisiblePage] = useState(1);

  if (isLoading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <PdfLoader />
      </div>
    );
  }

  if (error || !pdfDoc) {
    return (
      <div className="text-muted-foreground flex min-h-96 flex-col items-center justify-center gap-2 px-6 text-center text-sm">
        <FileText className="size-8" />
        <p>We could not preview this PDF.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-slate-50">
      <div className="flex h-12 shrink-0 items-center justify-end gap-3 border-b border-slate-300 bg-white px-3">
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-xs font-medium text-slate-700">
            {visiblePage}/{pageCount || 1}
          </span>
          <div className="ml-1 inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() =>
                onScaleChange(Math.max(0.25, Number((scale - 0.1).toFixed(2))))
              }
              disabled={scale <= 0.25}
              className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                onScaleChange(Math.min(3, Number((scale + 0.1).toFixed(2))))
              }
              disabled={scale >= 3}
              className="rounded p-1.5 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-30"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="size-3.5" />
            </button>
          </div>
          <span className="w-10 text-center text-[11px] font-medium text-slate-700">
            {Math.round(scale * 100)}%
          </span>
        </div>
      </div>
      <div className="min-h-0 flex-1">
        <BasePdfViewer
          pdfDoc={pdfDoc}
          pageCount={pageCount}
          scale={scale}
          onScaleChange={onScaleChange}
          visiblePage={visiblePage}
          onVisiblePageChange={setVisiblePage}
          showToolbar={false}
          squareFrame
          renderPage={(pageNumber) => (
            <PdfPage
              key={pageNumber}
              pdf={pdfDoc}
              pageNumber={pageNumber}
              scale={scale}
            />
          )}
        />
      </div>
    </div>
  );
}

function itemError(item: ImportItem): string | null {
  if (!item.companyName.trim()) return "Choose or enter a company name.";
  if (!item.effectiveDate) return "Enter the MOA start date.";
  if (!item.isPerpetual && !item.expiryDate)
    return "Enter the MOA end date or mark it perpetual.";
  if (!item.isPerpetual && item.expiryDate < item.effectiveDate) {
    return "The end date must be on or after the start date.";
  }
  return null;
}

function newImportItem(file: File): ImportItem {
  return {
    id: crypto.randomUUID(),
    file,
    companyName: "",
    effectiveDate: "",
    expiryDate: "",
    isPerpetual: false,
    ocrStatus: "waiting",
    ocrSuggested: false,
    ocrMessage: "Waiting for OCR...",
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  message: string,
) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error(message)), timeoutMs),
    ),
  ]);
}

export function LegacyCompanyImportWizard({ onBack }: { onBack: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const ocrWorkerRef = useRef<Promise<TesseractWorker> | null>(null);
  const ocrQueueRef = useRef(Promise.resolve());
  const activeOcrItemRef = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ImportItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const { data: legacyData } = useQuery({
    queryKey: ["university-legacy-companies"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/legacy-companies")
        .then(
          (response) =>
            response.data as { legacyCompanies: LegacyCompanySummary[] },
        ),
  });
  const companyNames = legacyData?.legacyCompanies ?? [];
  const selected = items.find((item) => item.id === selectedId) ?? null;
  const selectedIndex = selected
    ? items.findIndex((item) => item.id === selected.id)
    : -1;
  const invalidItems = items.filter((item) => itemError(item));

  useEffect(() => {
    return () => {
      void ocrWorkerRef.current
        ?.then((worker) => worker.terminate())
        .catch(() => undefined);
    };
  }, []);

  const commit = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      for (const item of items) formData.append("moaDocuments", item.file);
      formData.append(
        "moas",
        JSON.stringify(
          items.map((item, index) => ({
            company_name: item.companyName.trim(),
            effective_date: item.effectiveDate,
            expiry_date: item.isPerpetual ? null : item.expiryDate,
            is_perpetual: item.isPerpetual,
            document_file_index: index,
          })),
        ),
      );
      const response = await preconfiguredAxios.post(
        "/api/university/legacy-companies/bulk/wizard",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } },
      );
      return response.data as BulkResult;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({
        queryKey: ["university-legacy-companies"],
      });
      queryClient.invalidateQueries({ queryKey: ["university-partners"] });
    },
    onError: () => {
      toast(
        "Import failed. Your workspace has been kept so you can try again.",
        toastPresets.destructive,
      );
    },
  });

  const enqueueOcr = (newItems: ImportItem[]) => {
    const markFailed = (ids: Set<string>) => {
      setItems((current) =>
        current.map((item) =>
          ids.has(item.id)
            ? {
                ...item,
                ocrStatus: "failed",
                ocrMessage: "OCR unavailable - enter details manually",
              }
            : item,
        ),
      );
    };

    const run = ocrQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        for (const queuedItem of newItems) {
          activeOcrItemRef.current = queuedItem.id;
          setItems((current) =>
            current.map((item) =>
              item.id === queuedItem.id
                ? {
                    ...item,
                    ocrStatus: "processing",
                    ocrMessage: "Loading OCR engine...",
                  }
                : item,
            ),
          );

          try {
            if (!ocrWorkerRef.current) {
              const workerPromise = createWorker("eng", undefined, {
                logger: (message) => {
                  const activeId = activeOcrItemRef.current;
                  if (!activeId || message.status === "recognizing text")
                    return;
                  setItems((current) =>
                    current.map((item) =>
                      item.id === activeId
                        ? {
                            ...item,
                            ocrMessage: `${message.status} ${Math.round(message.progress * 100)}%`,
                          }
                        : item,
                    ),
                  );
                },
              });
              ocrWorkerRef.current = workerPromise;
              void workerPromise.catch(() => {
                ocrWorkerRef.current = null;
              });
            }
            const workerPromise = ocrWorkerRef.current;
            const worker = await withTimeout(
              workerPromise,
              60_000,
              "OCR engine took too long to load",
            );
            const suggestion = await withTimeout(
              extractLegacyMoaFields(
                queuedItem.file,
                worker,
                (currentPage, totalPages) =>
                  setItems((current) =>
                    current.map((item) =>
                      item.id === queuedItem.id
                        ? {
                            ...item,
                            ocrMessage: `Reading scanned page ${currentPage} of ${totalPages}...`,
                          }
                        : item,
                    ),
                  ),
              ),
              180_000,
              "OCR took too long",
            );
            setItems((current) =>
              current.map((item) => {
                if (item.id !== queuedItem.id) return item;
                const shouldSetPerpetual =
                  suggestion.isPerpetual !== null &&
                  !item.effectiveDate &&
                  !item.expiryDate;
                return {
                  ...item,
                  companyName: item.companyName || suggestion.companyName || "",
                  effectiveDate:
                    item.effectiveDate || suggestion.effectiveDate || "",
                  expiryDate: item.expiryDate || suggestion.expiryDate || "",
                  isPerpetual: shouldSetPerpetual
                    ? suggestion.isPerpetual === true
                    : item.isPerpetual,
                  ocrStatus: "done",
                  ocrMessage: "OCR complete",
                  ocrSuggested: Boolean(
                    suggestion.companyName ||
                    suggestion.effectiveDate ||
                    suggestion.expiryDate ||
                    suggestion.isPerpetual !== null,
                  ),
                };
              }),
            );
          } catch (error) {
            const message =
              error instanceof Error ? error.message : "Unknown OCR error";
            setItems((current) =>
              current.map((item) =>
                item.id === queuedItem.id
                  ? {
                      ...item,
                      ocrStatus: "failed",
                      ocrMessage: `OCR failed: ${message}`,
                    }
                  : item,
              ),
            );
            const failedWorker = ocrWorkerRef.current;
            ocrWorkerRef.current = null;
            void failedWorker
              ?.then((worker) => worker.terminate())
              .catch(() => undefined);
          }
        }
        activeOcrItemRef.current = null;
      });
    ocrQueueRef.current = run.catch(() => {
      markFailed(new Set(newItems.map((item) => item.id)));
      activeOcrItemRef.current = null;
    });
  };

  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    const accepted: File[] = [];
    let rejected = 0;

    for (const file of incoming) {
      const isPdf =
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");
      if (
        !isPdf ||
        file.size > MAX_PDF_BYTES ||
        items.length + accepted.length >= MAX_FILES
      ) {
        rejected += 1;
      } else {
        accepted.push(file);
      }
    }

    if (rejected) {
      toast(
        `Skipped ${rejected} file${rejected === 1 ? "" : "s"}. PDFs must be 7 MB or smaller; up to ${MAX_FILES} can be imported at once.`,
        toastPresets.destructive,
      );
    }
    if (!accepted.length) return;

    const newItems = accepted.map(newImportItem);
    setItems((current) => [...current, ...newItems]);
    setSelectedId((current) => current ?? newItems[0].id);
    enqueueOcr(newItems);
  };

  const updateSelected = (patch: Partial<ImportItem>) => {
    if (!selected) return;
    setItems((current) =>
      current.map((item) =>
        item.id === selected.id
          ? { ...item, ...patch, ocrSuggested: false }
          : item,
      ),
    );
  };

  const removeItem = (id: string) => {
    const remaining = items.filter((item) => item.id !== id);
    setItems(remaining);
    if (selectedId === id) setSelectedId(remaining[0]?.id ?? null);
  };

  const leaveWorkspace = () => {
    if (
      items.length > 0 &&
      !window.confirm(
        "Leave this import workspace? Your selected PDFs and assignments have not been saved.",
      )
    ) {
      return;
    }
    onBack();
  };

  if (result) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="text-supportive text-sm font-semibold">
            Import complete
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">
            Your MOAs are in Partners
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {result.summary.createdCompanies} new compan
            {result.summary.createdCompanies === 1 ? "y" : "ies"} and{" "}
            {result.summary.appendedMoas} MOA
            {result.summary.appendedMoas === 1 ? "" : "s"} were processed.
          </p>
        </div>
        <Card className="gap-0 overflow-hidden py-0">
          {result.results.map((row) => (
            <div
              key={row.row}
              className="flex items-start justify-between gap-4 border-b border-gray-100 px-4 py-3 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-900">
                  {row.company_name}
                </p>
                {row.message && (
                  <p className="text-destructive mt-0.5 text-xs">
                    {row.message}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium",
                  row.status === "failed"
                    ? "text-destructive"
                    : "text-supportive",
                )}
              >
                {row.status === "failed" ? "Failed" : "Imported"}
              </span>
            </div>
          ))}
        </Card>
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
        >
          <ArrowLeft className="h-4 w-4" /> Partners
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100dvh-5rem-1px)] flex-col gap-5 py-5 lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={leaveWorkspace}
          disabled={commit.isPending}
          className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
        >
          <ArrowLeft className="h-4 w-4" /> Partners
        </Button>
        {items.length > 0 && (
          <div className="flex items-center gap-3">
            <p
              className={cn(
                "text-sm",
                invalidItems.length ? "text-amber-700" : "text-supportive",
              )}
            >
              {invalidItems.length}/{items.length} needs checking
            </p>
            <Button
              disabled={invalidItems.length > 0 || commit.isPending}
              onClick={() => commit.mutate()}
            >
              {commit.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Import {items.length} MOA{items.length === 1 ? "" : "s"}
            </Button>
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        multiple
        className="hidden"
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          event.target.value = "";
        }}
      />

      {items.length === 0 ? (
        <button
          type="button"
          className={cn(
            "flex min-h-80 w-full flex-1 flex-col items-center justify-center rounded-[0.5em] border-2 border-dashed px-6 text-center transition-colors lg:min-h-0",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-gray-300 bg-white hover:border-primary/50",
          )}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <span className="mb-4 rounded-full bg-primary/10 p-4 text-primary">
            <Upload className="size-7" />
          </span>
          <span className="text-base font-semibold text-gray-900">
            Drop signed MOA PDFs here
          </span>
          <span className="text-muted-foreground mt-1 text-sm">
            or browse files. Up to {MAX_FILES} PDFs, 7 MB each.
          </span>
        </button>
      ) : (
        <div className="grid w-full overflow-hidden rounded-[0.5em] border border-gray-200 bg-white lg:min-h-0 lg:flex-1 lg:grid-cols-[22rem_minmax(0,1fr)_28rem]">
          <aside className="flex min-h-0 flex-col border-b border-gray-200 lg:border-r lg:border-b-0">
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-gray-200 px-3">
              <p className="text-sm font-semibold text-gray-900">
                PDFs ({items.length})
              </p>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => inputRef.current?.click()}
                aria-label="Add PDFs"
              >
                <Plus className="size-4" />
              </Button>
            </div>
            <div className="max-h-56 overflow-y-auto p-2 lg:max-h-none lg:flex-1">
              {items.map((item, index) => {
                const error = itemError(item);
                const isReading =
                  item.ocrStatus === "waiting" ||
                  item.ocrStatus === "processing";
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "mb-1 flex w-full items-start gap-2 rounded-[0.33em] p-2 text-left transition-colors",
                      selectedId === item.id
                        ? "bg-primary/10"
                        : "hover:bg-gray-50",
                    )}
                  >
                    {isReading ? (
                      <Loader2 className="text-primary mt-0.5 size-4 shrink-0 animate-spin" />
                    ) : (
                      <FileText
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          error ? "text-amber-600" : "text-supportive",
                        )}
                      />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-gray-800">
                        {item.file.name}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 block text-[11px]",
                          error ? "text-amber-700" : "text-muted-foreground",
                        )}
                      >
                        {isReading
                          ? item.ocrMessage
                          : item.ocrStatus === "failed"
                            ? item.ocrMessage
                            : error
                              ? "Needs details"
                              : item.companyName}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-[10px]">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="flex h-[70vh] min-h-[520px] min-w-0 flex-col overflow-hidden border-b border-gray-200 lg:h-auto lg:min-h-0 lg:border-r lg:border-b-0">
            {selected ? (
              <LocalPdfPreview
                key={selected.id}
                file={selected.file}
                scale={previewScale}
                onScaleChange={setPreviewScale}
              />
            ) : null}
          </section>

          <section className="flex min-h-0 flex-col overflow-hidden">
            {selected && (
              <>
                <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-gray-200 px-3">
                  <span
                    className="min-w-0 truncate text-xs font-medium text-gray-800"
                    title={selected.file.name}
                  >
                    {selected.file.name}
                  </span>
                  <div className="inline-flex shrink-0 items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          items[selectedIndex - 1]?.id ?? selected.id,
                        )
                      }
                      disabled={selectedIndex <= 0}
                      className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Previous PDF"
                      title="Previous PDF"
                    >
                      <ChevronLeft className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedId(
                          items[selectedIndex + 1]?.id ?? selected.id,
                        )
                      }
                      disabled={selectedIndex >= items.length - 1}
                      className="rounded p-1 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                      aria-label="Next PDF"
                      title="Next PDF"
                    >
                      <ChevronRight className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
                  {selected.ocrStatus === "processing" && (
                    <div className="bg-primary/5 text-primary flex items-center gap-2 rounded-[0.33em] border border-primary/20 px-3 py-2 text-xs">
                      <Loader2 className="size-3.5 animate-spin" />
                      {selected.ocrMessage}
                    </div>
                  )}
                  {selected.ocrStatus === "failed" && (
                    <div className="text-destructive rounded-[0.33em] border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs">
                      {selected.ocrMessage}. Enter the details manually.
                    </div>
                  )}
                  {selected.ocrSuggested && (
                    <div className="rounded-[0.33em] border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                      OCR suggested these details. Review them against the PDF
                      and edit anything that is incorrect.
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="wizard-company">Company</Label>
                    <Input
                      id="wizard-company"
                      list="legacy-company-names"
                      value={selected.companyName}
                      onChange={(event) =>
                        updateSelected({ companyName: event.target.value })
                      }
                      placeholder="Type or choose a company"
                      aria-invalid={
                        !!itemError(selected) && !selected.companyName.trim()
                      }
                    />
                    <datalist id="legacy-company-names">
                      {companyNames.map((company) => (
                        <option key={company.id} value={company.company_name} />
                      ))}
                    </datalist>
                    <p className="text-muted-foreground text-xs">
                      A matching legacy company receives another MOA. A new name
                      creates one.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Start date</Label>
                    <DatePicker
                      id="wizard-effective-date"
                      value={selected.effectiveDate}
                      onChange={(effectiveDate) =>
                        updateSelected({ effectiveDate })
                      }
                      invalid={!selected.effectiveDate}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="wizard-perpetual"
                      checked={selected.isPerpetual}
                      onCheckedChange={(checked) =>
                        updateSelected({
                          isPerpetual: checked === true,
                          expiryDate:
                            checked === true ? "" : selected.expiryDate,
                        })
                      }
                    />
                    <Label
                      htmlFor="wizard-perpetual"
                      className="cursor-pointer"
                    >
                      This MOA is perpetual
                    </Label>
                  </div>
                  {!selected.isPerpetual && (
                    <div className="space-y-2">
                      <Label>End date</Label>
                      <DatePicker
                        id="wizard-expiry-date"
                        value={selected.expiryDate}
                        onChange={(expiryDate) =>
                          updateSelected({ expiryDate })
                        }
                        invalid={
                          !!selected.effectiveDate &&
                          !!selected.expiryDate &&
                          selected.expiryDate < selected.effectiveDate
                        }
                      />
                    </div>
                  )}
                  {itemError(selected) && (
                    <p className="text-destructive text-xs">
                      {itemError(selected)}
                    </p>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => removeItem(selected.id)}
                  >
                    <Trash2 className="size-4" /> Remove PDF
                  </Button>
                </div>
                <div className="shrink-0 border-t border-gray-200 p-3">
                  <Button
                    type="button"
                    className="w-full"
                    disabled={selectedIndex >= items.length - 1}
                    onClick={() =>
                      setSelectedId(items[selectedIndex + 1]?.id ?? selected.id)
                    }
                  >
                    Save and next
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
