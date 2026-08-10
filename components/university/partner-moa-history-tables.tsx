"use client";

import { useEffect, useState } from "react";
import { Loader as PdfLoader } from "@betterinternship/core/pdf-viewer";
import {
  ArrowRight,
  Download,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

import { useUniversityControllerGetMoaDetail } from "@/app/api/app/api/endpoints/university/university";
import { DocumentPreviewPane } from "@/components/document-preview-pane";
import type { LegacyCompanyDetail } from "@/components/legacy-companies/legacy-companies-panel";
import { isLegacyMoaExpired } from "@/components/legacy-companies/legacy-companies-panel";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TruncatedTooltip } from "@/components/ui/truncated-tooltip";
import { cn, formatDateWithoutTime } from "@/lib/utils";

export interface RegisteredPartnerMoa {
  id: string;
  status: string;
  created_at: string;
  effective_date: string | null;
  expiry_date: string | null;
  is_expired: boolean | null;
  template: { name: string } | null;
  imported?: boolean;
  importedUrl?: string | null;
  importedLabel?: string | null;
}

type LegacyMoa = LegacyCompanyDetail["moas"][number];

function LegacyMoaActions({
  moa,
  onEditMoa,
  onDeleteMoa,
}: {
  moa: LegacyMoa;
  onEditMoa?: (moa: LegacyMoa) => void;
  onDeleteMoa?: (moa: LegacyMoa) => void;
}) {
  if (!onEditMoa && !onDeleteMoa) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="size-7 px-0"
          aria-label="MOA actions"
          title="MOA actions"
          onClick={(event) => event.stopPropagation()}
        >
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {onEditMoa && (
          <DropdownMenuItem onSelect={() => onEditMoa(moa)}>
            <Pencil /> Edit
          </DropdownMenuItem>
        )}
        {onDeleteMoa && (
          <DropdownMenuItem
            variant="destructive"
            onSelect={() => onDeleteMoa(moa)}
          >
            <Trash2 /> Delete
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type PartnerPdfSelection =
  | { kind: "registered"; moaId: string; label: string }
  | { kind: "legacy"; url: string | null; label: string }
  | { kind: "document"; url: string; label: string };

export function PartnerPdfPane({
  selection,
}: {
  selection: PartnerPdfSelection;
}) {
  const { data, isLoading } = useUniversityControllerGetMoaDetail(
    selection.kind === "registered" ? selection.moaId : null,
  );
  const pdfUrl = selection.kind === "registered" ? data?.pdfUrl : selection.url;
  if (isLoading && selection.kind === "registered") {
    return (
      <aside className="relative h-[70vh] min-h-[520px] overflow-hidden border-l border-gray-200 bg-slate-100 lg:h-full lg:min-h-0">
        <div className="flex h-full items-center justify-center">
          <PdfLoader />
        </div>
      </aside>
    );
  }
  if (pdfUrl) {
    return (
      <DocumentPreviewPane
        url={pdfUrl}
        label={selection.label}
        zoomStorageKey="iom-partner-preview-zoom"
      />
    );
  }
  return (
    <aside className="relative flex h-[70vh] min-h-[520px] items-center justify-center overflow-hidden border-l border-gray-200 bg-slate-100 text-sm text-muted-foreground lg:h-full lg:min-h-0">
      PDF not available.
    </aside>
  );
}

function MoaEndDate({
  expiryDate,
  isPerpetual,
}: {
  expiryDate: string | null;
  isPerpetual: boolean;
}) {
  if (isPerpetual) {
    return (
      <span className="bg-primary/20 text-primary inline-flex rounded-full px-2 py-1 text-sm">
        Perpetual
      </span>
    );
  }
  return (
    <span className="text-muted-foreground text-sm">
      {expiryDate ? formatDateWithoutTime(expiryDate) : "—"}
    </span>
  );
}

function withPdfExtension(name: string) {
  return name.toLowerCase().endsWith(".pdf") ? name : `${name}.pdf`;
}

type DownloadMoaButtonProps =
  | { moaId: string; pdfUrl?: never; label: string }
  | { moaId?: never; pdfUrl: string | null | undefined; label: string };

function DownloadMoaButton({
  className,
  ...props
}: DownloadMoaButtonProps & { className?: string }) {
  const { label } = props;
  const pdfUrl = "pdfUrl" in props ? props.pdfUrl : undefined;
  const moaId = "moaId" in props ? props.moaId : undefined;
  const [shouldFetch, setShouldFetch] = useState(false);
  const { data, isLoading } = useUniversityControllerGetMoaDetail(
    shouldFetch && moaId ? moaId : null,
  );
  const resolvedUrl = pdfUrl ?? data?.pdfUrl ?? null;
  const proxiedUrl = resolvedUrl
    ? `/gcs-proxy?url=${encodeURIComponent(resolvedUrl)}`
    : null;

  useEffect(() => {
    if (proxiedUrl && shouldFetch) {
      setShouldFetch(false);
      const anchor = document.createElement("a");
      anchor.href = proxiedUrl;
      anchor.download = label;
      anchor.rel = "noopener";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  }, [proxiedUrl, shouldFetch, label]);

  if (!moaId && !pdfUrl) return null;

  return (
    <a
      href={proxiedUrl ?? undefined}
      download={label}
      aria-label={`Download ${label}`}
      title="Download MOA"
      onClick={(event) => {
        event.stopPropagation();
        if (!proxiedUrl) {
          event.preventDefault();
          setShouldFetch(true);
        }
      }}
      className={cn(
        "text-muted-foreground hover:text-primary inline-flex size-7 items-center justify-center rounded-md transition-colors",
        isLoading && "pointer-events-none",
        className,
      )}
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="size-4" aria-hidden="true" />
      )}
    </a>
  );
}

export function RegisteredPartnerMoasTable({
  moas,
  isLoading,
  onOpenMoa,
}: {
  moas: RegisteredPartnerMoa[];
  isLoading: boolean;
  onOpenMoa: (selection: PartnerPdfSelection) => void;
}) {
  const columns: Array<ResourceTableColumn<RegisteredPartnerMoa>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[10%]",
      getSortValue: (moa) => (moa.is_expired ? "expired" : moa.status),
      render: (moa) => (
        <PartnershipStatusBadge
          status={moa.is_expired ? "Expired" : moa.status}
        />
      ),
    },
    {
      id: "imported",
      header: "Imported",
      width: "w-[12%]",
      getSortValue: (moa) => (moa.imported ? "yes" : "no"),
      render: (moa) =>
        moa.imported ? (
          <PartnershipStatusBadge status="imported" label="Imported" />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      id: "template",
      header: "Template",
      width: "w-[25%]",
      getSortValue: (moa) => moa.template?.name ?? "",
      render: (moa) => (
        <TruncatedTooltip className="block max-w-[220px] text-sm text-gray-700">
          {moa.template?.name ?? "—"}
        </TruncatedTooltip>
      ),
    },
    {
      id: "requested",
      header: "Requested",
      width: "w-[14%]",
      defaultSortDirection: "desc",
      getSortValue: (moa) => moa.created_at,
      render: (moa) => (
        <span className="text-muted-foreground text-sm">
          {formatDateWithoutTime(moa.created_at)}
        </span>
      ),
    },
    {
      id: "start-date",
      header: "Start Date",
      width: "w-[14%]",
      getSortValue: (moa) => moa.effective_date,
      render: (moa) => (
        <span className="text-muted-foreground text-sm">
          {moa.effective_date ? formatDateWithoutTime(moa.effective_date) : "—"}
        </span>
      ),
    },
    {
      id: "end-date",
      header: "End Date",
      width: "w-[13%]",
      getSortValue: (moa) => moa.expiry_date ?? "",
      render: (moa) => (
        <MoaEndDate
          expiryDate={moa.expiry_date}
          isPerpetual={!!moa.effective_date && !moa.expiry_date}
        />
      ),
    },
    {
      id: "download",
      header: <span className="sr-only">Download</span>,
      width: "w-[6%]",
      align: "right",
      sortable: false,
      render: (moa) =>
        moa.imported ? (
          <DownloadMoaButton
            pdfUrl={moa.importedUrl}
            label={withPdfExtension(moa.importedLabel ?? "MOA document")}
          />
        ) : (
          <DownloadMoaButton
            moaId={moa.id}
            label={withPdfExtension(moa.template?.name ?? "MOA document")}
          />
        ),
    },
    {
      id: "action",
      header: <span className="sr-only">Open</span>,
      width: "w-[6%]",
      align: "right",
      sortable: false,
      render: () => <ArrowRight className="text-primary ml-auto h-4 w-4" />,
    },
  ];
  const table = useResourceTable({
    data: moas,
    getRowId: (moa) => moa.id,
    columns,
    sort: { initialColumn: "requested", initialDirection: "desc" },
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 20] },
  });

  if (isLoading) return <Skeleton className="h-52 w-full" />;

  const openMoa = (moa: RegisteredPartnerMoa) =>
    onOpenMoa(
      moa.imported
        ? { kind: "legacy", url: moa.importedUrl ?? null, label: moa.importedLabel ?? "MOA document" }
        : { kind: "registered", moaId: moa.id, label: `${moa.template?.name ?? "MOA document"}.pdf` },
    );

  return (
    <ResourceTable
      table={table}
      className="[&_table]:min-w-[760px] [&_td]:py-2.5"
      onRowClick={openMoa}
      renderMobileRow={(moa) => (
        <div className="flex w-full items-center">
          <button
            type="button"
            onClick={() => openMoa(moa)}
            className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-primary/[0.035]"
          >
            <div className="flex items-start justify-between gap-3">
              <PartnershipStatusBadge
                status={moa.is_expired ? "Expired" : moa.status}
              />
              {moa.imported && (
                <PartnershipStatusBadge status="imported" label="Imported" />
              )}
              <ArrowRight className="text-primary mt-1 h-4 w-4" />
            </div>
            <p className="mt-2 max-w-[min(70vw,28rem)] truncate text-sm font-medium text-gray-900" title={moa.template?.name ?? "Template unavailable"}>
              {moa.template?.name ?? "Template unavailable"}
            </p>
            <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-3 text-xs">
              <p>
                Start:{" "}
                {moa.effective_date
                  ? formatDateWithoutTime(moa.effective_date)
                  : "—"}
              </p>
              <p className="flex items-center gap-1">
                End:{" "}
                <MoaEndDate
                  expiryDate={moa.expiry_date}
                  isPerpetual={!moa.expiry_date}
                />
              </p>
            </div>
          </button>
          <div className="shrink-0 pr-4">
            {moa.imported ? (
              <DownloadMoaButton
                pdfUrl={moa.importedUrl}
                label={withPdfExtension(moa.importedLabel ?? "MOA document")}
              />
            ) : (
              <DownloadMoaButton
                moaId={moa.id}
                label={withPdfExtension(moa.template?.name ?? "MOA document")}
              />
            )}
          </div>
        </div>
      )}
      emptyState={{
        title: "No MOA history",
        description: "This partner does not have any MOAs yet.",
      }}
      rowLabelSingular="MOA"
      rowLabelPlural="MOAs"
    />
  );
}

export function LegacyPartnerMoasTable({
  moas,
  onOpenMoa,
  onEditMoa,
  onDeleteMoa,
}: {
  moas: LegacyMoa[];
  onOpenMoa: (selection: PartnerPdfSelection) => void;
  onEditMoa?: (moa: LegacyMoa) => void;
  onDeleteMoa?: (moa: LegacyMoa) => void;
}) {
  const columns: Array<ResourceTableColumn<LegacyMoa>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[13%]",
      getSortValue: (moa) =>
        isLegacyMoaExpired(moa.expiry_date, moa.is_perpetual)
          ? "expired"
          : "active",
      render: (moa) => (
        <PartnershipStatusBadge
          status={
            isLegacyMoaExpired(moa.expiry_date, moa.is_perpetual)
              ? "Expired"
              : "Active"
          }
        />
      ),
    },
    {
      id: "imported",
      header: "Imported",
      width: "w-[12%]",
      sortable: false,
      render: () => <PartnershipStatusBadge status="imported" label="Imported" />,
    },
    {
      id: "document",
      header: "Document",
      width: "w-[22%]",
      getSortValue: (moa) => moa.filename ?? "",
      render: (moa) =>
        moa.document_url ? (
          <span className="text-primary inline-flex items-center gap-1.5 text-sm">
            <Eye className="h-3.5 w-3.5" />
            {moa.filename ?? "MOA Document"}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      id: "created",
      header: "Created",
      width: "w-[14%]",
      defaultSortDirection: "desc",
      getSortValue: (moa) => moa.created_at,
      render: (moa) => (
        <span className="text-muted-foreground text-sm">
          {formatDateWithoutTime(moa.created_at)}
        </span>
      ),
    },
    {
      id: "start-date",
      header: "Start Date",
      width: "w-[14%]",
      getSortValue: (moa) => moa.effective_date,
      render: (moa) => (
        <span className="text-muted-foreground text-sm">
          {moa.effective_date ? formatDateWithoutTime(moa.effective_date) : "—"}
        </span>
      ),
    },
    {
      id: "end-date",
      header: "End Date",
      width: "w-[13%]",
      getSortValue: (moa) => moa.expiry_date ?? "",
      render: (moa) => (
        <MoaEndDate
          expiryDate={moa.expiry_date}
          isPerpetual={!!moa.is_perpetual}
        />
      ),
    },
    {
      id: "download",
      header: <span className="sr-only">Download</span>,
      width: "w-[6%]",
      align: "right",
      sortable: false,
      render: (moa) => (
        <DownloadMoaButton
          pdfUrl={moa.document_url}
          label={withPdfExtension(moa.filename ?? "MOA document")}
        />
      ),
    },
    {
      id: "action",
      header: <span className="sr-only">Actions</span>,
      width: "w-[6%]",
      align: "right",
      sortable: false,
      render: (moa) =>
        onEditMoa || onDeleteMoa ? (
          <div
            className="flex items-center justify-end gap-1"
            onClick={(event) => event.stopPropagation()}
          >
            <LegacyMoaActions
              moa={moa}
              onEditMoa={onEditMoa}
              onDeleteMoa={onDeleteMoa}
            />
          </div>
        ) : (
          <ArrowRight className="text-primary ml-auto h-4 w-4" />
        ),
    },
  ];
  const table = useResourceTable({
    data: moas,
    getRowId: (moa) => moa.id,
    columns,
    sort: { initialColumn: "created", initialDirection: "desc" },
    pagination: { pageSize: 10, pageSizeOptions: [5, 10, 20] },
  });
  const openMoa = (moa: LegacyMoa) =>
    onOpenMoa({
      kind: "legacy",
      url: moa.document_url,
      label: moa.filename ?? "MOA document",
    });

  return (
    <ResourceTable
      table={table}
      className="[&_table]:min-w-[760px] [&_td]:py-2.5"
      onRowClick={openMoa}
      renderMobileRow={(moa) => (
        <div className="flex w-full items-center">
          <button
            type="button"
            onClick={() => openMoa(moa)}
            className="min-w-0 flex-1 px-4 py-3 text-left hover:bg-primary/[0.035]"
          >
            <div className="flex items-start justify-between gap-3">
              <PartnershipStatusBadge
                status={
                  isLegacyMoaExpired(moa.expiry_date, moa.is_perpetual)
                    ? "Expired"
                    : "Active"
                }
              />
              <ArrowRight className="text-primary mt-1 h-4 w-4" />
            </div>
            <p className="mt-2 text-sm font-medium text-gray-900">
              {moa.filename ?? "MOA Document"}
            </p>
            <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-3 text-xs">
              <p>
                Start:{" "}
                {moa.effective_date
                  ? formatDateWithoutTime(moa.effective_date)
                  : "—"}
              </p>
              <p className="flex items-center gap-1">
                End:{" "}
                <MoaEndDate
                  expiryDate={moa.expiry_date}
                  isPerpetual={!!moa.is_perpetual}
                />
              </p>
            </div>
          </button>
          <div className="flex shrink-0 items-center gap-1 pr-4">
            <DownloadMoaButton
              pdfUrl={moa.document_url}
              label={withPdfExtension(moa.filename ?? "MOA document")}
            />
            <LegacyMoaActions
              moa={moa}
              onEditMoa={onEditMoa}
              onDeleteMoa={onDeleteMoa}
            />
          </div>
        </div>
      )}
      emptyState={{
        title: "No MOA history",
        description: "This legacy partner does not have any MOAs yet.",
      }}
      rowLabelSingular="MOA"
      rowLabelPlural="MOAs"
    />
  );
}
