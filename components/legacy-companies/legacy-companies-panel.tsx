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
import { formatDateWithoutTime, cn } from "@/lib/utils";
import { ArrowLeft, CircleCheck, Eye, Loader2, Plus, Upload, X } from "lucide-react";
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
  "business_permit",
  "sec_dti_registration",
  "mayor_permit",
  "corporate_secretary_certificate",
  "board_resolution",
  "other",
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
  canUpload,
  queryKeyPrefix,
  selectedId: controlledSelectedId,
  onSelectedIdChange,
  showDetailBackButton = true,
}: LegacyCompaniesPanelProps) {
  const [internalSelectedId, setInternalSelectedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const selectedId = controlledSelectedId !== undefined ? controlledSelectedId : internalSelectedId;
  const setSelectedId = (id: string | null) => {
    if (onSelectedIdChange) onSelectedIdChange(id);
    else setInternalSelectedId(id);
  };

  const { data, isLoading } = useQuery({
    queryKey: [queryKeyPrefix],
    queryFn: () =>
      preconfiguredAxios.get(listEndpoint).then((r) => r.data as { legacyCompanies: LegacyCompanySummary[] }),
  });

  const legacyCompanies = data?.legacyCompanies ?? [];

  const columns = useMemo<ColumnDef<LegacyCompanySummary>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.company_name,
        cell: ({ row }) => (
          <span className="font-medium text-gray-900">{row.original.company_name}</span>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => {
          const type = (row.company_details as Record<string, string>)?.company_type;
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
          toolbarActions={canUpload ? (
            <Button onClick={() => setUploadOpen(true)}>
              <Plus /> Upload Legacy MOA
            </Button>
          ) : undefined}
        />
      )}

      {uploadOpen && (
        <UploadDialog
          uploadEndpoint={uploadEndpoint}
          queryKeyPrefix={queryKeyPrefix}
          onClose={() => setUploadOpen(false)}
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
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [companyDocInputs, setCompanyDocInputs] = useState<{ id: string; file: File; filename: string; expiryDate: string; type: string }[]>([]);

  const { data, isLoading } = useQuery({
    queryKey: [queryKeyPrefix, "detail", legacyCompanyId],
    queryFn: () =>
      preconfiguredAxios
        .get(detailEndpoint(legacyCompanyId))
        .then((r) => r.data as { legacyCompany: LegacyCompanyDetail }),
  });

  const company = data?.legacyCompany;

  const docUploadMutation = useMutation({
    mutationFn: (inputs: { id: string; file: File; filename: string; expiryDate: string; type: string }[]) => {
      const formData = new FormData();
      const documentNames: string[] = [];
      const documentExpiryDates: (string | null)[] = [];
      const documentTypes: string[] = [];
      inputs.forEach(({ file, filename, expiryDate, type }) => {
        formData.append("companyDocuments", file);
        documentNames.push(filename);
        documentExpiryDates.push(expiryDate || null);
        documentTypes.push(type || "other");
      });
      formData.append("documentNames", JSON.stringify(documentNames));
      formData.append("documentExpiryDates", JSON.stringify(documentExpiryDates));
      formData.append("documentTypes", JSON.stringify(documentTypes));
      return preconfiguredAxios.post(addDocumentsEndpoint(legacyCompanyId), formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [queryKeyPrefix] });
      queryClient.invalidateQueries({ queryKey: [queryKeyPrefix, "detail", legacyCompanyId] });
      setUploadOpen(false);
      setCompanyDocInputs([]);
      toast("Documents uploaded", toastPresets.success);
    },
    onError: (err) => {
      toast(err instanceof Error ? err.message : "Failed to upload documents", toastPresets.destructive);
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
        <p className="text-muted-foreground text-sm">Legacy company not found.</p>
      </div>
    );
  }

  const details = company.company_details as Record<string, unknown>;
  const companyType = typeof details.company_type === "string" ? details.company_type : null;
  const standardDetailKeys = [
    "company_type",
    "tin",
    "registered_address",
    "contact_person",
    "contact_email",
    "contact_phone",
  ];
  const detailEntries = [
    ...standardDetailKeys.map((key) => [formatLegacyFieldLabel(key), details[key]] as const),
    ...Object.entries(details)
      .filter(([key, value]) => !standardDetailKeys.includes(key) && isFilledValue(value))
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
                onClick={() => doc.url && setPreviewDoc({ url: doc.url, title: doc.filename })}
              >
                <CircleCheck className="text-supportive flex-shrink-0" />
                <div className="flex flex-1 items-center gap-3 rounded-[0.16em] p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {doc.type === "other" ? "Company document" : formatLegacyLabel(doc.type)}
                    </p>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">{doc.filename}</p>
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
                className={cn("align-top", moa.document_url && "cursor-pointer hover:bg-gray-50")}
                onClick={() => moa.document_url && setPreviewDoc({ url: moa.document_url, title: moa.filename ?? "MOA Document" })}
              >
                <td className="py-2.5 pr-4 text-gray-600">
                  <MoaStatusBadge status="active" isExpired={isLegacyMoaExpired(moa.expiry_date)} />
                </td>
                <td className="py-2.5 pr-4 text-gray-600">
                  {moa.document_url ? (
                    <span className="inline-flex items-center gap-1.5 text-primary">
                      <Eye className="h-3.5 w-3.5" /> {moa.filename ?? "MOA Document"}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-gray-600">
                  {formatDateWithoutTime(moa.created_at)}
                </td>
                <td className="py-2.5 text-gray-600">
                  {formatDateWithoutTime(moa.effective_date)} – {formatDateWithoutTime(moa.expiry_date)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-muted-foreground text-sm">No MOA history.</p>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(o) => { if (!o) setPreviewDoc(null); }}>
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

      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!o) { setUploadOpen(false); setCompanyDocInputs([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Documents</DialogTitle>
            <DialogDescription>Upload additional company documents (PDF, max 2.5MB each, max 10 files)</DialogDescription>
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
                  filename: f.name,
                  expiryDate: "",
                  type: "other",
                }));
                setCompanyDocInputs((prev) => [...prev, ...newInputs]);
              }}
            />
            {companyDocInputs.length > 0 && (
              <div className="space-y-3">
                {companyDocInputs.map((input) => (
                  <div key={input.id} className="rounded-[0.33em] border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-500">Document</p>
                      <Button
                        size="xs"
                        variant="ghost"
                        scheme="destructive"
                        onClick={() =>
                          setCompanyDocInputs((prev) => prev.filter((i) => i.id !== input.id))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select
                          value={input.type}
                          onValueChange={(val) =>
                            setCompanyDocInputs((prev) =>
                              prev.map((i) => (i.id === input.id ? { ...i, type: val } : i)),
                            )
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt === "other" ? "Other" : formatLegacyLabel(opt)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Name</Label>
                        <Input
                          className="h-7 text-xs"
                          value={input.filename}
                          onChange={(e) =>
                            setCompanyDocInputs((prev) =>
                              prev.map((i) => (i.id === input.id ? { ...i, filename: e.target.value } : i)),
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Expiry Date</Label>
                        <Input
                          type="date"
                          className="h-7 text-xs"
                          value={input.expiryDate}
                          onChange={(e) =>
                            setCompanyDocInputs((prev) =>
                              prev.map((i) => (i.id === input.id ? { ...i, expiryDate: e.target.value } : i)),
                            )
                          }
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setCompanyDocInputs([]); }}>
              Cancel
            </Button>
            <Button
              onClick={() => companyDocInputs.length > 0 && docUploadMutation.mutate(companyDocInputs)}
              disabled={companyDocInputs.length === 0 || docUploadMutation.isPending}
            >
              {docUploadMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
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
  const [companyDocInputs, setCompanyDocInputs] = useState<{ id: string; file: File; filename: string; expiryDate: string; type: string }[]>([]);

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
      if (registeredAddress) formData.append("registered_address", registeredAddress);
      if (contactPerson) formData.append("contact_person", contactPerson);
      if (contactEmail) formData.append("contact_email", contactEmail);
      if (contactPhone) formData.append("contact_phone", contactPhone);
      if (companyDocInputs.length > 0) {
        const documentNames: string[] = [];
        const documentExpiryDates: (string | null)[] = [];
        const documentTypes: string[] = [];
        companyDocInputs.forEach(({ file, filename, expiryDate, type }) => {
          formData.append("companyDocuments", file);
          documentNames.push(filename);
          documentExpiryDates.push(expiryDate || null);
          documentTypes.push(type || "other");
        });
        formData.append("documentNames", JSON.stringify(documentNames));
        formData.append("documentExpiryDates", JSON.stringify(documentExpiryDates));
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
      toast(err instanceof Error ? err.message : "Failed to create legacy MOA", toastPresets.destructive);
    },
  });

  const hasValidMoa = moas.some((m) => m.effectiveDate && m.expiryDate);
  const isValid = companyName.trim() && hasValidMoa;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
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
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Acme Corp" />
          </div>

          <div className="space-y-3">
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
              <div key={moa.id} className="rounded-[0.33em] border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-500">MOA {index + 1}</p>
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
                      onChange={(e) => updateMoa(moa.id, { effectiveDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Expiry Date *</Label>
                    <Input
                      type="date"
                      className="h-8 text-xs"
                      value={moa.expiryDate}
                      onChange={(e) => updateMoa(moa.id, { expiryDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="mt-2 space-y-1.5">
                  <Label className="text-xs">Name</Label>
                  <Input
                    className="h-8 text-xs"
                    value={moa.name}
                    onChange={(e) => updateMoa(moa.id, { name: e.target.value })}
                    placeholder={moa.file?.name ?? "MOA Agreement"}
                  />
                </div>
                <div className="mt-2 space-y-1.5">
                  <Label className="text-xs">MOA Document (PDF, optional, max 2.5MB)</Label>
                  <Input
                    type="file"
                    className="h-8 text-xs"
                    accept=".pdf,application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      updateMoa(moa.id, {
                        file,
                        name: moa.name || file?.name || "",
                      });
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
                  <Input className="h-8 text-xs" value={tin} onChange={(e) => setTin(e.target.value)} placeholder="123-456-789" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Company Type</Label>
                  <Input className="h-8 text-xs" value={companyType} onChange={(e) => setCompanyType(e.target.value)} placeholder="corporation" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Registered Address</Label>
                <Input className="h-8 text-xs" value={registeredAddress} onChange={(e) => setRegisteredAddress(e.target.value)} placeholder="Makati City" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Person</Label>
                  <Input className="h-8 text-xs" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Juan Dela Cruz" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Contact Email</Label>
                  <Input type="email" className="h-8 text-xs" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="juan@example.com" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Contact Phone</Label>
                <Input className="h-8 text-xs" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="09171234567" />
              </div>
            </div>
          </details>

          <div className="space-y-1.5">
            <Label className="text-xs">Company Documents (PDF, optional, max 2.5MB each, max 10)</Label>
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
                  filename: f.name,
                  expiryDate: "",
                  type: "other",
                }));
                setCompanyDocInputs((prev) => [...prev, ...newInputs]);
              }}
            />
            {companyDocInputs.length > 0 && (
              <div className="space-y-3">
                {companyDocInputs.map((input) => (
                  <div key={input.id} className="rounded-[0.33em] border border-gray-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-500">Document</p>
                      <Button
                        size="xs"
                        variant="ghost"
                        scheme="destructive"
                        onClick={() =>
                          setCompanyDocInputs((prev) => prev.filter((i) => i.id !== input.id))
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
                              prev.map((i) => (i.id === input.id ? { ...i, type: val } : i)),
                            )
                          }
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                              <SelectItem key={opt} value={opt} className="text-xs">
                                {opt === "other" ? "Other" : formatLegacyLabel(opt)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Name</Label>
                          <Input
                            className="h-7 text-xs"
                            value={input.filename}
                            onChange={(e) =>
                              setCompanyDocInputs((prev) =>
                                prev.map((i) => (i.id === input.id ? { ...i, filename: e.target.value } : i)),
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Expiry Date</Label>
                          <Input
                            type="date"
                            className="h-7 text-xs"
                            value={input.expiryDate}
                            onChange={(e) =>
                              setCompanyDocInputs((prev) =>
                                prev.map((i) => (i.id === input.id ? { ...i, expiryDate: e.target.value } : i))
                              )
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!isValid || mutation.isPending}>
            {mutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
