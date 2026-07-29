"use client";
import {
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  adminControllerGetUniversityMoaDetail,
  getAdminControllerGetPartnerLegacyCompanyQueryKey,
  getAdminControllerGetUniversityMoaDetailQueryKey,
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
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LegacyCompanyDetail,
  formatLegacyLabel,
  formatLegacyFieldLabel,
  isFilledValue,
  isLegacyMoaExpired,
} from "@/components/legacy-companies/legacy-companies-panel";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  GripVertical,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn, formatDateWithoutTime } from "@/lib/utils";
import { CompanyLogo } from "@/components/company-logo";
import { DocumentPreviewPane } from "@/components/document-preview-pane";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import {
  UniversityPartnersTable,
  type PartnerTab,
  type UniversityBlacklistEntry,
  type UniversityLegacyCompanySummary,
  type UniversityPartnerTableRow,
} from "@/components/university/university-partners-table";
import {
  LegacyPartnerMoasTable,
  RegisteredPartnerMoasTable,
  type PartnerPdfSelection,
} from "@/components/university/partner-moa-history-tables";
import { isOutstandingMoa } from "@/lib/partner-predicates";

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
  cosmetic?: Record<string, unknown>;
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
  registered_company_id: string | null;
}

type DocReviewDetails = Record<
  string,
  { type?: string; document?: string; value: string }
>;

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

const DOC_TYPES_LIST = Object.entries(DOC_LABELS);
const PREVIEW_WIDTH_STORAGE_KEY = "iom-admin-partner-preview-width";

function PartnerTabs({
  activeCount,
  expiredCount,
  blacklistedCount,
}: {
  activeCount: number;
  expiredCount: number;
  blacklistedCount: number;
}) {
  const tabs = [
    [
      "outstanding",
      "Active",
      activeCount,
      "group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground",
    ],
    [
      "expired",
      "Expired/None",
      expiredCount,
      "group-data-[state=active]:bg-destructive group-data-[state=active]:text-destructive-foreground",
    ],
    [
      "blacklisted",
      "Blacklisted",
      blacklistedCount,
      "group-data-[state=active]:bg-gray-900 group-data-[state=active]:text-white",
    ],
  ] as const;

  return (
    <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-none border-0 border-b border-gray-200 bg-transparent">
      {tabs.map(([value, label, count, activeClass]) => (
        <TabsTrigger
          key={value}
          value={value}
          className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
        >
          {label}
          <span
            className={cn(
              "ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700",
              activeClass,
            )}
          >
            {count}
          </span>
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

function PartnerIdentity({
  name,
  logoUrl,
  status,
  badge,
}: {
  name: string;
  logoUrl?: string | null;
  status: string;
  badge?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3">
      <CompanyLogo name={name} logoUrl={logoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg leading-tight font-semibold text-gray-900">
            {name}
          </h2>
          {badge}
        </div>
        <div className="mt-1.5">
          <PartnershipStatusBadge
            status={status}
            label={status === "active" ? "Active Partnership" : undefined}
          />
        </div>
      </div>
    </div>
  );
}

function VerifiedDocumentDetails({ details }: { details: DocReviewDetails }) {
  const entries = Object.entries(details).filter(([, v]) => v.value);
  if (entries.length === 0) return null;
  return (
    <CollapsibleCard
      id="verified-details"
      title="Verified details"
      icon={<ShieldCheck className="text-supportive h-4 w-4" />}
    >
      <div className="space-y-4 px-5 pb-5">
        {entries.map(([key, field]) => (
          <DetailField key={key} label={key}>
            <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
              {field.value}
            </p>
          </DetailField>
        ))}
      </div>
    </CollapsibleCard>
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
  const logoUrl =
    typeof details.logo_url === "string" ? details.logo_url : null;
  const hasActiveMoa = company.moas.some(
    (moa) => !isLegacyMoaExpired(moa.expiry_date, moa.is_perpetual),
  );
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
      <PartnerIdentity
        name={company.company_name}
        logoUrl={logoUrl}
        status={
          hasActiveMoa ? "active" : company.moas.length ? "expired" : "inactive"
        }
        badge={<PartnershipStatusBadge status="imported" label="Imported" />}
      />

      <CollapsibleCard id="company-details" title="Company details">
        <div className="space-y-4 px-5 pb-5">
          {detailEntries.map(([label, value]) => (
            <DetailField key={label} label={label}>
              <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
                {isFilledValue(value) ? String(value) : "—"}
              </p>
            </DetailField>
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        id="legacy-documents"
        title="Documents"
        defaultOpen={false}
      >
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
      </CollapsibleCard>

      <CollapsibleCard id="legacy-moa-history" title="MOA history" defaultOpen>
        <LegacyPartnerMoasTable
          moas={company.moas}
          onOpenMoa={(selection) => {
            if (selection.kind === "legacy" && selection.url) {
              onPreviewDoc(selection.url, selection.label);
            }
          }}
        />
      </CollapsibleCard>
    </>
  );
}

function LegacyRecordsSection({
  universityId,
  companyId,
  onPreviewDoc,
}: {
  universityId: string;
  companyId: string | null;
  onPreviewDoc: (url: string, title: string) => void;
}) {
  const [open, setOpen] = useState(false);

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
              onPreviewDoc={onPreviewDoc}
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

  const [detailType, setDetailType] = useState<"partner" | "legacy" | null>(
    null,
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [partnerTab, setPartnerTab] = useState<PartnerTab>("outstanding");
  const [preview, setPreview] = useState<{ url: string; label: string } | null>(
    null,
  );
  const [previewWidth, setPreviewWidth] = useState(50);

  useEffect(() => {
    const savedWidth = Number(
      window.localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY),
    );
    if (savedWidth >= 30 && savedWidth <= 70) setPreviewWidth(savedWidth);
  }, []);

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

  const rows = useMemo<UniversityPartnerTableRow[]>(() => {
    const map = new Map<string, UniversityPartnerTableRow>();

    for (const p of partnersData?.partners ?? []) {
      if (!p.company) continue;
      map.set(`registered:${p.company.id}`, {
        id: `registered:${p.company.id}`,
        displayName: p.company.registered_name,
        logoUrl:
          typeof p.company.cosmetic?.logo_url === "string"
            ? p.company.cosmetic.logo_url
            : null,
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
        contactEmail: null,
        lastRenewalRequestedAt: null,
      });
    }

    for (const b of partnersData?.blacklist ?? []) {
      const key = `registered:${b.company_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.isBlacklisted = true;
        existing.blacklistEntry = {
          ...b,
          company: b.company ?? {
            id: existing.partnerCompany?.id ?? b.company_id,
            registered_name: existing.displayName,
          },
        } satisfies UniversityBlacklistEntry;
      } else if (b.company) {
        map.set(key, {
          id: key,
          displayName: b.company.registered_name,
          logoUrl: null,
          partnerCompany: { ...b.company, company_type: null },
          latestMoaId: null,
          latestMoaStatus: null,
          hasActiveMoa: false,
          effectiveDate: null,
          expiryDate: null,
          isPartnerExpired: null,
          isBlacklisted: true,
          blacklistEntry: { ...b, company: b.company },
          legacyEntry: null,
          isImported: false,
          contactEmail: null,
          lastRenewalRequestedAt: null,
        });
      }
    }

    for (const l of legacyData?.legacyCompanies ?? []) {
      map.set(`legacy:${l.id}`, {
        id: `legacy:${l.id}`,
        displayName: l.company_name,
        logoUrl:
          typeof l.company_details.logo_url === "string"
            ? l.company_details.logo_url
            : null,
        partnerCompany: null,
        latestMoaId: null,
        latestMoaStatus: null,
        hasActiveMoa: false,
        effectiveDate: null,
        expiryDate: null,
        isPartnerExpired: null,
        isBlacklisted: false,
        blacklistEntry: null,
        legacyEntry: l satisfies UniversityLegacyCompanySummary,
        isImported: true,
        contactEmail:
          typeof l.company_details.contact_email === "string"
            ? l.company_details.contact_email
            : null,
        lastRenewalRequestedAt: null,
      });
    }

    return [...map.values()];
  }, [partnersData, legacyData]);

  const handleRowClick = (row: UniversityPartnerTableRow) => {
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
    setPreview(null);
  };

  const isLoading = partnersLoading || legacyLoading;
  const nowIso = new Date().toISOString();
  const activeRows = rows.filter(
    (row) => !row.isBlacklisted && isOutstandingMoa(row, nowIso),
  );
  const expiredRows = rows.filter(
    (row) => !row.isBlacklisted && !isOutstandingMoa(row, nowIso),
  );
  const blacklistedRows = rows.filter((row) => row.isBlacklisted);
  const visibleRows =
    partnerTab === "outstanding"
      ? activeRows
      : partnerTab === "expired"
        ? expiredRows
        : blacklistedRows;

  const openPreview = (url: string, label: string) =>
    setPreview({ url, label });
  const openMoaPreview = async (selection: PartnerPdfSelection) => {
    if (selection.kind === "registered") {
      const moa = await queryClient.fetchQuery({
        queryKey: getAdminControllerGetUniversityMoaDetailQueryKey(
          universityId,
          selection.moaId,
        ),
        queryFn: () =>
          adminControllerGetUniversityMoaDetail(universityId, selection.moaId),
      });

      if (moa.pdfUrl) openPreview(moa.pdfUrl, selection.label);
      return;
    }

    if (selection.url) openPreview(selection.url, selection.label);
  };
  const updatePreviewWidth = (nextWidth: number) => {
    const clampedWidth = Math.min(70, Math.max(30, nextWidth));
    setPreviewWidth(clampedWidth);
    window.localStorage.setItem(
      PREVIEW_WIDTH_STORAGE_KEY,
      String(clampedWidth),
    );
  };
  const resizePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    updatePreviewWidth(((bounds.right - event.clientX) / bounds.width) * 100);
  };

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
    <PageContainer
      className={cn(
        showDetail
          ? cn("py-0", preview && "max-w-none pr-0 sm:pr-0")
          : "max-w-7xl",
      )}
    >
      {!showDetail && (
        <>
          <button
            onClick={() => router.push("/admin/universities")}
            className="text-muted-foreground hover:text-foreground mb-4 inline-flex cursor-pointer items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Universities
          </button>

          {uniLoading ? (
            <div className="mb-6 space-y-2">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : (
            <h1 className="mb-6 text-2xl font-semibold tracking-tight text-gray-900">
              {uniData?.registered_name}
            </h1>
          )}

          <PageHeader
            title="Partners"
            description="Manage partners for this university."
          />
        </>
      )}

      <div className={cn(!showDetail && "mt-6")}>
        {!showDetail && (
          <Tabs
            value={partnerTab}
            onValueChange={(value) => setPartnerTab(value as typeof partnerTab)}
          >
            <UniversityPartnersTable
              rows={visibleRows}
              isLoading={isLoading}
              tab={partnerTab}
              expiringSoonDays={30}
              onPartnerClick={handleRowClick}
              getPartnerHref={() => null}
              toolbarStart={
                <PartnerTabs
                  activeCount={activeRows.length}
                  expiredCount={expiredRows.length}
                  blacklistedCount={blacklistedRows.length}
                />
              }
            />
          </Tabs>
        )}

        {showDetail && (
          <div
            className={cn(
              "relative min-h-[calc(100dvh-5rem-1px)] lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0 lg:overflow-hidden",
              preview && "lg:grid",
            )}
            style={
              preview
                ? {
                    gridTemplateColumns: `${100 - previewWidth}% ${previewWidth}%`,
                  }
                : undefined
            }
          >
            <div className="min-w-0 space-y-3 py-5 pr-4 lg:h-full lg:overflow-y-auto lg:px-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateBack}
                className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
              >
                <ArrowLeft className="h-4 w-4" />
                {uniData?.registered_name ?? "University"} / Partners
              </Button>

              {detailType === "partner" && (
                <div className="space-y-4">
                  <PartnerIdentity
                    name={company?.registered_name ?? "—"}
                    logoUrl={partnerEntry?.logoUrl}
                    status={
                      partnerEntry?.isBlacklisted
                        ? "blacklisted"
                        : partnerEntry?.hasActiveMoa
                          ? "active"
                          : partnerEntry?.isPartnerExpired
                            ? "expired"
                            : "inactive"
                    }
                  />

                  {partnerEntry?.isBlacklisted &&
                    partnerEntry.blacklistEntry && (
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
                      <CollapsibleCard
                        id="documents"
                        title="Documents"
                        defaultOpen={false}
                      >
                        <div className="space-y-1">
                          {DOC_TYPES_LIST.map(([type, label]) => {
                            const doc = partnerMoasData.companyDocuments.find(
                              (d) => d.type === type,
                            );
                            return (
                              <div
                                key={type}
                                className={cn(
                                  "flex flex-row items-center px-4 duration-200",
                                  doc?.url && "cursor-pointer hover:bg-gray-50",
                                )}
                                onClick={() =>
                                  doc?.url && openPreview(doc.url, doc.filename)
                                }
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
                      </CollapsibleCard>
                    )}

                  <CollapsibleCard
                    id="registered-moa-history"
                    title="MOA history"
                    defaultOpen
                  >
                    <RegisteredPartnerMoasTable
                      moas={moas}
                      isLoading={moasLoading}
                      onOpenMoa={(selection) => void openMoaPreview(selection)}
                    />
                  </CollapsibleCard>

                  <LegacyRecordsSection
                    universityId={universityId}
                    companyId={detailId}
                    onPreviewDoc={openPreview}
                  />
                </div>
              )}

              {detailType === "legacy" && (
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
                      onPreviewDoc={openPreview}
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Legacy company not found.
                    </p>
                  )}
                </div>
              )}
            </div>
            {preview && (
              <>
                <div
                  role="separator"
                  aria-label="Resize preview pane"
                  aria-orientation="vertical"
                  aria-valuemin={30}
                  aria-valuemax={70}
                  aria-valuenow={Math.round(previewWidth)}
                  tabIndex={0}
                  className="group absolute top-0 bottom-0 z-30 hidden w-5 -translate-x-1/2 cursor-col-resize touch-none lg:block"
                  style={{ left: `${100 - previewWidth}%` }}
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.currentTarget.setPointerCapture(event.pointerId);
                  }}
                  onPointerMove={resizePreview}
                  onPointerUp={(event) =>
                    event.currentTarget.releasePointerCapture(event.pointerId)
                  }
                  onKeyDown={(event) => {
                    if (event.key === "ArrowLeft")
                      updatePreviewWidth(previewWidth + 2);
                    if (event.key === "ArrowRight")
                      updatePreviewWidth(previewWidth - 2);
                  }}
                >
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover:bg-primary group-focus:bg-primary" />
                  <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm">
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setPreview(null)}
                      className="flex h-8 w-7 items-center justify-center border-b border-gray-200 hover:bg-gray-100"
                      aria-label="Close preview"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                    <span className="flex h-10 w-7 items-center justify-center">
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </div>
                </div>
                <DocumentPreviewPane
                  url={preview.url}
                  label={preview.label}
                  zoomStorageKey="iom-admin-partner-preview-zoom"
                />
              </>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
