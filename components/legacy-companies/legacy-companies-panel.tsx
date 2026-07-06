"use client";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import {
  Dialog,
  DialogContent,
  DialogBottomSheet,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";

export interface LegacyCompanySummary {
  id: string;
  company_name: string;
  company_details: Record<string, unknown>;
  moaCount: number;
  documentCount: number;
  valid_until: string | null;
}

export interface LegacyCompanyDetail {
  id: string;
  company_name: string;
  company_details: Record<string, unknown>;
  company_documents: {
    id: string;
    type: string;
    filename: string;
    url: string | null;
    expiry_date: string | null;
    uploaded_at: string;
  }[];
  moas: {
    id: string;
    effective_date: string;
    expiry_date: string;
    document_url: string | null;
    filename: string | null;
    notes: string | null;
    created_at: string;
  }[];
}

type LegacyCompaniesPanelProps = {
  listEndpoint: string;
  uploadEndpoint: string;
  detailEndpoint: (legacyCompanyId: string) => string;
  addDocumentsEndpoint: (legacyCompanyId: string) => string;
  bulkCsvEndpoint?: string;
  bulkZipEndpoint?: string;
  canUpload: boolean;
  queryKeyPrefix: string;
  selectedId?: string | null;
  onSelectedIdChange?: (id: string | null) => void;
  showDetailBackButton?: boolean;
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

export function isLegacyMoaExpired(expiryDate: string) {
  const today = new Date().toISOString().slice(0, 10);
  return expiryDate < today;
}

export function LegacyCompaniesPanel({
  listEndpoint,
  uploadEndpoint,
  detailEndpoint,
  addDocumentsEndpoint,
  bulkCsvEndpoint,
  bulkZipEndpoint,
  canUpload,
  queryKeyPrefix,
  selectedId: controlledSelectedId,
  onSelectedIdChange,
  showDetailBackButton = true,
}: LegacyCompaniesPanelProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(
    null,
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [zipUploadOpen, setZipUploadOpen] = useState(false);
  const selectedId =
    controlledSelectedId !== undefined
      ? controlledSelectedId
      : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    if (onSelectedIdChange) onSelectedIdChange(id);
    else setInternalSelectedId(id);
  };

  const { data, isLoading } = useQuery({
    queryKey: [queryKeyPrefix],
    queryFn: () =>
      preconfiguredAxios
        .get(listEndpoint)
        .then((r) => r.data as { legacyCompanies: LegacyCompanySummary[] }),
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
      <DetailView
        legacyCompanyId={selectedId}
        detailEndpoint={detailEndpoint}
        addDocumentsEndpoint={addDocumentsEndpoint}
        canUpload={canUpload}
        queryKeyPrefix={queryKeyPrefix}
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
          id={`${queryKeyPrefix}-table`}
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
                  onClick={() => setUploadOpen(true)}
                  className={(bulkCsvEndpoint || bulkZipEndpoint) ? "rounded-r-none" : undefined}
                >
                  <Plus /> Upload Legacy MOA
                </Button>
                {(bulkCsvEndpoint || bulkZipEndpoint) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="rounded-l-none border-l-0 px-2">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {bulkCsvEndpoint && (
                        <DropdownMenuItem onSelect={() => setCsvUploadOpen(true)}>
                          <Upload className="h-4 w-4" />
                          Bulk upload via CSV
                        </DropdownMenuItem>
                      )}
                      {bulkZipEndpoint && (
                        <DropdownMenuItem onSelect={() => setZipUploadOpen(true)}>
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

      {uploadOpen && (
        <UploadDialog
          uploadEndpoint={uploadEndpoint}
          queryKeyPrefix={queryKeyPrefix}
          onClose={() => setUploadOpen(false)}
        />
      )}

      {csvUploadOpen && bulkCsvEndpoint && (
        <CsvUploadDialog
          csvEndpoint={bulkCsvEndpoint}
          queryKeyPrefix={queryKeyPrefix}
          onClose={() => setCsvUploadOpen(false)}
        />
      )}

      {zipUploadOpen && bulkZipEndpoint && (
        <ZipUploadDialog
          zipEndpoint={bulkZipEndpoint}
          queryKeyPrefix={queryKeyPrefix}
          onClose={() => setZipUploadOpen(false)}
        />
      )}
    </div>
  );
}

function DetailView({
  legacyCompanyId,
  detailEndpoint,
  addDocumentsEndpoint,
  canUpload,
  queryKeyPrefix,
  showBackButton,
  onBack,
}: {
  legacyCompanyId: string;
  detailEndpoint: (id: string) => string;
  addDocumentsEndpoint: (id: string) => string;
  canUpload: boolean;
  queryKeyPrefix: string;
  showBackButton: boolean;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [previewDoc, setPreviewDoc] = useState<{
    url: string;
    title: string;
  } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [companyDocInputs, setCompanyDocInputs] = useState<
    { id: string; file: File; type: string }[]
  >([]);

  const { data, isLoading } = useQuery({
    queryKey: [queryKeyPrefix, "detail", legacyCompanyId],
    queryFn: () =>
      preconfiguredAxios
        .get(detailEndpoint(legacyCompanyId))
        .then((r) => r.data as { legacyCompany: LegacyCompanyDetail }),
  });

  const company = data?.legacyCompany;

  const docUploadMutation = useMutation({
    mutationFn: (inputs: { id: string; file: File; type: string }[]) => {
      const formData = new FormData();
      const documentTypes: string[] = [];
      inputs.forEach(({ file, type }) => {
        formData.append("companyDocuments", file);
        documentTypes.push(type || "other");
      });
      formData.append("documentTypes", JSON.stringify(documentTypes));
      return preconfiguredAxios.post(
        addDocumentsEndpoint(legacyCompanyId),
        formData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      queryClient.invalidateQueries({
        queryKey: [queryKeyPrefix, "detail", legacyCompanyId],
      });
      setUploadOpen(false);
      setCompanyDocInputs([]);
      toast("Documents uploaded", toastPresets.success);
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : "Failed to upload documents",
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
        <h3 className="font-semibold text-gray-900">{company.company_name}</h3>
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
            <Button size="xs" onClick={() => setUploadOpen(true)}>
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
                  setPreviewDoc({ url: doc.url, title: doc.filename })
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
                  setPreviewDoc({
                    url: moa.document_url,
                    title: moa.filename ?? "MOA Document",
                  })
                }
              >
                <td className="py-2.5 pr-4 text-gray-600">
                  <MoaStatusBadge
                    status="active"
                    isExpired={isLegacyMoaExpired(moa.expiry_date)}
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
                  {formatDateWithoutTime(moa.effective_date)} –{" "}
                  {formatDateWithoutTime(moa.expiry_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground text-sm">No MOA history.</p>
      )}

      <Dialog
        open={!!previewDoc}
        onOpenChange={(o) => {
          if (!o) setPreviewDoc(null);
        }}
      >
        <DialogBottomSheet className="flex h-[88vh] flex-col p-0">
          <div className="flex items-center border-b border-gray-100 px-5 py-3.5 pr-14">
            <DialogTitle className="text-sm font-medium text-gray-900">
              {previewDoc?.title ?? "Document"}
            </DialogTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {previewDoc?.url ? (
              <iframe
                src={previewDoc.url}
                className="h-full w-full border-none"
                title={previewDoc?.title}
              />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                Couldn&apos;t load that document.
              </div>
            )}
          </div>
        </DialogBottomSheet>
      </Dialog>

      <Dialog
        open={uploadOpen}
        onOpenChange={(o) => {
          if (!o) {
            setUploadOpen(false);
            setCompanyDocInputs([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Documents</DialogTitle>
            <DialogDescription>
              Upload additional company documents (PDF, max 2.5MB each, max 10
              files)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="file"
              multiple
              accept=".pdf,application/pdf"
              onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                const newInputs = Array.from(files).map((f) => ({
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
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
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
                        <SelectTrigger className="h-7 text-xs">
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
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUploadOpen(false);
                setCompanyDocInputs([]);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                companyDocInputs.length > 0 &&
                docUploadMutation.mutate(companyDocInputs)
              }
              disabled={
                companyDocInputs.length === 0 || docUploadMutation.isPending
              }
            >
              {docUploadMutation.isPending && (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              )}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface MoaRecordInput {
  id: string;
  effectiveDate: string;
  expiryDate: string;
  file: File | null;
  name: string;
}

function createEmptyMoaRecord(): MoaRecordInput {
  return {
    id: crypto.randomUUID(),
    effectiveDate: "",
    expiryDate: "",
    file: null,
    name: "",
  };
}

function UploadDialog({
  uploadEndpoint,
  queryKeyPrefix,
  onClose,
}: {
  uploadEndpoint: string;
  queryKeyPrefix: string;
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
      const formData = new FormData();
      formData.append("company_name", companyName);

      const moaPayload: {
        effective_date: string;
        expiry_date: string;
        name: string | null;
        document_file_index: number | null;
      }[] = [];
      const moaFiles: File[] = [];

      for (const m of moas) {
        if (!m.effectiveDate || !m.expiryDate) continue;
        let document_file_index: number | null = null;
        if (m.file) {
          document_file_index = moaFiles.length;
          moaFiles.push(m.file);
        }
        moaPayload.push({
          effective_date: m.effectiveDate,
          expiry_date: m.expiryDate,
          name: m.name || null,
          document_file_index,
        });
      }

      formData.append("moas", JSON.stringify(moaPayload));
      moaFiles.forEach((f) => formData.append("moaDocuments", f));

      if (tin) formData.append("tin", tin);
      if (companyType) formData.append("company_type", companyType);
      if (registeredAddress)
        formData.append("registered_address", registeredAddress);
      if (contactPerson) formData.append("contact_person", contactPerson);
      if (contactEmail) formData.append("contact_email", contactEmail);
      if (contactPhone) formData.append("contact_phone", contactPhone);
      if (companyDocInputs.length > 0) {
        const documentTypes: string[] = [];
        companyDocInputs.forEach(({ file, type }) => {
          formData.append("companyDocuments", file);
          documentTypes.push(type || "other");
        });
        formData.append("documentTypes", JSON.stringify(documentTypes));
      }
      return preconfiguredAxios.post(uploadEndpoint, formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      onClose();
      toast("Legacy MOA created", toastPresets.success);
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : "Failed to create legacy MOA",
        toastPresets.destructive,
      );
    },
  });

  const hasValidMoa = moas.some((m) => m.effectiveDate && m.expiryDate);
  const isValid = companyName.trim() && hasValidMoa;

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Legacy MOA</DialogTitle>
          <DialogDescription>
            Record one or more pre-existing MOA partnerships with a company.
          </DialogDescription>
        </DialogHeader>
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
              <Label>MOA Records</Label>
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
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Effective Date *</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={moa.effectiveDate}
                      onChange={(e) =>
                        updateMoa(moa.id, { effectiveDate: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Expiry Date *</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={moa.expiryDate}
                      onChange={(e) =>
                        updateMoa(moa.id, { expiryDate: e.target.value })
                      }
                    />
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  <Label className="text-xs">
                    MOA Document (PDF, optional, max 2.5MB)
                  </Label>
                  <Input
                    type="file"
                    className="h-8 text-xs"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
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
                    className="h-8 text-xs"
                    value={tin}
                    onChange={(e) => setTin(e.target.value)}
                    placeholder="123-456-789"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company Type</Label>
                  <Input
                    className="h-8 text-xs"
                    value={companyType}
                    onChange={(e) => setCompanyType(e.target.value)}
                    placeholder="corporation"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Registered Address</Label>
                <Input
                  className="h-8 text-xs"
                  value={registeredAddress}
                  onChange={(e) => setRegisteredAddress(e.target.value)}
                  placeholder="Makati City"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Person</Label>
                  <Input
                    className="h-8 text-xs"
                    value={contactPerson}
                    onChange={(e) => setContactPerson(e.target.value)}
                    placeholder="Juan Dela Cruz"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Email</Label>
                  <Input
                    type="email"
                    className="h-8 text-xs"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="juan@example.com"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Phone</Label>
                <Input
                  className="h-8 text-xs"
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
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Company Documents (PDF, optional, max 2.5MB each, max 10)
                </Label>
                <Input
                  type="file"
                  multiple
                  className="h-8 text-xs"
                  accept=".pdf,application/pdf"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (!files) return;
                    const newInputs = Array.from(files).map((f) => ({
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
                              <SelectTrigger className="h-7 text-xs">
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
        <DialogFooter>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BulkCsvRowResult {
  row: number;
  company_name: string;
  status: "created_company" | "appended_moa" | "invalid" | "failed";
  message?: string;
}

interface CsvUploadDialogProps {
  csvEndpoint: string;
  queryKeyPrefix: string;
  onClose: () => void;
}

function CsvUploadDialog({
  csvEndpoint,
  queryKeyPrefix,
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
      const formData = new FormData();
      formData.append("file", file);
      const r = await preconfiguredAxios.post(csvEndpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return r.data as {
        summary: {
          createdCompanies: number;
          appendedMoas: number;
          invalid: number;
          failed: number;
        };
        results: BulkCsvRowResult[];
      };
    },
    onSuccess: (data) => {
      if (!data) return;
      setResult(data);
      if (data.summary.createdCompanies + data.summary.appendedMoas > 0) {
        queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      }
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
      required: true,
      description: "MOA start date (YYYY-MM-DD)",
      example: "2023-01-15",
    },
    {
      name: "expiry_date",
      required: true,
      description: "MOA expiry date (YYYY-MM-DD)",
      example: "2025-01-15",
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Legacy MOAs</DialogTitle>
          <DialogDescription>
            Upload a CSV file to create or append multiple legacy MOAs at once.
            Each row represents one legacy MOA. Rows with the same company name
            append MOAs to the same legacy partner.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] -mx-6 px-6 space-y-4">
          {!result && (
            <>
              <p className="text-sm font-medium">
                Required columns:{" "}
                <span className="font-normal text-muted-foreground">
                  company_name, effective_date, expiry_date
                </span>
              </p>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">
                        Column
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Required
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Description
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Example
                      </th>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                  >
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
                  Each row is one MOA. At least company_name, effective_date,
                  and expiry_date are required. Wrap values containing commas in
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
                <Label htmlFor="csv-file">CSV File</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                  r.status !== "created_company" && r.status !== "appended_moa",
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
                            r.status === "appended_moa"
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

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ZipUploadDialogProps {
  zipEndpoint: string;
  queryKeyPrefix: string;
  onClose: () => void;
}

function ZipUploadDialog({
  zipEndpoint,
  queryKeyPrefix,
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
      const formData = new FormData();
      formData.append("file", file);
      const r = await preconfiguredAxios.post(zipEndpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return r.data as {
        summary: {
          createdCompanies: number;
          appendedMoas: number;
          invalid: number;
          failed: number;
        };
        results: BulkCsvRowResult[];
      };
    },
    onSuccess: (data) => {
      if (!data) return;
      setResult(data);
      if (data.summary.createdCompanies + data.summary.appendedMoas > 0) {
        queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      }
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
      required: true,
      description: "MOA start date (YYYY-MM-DD)",
      example: "2023-01-15",
    },
    {
      name: "expiry_date",
      required: true,
      description: "MOA expiry date (YYYY-MM-DD)",
      example: "2025-01-15",
    },
    {
      name: "moa_file",
      required: false,
      description: "Path to MOA PDF inside ZIP",
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>Bulk Upload Legacy MOAs via ZIP</DialogTitle>
          <DialogDescription>
            Upload a ZIP file containing a{" "}
            <code className="text-xs">legacy-import.csv</code> manifest and
            referenced PDF files. Each CSV row represents one legacy MOA.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[60vh] -mx-6 px-6 space-y-4">
          {!result && (
            <>
              <p className="text-sm font-medium">
                Required columns:{" "}
                <span className="font-normal text-muted-foreground">
                  company_name, effective_date, expiry_date
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
                  The <code className="text-xs">legacy-import.csv</code>{" "}
                  manifest references files by their path inside the ZIP (e.g.{" "}
                  <code className="text-xs">moas/acme-2024.pdf</code>).
                </p>
              </Card>

              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">
                        Column
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Required
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Description
                      </th>
                      <th className="px-3 py-2 text-left font-medium">
                        Example
                      </th>
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadTemplate}
                  >
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
                  Each row is one MOA. At least company_name, effective_date,
                  and expiry_date are required. File columns reference paths
                  inside the ZIP. Invalid rows are skipped; valid rows are still
                  uploaded. Wrap values containing commas in double quotes.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="zip-file">ZIP File</Label>
                <Input
                  id="zip-file"
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
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
                  r.status !== "created_company" && r.status !== "appended_moa",
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
                            r.status === "appended_moa"
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

        <DialogFooter>
          {result ? (
            <Button onClick={onClose}>Done</Button>
          ) : (
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
