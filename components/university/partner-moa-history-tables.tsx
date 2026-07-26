"use client";

import { useState } from "react";
import { Loader as PdfLoader } from "@betterinternship/core/pdf-viewer";
import { ArrowRight, Eye } from "lucide-react";

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
import { formatDateWithoutTime } from "@/lib/utils";

export interface RegisteredPartnerMoa {
  id: string;
  status: string;
  created_at: string;
  effective_date: string;
  expiry_date: string | null;
  is_expired: boolean | null;
  template: { name: string } | null;
}

type LegacyMoa = LegacyCompanyDetail["moas"][number];

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
      width: "w-[17%]",
      getSortValue: (moa) => (moa.is_expired ? "expired" : moa.status),
      render: (moa) => (
        <PartnershipStatusBadge
          status={moa.is_expired ? "Expired" : moa.status}
        />
      ),
    },
    {
      id: "template",
      header: "Template",
      width: "w-[25%]",
      getSortValue: (moa) => moa.template?.name ?? "",
      render: (moa) => (
        <span className="text-sm text-gray-700">
          {moa.template?.name ?? "—"}
        </span>
      ),
    },
    {
      id: "requested",
      header: "Requested",
      width: "w-[16%]",
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
      width: "w-[16%]",
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
      width: "w-[20%]",
      getSortValue: (moa) => moa.expiry_date ?? "",
      render: (moa) => (
        <MoaEndDate
          expiryDate={moa.expiry_date}
          isPerpetual={!!moa.effective_date && !moa.expiry_date}
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
    onOpenMoa({
      kind: "registered",
      moaId: moa.id,
      label: `${moa.template?.name ?? "MOA document"}.pdf`,
    });

  return (
    <ResourceTable
      table={table}
      className="[&_table]:min-w-[760px] [&_td]:py-2.5"
      onRowClick={openMoa}
      renderMobileRow={(moa) => (
        <button
          type="button"
          onClick={() => openMoa(moa)}
          className="w-full px-4 py-3 text-left hover:bg-primary/[0.035]"
        >
          <div className="flex items-start justify-between gap-3">
            <PartnershipStatusBadge
              status={moa.is_expired ? "Expired" : moa.status}
            />
            <ArrowRight className="text-primary mt-1 h-4 w-4" />
          </div>
          <p className="mt-2 text-sm font-medium text-gray-900">
            {moa.template?.name ?? "Template unavailable"}
          </p>
          <div className="text-muted-foreground mt-1 grid grid-cols-2 gap-3 text-xs">
            <p>Start: {formatDateWithoutTime(moa.effective_date)}</p>
            <p className="flex items-center gap-1">
              End:{" "}
              <MoaEndDate
                expiryDate={moa.expiry_date}
                isPerpetual={!moa.expiry_date}
              />
            </p>
          </div>
        </button>
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
}: {
  moas: LegacyMoa[];
  onOpenMoa: (selection: PartnerPdfSelection) => void;
}) {
  const columns: Array<ResourceTableColumn<LegacyMoa>> = [
    {
      id: "status",
      header: "Status",
      width: "w-[17%]",
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
      id: "document",
      header: "Document",
      width: "w-[27%]",
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
      width: "w-[16%]",
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
      width: "w-[16%]",
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
      width: "w-[18%]",
      getSortValue: (moa) => moa.expiry_date ?? "",
      render: (moa) => (
        <MoaEndDate
          expiryDate={moa.expiry_date}
          isPerpetual={!!moa.is_perpetual}
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
        <button
          type="button"
          onClick={() => openMoa(moa)}
          className="w-full px-4 py-3 text-left hover:bg-primary/[0.035]"
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
