"use client";

import { useEffect, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  BasePdfViewer,
  Loader as PdfLoader,
  usePdfDocumentFromUrl,
  usePdfPageRenderer,
} from "@betterinternship/core/pdf-viewer";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCompanyControllerGetMoa } from "@/app/api";
import { useModal } from "@/app/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { MoaStatusBadge } from "@/components/status-badge";
import { AutoSignCta } from "@/components/auto-sign-cta";
import { cn, formatDateWithoutTime, formatExpiryCountdown } from "@/lib/utils";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Download,
  FileText,
  ShieldCheck,
  ShieldX,
} from "lucide-react";

function MoaPdfPage({
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

function MoaPdfViewer({ url }: { url: string }) {
  const { pdfDoc, pageCount, isLoading, error } = usePdfDocumentFromUrl(url);
  const [scale, setScale] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);

  useEffect(() => {
    if (window.matchMedia("(max-width: 639px)").matches) setScale(0.7);
  }, []);

  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-100 px-6 text-center">
        <div>
          <p className="text-destructive text-sm font-medium">
            Failed to load PDF
          </p>
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
        <MoaPdfPage
          key={pageNumber}
          pdfDoc={pdfDoc}
          pageNumber={pageNumber}
          scale={scale}
        />
      )}
    />
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-slate-200 py-5 last:border-b-0">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-600">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <span className="ml-auto max-w-[50%] text-right text-sm text-slate-600">
        {value}
      </span>
    </div>
  );
}

function universityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function CompanyMoaDetailPage() {
  const { moaId } = useParams<{ moaId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { closeModal } = useModal();
  const justIssued = searchParams.get("issued") === "1";

  const { data, isLoading } = useCompanyControllerGetMoa(moaId, {
    query: { refetchInterval: 25 * 60 * 1000 },
  });

  useEffect(() => {
    if (!justIssued || isLoading || !data) return;

    const timer = window.setTimeout(() => {
      closeModal("request-moa", { skipOnClose: true });
    }, 650);

    return () => window.clearTimeout(timer);
  }, [closeModal, data, isLoading, justIssued]);

  const goBack = () => {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.replace("/company/dashboard");
  };

  if (isLoading) {
    return (
      <main className="grid flex-1 lg:h-[calc(100dvh-5rem-1px)] lg:flex-none lg:grid-cols-[460px_1fr] lg:overflow-hidden xl:grid-cols-[500px_1fr]">
        <div className="space-y-6 border-r border-slate-200 p-6 lg:overflow-y-auto lg:px-8 lg:py-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-4/5" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
        <div className="p-6 lg:p-8">
          <Skeleton className="mb-6 h-7 w-32" />
          <Skeleton className="h-[70vh] w-full" />
        </div>
      </main>
    );
  }

  if (!data?.moa) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p className="text-destructive text-sm">MOA not found.</p>
      </main>
    );
  }

  const { moa, pdfUrl } = data;
  const universityName = moa.university?.registered_name ?? "University";
  const templateName = moa.template?.name ?? "MOA Template";
  const isExpired = Boolean(moa.is_expired);
  const isActive = moa.status === "active" && !moa.is_expired;
  const proxiedPdfUrl = pdfUrl
    ? `/gcs-proxy?url=${encodeURIComponent(pdfUrl)}`
    : null;
  const downloadFilename = `${universityName} MOA.pdf`;

  return (
    <main className="grid flex-1 lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0 lg:flex-none lg:grid-cols-[460px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[500px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8 lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="mx-auto max-w-md lg:max-w-none">
          <button
            type="button"
            onClick={goBack}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-950"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to partners
          </button>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-lg font-semibold text-slate-600">
              {moa.university?.logo_url ? (
                // University logos are user-uploaded external assets.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={moa.university.logo_url}
                  alt={`${universityName} logo`}
                  className="size-full object-contain p-2"
                />
              ) : (
                <span aria-hidden="true">
                  {universityInitials(universityName)}
                </span>
              )}
            </div>
            <h1 className="min-w-0 flex-1 text-2xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-3xl">
              {universityName}
            </h1>
            {!isActive && !isExpired && (
              <div className="shrink-0">
                <MoaStatusBadge
                  status={moa.status}
                  isExpired={moa.is_expired}
                />
              </div>
            )}
          </div>

          {(isActive || isExpired) && (
            <div
              className={cn(
                "mt-7 flex items-center gap-4 rounded-lg px-5 py-4",
                isExpired
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-supportive text-supportive-foreground",
              )}
            >
              <span className="bg-current/15 flex size-10 shrink-0 items-center justify-center rounded-full">
                {isExpired ? (
                  <ShieldX className="size-6" aria-hidden="true" />
                ) : (
                  <ShieldCheck className="size-6" aria-hidden="true" />
                )}
              </span>
              <div>
                <p className="font-semibold">
                  {isExpired ? "Expired Partnership" : "Active Partnership"}
                </p>
                <p className="mt-0.5 text-sm">
                  {isExpired && moa.expiry_date
                    ? `Expired on ${formatDateWithoutTime(moa.expiry_date)}`
                    : moa.expiry_date
                      ? formatExpiryCountdown(moa.expiry_date)
                      : "Perpetual — no expiry"}
                </p>
              </div>
            </div>
          )}

          <div className="mt-5 border-y border-slate-200">
            <DetailRow icon={FileText} label="Template" value={templateName} />
            <DetailRow
              icon={CalendarDays}
              label="Start Date"
              value={formatDateWithoutTime(moa.effective_date)}
            />
            <DetailRow
              icon={CalendarDays}
              label="End Date"
              value={
                moa.expiry_date
                  ? formatDateWithoutTime(moa.expiry_date)
                  : "Perpetual"
              }
            />
            <DetailRow
              icon={Clock3}
              label="Date Requested"
              value={formatDateWithoutTime(moa.created_at)}
            />
          </div>

          {pdfUrl && (
            <Button asChild className="mt-7 h-12 w-full text-base">
              <a href={proxiedPdfUrl!} download={downloadFilename}>
                <Download className="size-5" aria-hidden="true" />
                Download MOA
              </a>
            </Button>
          )}

          {/* Only on the ?issued=1 arrival — a moment, not a permanent
              banner (Docs/plans/AUTO_SIGN_CTA_IMPLEMENTATION_PLAN.md §6.1). */}
          {justIssued && (
            <div className="mt-6">
              <AutoSignCta templateId={moa.template_id} />
            </div>
          )}
        </div>
      </aside>

      <section className="min-w-0 bg-slate-50 px-4 py-6 sm:px-6 lg:flex lg:min-h-0 lg:flex-col lg:px-0 lg:py-0">
        <div className="h-[72vh] min-h-[520px] overflow-hidden bg-white lg:h-auto lg:min-h-0 lg:flex-1">
          {proxiedPdfUrl ? (
            <MoaPdfViewer url={proxiedPdfUrl} />
          ) : (
            <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
              PDF not available.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
