"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  BasePdfViewer,
  Loader as PdfLoader,
  usePdfDocumentFromUrl,
  usePdfPageRenderer,
} from "@betterinternship/core/pdf-viewer";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveFile } from "@/app/lib/resolve-file";

function DocumentPdfPage({
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

function DocumentPdfViewer({ url }: { url: string }) {
  const { pdfDoc, pageCount, isLoading, error } = usePdfDocumentFromUrl(url);
  const [scale, setScale] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 text-center">
        <div>
          <p className="text-destructive text-sm">Failed to load PDF</p>
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
        <DocumentPdfPage
          pdfDoc={pdfDoc}
          pageNumber={pageNumber}
          scale={scale}
        />
      )}
    />
  );
}

export function DocumentPreview({ docId }: { docId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    resolveFile("company_document", docId).then((resolved) => {
      setUrl(resolved);
      setIsLoading(false);
      if (!resolved) toast.error("Couldn't load that document");
    });
  }, [docId]);

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...
      </div>
    );
  }
  if (!url) {
    return (
      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
        Couldn&apos;t load that document.
      </div>
    );
  }

  return (
    <DocumentPdfViewer url={`/gcs-proxy?url=${encodeURIComponent(url)}`} />
  );
}
