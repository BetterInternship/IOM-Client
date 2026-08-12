"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  BasePdfViewer,
  Loader as PdfLoader,
  usePdfDocumentFromUrl,
  usePdfPageRenderer,
} from "@betterinternship/core/pdf-viewer";
import { FileText } from "lucide-react";

function PdfPage({
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

function PdfViewer({
  url,
  label,
  zoomStorageKey,
}: {
  url: string;
  label: string;
  zoomStorageKey: string;
}) {
  const { pdfDoc, pageCount, isLoading, error } = usePdfDocumentFromUrl(url);
  const [scale, setScale] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);

  useEffect(() => {
    const savedScale = Number(window.localStorage.getItem(zoomStorageKey));
    if (savedScale >= 0.2 && savedScale <= 3) setScale(savedScale);
  }, [zoomStorageKey]);

  const updateScale = (nextScale: number) => {
    setScale(nextScale);
    window.localStorage.setItem(zoomStorageKey, String(nextScale));
  };

  if (error) {
    return (
      <div className="text-destructive flex h-full items-center justify-center px-6 text-center text-sm">
        Failed to load PDF.
      </div>
    );
  }
  if (isLoading || !pdfDoc) {
    return (
      <div className="flex h-full items-center justify-center">
        <PdfLoader />
      </div>
    );
  }

  return (
    <BasePdfViewer
      pdfDoc={pdfDoc}
      pageCount={pageCount}
      scale={scale}
      onScaleChange={updateScale}
      visiblePage={visiblePage}
      onVisiblePageChange={setVisiblePage}
      children={
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-slate-700">
          <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="max-w-64 truncate" title={label}>
            {label}
          </span>
        </span>
      }
      renderPage={(pageNumber) => (
        <PdfPage
          key={pageNumber}
          pdfDoc={pdfDoc}
          pageNumber={pageNumber}
          scale={scale}
        />
      )}
    />
  );
}

export function DocumentPreviewPane({
  url,
  label,
  filename = label,
  zoomStorageKey = "iom-document-preview-zoom",
}: {
  url: string;
  label: string;
  filename?: string;
  zoomStorageKey?: string;
}) {
  const proxiedUrl = `/gcs-proxy?url=${encodeURIComponent(url)}`;
  const isImage = /\.(png|jpe?g|gif|webp)$/i.test(filename);

  return (
    <aside className="relative h-[70vh] min-h-[520px] overflow-hidden border-l border-gray-200 bg-slate-100 lg:h-full lg:min-h-0">
      {isImage ? (
        // User-uploaded document image.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={proxiedUrl}
          alt={label}
          className="h-full w-full object-contain p-4"
        />
      ) : (
        <PdfViewer
          url={proxiedUrl}
          label={label}
          zoomStorageKey={zoomStorageKey}
        />
      )}
    </aside>
  );
}
