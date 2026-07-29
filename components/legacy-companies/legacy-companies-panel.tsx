"use client";
import { useMemo, useState } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { useModal } from "@/app/providers/modal-provider";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/ui/file-upload";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { Card } from "@/components/ui/card";
import { MoaStatusBadge } from "@/components/status-badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateWithoutTime, cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronDown,
  CircleCheck,
  Eye,
  Loader2,
  Plus,
  Upload,
  X,
} from "lucide-react";
import type {
  AppendLegacyMoasDto,
  UniversityLegacyCompanyDetailDto,
  UniversityLegacyCompanySummaryDto,
} from "@/app/api";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";

const COMPANY_TYPES = [
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "government_agency", label: "Government Agency" },
];

export type LegacyCompanySummary = UniversityLegacyCompanySummaryDto;
export type LegacyCompanyDetail = UniversityLegacyCompanyDetailDto;

type LegacyCompaniesPanelProps = {
  requests: LegacyCompanyRequests;
  canUpload: boolean;
  queryKey: QueryKey;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  showDetailBackButton?: boolean;
};

type LegacyCompanyRequests = {
  list: (
    signal?: AbortSignal,
  ) => Promise<{ legacyCompanies: LegacyCompanySummary[] }>;
  detail: (
    id: string,
    signal?: AbortSignal,
  ) => Promise<{ legacyCompany: LegacyCompanyDetail }>;
  create: (data: LegacyCompanyCreateInput) => Promise<unknown>;
  addDocuments: (
    id: string,
    data: LegacyCompanyDocumentsInput,
  ) => Promise<unknown>;
  addMoas: (id: string, data: AppendLegacyMoasDto) => Promise<unknown>;
  bulkCsv?: (file: File) => Promise<BulkUploadResult>;
  bulkZip?: (file: File) => Promise<BulkUploadResult>;
};

type LegacyCompanyDocumentsInput = {
  companyDocuments: File[];
  documentTypes: string;
};
type LegacyCompanyCreateInput = AppendLegacyMoasDto & {
  company_name: string;
  tin?: string;
  company_type?: string;
  registered_address?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  companyDocuments?: File[];
  documentTypes?: string;
};

export function formatLegacyLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function formatLegacyFieldLabel(value: string) {
  if (value === "tin") return "TIN";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isFilledValue(value: unknown) {
  if (value === null || value === undefined) return false;
  return String(value).trim() !== "";
}

const DOCUMENT_TYPE_OPTIONS = [
  { value: "business_permit", label: "Business Permit" },
  { value: "sec_dti_registration", label: "SEC/DTI Registration" },
  { value: "mayor_permit", label: "Mayor's Permit" },
  { value: "other", label: "Other" },
];

export function isLegacyMoaExpired(
  expiryDate: string | null,
  isPerpetual?: boolean,
) {
  if (isPerpetual) return false;
  if (!expiryDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return expiryDate < today;
}

export function formatLegacyMoaPeriod(moa: {
  effective_date: string | null;
  expiry_date: string | null;
  is_perpetual?: boolean;
}) {
  if (moa.is_perpetual) {
    return moa.effective_date
      ? `${formatDateWithoutTime(moa.effective_date)} – Perpetual`
      : "Effective date unknown – Perpetual";
  }

  return `${moa.effective_date ? formatDateWithoutTime(moa.effective_date) : "—"} – ${
    moa.expiry_date ? formatDateWithoutTime(moa.expiry_date) : "—"
  }`;
}

export function LegacyCompaniesPanel({
  requests,
  canUpload,
  queryKey,
  selectedId: controlledSelectedId,
  onSelectedIdChange,
  showDetailBackButton = true,
}: LegacyCompaniesPanelProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null,
  );
  const { openModal, closeModal } = useModal();
  const bulkCsv = requests.bulkCsv;
  const bulkZip = requests.bulkZip;
  const selectedId =
    controlledSelectedId !== undefined
      ? controlledSelectedId
      : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    if (onSelectedIdChange) onSelectedIdChange(id);
    else setInternalSelectedId(id);
  };

  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: ({ signal }) => requests.list(signal),
  });

  const legacyCompanies = data?.legacyCompanies ?? [];

  const columns = useMemo<ColumnDef<LegacyCompanySummary>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.company_name,
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">
            {row.original.company_name}
          </span>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => {
          const type = (row.company_details as Record<string, string>)
            ?.company_type;
          return type ? formatLegacyLabel(type) : "—";
        },
      },
    ],
    [],
  );

  if (selectedId) {
    return (
      <LegacyCompanyDetailView
        legacyCompanyId={selectedId}
        requests={requests}
        canUpload={canUpload}
        queryKey={queryKey}
        showBackButton={showDetailBackButton}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="space-y-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : (
        <DataTable
          id={`${String(queryKey[0])}-table`}
          columns={columns}
          data={legacyCompanies}
          searchKey="company"
          searchPlaceholder="Search by company..."
          rowLabelSingular="legacy company"
          rowLabelPlural="legacy companies"
          onRowClick={(row) => {
            setSelectedId(row.id);
          }}
          toolbarActions={
            canUpload ? (
              <div className="flex">
                <Button
                  onClick={() =>
                    openModal(
                      "legacy-upload",
                      <UploadDialog
                        createRequest={requests.create}
                        queryKey={queryKey}
                        onClose={() => closeModal("legacy-upload")}
                      />,
                      {
                        title: "Add Legacy Company",
                        description:
                          "Create a legacy company record. You can add MOAs now or later from the company detail view.",
                        panelClassName: "!w-full sm:!max-w-2xl",
                      },
                    )
                  }
                  className={bulkCsv || bulkZip ? "rounded-r-none" : undefined}
                >
                  <Plus /> Add Legacy Company
                </Button>
                {(bulkCsv || bulkZip) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="rounded-l-none border-l-0 px-2">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {bulkCsv && (
                        <DropdownMenuItem
                          onSelect={() =>
                            openModal(
                              "csv-upload",
                              <CsvUploadDialog
                                uploadRequest={bulkCsv}
                                queryKey={queryKey}
                                onClose={() => closeModal("csv-upload")}
                              />,
                              {
                                title: "Bulk Upload Legacy MOAs",
                                description:
                                  "Upload a CSV file to create or append multiple legacy MOAs at once.",
                                panelClassName: "!w-full sm:!max-w-5xl",
                              },
                            )
                          }
                        >
                          <Upload className="h-4 w-4" />
                          Bulk upload via CSV
                        </DropdownMenuItem>
                      )}
                      {bulkZip && (
                        <DropdownMenuItem
                          onSelect={() =>
                            openModal(
                              "zip-upload",
                              <ZipUploadDialog
                                uploadRequest={bulkZip}
                                queryKey={queryKey}
                                onClose={() => closeModal("zip-upload")}
                              />,
                              {
                                title: "Bulk Upload Legacy MOAs via ZIP",
                                description:
                                  "Upload a ZIP file containing a legacy-import.csv manifest and referenced PDF files.",
                                panelClassName: "!w-full sm:!max-w-5xl",
                              },
                            )
                          }
                        >
                          <Upload className="h-4 w-4" />
                          Bulk upload via ZIP
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

export function LegacyCompanyDetailView({
  legacyCompanyId,
  requests,
  canUpload,
  queryKey,
  showBackButton,
  onBack,
}: {
  legacyCompanyId: string;
  requests: LegacyCompanyRequests;
  canUpload: boolean;
  queryKey: QueryKey;
  showBackButton: boolean;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();

  const { data, isLoading } = useQuery({
    queryKey: [...queryKey, legacyCompanyId],
    queryFn: ({ signal }) => requests.detail(legacyCompanyId, signal),
  });

  const company = data?.legacyCompany;

  const docUploadMutation = useMutation({
    mutationFn: (inputs: { id: string; file: File; type: string }[]) => {
      const documentTypes: string[] = [];
      inputs.forEach(({ file, type }) => {
        documentTypes.push(type || "other");
      });
      return requests.addDocuments(legacyCompanyId, {
        companyDocuments: inputs.map(({ file }) => file),
        documentTypes: JSON.stringify(documentTypes),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: [...queryKey, legacyCompanyId],
      });
      toast("Documents uploaded", toastPresets.success);
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : "Failed to upload documents",
        toastPresets.destructive,
      );
    },
  });

  const moaUploadMutation = useMutation({
    mutationFn: (inputs: MoaRecordInput[]) => {
      return requests.addMoas(legacyCompanyId, buildMoaRequest(inputs));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: [...queryKey, legacyCompanyId],
      });
      closeModal("moa-upload");
      toast("Legacy MOA added", toastPresets.success);
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : "Failed to add legacy MOA",
        toastPresets.destructive,
      );
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
          >
            <ArrowLeft className="h-4 w-4" /> Legacy Companies
          </Button>
        )}
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="space-y-4">
        {showBackButton && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
          >
            <ArrowLeft className="h-4 w-4" /> Legacy Companies
          </Button>
        )}
        <p className="text-muted-foreground text-sm">
          Legacy company not found.
        </p>
      </div>
    );
  }

  const details = company.company_details as Record<string, unknown>;
  const companyType =
    typeof details.company_type === "string" ? details.company_type : null;
  const standardDetailKeys = [
    "company_type",
    "tin",
    "registered_address",
    "contact_person",
    "contact_email",
    "contact_phone",
  ];
  const detailEntries = [
    ...standardDetailKeys.map(
      (key) => [formatLegacyFieldLabel(key), details[key]] as const,
    ),
    ...Object.entries(details)
      .filter(
        ([key, value]) =>
          !standardDetailKeys.includes(key) && isFilledValue(value),
      )
      .map(([key, value]) => [formatLegacyFieldLabel(key), value] as const),
  ];

  return (
    <div className="space-y-4">
      {showBackButton && (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
          >
            <ArrowLeft className="h-4 w-4" /> Legacy Companies
          </Button>
        </div>
      )}

      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-semibold text-gray-900">
            {company.company_name}
          </h3>
          <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
            Imported
          </span>
        </div>
        {companyType && (
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatLegacyLabel(companyType)}
          </p>
        )}
      </div>

      <div className="space-y-0 rounded-[0.33em] border border-gray-200">
        <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
          Company details
        </div>
        <div className="divide-y divide-gray-100">
          {detailEntries.map(([label, value]) => (
            <div key={label} className="flex items-center gap-4 px-3 py-2">
              <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">
                {label}
              </p>
              <p className="text-sm font-medium text-gray-900">
                {isFilledValue(value) ? String(value) : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Card className="gap-4 py-5">
        <div className="flex items-center justify-between px-5">
          <p className="text-sm font-semibold text-gray-900">Documents</p>
          {canUpload && (
            <Button
              size="xs"
              onClick={() =>
                openModal(
                  "add-docs-2",
                  <AddDocumentsForm
                    isPending={docUploadMutation.isPending}
                    onSubmit={(inputs) =>
                      docUploadMutation.mutate(inputs, {
                        onSuccess: () => closeModal("add-docs-2"),
                      })
                    }
                    onClose={() => closeModal("add-docs-2")}
                  />,
                  {
                    title: "Add Documents",
                    description:
                      "Upload additional company documents (PDF, max 7MB each, max 10 files)",
                    panelClassName: "!w-full sm:!max-w-md",
                  },
                )
              }
            >
              <Upload className="mr-1 h-3.5 w-3.5" /> Add
            </Button>
          )}
        </div>
        <div className="space-y-1">
          {company.company_documents.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">No documents.</p>
          ) : (
            company.company_documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "flex flex-row items-center px-5 duration-200",
                  doc.url && "hover:cursor-pointer hover:bg-gray-50",
                )}
                onClick={() =>
                  doc.url &&
                  openModal(
                    "preview-doc",
                    doc.url ? (
                      <iframe
                        src={doc.url}
                        className="h-full w-full border-none"
                        title={doc.filename}
                      />
                    ) : (
                      <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                        Couldn&apos;t load that document.
                      </div>
                    ),
                    {
                      title: doc.filename,
                      panelClassName: "!w-full sm:!max-w-4xl",
                      contentClassName:
                        "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                      showHeaderDivider: true,
                    },
                  )
                }
              >
                <CircleCheck className="text-supportive flex-shrink-0" />
                <div className="flex flex-1 items-center gap-3 rounded-[0.16em] p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {doc.type === "other"
                        ? "Company document"
                        : formatLegacyLabel(doc.type)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {doc.filename}
                    </p>
                    {doc.expiry_date && (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        Expires {formatDateWithoutTime(doc.expiry_date)}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">MOA History</p>
        {canUpload && (
          <Button
            size="xs"
            onClick={() =>
              openModal(
                "moa-upload",
                <MoaUploadDialog
                  title="Add Legacy MOA"
                  description="Add an MOA record to this legacy company."
                  isPending={moaUploadMutation.isPending}
                  onClose={() => closeModal("moa-upload")}
                  onSubmit={(moas) => moaUploadMutation.mutate(moas)}
                />,
                {
                  title: "Add Legacy MOA",
                  description: "Add an MOA record to this legacy company.",
                  panelClassName: "!w-full sm:!max-w-2xl",
                },
              )
            }
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Add MOA
          </Button>
        )}
      </div>

      {company.moas.length > 0 ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="pb-2 pr-4 font-medium text-gray-500">Status</th>
              <th className="pb-2 pr-4 font-medium text-gray-500">Document</th>
              <th className="pb-2 pr-4 font-medium text-gray-500">Created</th>
              <th className="pb-2 font-medium text-gray-500">Period</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {company.moas.map((moa) => (
              <tr
                key={moa.id}
                className={cn(
                  "align-top",
                  moa.document_url && "cursor-pointer hover:bg-gray-50",
                )}
                onClick={() =>
                  moa.document_url &&
                  openModal(
                    "preview-doc-moa",
                    <iframe
                      src={moa.document_url}
                      className="h-full w-full border-none"
                      title={moa.filename ?? "MOA Document"}
                    />,
                    {
                      title: moa.filename ?? "MOA Document",
                      panelClassName: "!w-full sm:!max-w-4xl",
                      contentClassName:
                        "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                      showHeaderDivider: true,
                    },
                  )
                }
              >
                <td className="py-2.5 pr-4 text-gray-600">
                  <MoaStatusBadge
                    status="active"
                    isExpired={isLegacyMoaExpired(
                      moa.expiry_date,
                      moa.is_perpetual,
                    )}
                  />
                </td>
                <td className="py-2.5 pr-4 text-gray-600">
                  {moa.document_url ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Eye className="h-3.5 w-3.5" />{" "}
                      {moa.filename ?? "MOA Document"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-gray-600">
                  {formatDateWithoutTime(moa.created_at)}
                </td>
                <td className="py-2.5 text-gray-600">
                  {formatLegacyMoaPeriod(moa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground text-sm">No MOA history.</p>
      )}
    </div>
  );
}

interface MoaRecordInput {
  id: string;
  effectiveDate: string;
  expiryDate: string;
  isPerpetual: boolean;
  file: File | null;
  name: string;
}

function createEmptyMoaRecord(): MoaRecordInput {
  return {
    id: crypto.randomUUID(),
    effectiveDate: "",
    expiryDate: "",
    isPerpetual: false,
    file: null,
    name: "",
  };
}

// A row the user has started filling in (as opposed to a blank, never-touched row,
// which is fine to silently drop since MOAs are optional on these forms).
function isMoaRowTouched(m: MoaRecordInput): boolean {
  return (
    !!m.file ||
    !!m.effectiveDate ||
    !!m.expiryDate ||
    m.isPerpetual ||
    !!m.name.trim()
  );
}

function isMoaRowComplete(m: MoaRecordInput): boolean {
  return isMoaRowTouched(m);
}

function hasIncompleteMoa(moas: MoaRecordInput[]): boolean {
  return moas.some((m) => isMoaRowTouched(m) && !isMoaRowComplete(m));
}

export function buildMoaFormData(moas: MoaRecordInput[]) {
  const request = buildMoaRequest(moas);
  const formData = new FormData();
  formData.append("moas", request.moas);
  request.moaDocuments?.forEach((file) =>
    formData.append("moaDocuments", file),
  );
  return formData;
}

export function buildMoaRequest(moas: MoaRecordInput[]): AppendLegacyMoasDto {
  const moaPayload: {
    effective_date: string | null;
    expiry_date: string | null;
    is_perpetual: boolean;
    name: string | null;
    document_file_index: number | null;
  }[] = [];
  const moaFiles: File[] = [];

  for (const m of moas) {
    const isPerpetual = m.isPerpetual;
    if (!isMoaRowComplete(m)) continue;
    let document_file_index: number | null = null;
    if (m.file) {
      document_file_index = moaFiles.length;
      moaFiles.push(m.file);
    }
    moaPayload.push({
      effective_date: m.effectiveDate || null,
      expiry_date: isPerpetual ? null : m.expiryDate || null,
      is_perpetual: isPerpetual,
      name: m.name || null,
      document_file_index,
    });
  }

  return { moas: JSON.stringify(moaPayload), moaDocuments: moaFiles };
}

export function MoaUploadDialog({
  title,
  description,
  isPending,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (moas: MoaRecordInput[]) => void;
}) {
  const [moas, setMoas] = useState<MoaRecordInput[]>([createEmptyMoaRecord()]);
  const updateMoa = (id: string, patch: Partial<MoaRecordInput>) => {
    setMoas((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };
  const removeMoa = (id: string) => {
    setMoas((prev) => prev.filter((m) => m.id !== id));
  };
  // MOAs are optional when importing a partner. Only validate rows the user
  // actually started filling in; the initial blank row must not block saving
  // a company-only partner.
  const touchedMoas = moas.filter(isMoaRowTouched);
  const incompleteMoa = hasIncompleteMoa(touchedMoas);
  const hasValidMoa = moas.some(isMoaRowComplete) && !incompleteMoa;

  return (
    <>
      <div className="max-h-[65vh] space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <Label>MOA Records</Label>
          <Button
            size="xs"
            variant="outline"
            onClick={() => setMoas((prev) => [...prev, createEmptyMoaRecord()])}
          >
            <Plus /> Add MOA
          </Button>
        </div>
        {moas.map((moa, index) => (
          <div
            key={moa.id}
            className="rounded-[0.33em] border border-gray-200 p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-medium text-gray-500">
                MOA {index + 1}
              </p>
              {moas.length > 1 && (
                <Button
                  size="xs"
                  variant="ghost"
                  scheme="destructive"
                  onClick={() => removeMoa(moa.id)}
                >
                  Remove
                </Button>
              )}
            </div>
            <div className="mb-2 flex items-center gap-2">
              <input
                type="checkbox"
                id={`perpetual-${moa.id}`}
                className="h-4 w-4"
                checked={moa.isPerpetual}
                onChange={(e) =>
                  updateMoa(moa.id, {
                    isPerpetual: e.target.checked,
                    expiryDate: "",
                  })
                }
              />
              <Label
                htmlFor={`perpetual-${moa.id}`}
                className="text-xs cursor-pointer"
              >
                Perpetual MOA
              </Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Effective Date *</Label>
                <DatePicker
                  className="h-8"
                  value={moa.effectiveDate}
                  onChange={(value) =>
                    updateMoa(moa.id, { effectiveDate: value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">
                  {moa.isPerpetual ? "N/A" : "Expiry Date *"}
                </Label>
                <DatePicker
                  className="h-8"
                  value={moa.expiryDate}
                  disabled={moa.isPerpetual}
                  onChange={(value) => updateMoa(moa.id, { expiryDate: value })}
                />
              </div>
            </div>
            <div className="mt-2">
              <FileUpload
                label="MOA Document (PDF, optional, max 7MB)"
                name={`moa-document-${moa.id}`}
                accept=".pdf,application/pdf"
                onFileSelect={(file) => {
                  updateMoa(moa.id, { file, name: file?.name || "" });
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit(moas)}
          disabled={!hasValidMoa || isPending}
        >
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Save
        </Button>
      </div>
    </>
  );
}

export interface DocInput {
  id: string;
  file: File;
  type: string;
}

export function AddDocumentsForm({
  isPending,
  onSubmit,
  onClose,
}: {
  isPending: boolean;
  onSubmit: (inputs: DocInput[]) => void;
  onClose: () => void;
}) {
  const [inputs, setInputs] = useState<DocInput[]>([]);

  return (
    <div className="space-y-4">
      <FileUpload
        label="Company documents"
        name="company-documents"
        multiple
        accept=".pdf,application/pdf"
        placeholder="Click to upload PDF files"
        onFilesSelect={(files) => {
          const newInputs = files.map((f) => ({
            id: crypto.randomUUID(),
            file: f,
            type: "other",
          }));
          setInputs((prev) => [...prev, ...newInputs]);
        }}
      />
      {inputs.length > 0 && (
        <div className="space-y-3">
          {inputs.map((input) => (
            <div
              key={input.id}
              className="rounded-[0.33em] border border-gray-200 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">Document</p>
                <Button
                  size="xs"
                  variant="ghost"
                  scheme="destructive"
                  onClick={() =>
                    setInputs((prev) => prev.filter((i) => i.id !== input.id))
                  }
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type</Label>
                <Select
                  value={input.type}
                  onValueChange={(val) =>
                    setInputs((prev) =>
                      prev.map((i) =>
                        i.id === input.id ? { ...i, type: val } : i,
                      ),
                    )
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-xs"
                      >
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => onSubmit(inputs)}
          disabled={inputs.length === 0 || isPending}
        >
          {isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
          Upload
        </Button>
      </div>
    </div>
  );
}

export function UploadDialog({
  createRequest,
  queryKey,
  onClose,
}: {
  createRequest: (data: LegacyCompanyCreateInput) => Promise<unknown>;
  queryKey: QueryKey;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [companyName, setCompanyName] = useState("");
  const [moas, setMoas] = useState<MoaRecordInput[]>([createEmptyMoaRecord()]);
  const [tin, setTin] = useState("");
  const [companyType, setCompanyType] = useState("");
  const [registeredAddress, setRegisteredAddress] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [companyDocInputs, setCompanyDocInputs] = useState<
    { id: string; file: File; type: string }[]
  >([]);

  const updateMoa = (id: string, patch: Partial<MoaRecordInput>) => {
    setMoas((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  };

  const removeMoa = (id: string) => {
    setMoas((prev) => prev.filter((m) => m.id !== id));
  };

  const mutation = useMutation({
    mutationFn: () => {
      const moaRequest = buildMoaRequest(moas);
      return createRequest({
        company_name: companyName,
        ...moaRequest,
        tin: tin || undefined,
        company_type: companyType || undefined,
        registered_address: registeredAddress || undefined,
        contact_person: contactPerson || undefined,
        contact_email: contactEmail || undefined,
        contact_phone: contactPhone || undefined,
        companyDocuments: companyDocInputs.length
          ? companyDocInputs.map(({ file }) => file)
          : undefined,
        documentTypes: companyDocInputs.length
          ? JSON.stringify(companyDocInputs.map(({ type }) => type || "other"))
          : undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      onClose();
      toast("Legacy company saved", toastPresets.success);
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : "Failed to save legacy company",
        toastPresets.destructive,
      );
    },
  });

  // A partner may be imported before its MOA is available. Validate only
  // rows the user has started filling in.
  const touchedMoas = moas.filter(isMoaRowTouched);
  const incompleteMoa = hasIncompleteMoa(touchedMoas);
  const isValid = !!companyName.trim() && !incompleteMoa;

  return (
    <>
      <div className="max-h-[65vh] space-y-4 overflow-y-auto">
        <div className="space-y-2">
          <Label>Company Name *</Label>
          <Input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Corp"
          />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
          <Label>MOA Records (optional)</Label>
            <Button
              size="xs"
              variant="outline"
              onClick={() =>
                setMoas((prev) => [...prev, createEmptyMoaRecord()])
              }
            >
              <Plus /> Add MOA
            </Button>
          </div>
          {moas.map((moa, index) => (
            <div
              key={moa.id}
              className="rounded-[0.33em] border border-gray-200 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500">
                  MOA {index + 1}
                </p>
                {moas.length > 1 && (
                  <Button
                    size="xs"
                    variant="ghost"
                    scheme="destructive"
                    onClick={() => removeMoa(moa.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>
              <div className="mb-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  id={`perpetual-${moa.id}`}
                  className="h-4 w-4"
                  checked={moa.isPerpetual}
                  onChange={(e) =>
                    updateMoa(moa.id, {
                      isPerpetual: e.target.checked,
                      expiryDate: "",
                    })
                  }
                />
                <Label
                  htmlFor={`perpetual-${moa.id}`}
                  className="text-xs cursor-pointer"
                >
                  Perpetual MOA
                </Label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Effective Date *</Label>
                  <DatePicker
                    className="h-8"
                    value={moa.effectiveDate}
                    onChange={(value) =>
                      updateMoa(moa.id, { effectiveDate: value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">
                    {moa.isPerpetual ? "N/A" : "Expiry Date *"}
                  </Label>
                  <DatePicker
                    className="h-8"
                    value={moa.expiryDate}
                    disabled={moa.isPerpetual}
                    onChange={(value) =>
                      updateMoa(moa.id, { expiryDate: value })
                    }
                  />
                </div>
              </div>
              <div className="mt-2">
                <FileUpload
                  label="MOA Document (PDF, optional, max 7MB)"
                  name={`moa-document-${moa.id}`}
                  accept=".pdf,application/pdf"
                  onFileSelect={(file) => {
                    updateMoa(moa.id, { file, name: file?.name || "" });
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-gray-900">
            Company details (optional)
          </summary>
          <div className="mt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">TIN</Label>
                <Input
                  className="h-8"
                  value={tin}
                  onChange={(e) => setTin(e.target.value)}
                  placeholder="123-456-789"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Company Type</Label>
                <Select
                  value={companyType || undefined}
                  onValueChange={setCompanyType}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Select a type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Registered Address</Label>
              <Input
                className="h-8"
                value={registeredAddress}
                onChange={(e) => setRegisteredAddress(e.target.value)}
                placeholder="Makati City"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Person</Label>
                <Input
                  className="h-8"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Juan Dela Cruz"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Email</Label>
                <Input
                  type="email"
                  className="h-8"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="juan@example.com"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact Phone</Label>
              <Input
                className="h-8"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="09171234567"
              />
            </div>
          </div>
        </details>

        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-gray-900">
            Company documents (optional)
          </summary>
          <div className="mt-3 space-y-3">
            <div className="space-y-3">
              <FileUpload
                label="Company Documents (PDF, optional, max 7MB each, max 10)"
                name="company-documents"
                multiple
                accept=".pdf,application/pdf"
                placeholder="Click to upload PDF files"
                onFilesSelect={(files) => {
                  const newInputs = files.map((f) => ({
                    id: crypto.randomUUID(),
                    file: f,
                    type: "other",
                  }));
                  setCompanyDocInputs((prev) => [...prev, ...newInputs]);
                }}
              />
              {companyDocInputs.length > 0 && (
                <div className="space-y-3">
                  {companyDocInputs.map((input) => (
                    <div
                      key={input.id}
                      className="rounded-[0.33em] border border-gray-200 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-medium text-gray-500">
                          Document
                        </p>
                        <Button
                          size="xs"
                          variant="ghost"
                          scheme="destructive"
                          onClick={() =>
                            setCompanyDocInputs((prev) =>
                              prev.filter((i) => i.id !== input.id),
                            )
                          }
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={input.type}
                            onValueChange={(val) =>
                              setCompanyDocInputs((prev) =>
                                prev.map((i) =>
                                  i.id === input.id ? { ...i, type: val } : i,
                                ),
                              )
                            }
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                                <SelectItem
                                  key={opt.value}
                                  value={opt.value}
                                  className="text-xs"
                                >
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </details>
      </div>
      <div className="flex justify-end gap-2 pt-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() => mutation.mutate()}
          disabled={!isValid || mutation.isPending}
        >
          {mutation.isPending && (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          )}
          Save
        </Button>
      </div>
    </>
  );
}

interface BulkCsvRowResult {
  row: number;
  company_name: string;
  status:
    | "created_company"
    | "appended_moa"
    | "updated_company"
    | "invalid"
    | "failed";
  message?: string;
}

type BulkUploadResult = {
  summary: {
    createdCompanies: number;
    appendedMoas: number;
    invalid: number;
    failed: number;
  };
  results: BulkCsvRowResult[];
};

export function normalizeBulkUploadResult(result: {
  summary: BulkUploadResult["summary"];
  results: Array<{
    row: number;
    company_name: string;
    status: string;
    message?: string;
  }>;
}): BulkUploadResult {
  return {
    summary: result.summary,
    results: result.results.map((row) => ({
      ...row,
      status:
        row.status === "created_company" ||
        row.status === "appended_moa" ||
        row.status === "updated_company" ||
        row.status === "invalid"
          ? row.status
          : "failed",
    })),
  };
}

interface CsvUploadDialogProps {
  uploadRequest: (file: File) => Promise<BulkUploadResult>;
  queryKey: QueryKey;
  onClose: () => void;
}

export function CsvUploadDialog({
  uploadRequest,
  queryKey,
  onClose,
}: CsvUploadDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    summary: {
      createdCompanies: number;
      appendedMoas: number;
      invalid: number;
      failed: number;
    };
    results: BulkCsvRowResult[];
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) return;
      return uploadRequest(file);
    },
    onSuccess: (data) => {
      if (!data) return;
      setResult(data);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast("CSV upload failed", toastPresets.destructive);
    },
  });

  const columns = [
    {
      name: "company_name",
      required: true,
      description: "Company/partner name",
      example: "Acme Corporation",
    },
    {
      name: "effective_date",
      required: false,
      description:
        "MOA start date (YYYY-MM-DD). Required when adding a normal MOA",
      example: "2023-01-15",
    },
    {
      name: "expiry_date",
      required: false,
      description:
        "MOA expiry date (YYYY-MM-DD). Required when adding a normal MOA",
      example: "2025-01-15",
    },
    {
      name: "is_perpetual",
      required: false,
      description: 'Set to "true"/"yes"/"1" for a perpetual MOA (no expiry)',
      example: "true",
    },
    {
      name: "tin",
      required: false,
      description: "Company TIN",
      example: "123-456-789",
    },
    {
      name: "company_type",
      required: false,
      description: "Type/category of company",
      example: "Corporation",
    },
    {
      name: "registered_address",
      required: false,
      description: "Registered company address",
      example: "Makati City",
    },
    {
      name: "contact_person",
      required: false,
      description: "Main contact person",
      example: "Juan Dela Cruz",
    },
    {
      name: "contact_email",
      required: false,
      description: "Contact email address",
      example: "juan@example.com",
    },
    {
      name: "contact_phone",
      required: false,
      description: "Contact phone number",
      example: "09171234567",
    },
  ];

  const sampleRow: Record<string, string> = {
    company_name: "Acme Corporation",
    effective_date: "2023-01-15",
    expiry_date: "2025-01-15",
    is_perpetual: "false",
    tin: "123-456-789",
    company_type: "Corporation",
    registered_address: "Makati City",
    contact_person: "Juan Dela Cruz",
    contact_email: "juan@example.com",
    contact_phone: "09171234567",
  };

  const downloadTemplate = () => {
    const headerRow = columns.map((c) => c.name);
    const sampleRowData = columns.map((c) => sampleRow[c.name]);
    const csvContent = [headerRow.join(","), sampleRowData.join(",")].join(
      "\n",
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "legacy-moa-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="overflow-y-auto max-h-[60vh] space-y-4 -mx-6 px-6">
        {!result && (
          <>
            <p className="text-sm font-medium">
              Required columns:{" "}
              <span className="font-normal text-muted-foreground">
                company_name
              </span>
            </p>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Column</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Required
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.map((col) => (
                    <tr key={col.name} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">
                        {col.name}
                      </td>
                      <td className="px-3 py-2">
                        {col.required ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {col.description}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {col.example}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Template preview</Label>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  Download Template
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {columns.map((col) => (
                        <th
                          key={col.name}
                          className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      {columns.map((col) => (
                        <td
                          key={col.name}
                          className="px-2 py-1.5 whitespace-nowrap text-muted-foreground"
                        >
                          {sampleRow[col.name]}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-muted-foreground">
                      {columns.map((col) => (
                        <td
                          key={col.name}
                          className="px-2 py-1.5 whitespace-nowrap"
                        >
                          {col.required ? "..." : ""}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Each row creates or updates one legacy company. To add a normal
                MOA, include both effective_date and expiry_date. To add a
                perpetual MOA (no expiry), set is_perpetual to "true"
                (effective_date is optional). Wrap values containing commas in
                double quotes (e.g.{" "}
                <code className="text-xs">&quot;Acme, Inc.&quot;</code>). Use
                two double quotes to escape a literal quote (e.g.{" "}
                <code className="text-xs">
                  &quot;Acme &quot;&quot;The Best&quot;&quot; Inc.&quot;
                </code>
                ). Invalid rows are skipped; valid rows are still uploaded.
              </p>
            </div>

            <div className="space-y-2">
              <FileUpload
                label="CSV File"
                name="csv-file"
                accept=".csv,text/csv"
                placeholder="Click to upload CSV file"
                onFileSelect={setFile}
              />
            </div>

            <Button
              onClick={() => mutation.mutate()}
              disabled={!file || mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Upload
            </Button>
          </>
        )}

        {result && (
          <div className="space-y-4">
            <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {result.summary.createdCompanies}
                </p>
                <p className="text-xs text-muted-foreground">New companies</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {result.summary.appendedMoas}
                </p>
                <p className="text-xs text-muted-foreground">MOAs appended</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">
                  {result.summary.invalid}
                </p>
                <p className="text-xs text-muted-foreground">Invalid rows</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {result.summary.failed}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </Card>

            {result.results.filter(
              (r) =>
                r.status !== "created_company" &&
                r.status !== "appended_moa" &&
                r.status !== "updated_company",
            ).length > 0 && (
              <div>
                <p className="font-medium mb-2">Row details</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {result.results.map((r) => (
                    <div
                      key={r.row}
                      className={`text-sm p-2 rounded ${r.status === "invalid" || r.status === "failed" ? "bg-red-50" : "bg-green-50"}`}
                    >
                      <span className="font-medium">Row {r.row}:</span>{" "}
                      <span
                        className={
                          r.status === "created_company" ||
                          r.status === "appended_moa" ||
                          r.status === "updated_company"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {r.company_name} — {r.status.replace(/_/g, " ")}
                      </span>
                      {r.message && (
                        <span className="text-muted-foreground ml-1">
                          ({r.message})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        {result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </>
  );
}

interface ZipUploadDialogProps {
  uploadRequest: (file: File) => Promise<BulkUploadResult>;
  queryKey: QueryKey;
  onClose: () => void;
}

export function ZipUploadDialog({
  uploadRequest,
  queryKey,
  onClose,
}: ZipUploadDialogProps) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<{
    summary: {
      createdCompanies: number;
      appendedMoas: number;
      invalid: number;
      failed: number;
    };
    results: BulkCsvRowResult[];
  } | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) return;
      return uploadRequest(file);
    },
    onSuccess: (data) => {
      if (!data) return;
      setResult(data);
      queryClient.invalidateQueries({ queryKey });
    },
    onError: () => {
      toast("ZIP upload failed", toastPresets.destructive);
    },
  });

  const csvColumns = [
    {
      name: "company_name",
      required: true,
      description: "Company/partner name",
      example: "Acme Corporation",
    },
    {
      name: "effective_date",
      required: false,
      description:
        "MOA start date (YYYY-MM-DD). Required when adding a normal MOA",
      example: "2023-01-15",
    },
    {
      name: "expiry_date",
      required: false,
      description:
        "MOA expiry date (YYYY-MM-DD). Required when adding a normal MOA",
      example: "2025-01-15",
    },
    {
      name: "is_perpetual",
      required: false,
      description: 'Set to "true"/"yes"/"1" for a perpetual MOA (no expiry)',
      example: "true",
    },
    {
      name: "moa_file",
      required: false,
      description:
        "Path to MOA PDF inside ZIP. Requires normal MOA dates or is_perpetual=true",
      example: "moas/acme-2024.pdf",
    },
    {
      name: "business_permit_file",
      required: false,
      description: "Path to business permit PDF inside ZIP",
      example: "company-documents/acme-permit.pdf",
    },
    {
      name: "mayor_permit_file",
      required: false,
      description: "Path to mayor's permit PDF inside ZIP",
      example: "company-documents/acme-mayor.pdf",
    },
    {
      name: "sec_dti_registration_file",
      required: false,
      description: "Path to SEC/DTI registration PDF inside ZIP",
      example: "company-documents/acme-sec.pdf",
    },
    {
      name: "tin",
      required: false,
      description: "Company TIN",
      example: "123-456-789",
    },
    {
      name: "company_type",
      required: false,
      description: "Type/category of company",
      example: "Corporation",
    },
    {
      name: "registered_address",
      required: false,
      description: "Registered company address",
      example: "Makati City",
    },
    {
      name: "contact_person",
      required: false,
      description: "Main contact person",
      example: "Juan Dela Cruz",
    },
    {
      name: "contact_email",
      required: false,
      description: "Contact email address",
      example: "juan@example.com",
    },
    {
      name: "contact_phone",
      required: false,
      description: "Contact phone number",
      example: "09171234567",
    },
  ];

  const sampleRow: Record<string, string> = {
    company_name: "Acme Corporation",
    effective_date: "2023-01-15",
    expiry_date: "2025-01-15",
    is_perpetual: "false",
    moa_file: "moas/acme-2024.pdf",
    business_permit_file: "company-documents/acme-permit.pdf",
    mayor_permit_file: "company-documents/acme-mayor.pdf",
    sec_dti_registration_file: "",
    tin: "123-456-789",
    company_type: "Corporation",
    registered_address: "Makati City",
    contact_person: "Juan Dela Cruz",
    contact_email: "juan@example.com",
    contact_phone: "09171234567",
  };

  const downloadTemplate = () => {
    const headerRow = csvColumns.map((c) => c.name);
    const sampleRowData = csvColumns.map((c) => sampleRow[c.name]);
    const csvContent = [headerRow.join(","), sampleRowData.join(",")].join(
      "\n",
    );
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "legacy-moa-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="overflow-y-auto max-h-[60vh] space-y-4 -mx-6 px-6">
        {!result && (
          <>
            <p className="text-sm font-medium">
              Required columns:{" "}
              <span className="font-normal text-muted-foreground">
                company_name
              </span>
            </p>

            <Card className="p-4 space-y-2 text-sm">
              <p className="font-medium">ZIP structure</p>
              <pre className="text-xs bg-muted p-2 rounded-md font-mono">
                {`legacy-import.csv
moas/acme-2024.pdf
company-documents/acme-permit.pdf
company-documents/acme-mayor.pdf`}
              </pre>
              <p className="text-muted-foreground">
                The <code className="text-xs">legacy-import.csv</code> manifest
                references files by their path inside the ZIP (e.g.{" "}
                <code className="text-xs">moas/acme-2024.pdf</code>).
              </p>
            </Card>

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium">Column</th>
                    <th className="px-3 py-2 text-left font-medium">
                      Required
                    </th>
                    <th className="px-3 py-2 text-left font-medium">
                      Description
                    </th>
                    <th className="px-3 py-2 text-left font-medium">Example</th>
                  </tr>
                </thead>
                <tbody>
                  {csvColumns.map((col) => (
                    <tr key={col.name} className="border-b last:border-0">
                      <td className="px-3 py-2 font-mono text-xs">
                        {col.name}
                      </td>
                      <td className="px-3 py-2">
                        {col.required ? "Yes" : "No"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {col.description}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">
                        {col.example}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Template preview</Label>
                <Button variant="outline" size="sm" onClick={downloadTemplate}>
                  Download Template
                </Button>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {csvColumns.map((col) => (
                        <th
                          key={col.name}
                          className="px-2 py-1.5 text-left font-medium whitespace-nowrap"
                        >
                          {col.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      {csvColumns.map((col) => (
                        <td
                          key={col.name}
                          className="px-2 py-1.5 whitespace-nowrap text-muted-foreground"
                        >
                          {sampleRow[col.name]}
                        </td>
                      ))}
                    </tr>
                    <tr className="text-muted-foreground">
                      {csvColumns.map((col) => (
                        <td
                          key={col.name}
                          className="px-2 py-1.5 whitespace-nowrap"
                        >
                          {col.required ? "..." : ""}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Each row creates or updates one legacy company. To add a normal
                MOA, include both effective_date and expiry_date. To add a
                perpetual MOA (no expiry), set is_perpetual to "true"
                (effective_date is optional). A moa_file requires a normal MOA
                (dates) or is_perpetual=true. File columns reference paths
                inside the ZIP. Invalid rows are skipped; valid rows are still
                uploaded. Wrap values containing commas in double quotes.
              </p>
            </div>

            <div className="space-y-2">
              <FileUpload
                label="ZIP File"
                name="zip-file"
                accept=".zip,application/zip"
                placeholder="Click to upload ZIP file"
                onFileSelect={setFile}
              />
            </div>

            <Button
              onClick={() => mutation.mutate()}
              disabled={!file || mutation.isPending}
            >
              {mutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Upload
            </Button>
          </>
        )}

        {result && (
          <div className="space-y-4">
            <Card className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-green-600">
                  {result.summary.createdCompanies}
                </p>
                <p className="text-xs text-muted-foreground">New companies</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">
                  {result.summary.appendedMoas}
                </p>
                <p className="text-xs text-muted-foreground">MOAs appended</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">
                  {result.summary.invalid}
                </p>
                <p className="text-xs text-muted-foreground">Invalid rows</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600">
                  {result.summary.failed}
                </p>
                <p className="text-xs text-muted-foreground">Failed</p>
              </div>
            </Card>

            {result.results.filter(
              (r) =>
                r.status !== "created_company" &&
                r.status !== "appended_moa" &&
                r.status !== "updated_company",
            ).length > 0 && (
              <div>
                <p className="font-medium mb-2">Row details</p>
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {result.results.map((r) => (
                    <div
                      key={r.row}
                      className={`text-sm p-2 rounded ${r.status === "invalid" || r.status === "failed" ? "bg-red-50" : "bg-green-50"}`}
                    >
                      <span className="font-medium">Row {r.row}:</span>{" "}
                      <span
                        className={
                          r.status === "created_company" ||
                          r.status === "appended_moa" ||
                          r.status === "updated_company"
                            ? "text-green-700"
                            : "text-red-700"
                        }
                      >
                        {r.company_name} — {r.status.replace(/_/g, " ")}
                      </span>
                      {r.message && (
                        <span className="text-muted-foreground ml-1">
                          ({r.message})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-4">
        {result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </>
  );
}
