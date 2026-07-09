"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBottomSheet,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { LegacyCompanyDetail, formatLegacyLabel, formatLegacyFieldLabel, formatLegacyMoaPeriod, isFilledValue, isLegacyMoaExpired } from "@/components/legacy-companies/legacy-companies-panel";
import { UploadDialog, CsvUploadDialog, ZipUploadDialog } from "@/components/legacy-companies/legacy-companies-panel";
import { ArrowLeft, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Eye, Plus, ShieldCheck, Upload } from "lucide-react";
import { formatDateWithoutTime } from "@/lib/utils";
import { MoaStatusBadge } from "@/components/status-badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface University {
  id: string;
  registered_name: string;
  is_deactivated: boolean | null;
}

interface PartnerCompany {
  id: string;
  registered_name: string;
  company_type: string | null;
}

interface Partner {
  company: PartnerCompany | null;
  latestMoaId: string | null;
  latestMoaStatus: string;
  effective_date: string | null;
  expiry_date: string | null;
  is_expired: boolean | null;
  hasActiveMoa: boolean;
}

interface BlacklistEntry {
  id: string;
  company_id: string;
  reason: string | null;
  created_at: string;
  actor_email: string | null;
  company: { id: string; registered_name: string } | null;
}

interface LegacyCompanySummary {
  id: string;
  company_name: string;
  company_details: Record<string, unknown>;
  moaCount: number;
  documentCount: number;
  valid_until: string | null;
  hasMoa: boolean;
  hasPerpetualMoa: boolean;
  latestMoaEffectiveDate: string | null;
  latestMoaExpiryDate: string | null;
  latestMoaIsPerpetual: boolean;
}

interface PartnerMoaEntry {
  id: string;
  status: string;
  created_at: string;
  effective_date: string;
  expiry_date: string;
  is_expired: boolean | null;
  template: { name: string } | null;
}

type DocReviewDetails = Record<string, { type?: string; document?: string; value: string }>;

interface CompanyDoc {
  type: string;
  filename: string;
  url: string | null;
}

interface PartnerMoasData {
  company: PartnerCompany & { document_review_details?: DocReviewDetails };
  moas: PartnerMoaEntry[];
  companyDocuments: CompanyDoc[];
}

interface PartnerTableRow {
  id: string;
  displayName: string;

  // Registered partner data
  partnerCompany: PartnerCompany | null;
  latestMoaId: string | null;
  latestMoaStatus: string | null;
  hasActiveMoa: boolean;
  effectiveDate: string | null;
  expiryDate: string | null;
  isPartnerExpired: boolean | null;

  // Blacklist
  isBlacklisted: boolean;
  blacklistEntry: BlacklistEntry | null;

  // Legacy
  legacyEntry: LegacyCompanySummary | null;
  isImported: boolean;
}

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

const DOC_TYPES_LIST = Object.entries(DOC_LABELS);

function PartnerStatusBadge({ status }: { status: string }) {
  if (status === "Active") return <Badge className="border-transparent bg-supportive text-white">Active</Badge>;
  if (status === "Expired") return <Badge className="border-transparent bg-destructive text-white">Expired</Badge>;
  if (status === "Blacklisted" || status === "Revoked") return <Badge className="border-transparent bg-destructive text-white">{status}</Badge>;
  if (status === "None") return <Badge className="border-transparent bg-gray-500 text-white">None</Badge>;
  return <Badge className="border-transparent bg-primary text-white">{status}</Badge>;
}

function VerifiedDocumentDetails({ details }: { details: DocReviewDetails }) {
  const entries = Object.entries(details).filter(([, v]) => v.value);
  if (entries.length === 0) return null;
  return (
    <div className="space-y-0 rounded-[0.33em] border border-gray-200">
      <div className="flex items-center gap-1.5 border-b border-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
        <ShieldCheck className="h-3.5 w-3.5 text-supportive" />
        Verified details
      </div>
      <div className="divide-y divide-gray-100">
        {entries.map(([key, field]) => (
          <div key={key} className="flex items-center gap-4 px-3 py-2">
            <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">{key}</p>
            <p className="text-sm font-medium text-gray-900">{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReadOnlyLegacyDetail({
  company,
  onPreviewDoc,
}: {
  company: LegacyCompanyDetail;
  onPreviewDoc: (url: string, title: string) => void;
}) {
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
    <>
      <div>
        <p className="text-sm font-semibold text-gray-900">{company.company_name}</p>
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
              <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">{label}</p>
              <p className="text-sm font-medium text-gray-900">
                {isFilledValue(value) ? String(value) : "—"}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Card className="gap-4 py-5">
        <p className="px-5 text-sm font-semibold text-gray-900">Documents</p>
        <div className="space-y-1">
          {company.company_documents.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">No documents.</p>
          ) : (
            company.company_documents.map((doc) => (
              <div
                key={doc.id}
                className={"flex flex-row items-center px-5 duration-200" + (doc.url ? " hover:cursor-pointer hover:bg-gray-50" : "")}
                onClick={() => doc.url && onPreviewDoc(doc.url, doc.filename)}
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
                className={"align-top" + (moa.document_url ? " cursor-pointer hover:bg-gray-50" : "")}
                onClick={() => moa.document_url && onPreviewDoc(moa.document_url, moa.filename ?? "MOA Document")}
              >
                <td className="py-2.5 pr-4 text-gray-600">
                  <MoaStatusBadge status="active" isExpired={isLegacyMoaExpired(moa.expiry_date, moa.is_perpetual)} />
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
                  {formatLegacyMoaPeriod(moa)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm text-muted-foreground">No MOA history.</p>
      )}
    </>
  );
}

function LegacyRecordsSection({ universityId, companyId }: { universityId: string; companyId: string | null }) {
  const [open, setOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-partner-legacy-company", universityId, companyId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/universities/${universityId}/partners/${companyId}/legacy-companies`)
        .then((r) => r.data as { legacyCompany: LegacyCompanyDetail | null }),
    enabled: open && !!companyId && !!universityId,
  });

  const company = data?.legacyCompany;

  return (
    <div className="rounded-[0.33em] border border-gray-200">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50"
      >
        <span>Legacy records</span>
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>

      {open && (
        <div className="space-y-4 border-t border-gray-200 p-4">
          {isLoading ? (
            <>
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-16 w-full" />
            </>
          ) : !company ? (
            <p className="text-sm text-muted-foreground">No legacy records matched.</p>
          ) : (
            <ReadOnlyLegacyDetail
              company={company}
              onPreviewDoc={(url, title) => setPreviewDoc({ url, title })}
            />
          )}
        </div>
      )}

      {previewDoc && (
        <Dialog open onOpenChange={(o) => !o && setPreviewDoc(null)}>
          <DialogBottomSheet className="flex h-[88vh] flex-col p-0">
            <div className="flex items-center border-b border-gray-100 px-5 py-3.5 pr-14">
              <DialogTitle className="text-sm font-medium text-gray-900">
                {previewDoc.title}
              </DialogTitle>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <iframe
                src={previewDoc.url}
                className="h-full w-full border-none"
                title={previewDoc.title}
              />
            </div>
          </DialogBottomSheet>
        </Dialog>
      )}
    </div>
  );
}

export default function AdminUniversityPartnersPage() {
  const { universityId } = useParams<{ universityId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [detailType, setDetailType] = useState<"partner" | "legacy" | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [legacyUploadOpen, setLegacyUploadOpen] = useState(false);
  const [csvUploadOpen, setCsvUploadOpen] = useState(false);
  const [zipUploadOpen, setZipUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; title: string } | null>(null);

  const showDetail = detailType !== null;

  const { data: uniData, isLoading: uniLoading } = useQuery({
    queryKey: ["admin-university", universityId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/universities/${universityId}`)
        .then((r) => r.data.university as University),
    enabled: !!universityId,
  });

  const { data: partnersData, isLoading: partnersLoading } = useQuery({
    queryKey: ["admin-university-partners", universityId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/universities/${universityId}/partners`)
        .then((r) => r.data as { university: University; partners: Partner[]; blacklist: BlacklistEntry[] }),
    enabled: !!universityId,
  });

  const { data: legacyData, isLoading: legacyLoading } = useQuery({
    queryKey: ["admin-university-legacy", universityId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/universities/${universityId}/legacy-companies`)
        .then((r) => r.data as { legacyCompanies: LegacyCompanySummary[] }),
    enabled: !!universityId,
  });

  const { data: partnerMoasData, isLoading: moasLoading } = useQuery({
    queryKey: ["admin-university-partner-moas", universityId, detailId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/universities/${universityId}/partners/${detailId}/moas`)
        .then((r) => r.data as PartnerMoasData),
    enabled: detailType === "partner" && !!detailId,
  });

  const { data: legacyDetailData, isLoading: legacyDetailLoading } = useQuery({
    queryKey: ["admin-university-legacy-detail", universityId, detailId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/universities/${universityId}/legacy-companies/${detailId}`)
        .then((r) => r.data as { legacyCompany: LegacyCompanyDetail }),
    enabled: detailType === "legacy" && !!detailId,
  });

  const rows = useMemo<PartnerTableRow[]>(() => {
    const map = new Map<string, PartnerTableRow>();

    for (const p of partnersData?.partners ?? []) {
      if (!p.company) continue;
      map.set(`registered:${p.company.id}`, {
        id: `registered:${p.company.id}`,
        displayName: p.company.registered_name,
        partnerCompany: p.company,
        latestMoaId: p.latestMoaId,
        latestMoaStatus: p.latestMoaStatus,
        hasActiveMoa: p.hasActiveMoa,
        effectiveDate: p.effective_date,
        expiryDate: p.expiry_date,
        isPartnerExpired: p.is_expired,
        isBlacklisted: false,
        blacklistEntry: null,
        legacyEntry: null,
        isImported: false,
      });
    }

    for (const b of partnersData?.blacklist ?? []) {
      const key = `registered:${b.company_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.isBlacklisted = true;
        existing.blacklistEntry = b;
      } else if (b.company) {
        map.set(key, {
          id: key,
          displayName: b.company.registered_name,
          partnerCompany: { ...b.company, company_type: null },
          latestMoaId: null,
          latestMoaStatus: null,
          hasActiveMoa: false,
          effectiveDate: null,
          expiryDate: null,
          isPartnerExpired: null,
          isBlacklisted: true,
          blacklistEntry: b,
          legacyEntry: null,
          isImported: false,
        });
      }
    }

    for (const l of legacyData?.legacyCompanies ?? []) {
      map.set(`legacy:${l.id}`, {
        id: `legacy:${l.id}`,
        displayName: l.company_name,
        partnerCompany: null,
        latestMoaId: null,
        latestMoaStatus: null,
        hasActiveMoa: false,
        effectiveDate: null,
        expiryDate: null,
        isPartnerExpired: null,
        isBlacklisted: false,
        blacklistEntry: null,
        legacyEntry: l,
        isImported: true,
      });
    }

    return [...map.values()];
  }, [partnersData, legacyData]);

  const handleRowClick = (row: PartnerTableRow) => {
    if (row.isImported && row.legacyEntry) {
      setDetailType("legacy");
      setDetailId(row.legacyEntry.id);
    } else {
      setDetailType("partner");
      setDetailId(row.id.replace("registered:", ""));
    }
  };

  const navigateBack = () => {
    setDetailType(null);
    setDetailId(null);
  };

  const isLoading = partnersLoading || legacyLoading;

  const listColumns = useMemo<ColumnDef<PartnerTableRow>[]>(
    () => [
      {
        id: "status",
        header: "Status",
        minSize: 130,
        size: 140,
        accessorFn: (row) => {
          if (row.isBlacklisted) return "Blacklisted";
          if (row.isImported && row.legacyEntry) {
            if (!row.legacyEntry.hasMoa) return "None";
            if (row.legacyEntry.hasPerpetualMoa) return "Active";
            if (row.legacyEntry.valid_until && row.legacyEntry.valid_until < new Date().toISOString()) return "Expired";
            return "Active";
          }
          if (row.hasActiveMoa) return "Active";
          if (row.isPartnerExpired) return "Expired";
          if (row.latestMoaStatus === "revoked") return "Revoked";
          return row.latestMoaStatus ?? "None";
        },
        cell: ({ getValue }) => <PartnerStatusBadge status={getValue() as string} />,
      },
      {
        id: "company",
        header: "Company",
        minSize: 280,
        size: 360,
        accessorFn: (row) => row.displayName,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{row.original.displayName}</p>
            {row.original.isBlacklisted && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Blacklisted
              </span>
            )}
          </div>
        ),
      },
      {
        id: "period",
        header: "Period",
        minSize: 220,
        size: 260,
        accessorFn: (row) => {
          if (row.isImported && row.legacyEntry) {
            if (row.legacyEntry.latestMoaIsPerpetual) return "Perpetual";
            if (row.legacyEntry.latestMoaEffectiveDate || row.legacyEntry.latestMoaExpiryDate) {
              const from = row.legacyEntry.latestMoaEffectiveDate
                ? formatDateWithoutTime(row.legacyEntry.latestMoaEffectiveDate)
                : "—";
              const to = row.legacyEntry.latestMoaExpiryDate
                ? formatDateWithoutTime(row.legacyEntry.latestMoaExpiryDate)
                : "—";
              return `${from} – ${to}`;
            }
            return "—";
          }
          if (row.effectiveDate || row.expiryDate) {
            const from = row.effectiveDate ? formatDateWithoutTime(row.effectiveDate) : "—";
            const to = row.expiryDate ? formatDateWithoutTime(row.expiryDate) : "—";
            return `${from} – ${to}`;
          }
          return "—";
        },
      },
      {
        id: "imported",
        header: "Imported",
        minSize: 120,
        size: 130,
        accessorFn: (row) => (row.isImported ? "Yes" : "—"),
        cell: ({ row }) => row.original.isImported ? <Badge className="border-transparent bg-primary text-white">Imported</Badge> : <span className="text-muted-foreground">—</span>,
      },
    ],
    [],
  );

  const partnerEntry = detailType === "partner" && detailId
    ? rows.find((r) => r.id === `registered:${detailId}`)
    : null;
  const company = partnerMoasData?.company ?? partnerEntry?.partnerCompany;
  const moas = partnerMoasData?.moas ?? [];
  const legacyCompany = legacyDetailData?.legacyCompany;

  if (!uniData && !uniLoading) {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">University not found.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer className="max-w-none">
      <button
        onClick={() => {
          if (showDetail) {
            navigateBack();
          } else {
            router.push("/admin/universities");
          }
        }}
        className="text-muted-foreground hover:text-foreground mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> {showDetail ? "Partners" : "Universities"}
      </button>

      {uniLoading ? (
        <div className="space-y-2 mb-6">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
      ) : (
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900 mb-6">
          {uniData?.registered_name}
        </h1>
      )}

      <PageHeader
        title="Partners"
        description="Manage partners for this university."
      />

      <div className="mt-6">
      {!showDetail && (
        <>
          {isLoading ? (
            <div className="space-y-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              id="admin-university-partners-merged-v2"
              columns={listColumns}
              data={rows}
              showRowNumbers={false}
              searchKey="company"
              searchPlaceholder="Search by company..."
              rowLabelSingular="partner"
              rowLabelPlural="partners"
              onRowClick={handleRowClick}
              getRowClassName={(row) => (row.isBlacklisted ? "bg-red-50" : undefined)}
              toolbarActions={
                <div className="flex">
                  <Button
                    onClick={() => setLegacyUploadOpen(true)}
                    className={(true) ? "rounded-r-none" : undefined}
                  >
                    <Plus /> Import Partner
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button className="rounded-l-none border-l-0 px-2">
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => setCsvUploadOpen(true)}>
                        <Upload className="h-4 w-4" />
                        Bulk upload via CSV
                      </DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setZipUploadOpen(true)}>
                        <Upload className="h-4 w-4" />
                        Bulk upload via ZIP
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              }
            />
          )}
        </>
      )}

      {showDetail && detailType === "partner" && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">{company?.registered_name ?? "—"}</h3>
            {company?.company_type && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {company.company_type.replace(/_/g, " ")}
              </p>
            )}
          </div>

          {partnerEntry?.isBlacklisted && partnerEntry.blacklistEntry && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-[0.33em] border p-3 text-sm">
              <p>
                This company is <strong>blacklisted</strong>.
              </p>
              {partnerEntry.blacklistEntry.reason && (
                <p className="text-destructive/80 text-xs">
                  Reason: {partnerEntry.blacklistEntry.reason}
                </p>
              )}
              <p className="text-destructive/60 text-xs">
                Blacklisted on {formatDateWithoutTime(partnerEntry.blacklistEntry.created_at)}
                {partnerEntry.blacklistEntry.actor_email && ` by ${partnerEntry.blacklistEntry.actor_email}`}
              </p>
            </div>
          )}

          {partnerMoasData?.company?.document_review_details && (
            <VerifiedDocumentDetails details={partnerMoasData.company.document_review_details} />
          )}

          {partnerMoasData?.companyDocuments && partnerMoasData.companyDocuments.length > 0 && (
            <Card className="gap-4 py-5">
              <p className="px-5 text-sm font-semibold text-gray-900">Documents</p>
              <div className="space-y-1">
                {DOC_TYPES_LIST.map(([type, label]) => {
                  const doc = partnerMoasData.companyDocuments.find((d) => d.type === type);
                  return (
                    <div key={type} className="flex flex-row items-center px-5 duration-200">
                      {doc
                        ? <CircleCheck className="text-supportive flex-shrink-0" />
                        : <CircleAlert className="text-warning flex-shrink-0" />
                      }
                      <div className="flex flex-1 items-center gap-3 rounded-[0.16em] p-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-800">{label}</p>
                          {doc && (
                            <p className="text-muted-foreground mt-0.5 truncate text-xs">{doc.filename}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {moasLoading ? (
            <div className="space-y-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : moas.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-2 pr-4 font-medium text-gray-500">Status</th>
                  <th className="pb-2 pr-4 font-medium text-gray-500">Template</th>
                  <th className="pb-2 pr-4 font-medium text-gray-500">Requested</th>
                  <th className="pb-2 font-medium text-gray-500">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {moas.map((moa) => (
                  <tr
                    key={moa.id}
                    className="cursor-pointer align-top hover:bg-gray-50"
                    onClick={() => router.push(`/admin/universities/${universityId}/moas/${moa.id}`)}
                  >
                    <td className="py-2.5 pr-4">
                        <MoaStatusBadge status={moa.status} isExpired={moa.is_expired} />
                      </td>
                    <td className="py-2.5 pr-4 text-gray-600">{moa.template?.name ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {formatDateWithoutTime(moa.created_at)}
                    </td>
                    <td className="py-2.5 text-gray-600">
                      {moa.effective_date
                        ? `${formatDateWithoutTime(moa.effective_date)} – ${formatDateWithoutTime(moa.expiry_date)}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground text-sm">No MOA history.</p>
          )}

          <LegacyRecordsSection universityId={universityId} companyId={detailId} />
        </div>
      )}

      {showDetail && detailType === "legacy" && (
        <div className="space-y-4">
          {legacyDetailLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : legacyCompany ? (
            <ReadOnlyLegacyDetail
              company={legacyCompany}
              onPreviewDoc={(url, title) => setPreviewDoc({ url, title })}
            />
          ) : (
            <p className="text-muted-foreground text-sm">Legacy company not found.</p>
          )}
        </div>
      )}
    </div>

    {previewDoc && (
      <Dialog open onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogBottomSheet className="flex h-[88vh] flex-col p-0">
          <div className="flex items-center border-b border-gray-100 px-5 py-3.5 pr-14">
            <DialogTitle className="text-sm font-medium text-gray-900">
              {previewDoc.title}
            </DialogTitle>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            <iframe
              src={previewDoc.url}
              className="h-full w-full border-none"
              title={previewDoc.title}
            />
          </div>
        </DialogBottomSheet>
      </Dialog>
    )}

    {legacyUploadOpen && (
      <UploadDialog
        uploadEndpoint={`/api/admin/universities/${universityId}/legacy-companies`}
        queryKeyPrefix={`admin-university-legacy-${universityId}`}
        onClose={() => {
          setLegacyUploadOpen(false);
          queryClient.invalidateQueries({ queryKey: ["admin-university-partners", universityId] });
          queryClient.invalidateQueries({ queryKey: ["admin-university-legacy", universityId] });
        }}
      />
    )}

    {csvUploadOpen && (
      <CsvUploadDialog
        csvEndpoint={`/api/admin/universities/${universityId}/legacy-companies/bulk/csv`}
        queryKeyPrefix={`admin-university-legacy-${universityId}`}
        onClose={() => {
          setCsvUploadOpen(false);
          queryClient.invalidateQueries({ queryKey: ["admin-university-partners", universityId] });
          queryClient.invalidateQueries({ queryKey: ["admin-university-legacy", universityId] });
        }}
      />
    )}

    {zipUploadOpen && (
      <ZipUploadDialog
        zipEndpoint={`/api/admin/universities/${universityId}/legacy-companies/bulk/zip`}
        queryKeyPrefix={`admin-university-legacy-${universityId}`}
        onClose={() => {
          setZipUploadOpen(false);
          queryClient.invalidateQueries({ queryKey: ["admin-university-partners", universityId] });
          queryClient.invalidateQueries({ queryKey: ["admin-university-legacy", universityId] });
        }}
      />
    )}
    </PageContainer>
  );
}
