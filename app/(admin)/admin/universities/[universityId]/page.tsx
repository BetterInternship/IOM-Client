"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogBottomSheet,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/ui/data-table";
import { LegacyCompaniesPanel, LegacyCompanyDetail, formatLegacyLabel, formatLegacyFieldLabel, isFilledValue, isLegacyMoaExpired } from "@/components/legacy-companies/legacy-companies-panel";
import { ArrowLeft, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Eye, ShieldCheck } from "lucide-react";
import { formatDateWithoutTime } from "@/lib/utils";
import { MoaStatusBadge } from "@/components/status-badge";

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
  latestMoaId: string;
}

interface BlacklistEntry {
  id: string;
  company_id: string;
  reason: string | null;
  created_at: string;
  actor_email: string | null;
  company: { id: string; registered_name: string } | null;
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

interface CombinedEntry {
  company: PartnerCompany;
  latestMoaId: string;
  isBlacklisted: boolean;
  blacklistEntry: BlacklistEntry | null;
}

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

const DOC_TYPES_LIST = Object.entries(DOC_LABELS);

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

  const [currentCompanyId, setCurrentCompanyId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

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

  const { data: partnerMoasData, isLoading: moasLoading } = useQuery({
    queryKey: ["admin-university-partner-moas", universityId, currentCompanyId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/admin/universities/${universityId}/partners/${currentCompanyId}/moas`)
        .then((r) => r.data as PartnerMoasData),
    enabled: !!currentCompanyId,
  });

  const combined = useMemo<CombinedEntry[]>(() => {
    if (!partnersData) return [];
    const map = new Map<string, CombinedEntry>();
    for (const p of partnersData.partners) {
      if (!p.company) continue;
      map.set(p.company.id, {
        company: p.company,
        latestMoaId: p.latestMoaId,
        isBlacklisted: false,
        blacklistEntry: null,
      });
    }
    for (const b of partnersData.blacklist) {
      const existing = map.get(b.company_id);
      if (existing) {
        existing.isBlacklisted = true;
        existing.blacklistEntry = b;
      } else if (b.company) {
        map.set(b.company_id, {
          company: { ...b.company, company_type: null },
          latestMoaId: "",
          isBlacklisted: true,
          blacklistEntry: b,
        });
      }
    }
    return [...map.values()];
  }, [partnersData]);

  const listColumns = useMemo<ColumnDef<CombinedEntry>[]>(
    () => [
      {
        id: "company",
        header: "Company",
        accessorFn: (row) => row.company.registered_name,
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{row.original.company.registered_name}</p>
            {row.original.isBlacklisted && (
              <span className="inline-flex shrink-0 items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Blacklisted
              </span>
            )}
          </div>
        ),
      },
      {
        id: "type",
        header: "Type",
        accessorFn: (row) => row.company.company_type?.replace(/_/g, " ") ?? "—",
      },
    ],
    [],
  );

  const entry = currentCompanyId ? combined.find((e) => e.company.id === currentCompanyId) : null;
  const company = partnerMoasData?.company ?? entry?.company;
  const moas = partnerMoasData?.moas ?? [];
  const isPartnerDetail = showDetail;

  if (!uniData && !uniLoading) {
    return (
      <PageContainer>
        <p className="text-destructive text-sm">University not found.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <button
        onClick={() => {
          if (showDetail) {
            setShowDetail(false);
            setCurrentCompanyId(null);
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
        description={
          <>
            Manage partners for this university.{' '}
            <a href={`/admin/universities/${universityId}/legacy-partners`} target="_blank" className="underline">
              View legacy partners
            </a>
            .
          </>
        }
      />
      <div className="mt-6">
      {!showDetail && (
        <>
          {partnersLoading ? (
            <div className="space-y-1">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <DataTable
              id="admin-university-partners"
              columns={listColumns}
              data={combined}
              searchKey="company"
              searchPlaceholder="Search by company..."
              rowLabelSingular="partner"
              rowLabelPlural="partners"
              onRowClick={(e) => {
                setCurrentCompanyId(e.company.id);
                setShowDetail(true);
              }}
              getRowClassName={(row) => (row.isBlacklisted ? "bg-red-50" : undefined)}
            />
          )}
        </>
      )}

      {showDetail && (
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-gray-900">{company?.registered_name ?? "—"}</h3>
            {company?.company_type && (
              <p className="text-muted-foreground mt-0.5 text-xs">
                {company.company_type.replace(/_/g, " ")}
              </p>
            )}
          </div>

          {entry?.isBlacklisted && entry.blacklistEntry && (
            <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-[0.33em] border p-3 text-sm">
              <p>
                This company is <strong>blacklisted</strong>.
              </p>
              {entry.blacklistEntry.reason && (
                <p className="text-destructive/80 text-xs">
                  Reason: {entry.blacklistEntry.reason}
                </p>
              )}
              <p className="text-destructive/60 text-xs">
                Blacklisted on {formatDateWithoutTime(entry.blacklistEntry.created_at)}
                {entry.blacklistEntry.actor_email && ` by ${entry.blacklistEntry.actor_email}`}
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

          <LegacyRecordsSection universityId={universityId} companyId={currentCompanyId} />
        </div>
      )}
    </div>
    </PageContainer>
  );
}
