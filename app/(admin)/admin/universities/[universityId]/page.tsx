"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  getAdminControllerGetPartnerLegacyCompanyQueryKey,
  getAdminControllerGetUniversityLegacyCompanyQueryKey,
  getAdminControllerGetUniversityPartnerMoasQueryKey,
  getAdminControllerGetUniversityPartnersQueryKey,
  getAdminControllerGetUniversityQueryKey,
  getAdminControllerListUniversityLegacyCompaniesQueryKey,
  useAdminControllerGetPartnerLegacyCompany,
  useAdminControllerGetUniversity,
  useAdminControllerGetUniversityLegacyCompany,
  useAdminControllerGetUniversityPartnerMoas,
  useAdminControllerGetUniversityPartners,
  useAdminControllerListUniversityLegacyCompanies,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useModal } from "@/app/providers/modal-provider";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import {
  UploadDialog,
  CsvUploadDialog,
  ZipUploadDialog,
  LegacyCompanyDetail,
  formatLegacyLabel,
  formatLegacyFieldLabel,
  formatLegacyMoaPeriod,
  isFilledValue,
  isLegacyMoaExpired,
  normalizeBulkUploadResult,
} from "@/components/legacy-companies/legacy-companies-panel";
import {
  adminControllerBulkCreateLegacyCompaniesFromCsv,
  adminControllerBulkCreateLegacyCompaniesFromZip,
  adminControllerCreateUniversityLegacyCompany,
} from "@/app/api";
import {
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock,
  Eye,
  Minus,
  Plus,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { formatDateWithoutTime } from "@/lib/utils";
import { MoaStatusBadge } from "@/components/status-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface University {
  id: string;
  registered_name: string;
  is_deactivated: boolean | null;
}

function mapUniversityDetail(university: Record<string, unknown>): University {
  return {
    id: typeof university.id === "string" ? university.id : "",
    registered_name:
      typeof university.registered_name === "string"
        ? university.registered_name
        : "",
    is_deactivated:
      typeof university.is_deactivated === "boolean"
        ? university.is_deactivated
        : null,
  };
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

type DocReviewDetails = Record<
  string,
  { type?: string; document?: string; value: string }
>;

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
  if (status === "Active")
    return (
      <Badge className="border-transparent bg-supportive gap-1 text-white">
        <CircleCheck className="h-3.5 w-3.5" />
        Active
      </Badge>
    );
  if (status === "Expired")
    return (
      <Badge className="border-transparent bg-destructive gap-1 text-white">
        <Clock className="h-3.5 w-3.5" />
        Expired
      </Badge>
    );
  if (status === "Blacklisted")
    return (
      <Badge className="border-transparent bg-destructive gap-1 text-white">
        <Ban className="h-3.5 w-3.5" />
        Blacklisted
      </Badge>
    );
  if (status === "Revoked")
    return (
      <Badge className="border-transparent bg-destructive gap-1 text-white">
        <Ban className="h-3.5 w-3.5" />
        Revoked
      </Badge>
    );
  if (status === "None")
    return (
      <Badge className="border-transparent bg-gray-500 gap-1 text-white">
        <Minus className="h-3.5 w-3.5" />
        None
      </Badge>
    );
  return (
    <Badge className="border-transparent bg-primary gap-1 text-white">
      {status}
    </Badge>
  );
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
            <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">
              {key}
            </p>
            <p className="text-sm font-medium text-gray-900">{field.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function normalizeDocumentReviewDetails(
  details: Record<string, unknown>,
): DocReviewDetails {
  const normalized: DocReviewDetails = {};

  for (const [key, field] of Object.entries(details)) {
    if (
      typeof field === "object" &&
      field !== null &&
      "value" in field &&
      typeof field.value === "string"
    ) {
      normalized[key] = {
        value: field.value,
        ...("type" in field && typeof field.type === "string"
          ? { type: field.type }
          : {}),
        ...("document" in field && typeof field.document === "string"
          ? { document: field.document }
          : {}),
      };
    }
  }

  return normalized;
}

function ReadOnlyLegacyDetail({
  company,
  onPreviewDoc,
}: {
  company: LegacyCompanyDetail;
  onPreviewDoc: (url: string, title: string) => void;
}) {
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
    <>
      <div>
        <p className="text-sm font-semibold text-gray-900">
          {company.company_name}
        </p>
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
        <p className="px-5 text-sm font-semibold text-gray-900">Documents</p>
        <div className="space-y-1">
          {company.company_documents.length === 0 ? (
            <p className="px-5 text-sm text-muted-foreground">No documents.</p>
          ) : (
            company.company_documents.map((doc) => (
              <div
                key={doc.id}
                className={
                  "flex flex-row items-center px-5 duration-200" +
                  (doc.url ? " hover:cursor-pointer hover:bg-gray-50" : "")
                }
                onClick={() => doc.url && onPreviewDoc(doc.url, doc.filename)}
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
                className={
                  "align-top" +
                  (moa.document_url ? " cursor-pointer hover:bg-gray-50" : "")
                }
                onClick={() =>
                  moa.document_url &&
                  onPreviewDoc(moa.document_url, moa.filename ?? "MOA Document")
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
        <p className="text-sm text-muted-foreground">No MOA history.</p>
      )}
    </>
  );
}

function LegacyRecordsSection({
  universityId,
  companyId,
}: {
  universityId: string;
  companyId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const { openModal, closeModal } = useModal();

  const { data, isLoading } = useAdminControllerGetPartnerLegacyCompany<{
    legacyCompany: LegacyCompanyDetail | null;
  }>(universityId, companyId, {
    query: {
      queryKey: getAdminControllerGetPartnerLegacyCompanyQueryKey(
        universityId,
        companyId,
      ),
      enabled: open && !!companyId && !!universityId,
    },
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
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
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
            <p className="text-sm text-muted-foreground">
              No legacy records matched.
            </p>
          ) : (
            <ReadOnlyLegacyDetail
              company={company}
              onPreviewDoc={(url, title) =>
                openModal(
                  "preview-doc",
                  <iframe
                    src={url}
                    className="h-full w-full border-none"
                    title={title}
                  />,
                  {
                    title,
                    panelClassName: "!w-full sm:!max-w-4xl",
                    contentClassName:
                      "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                    showHeaderDivider: true,
                  },
                )
              }
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminUniversityPartnersPage() {
  const { universityId } = useParams<{ universityId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();

  const [detailType, setDetailType] = useState<"partner" | "legacy" | null>(
    null,
  );
  const [detailId, setDetailId] = useState<string | null>(null);

  const showDetail = detailType !== null;

  const { data: uniData, isLoading: uniLoading } =
    useAdminControllerGetUniversity<University>(universityId, {
      query: {
        queryKey: getAdminControllerGetUniversityQueryKey(universityId),
        select: (response) => mapUniversityDetail(response.university),
        enabled: !!universityId,
      },
    });

  const { data: partnersData, isLoading: partnersLoading } =
    useAdminControllerGetUniversityPartners<{
      university: University;
      partners: Partner[];
      blacklist: BlacklistEntry[];
    }>(universityId, {
      query: {
        queryKey: getAdminControllerGetUniversityPartnersQueryKey(universityId),
        enabled: !!universityId,
      },
    });

  const { data: legacyData, isLoading: legacyLoading } =
    useAdminControllerListUniversityLegacyCompanies<{
      legacyCompanies: LegacyCompanySummary[];
    }>(universityId, {
      query: {
        queryKey:
          getAdminControllerListUniversityLegacyCompaniesQueryKey(universityId),
        enabled: !!universityId,
      },
    });

  const { data: partnerMoasData, isLoading: moasLoading } =
    useAdminControllerGetUniversityPartnerMoas(universityId, detailId, {
      query: {
        queryKey: getAdminControllerGetUniversityPartnerMoasQueryKey(
          universityId,
          detailId,
        ),
        enabled: detailType === "partner" && !!detailId,
      },
    });

  const { data: legacyDetailData, isLoading: legacyDetailLoading } =
    useAdminControllerGetUniversityLegacyCompany<{
      legacyCompany: LegacyCompanyDetail;
    }>(universityId, detailId, {
      query: {
        queryKey: getAdminControllerGetUniversityLegacyCompanyQueryKey(
          universityId,
          detailId,
        ),
        enabled: detailType === "legacy" && !!detailId,
      },
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

  const listColumns = useMemo<Array<ResourceTableColumn<PartnerTableRow>>>(
    () => [
      {
        id: "status",
        header: "Status",
        width: "w-[18%]",
        getSortValue: (row) => {
          if (row.isBlacklisted) return "Blacklisted";
          if (row.isImported && row.legacyEntry) {
            if (!row.legacyEntry.hasMoa) return "None";
            if (row.legacyEntry.hasPerpetualMoa) return "Active";
            if (
              row.legacyEntry.valid_until &&
              row.legacyEntry.valid_until < new Date().toISOString()
            )
              return "Expired";
            return "Active";
          }
          if (row.hasActiveMoa) return "Active";
          if (row.isPartnerExpired) return "Expired";
          if (row.latestMoaStatus === "revoked") return "Revoked";
          return row.latestMoaStatus ?? "None";
        },
        render: (row) => <PartnerStatusBadge status={getPartnerStatus(row)} />,
      },
      {
        id: "company",
        header: "Company",
        width: "w-[38%]",
        getSortValue: (row) => row.displayName,
        render: (row) => (
          <div className="flex items-center gap-2">
            <p className="font-medium text-gray-900">{row.displayName}</p>
            {row.isBlacklisted && (
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
        width: "w-[29%]",
        getSortValue: (row) => {
          if (row.isImported && row.legacyEntry) {
            if (row.legacyEntry.latestMoaIsPerpetual) return "Perpetual";
            if (
              row.legacyEntry.latestMoaEffectiveDate ||
              row.legacyEntry.latestMoaExpiryDate
            ) {
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
          if (row.effectiveDate) {
            const from = formatDateWithoutTime(row.effectiveDate);
            const to = row.expiryDate
              ? formatDateWithoutTime(row.expiryDate)
              : "Perpetual";
            return `${from} – ${to}`;
          }
          return "—";
        },
        render: (row) => {
          if (row.isImported && row.legacyEntry) {
            if (row.legacyEntry.latestMoaIsPerpetual) return "Perpetual";
            if (
              row.legacyEntry.latestMoaEffectiveDate ||
              row.legacyEntry.latestMoaExpiryDate
            ) {
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
          if (!row.effectiveDate) return "—";
          const to = row.expiryDate
            ? formatDateWithoutTime(row.expiryDate)
            : "Perpetual";
          return `${formatDateWithoutTime(row.effectiveDate)} – ${to}`;
        },
      },
      {
        id: "imported",
        header: "Imported",
        width: "w-[15%]",
        getSortValue: (row) => (row.isImported ? "Yes" : "—"),
        render: (row) =>
          row.isImported ? (
            <Badge type="primary">Imported</Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    ],
    [],
  );

  function getPartnerStatus(row: PartnerTableRow) {
    if (row.isBlacklisted) return "Blacklisted";
    if (row.isImported && row.legacyEntry) {
      if (!row.legacyEntry.hasMoa) return "None";
      if (row.legacyEntry.hasPerpetualMoa) return "Active";
      if (
        row.legacyEntry.valid_until &&
        row.legacyEntry.valid_until < new Date().toISOString()
      )
        return "Expired";
      return "Active";
    }
    if (row.hasActiveMoa) return "Active";
    if (row.isPartnerExpired) return "Expired";
    if (row.latestMoaStatus === "revoked") return "Revoked";
    return row.latestMoaStatus ?? "None";
  }

  const partnersTable = useResourceTable({
    data: rows,
    getRowId: (row) => row.id,
    columns: listColumns,
    search: {
      placeholder: "Search by company...",
      ariaLabel: "Search partners by company",
      matches: (row, query) => row.displayName.toLowerCase().includes(query),
    },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50, 100] },
  });

  const partnerEntry =
    detailType === "partner" && detailId
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
    <PageContainer className="max-w-7xl">
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
        <ArrowLeft className="h-4 w-4" />{" "}
        {showDetail ? "Partners" : "Universities"}
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
              <ResourceTable
                table={partnersTable}
                emptyState={{ title: "No partners yet." }}
                noResultsState={{ title: "No partners match your search." }}
                rowLabelSingular="partner"
                rowLabelPlural="partners"
                onRowClick={handleRowClick}
                getRowClassName={(row) =>
                  row.isBlacklisted
                    ? "bg-red-50 hover:bg-red-100/70"
                    : undefined
                }
                renderMobileRow={(row) => (
                  <button
                    type="button"
                    onClick={() => handleRowClick(row)}
                    className={
                      row.isBlacklisted
                        ? "w-full cursor-pointer bg-red-50 px-4 py-3 text-left transition-colors hover:bg-red-100/70 focus-visible:outline-none"
                        : "w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-primary/[0.035] focus-visible:outline-none"
                    }
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">
                          {row.displayName}
                        </p>
                        <p className="text-muted-foreground mt-1 text-xs">
                          {listColumns[2].render(row)}
                        </p>
                      </div>
                      <PartnerStatusBadge status={getPartnerStatus(row)} />
                    </div>
                    {row.isImported && (
                      <Badge type="primary" className="mt-2">
                        Imported
                      </Badge>
                    )}
                  </button>
                )}
                toolbarLeading={
                  <div className="ml-auto flex">
                    <Button
                      onClick={() =>
                        openModal(
                          "legacy-upload",
                          <UploadDialog
                            createRequest={(data) =>
                              adminControllerCreateUniversityLegacyCompany(
                                universityId,
                                data,
                              )
                            }
                            queryKey={getAdminControllerListUniversityLegacyCompaniesQueryKey(
                              universityId,
                            )}
                            onClose={() => {
                              closeModal("legacy-upload");
                              queryClient.invalidateQueries({
                                queryKey:
                                  getAdminControllerGetUniversityPartnersQueryKey(
                                    universityId,
                                  ),
                              });
                              queryClient.invalidateQueries({
                                queryKey:
                                  getAdminControllerListUniversityLegacyCompaniesQueryKey(
                                    universityId,
                                  ),
                              });
                            }}
                          />,
                          {
                            title: "Add Legacy Company",
                            description:
                              "Create a legacy company record. You can add MOAs now or later from the company detail view.",
                            panelClassName: "!w-full sm:!max-w-2xl",
                          },
                        )
                      }
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
                        <DropdownMenuItem
                          onSelect={() =>
                            openModal(
                              "csv-upload",
                              <CsvUploadDialog
                                uploadRequest={async (file) =>
                                  normalizeBulkUploadResult(
                                    await adminControllerBulkCreateLegacyCompaniesFromCsv(
                                      universityId,
                                      { file },
                                    ),
                                  )
                                }
                                queryKey={getAdminControllerListUniversityLegacyCompaniesQueryKey(
                                  universityId,
                                )}
                                onClose={() => {
                                  closeModal("csv-upload");
                                  queryClient.invalidateQueries({
                                    queryKey:
                                      getAdminControllerGetUniversityPartnersQueryKey(
                                        universityId,
                                      ),
                                  });
                                  queryClient.invalidateQueries({
                                    queryKey:
                                      getAdminControllerListUniversityLegacyCompaniesQueryKey(
                                        universityId,
                                      ),
                                  });
                                }}
                              />,
                              {
                                title: "Bulk Upload Legacy MOAs",
                                description:
                                  "Upload a CSV file to create or append multiple legacy MOAs at once. Each row represents one legacy MOA. Rows with the same company name append MOAs to the same legacy partner.",
                                panelClassName: "!w-full sm:!max-w-5xl",
                              },
                            )
                          }
                        >
                          <Upload className="h-4 w-4" />
                          Bulk upload via CSV
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            openModal(
                              "zip-upload",
                              <ZipUploadDialog
                                uploadRequest={async (file) =>
                                  normalizeBulkUploadResult(
                                    await adminControllerBulkCreateLegacyCompaniesFromZip(
                                      universityId,
                                      { file },
                                    ),
                                  )
                                }
                                queryKey={getAdminControllerListUniversityLegacyCompaniesQueryKey(
                                  universityId,
                                )}
                                onClose={() => {
                                  closeModal("zip-upload");
                                  queryClient.invalidateQueries({
                                    queryKey:
                                      getAdminControllerGetUniversityPartnersQueryKey(
                                        universityId,
                                      ),
                                  });
                                  queryClient.invalidateQueries({
                                    queryKey:
                                      getAdminControllerListUniversityLegacyCompaniesQueryKey(
                                        universityId,
                                      ),
                                  });
                                }}
                              />,
                              {
                                title: "Bulk Upload Legacy MOAs via ZIP",
                                description:
                                  "Upload a ZIP file containing a legacy-import.csv manifest and referenced PDF files. Each CSV row creates or updates one legacy company, and can also add an MOA.",
                                panelClassName: "!w-full sm:!max-w-5xl",
                              },
                            )
                          }
                        >
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
              <h3 className="font-semibold text-gray-900">
                {company?.registered_name ?? "—"}
              </h3>
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
                  Blacklisted on{" "}
                  {formatDateWithoutTime(
                    partnerEntry.blacklistEntry.created_at,
                  )}
                  {partnerEntry.blacklistEntry.actor_email &&
                    ` by ${partnerEntry.blacklistEntry.actor_email}`}
                </p>
              </div>
            )}

            {partnerMoasData?.company?.document_review_details && (
              <VerifiedDocumentDetails
                details={normalizeDocumentReviewDetails(
                  partnerMoasData.company.document_review_details,
                )}
              />
            )}

            {partnerMoasData?.companyDocuments &&
              partnerMoasData.companyDocuments.length > 0 && (
                <Card className="gap-4 py-5">
                  <p className="px-5 text-sm font-semibold text-gray-900">
                    Documents
                  </p>
                  <div className="space-y-1">
                    {DOC_TYPES_LIST.map(([type, label]) => {
                      const doc = partnerMoasData.companyDocuments.find(
                        (d) => d.type === type,
                      );
                      return (
                        <div
                          key={type}
                          className="flex flex-row items-center px-5 duration-200"
                        >
                          {doc ? (
                            <CircleCheck className="text-supportive flex-shrink-0" />
                          ) : (
                            <CircleAlert className="text-warning flex-shrink-0" />
                          )}
                          <div className="flex flex-1 items-center gap-3 rounded-[0.16em] p-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-800">
                                {label}
                              </p>
                              {doc && (
                                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                                  {doc.filename}
                                </p>
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
                    <th className="pb-2 pr-4 font-medium text-gray-500">
                      Status
                    </th>
                    <th className="pb-2 pr-4 font-medium text-gray-500">
                      Template
                    </th>
                    <th className="pb-2 pr-4 font-medium text-gray-500">
                      Requested
                    </th>
                    <th className="pb-2 font-medium text-gray-500">Period</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {moas.map((moa) => (
                    <tr
                      key={moa.id}
                      className="cursor-pointer align-top hover:bg-gray-50"
                      onClick={() =>
                        router.push(
                          `/admin/universities/${universityId}/moas/${moa.id}`,
                        )
                      }
                    >
                      <td className="py-2.5 pr-4">
                        <MoaStatusBadge
                          status={moa.status}
                          isExpired={moa.is_expired}
                        />
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {moa.template?.name ?? "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-gray-600">
                        {formatDateWithoutTime(moa.created_at)}
                      </td>
                      <td className="py-2.5 text-gray-600">
                        {moa.effective_date
                          ? `${formatDateWithoutTime(moa.effective_date)} – ${moa.expiry_date ? formatDateWithoutTime(moa.expiry_date) : "Perpetual"}`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground text-sm">No MOA history.</p>
            )}

            <LegacyRecordsSection
              universityId={universityId}
              companyId={detailId}
            />
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
                onPreviewDoc={(url, title) =>
                  openModal(
                    "preview-doc",
                    <iframe
                      src={url}
                      className="h-full w-full border-none"
                      title={title}
                    />,
                    {
                      title,
                      panelClassName: "!w-full sm:!max-w-4xl",
                      contentClassName:
                        "min-h-0 flex-1 overflow-hidden p-0 sm:p-0",
                      showHeaderDivider: true,
                    },
                  )
                }
              />
            ) : (
              <p className="text-muted-foreground text-sm">
                Legacy company not found.
              </p>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
