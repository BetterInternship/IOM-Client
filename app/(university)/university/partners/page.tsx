"use client";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import {
  LegacyCompanyDetail,
  AddDocumentsForm,
  MoaUploadDialog,
  buildMoaFormData,
  type DocInput,
  formatLegacyLabel,
  formatLegacyFieldLabel,
  isFilledValue,
  isLegacyMoaExpired,
  UploadDialog,
  CsvUploadDialog,
  ZipUploadDialog,
} from "@/components/legacy-companies/legacy-companies-panel";
import { formatDateWithoutTime, cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  GripVertical,
  Plus,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UniversityPartnersTable,
  type UniversityBlacklistEntry as BlacklistEntry,
  type UniversityLegacyCompanySummary as LegacyCompanySummary,
  type UniversityPartnerTableRow as PartnerTableRow,
} from "@/components/university/university-partners-table";
import {
  LegacyPartnerMoasTable,
  PartnerPdfPane,
  RegisteredPartnerMoasTable,
  type PartnerPdfSelection,
  type RegisteredPartnerMoa,
} from "@/components/university/partner-moa-history-tables";

interface Partner {
  company: {
    id: string;
    registered_name: string;
    company_type: string | null;
    cosmetic: Record<string, unknown>;
  } | null;
  latestMoaId: string | null;
  latestMoaStatus: string;
  effective_date: string | null;
  expiry_date: string | null;
  is_expired: boolean | null;
  hasActiveMoa: boolean;
}

type DocReviewDetails = Record<
  string,
  { type?: string; document?: string; value: string }
>;

interface CompanyDoc {
  type: string;
  filename: string;
  url: string | null;
}

const DOC_LABELS: Record<string, string> = {
  business_permit: "Business Permit",
  mayor_permit: "Mayor's Permit",
  sec_dti_registration: "SEC/DTI Registration",
};

const DOC_TYPES_LIST = Object.entries(DOC_LABELS);
const PREVIEW_WIDTH_STORAGE_KEY = "iom-partner-preview-width";

function CollapsibleCard({
  id,
  title,
  children,
  defaultOpen = false,
  contentClassName,
}: {
  id: string;
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  contentClassName?: string;
}) {
  return (
    <Card className="gap-0 overflow-hidden border-gray-200 py-0">
      <Accordion
        type="single"
        collapsible
        defaultValue={defaultOpen ? id : undefined}
      >
        <AccordionItem value={id} className="border-0">
          <AccordionTrigger className="px-4 py-3 text-sm font-semibold text-gray-900 hover:no-underline">
            {title}
          </AccordionTrigger>
          <AccordionContent
            className={cn(
              "border-t border-gray-100 pt-0 pb-0",
              contentClassName,
            )}
          >
            {children}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function companyInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
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
      <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50 text-lg font-semibold text-gray-600">
        {logoUrl ? (
          // Company logos are user-uploaded external assets.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt={`${name} logo`}
            className="size-full object-contain p-2"
          />
        ) : (
          <span aria-hidden="true">{companyInitials(name)}</span>
        )}
      </div>
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

function VerifiedDocumentDetails({
  details,
  companyType,
}: {
  details: DocReviewDetails;
  companyType?: string | null;
}) {
  const entries = Object.entries(details).filter(([, v]) => v.value);
  const includesCompanyType = entries.some(([key]) =>
    ["company type", "company_type"].includes(key.toLowerCase()),
  );
  if (companyType && !includesCompanyType) {
    entries.unshift([
      "Company type",
      { value: companyType.replace(/_/g, " ") },
    ]);
  }
  if (entries.length === 0) return null;
  return (
    <CollapsibleCard
      id="verified-details"
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="text-supportive h-4 w-4" />
          Verified details
        </span>
      }
    >
      <div className="divide-y divide-gray-100">
        {entries.map(([key, field]) => {
          const isDateOfIncorporation =
            key.toLowerCase().replace(/_/g, " ") === "date of incorporation";

          return (
            <div key={key} className="flex items-center gap-4 px-4 py-2.5">
              <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">
                {key}
              </p>
              <p className="text-sm font-medium text-gray-900">
                {isDateOfIncorporation
                  ? formatDateWithoutTime(field.value)
                  : field.value}
              </p>
            </div>
          );
        })}
      </div>
    </CollapsibleCard>
  );
}

function DocumentsSection({
  documents,
  onOpenDocument,
}: {
  documents: CompanyDoc[];
  onOpenDocument: (url: string, label: string) => void;
}) {
  return (
    <CollapsibleCard id="documents" title="Documents" defaultOpen={false}>
      <div>
        {DOC_TYPES_LIST.map(([type, label]) => {
          const doc = documents.find((d) => d.type === type);
          return (
            <div
              key={type}
              className="flex flex-row items-center px-4 duration-200 hover:cursor-pointer hover:bg-gray-50"
              onClick={() => {
                if (!doc?.url) return;
                onOpenDocument(doc.url, doc.filename);
              }}
            >
              {doc ? (
                <CircleCheck className="text-supportive flex-shrink-0" />
              ) : (
                <CircleAlert className="text-warning flex-shrink-0" />
              )}
              <div className="flex flex-1 items-center gap-3 rounded-[0.16em] px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800">{label}</p>
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
  );
}

function ReadOnlyLegacyDetail({
  company,
  onPreviewDoc,
  onOpenMoa,
  showHeader = true,
  canUpload = false,
}: {
  company: LegacyCompanyDetail;
  onPreviewDoc: (url: string, title: string) => void;
  onOpenMoa: (selection: PartnerPdfSelection) => void;
  showHeader?: boolean;
  canUpload?: boolean;
}) {
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();
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

  const docUploadMutation = useMutation({
    mutationFn: (inputs: DocInput[]) => {
      const formData = new FormData();
      const documentTypes: string[] = [];
      inputs.forEach(({ file, type }) => {
        formData.append("companyDocuments", file);
        documentTypes.push(type || "other");
      });
      formData.append("documentTypes", JSON.stringify(documentTypes));
      return preconfiguredAxios.post(
        `/api/university/legacy-companies/${company.id}/documents`,
        formData,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["university-legacy-company-detail", company.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["university-legacy-companies"],
      });
      closeModal("legacy-add-documents");
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
    mutationFn: (inputs: Parameters<typeof buildMoaFormData>[0]) =>
      preconfiguredAxios.post(
        `/api/university/legacy-companies/${company.id}/moas`,
        buildMoaFormData(inputs),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["university-legacy-company-detail", company.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["university-legacy-companies"],
      });
      closeModal("legacy-add-moa");
      toast("Legacy MOA added", toastPresets.success);
    },
    onError: (err) => {
      toast(
        err instanceof Error ? err.message : "Failed to add legacy MOA",
        toastPresets.destructive,
      );
    },
  });

  return (
    <>
      {showHeader && (
        <PartnerIdentity
          name={company.company_name}
          logoUrl={logoUrl}
          status={
            hasActiveMoa
              ? "active"
              : company.moas.length
                ? "expired"
                : "inactive"
          }
          badge={<PartnershipStatusBadge status="imported" label="Imported" />}
        />
      )}

      <CollapsibleCard id="company-details" title="Company details">
        <div className="divide-y divide-gray-100">
          {detailEntries.map(([label, value]) => (
            <div key={label} className="flex items-center gap-4 px-4 py-2.5">
              <p className="text-muted-foreground w-44 flex-shrink-0 text-xs">
                {label}
              </p>
              <p className="text-sm font-medium text-gray-900">
                {isFilledValue(value) ? String(value) : "—"}
              </p>
            </div>
          ))}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        id="legacy-documents"
        title={
          <span className="flex w-full items-center justify-between gap-3">
            <span>Documents</span>
            {canUpload && (
              <Button
                size="xs"
                onClick={(event) => {
                  event.stopPropagation();
                  openModal(
                    "legacy-add-documents",
                    <AddDocumentsForm
                      isPending={docUploadMutation.isPending}
                      onSubmit={(inputs) => docUploadMutation.mutate(inputs)}
                      onClose={() => closeModal("legacy-add-documents")}
                    />,
                    {
                      title: "Add documents",
                      description:
                        "Upload additional company documents (PDF, max 2.5MB each).",
                      panelClassName: "!w-full sm:!max-w-md",
                    },
                  );
                }}
              >
                <Upload className="h-3.5 w-3.5" /> Add
              </Button>
            )}
          </span>
        }
        defaultOpen={false}
      >
        <div>
          {company.company_documents.length === 0 ? (
            <p className="text-muted-foreground px-4 py-3 text-sm">
              No documents.
            </p>
          ) : (
            company.company_documents.map((doc) => (
              <div
                key={doc.id}
                className={cn(
                  "flex flex-row items-center px-4 duration-200",
                  doc.url && "hover:cursor-pointer hover:bg-gray-50",
                )}
                onClick={() => doc.url && onPreviewDoc(doc.url, doc.filename)}
              >
                <CircleCheck className="text-supportive flex-shrink-0" />
                <div className="flex flex-1 items-center gap-3 rounded-[0.16em] px-3 py-2.5">
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

      <CollapsibleCard
        id="legacy-moa-history"
        title={
          <span className="flex w-full items-center justify-between gap-3">
            <span>MOA history</span>
            {canUpload && (
              <Button
                size="xs"
                onClick={(event) => {
                  event.stopPropagation();
                  openModal(
                    "legacy-add-moa",
                    <MoaUploadDialog
                      title="Add Legacy MOA"
                      description="Add an MOA record to this imported company."
                      isPending={moaUploadMutation.isPending}
                      onClose={() => closeModal("legacy-add-moa")}
                      onSubmit={(moas) => moaUploadMutation.mutate(moas)}
                    />,
                    {
                      title: "Add Legacy MOA",
                      description:
                        "Add an MOA record to this imported company.",
                      panelClassName: "!w-full sm:!max-w-2xl",
                    },
                  );
                }}
              >
                <Plus className="h-3.5 w-3.5" /> Add MOA
              </Button>
            )}
          </span>
        }
        defaultOpen
      >
        <LegacyPartnerMoasTable moas={company.moas} onOpenMoa={onOpenMoa} />
      </CollapsibleCard>
    </>
  );
}

function LegacyRecordsSection({
  currentCompanyId: companyId,
  onOpenMoa,
  onOpenDocument,
}: {
  currentCompanyId: string | null;
  onOpenMoa: (selection: PartnerPdfSelection) => void;
  onOpenDocument: (url: string, label: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["partner-legacy-company", companyId],
    queryFn: () =>
      preconfiguredAxios
        .get(`/api/university/partners/${companyId}/legacy-companies`)
        .then((r) => r.data as { legacyCompany: LegacyCompanyDetail | null }),
    enabled: open && !!companyId,
  });

  const company = data?.legacyCompany;

  return (
    <Card className="gap-0 overflow-hidden border-gray-200 py-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50"
      >
        <span>Legacy records</span>
        {open ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>

      {open && (
        <div className="space-y-3 border-t border-gray-100 p-3">
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
              onOpenMoa={onOpenMoa}
              onPreviewDoc={(url, title) => onOpenDocument(url, title)}
              showHeader={false}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function PartnersContent({
  initialDetailType = null,
  initialDetailId = null,
}: {
  initialDetailType?: "partner" | "legacy" | null;
  initialDetailId?: string | null;
} = {}) {
  const { account, isLoading: profileLoading } = useUniversityProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const detailType = initialDetailType;
  const detailId = initialDetailId;
  const [pdfSelection, setPdfSelection] = useState<PartnerPdfSelection | null>(
    null,
  );
  const [previewWidth, setPreviewWidth] = useState(50);

  useEffect(() => {
    const savedWidth = Number(
      window.localStorage.getItem(PREVIEW_WIDTH_STORAGE_KEY),
    );
    if (savedWidth >= 30 && savedWidth <= 70) setPreviewWidth(savedWidth);
  }, []);

  const { openModal, closeModal } = useModal();
  const modal = useIomModalRegistry();

  const { data: partnersData, isLoading: isPartnersLoading } = useQuery({
    queryKey: ["university-partners"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/partners")
        .then((r) => r.data as { partners: Partner[] }),
    enabled: !!account,
  });

  const { data: blacklistData, isLoading: isBlacklistLoading } = useQuery({
    queryKey: ["university-blacklist"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/blacklist")
        .then((r) => r.data as { blacklist: BlacklistEntry[] }),
    enabled: !!account,
  });

  const { data: legacyData, isLoading: isLegacyLoading } = useQuery({
    queryKey: ["university-legacy-companies"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/university/legacy-companies")
        .then((r) => r.data as { legacyCompanies: LegacyCompanySummary[] }),
    enabled: !!account,
  });

  const { data: partnerMoasData, isLoading: isMoasLoading } = useQuery({
    queryKey: ["university-partner-moas", detailId],
    queryFn: () =>
      preconfiguredAxios.get(`/api/university/partners/${detailId}/moas`).then(
        (r) =>
          r.data as {
            company: Partner["company"] & {
              document_review_details?: DocReviewDetails;
            };
            moas: RegisteredPartnerMoa[];
            companyDocuments: CompanyDoc[];
          },
      ),
    enabled: detailType === "partner" && !!detailId,
    refetchInterval: 25 * 60 * 1000,
  });

  const { data: legacyDetailData, isLoading: isLegacyDetailLoading } = useQuery(
    {
      queryKey: ["university-legacy-company-detail", detailId],
      queryFn: () =>
        preconfiguredAxios
          .get(`/api/university/legacy-companies/${detailId}`)
          .then((r) => r.data as { legacyCompany: LegacyCompanyDetail }),
      enabled: detailType === "legacy" && !!detailId,
    },
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["university-partners"] });
    queryClient.invalidateQueries({ queryKey: ["university-blacklist"] });
    queryClient.invalidateQueries({
      queryKey: ["university-legacy-companies"],
    });
    queryClient.invalidateQueries({ queryKey: ["university-audit"] });
  };

  const blacklistMutation = useMutation({
    mutationFn: ({
      companyId,
      reason,
    }: {
      companyId: string;
      reason: string;
    }) =>
      preconfiguredAxios.post("/api/university/blacklist", {
        companyId,
        reason: reason || undefined,
      }),
    onSuccess: () => {
      refresh();
    },
  });

  const unblacklistMutation = useMutation({
    mutationFn: (companyId: string) =>
      preconfiguredAxios.delete(`/api/university/blacklist/${companyId}`),
    onSuccess: () => {
      refresh();
    },
  });

  const openInviteModal = useCallback(
    (row: PartnerTableRow) => {
      // D1/D3: row context decides the invite-kind default — a template
      // gate here would wrongly block inviting an active-MOA partner to
      // post a listing (which needs no template at all). The "no active
      // templates" case is now handled inline inside the modal, and only
      // when the university is actually on the moa kind.
      const contactEmail = row.isImported ? (row.contactEmail ?? "") : "";
      const initialStep: 1 | 2 = row.isImported && !contactEmail ? 1 : 2;

      const nowIso = new Date().toISOString();
      const legacyOutstanding = !!(
        row.legacyEntry?.hasMoa &&
        (row.legacyEntry.hasPerpetualMoa ||
          !row.legacyEntry.valid_until ||
          row.legacyEntry.valid_until >= nowIso)
      );
      const initialKind: "moa" | "listing" = row.isImported
        ? legacyOutstanding
          ? "listing"
          : "moa"
        : row.hasActiveMoa
          ? "listing"
          : "moa";

      modal.inviteCompany.open({
        onSent: refresh,
        initialMode: row.isImported ? "new" : "registered",
        initialStep,
        initialCompanyId: row.partnerCompany?.id,
        initialCompanyName: row.displayName,
        initialEmail: contactEmail,
        initialKind,
        initialLegacyCompanyId: row.isImported ? row.legacyEntry?.id : undefined,
        // The row already identifies a specific company — no reason to let
        // the university search for/switch to a different one.
        allowSearch: false,
        // Listing invites only ever originate from a Partners-page row.
        allowListingKind: true,
      });
    },
    [modal.inviteCompany, refresh],
  );

  const rows = useMemo<PartnerTableRow[]>(() => {
    const map = new Map<string, PartnerTableRow>();

    for (const p of partnersData?.partners ?? []) {
      if (!p.company) continue;
      map.set(`registered:${p.company.id}`, {
        id: `registered:${p.company.id}`,
        displayName: p.company.registered_name,
        logoUrl:
          typeof p.company.cosmetic.logo_url === "string"
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
      });
    }

    for (const b of blacklistData?.blacklist ?? []) {
      const key = `registered:${b.company_id}`;
      const existing = map.get(key);
      if (existing) {
        existing.isBlacklisted = true;
        existing.blacklistEntry = b;
      } else {
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
          blacklistEntry: b,
          legacyEntry: null,
          isImported: false,
          contactEmail: null,
        });
      }
    }

    for (const l of legacyData?.legacyCompanies ?? []) {
      const details = l.company_details as Record<string, unknown>;
      const contactEmail =
        typeof details.contact_email === "string" &&
        details.contact_email.trim()
          ? details.contact_email
          : null;
      map.set(`legacy:${l.id}`, {
        id: `legacy:${l.id}`,
        displayName: l.company_name,
        logoUrl: typeof details.logo_url === "string" ? details.logo_url : null,
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
        contactEmail,
      });
    }

    return [...map.values()];
  }, [partnersData, blacklistData, legacyData]);

  const navigateToDetail = (row: PartnerTableRow) => {
    if (row.isImported && row.legacyEntry) {
      router.push(`/partners/legacy/${row.legacyEntry.id}`);
    } else {
      router.push(`/partners/registered/${row.id.replace("registered:", "")}`);
    }
  };

  const navigateToList = () => router.push("/partners");
  const openDocumentPreview = (url: string, label: string) =>
    setPdfSelection({ kind: "document", url, label });

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

    const nextWidth = ((bounds.right - event.clientX) / bounds.width) * 100;
    updatePreviewWidth(nextWidth);
  };

  if (profileLoading || !account) return null;

  const isLoading = isPartnersLoading || isBlacklistLoading || isLegacyLoading;
  const nowIso = new Date().toISOString();
  const activePartnerCount = rows.filter((row) => {
    if (row.isBlacklisted) return false;
    if (row.hasActiveMoa) return true;
    if (!row.isImported || !row.legacyEntry?.hasMoa) return false;
    return (
      row.legacyEntry.hasPerpetualMoa ||
      !row.legacyEntry.valid_until ||
      row.legacyEntry.valid_until >= nowIso
    );
  }).length;
  const expiredPartnerCount = rows.filter((row) => {
    if (row.isBlacklisted) return false;
    if (!row.isImported) return !!row.isPartnerExpired;
    return (
      !!row.legacyEntry?.hasMoa &&
      !row.legacyEntry.hasPerpetualMoa &&
      !!row.legacyEntry.valid_until &&
      row.legacyEntry.valid_until < nowIso
    );
  }).length;
  const partnerStats = [
    { label: "Total partners", value: rows.length },
    { label: "Active partners", value: activePartnerCount },
    { label: "Expired partners", value: expiredPartnerCount },
  ];
  const partnerEntry =
    detailType === "partner" && detailId
      ? rows.find((r) => r.id === `registered:${detailId}`)
      : null;
  const company = partnerMoasData?.company ?? partnerEntry?.partnerCompany;
  const moas = partnerMoasData?.moas ?? [];
  const legacyCompany = legacyDetailData?.legacyCompany;
  const registeredPartnerStatus = partnerEntry?.isBlacklisted
    ? "blacklisted"
    : partnerEntry?.hasActiveMoa
      ? "active"
      : partnerEntry?.isPartnerExpired
        ? "expired"
        : "inactive";

  const showList = !detailType;
  const showDetailPanel = !!detailType;

  const getCompanyIdForBlacklist = (row: PartnerTableRow) =>
    row.partnerCompany?.id ?? row.blacklistEntry?.company_id ?? "";

  return (
    <PageContainer
      className={cn(
        detailType
          ? pdfSelection
            ? "max-w-none py-0 pr-0 sm:pr-0"
            : "max-w-7xl py-0"
          : "max-w-7xl",
      )}
    >
      {showList && (
        <PageHeader title="Partners" description="Manage your partners.">
          {isLoading
            ? [0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-[58px] w-28" />
              ))
            : partnerStats.map((stat) => (
                <div
                  key={stat.label}
                  className="min-w-28 rounded-[0.33em] border border-gray-200 bg-white px-3 py-2"
                >
                  <p className="text-lg font-semibold leading-none text-gray-900">
                    {stat.value}
                  </p>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {stat.label}
                  </p>
                </div>
              ))}
        </PageHeader>
      )}
      <div className={cn("relative", showList && "mt-6")}>
        {/* ── List panel ───────────────────────────────────────────────────── */}
        {showList && (
          <div className="space-y-6">
            <UniversityPartnersTable
              rows={rows}
              isLoading={isLoading}
              onPartnerClick={navigateToDetail}
              onInvite={openInviteModal}
              toolbarActions={
                <div className="flex">
                  <Button
                    onClick={() =>
                      openModal(
                        "legacy-upload",
                        <UploadDialog
                          uploadEndpoint="/api/university/legacy-companies"
                          queryKeyPrefix="university-legacy-companies"
                          onClose={() => {
                            closeModal("legacy-upload");
                            queryClient.invalidateQueries({
                              queryKey: ["university-partners"],
                            });
                            queryClient.invalidateQueries({
                              queryKey: ["university-legacy-companies"],
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
                    className="rounded-r-none"
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
                              csvEndpoint="/api/university/legacy-companies/bulk/csv"
                              queryKeyPrefix="university-legacy-companies"
                              onClose={() => {
                                closeModal("csv-upload");
                                queryClient.invalidateQueries({
                                  queryKey: ["university-partners"],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ["university-legacy-companies"],
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
                              zipEndpoint="/api/university/legacy-companies/bulk/zip"
                              queryKeyPrefix="university-legacy-companies"
                              onClose={() => {
                                closeModal("zip-upload");
                                queryClient.invalidateQueries({
                                  queryKey: ["university-partners"],
                                });
                                queryClient.invalidateQueries({
                                  queryKey: ["university-legacy-companies"],
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
          </div>
        )}

        {/* ── Detail panel ─────────────────────────────────────────────────── */}
        {showDetailPanel && (
          <div
            className={cn(
              "relative min-h-[calc(100dvh-5rem-1px)] lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0 lg:overflow-hidden",
              pdfSelection && "lg:grid",
            )}
            style={
              pdfSelection
                ? {
                    gridTemplateColumns: `${100 - previewWidth}% ${previewWidth}%`,
                  }
                : undefined
            }
          >
            <div className="min-w-0 space-y-3 py-5 pr-4 lg:h-full lg:overflow-y-auto lg:px-6">
              {/* Partner detail */}
              {detailType === "partner" && (
                <>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={navigateToList}
                      className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
                    >
                      <ArrowLeft className="h-4 w-4" /> Partners
                    </Button>
                  </div>

                  <PartnerIdentity
                    name={company?.registered_name ?? "—"}
                    logoUrl={partnerEntry?.logoUrl}
                    status={registeredPartnerStatus}
                  />

                  {partnerEntry?.isBlacklisted &&
                    partnerEntry.blacklistEntry && (
                      <div className="border-destructive/30 bg-destructive/5 text-destructive space-y-1 rounded-[0.33em] border p-3 text-sm">
                        <p>
                          This company is <strong>blacklisted</strong> — all
                          active MOAs are revoked and new requests are blocked.
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

                  {(partnerMoasData?.company?.document_review_details ||
                    company?.company_type) && (
                    <VerifiedDocumentDetails
                      details={
                        partnerMoasData?.company?.document_review_details ?? {}
                      }
                      companyType={company?.company_type}
                    />
                  )}
                  {partnerMoasData?.companyDocuments && (
                    <DocumentsSection
                      documents={partnerMoasData.companyDocuments}
                      onOpenDocument={openDocumentPreview}
                    />
                  )}

                  <CollapsibleCard
                    id="registered-moa-history"
                    title="MOA history"
                    defaultOpen
                  >
                    <RegisteredPartnerMoasTable
                      moas={moas}
                      isLoading={isMoasLoading}
                      onOpenMoa={setPdfSelection}
                    />
                  </CollapsibleCard>

                  <LegacyRecordsSection
                    currentCompanyId={detailId}
                    onOpenMoa={setPdfSelection}
                    onOpenDocument={openDocumentPreview}
                  />

                  {partnerEntry && (
                    <CollapsibleCard id="partner-actions" title="Actions">
                      <div className="flex flex-col items-start justify-between gap-4 p-4 sm:flex-row sm:items-center">
                        <p className="text-muted-foreground max-w-lg text-sm">
                          {partnerEntry.isBlacklisted
                            ? "Allow this company to send new partnership requests again. Previously revoked MOAs will not be restored."
                            : "Block new requests from this company and revoke its currently active MOAs."}
                        </p>
                        {partnerEntry.isBlacklisted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              modal.confirmAction.open({
                                title: `Remove ${partnerEntry.displayName} from the blacklist?`,
                                description:
                                  "This re-enables future requests from this company. Previously revoked MOAs will not be restored.",
                                confirmLabel: "Remove",
                                onConfirm: () =>
                                  unblacklistMutation.mutate(
                                    getCompanyIdForBlacklist(partnerEntry),
                                  ),
                              })
                            }
                          >
                            Un-blacklist
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            scheme="destructive"
                            size="sm"
                            className="shrink-0"
                            onClick={() =>
                              modal.blacklistPartner.open({
                                companyName: partnerEntry.displayName,
                                onBlacklist: (reason) =>
                                  blacklistMutation.mutate({
                                    companyId:
                                      getCompanyIdForBlacklist(partnerEntry),
                                    reason,
                                  }),
                                isPending: blacklistMutation.isPending,
                              })
                            }
                          >
                            Blacklist company
                          </Button>
                        )}
                      </div>
                    </CollapsibleCard>
                  )}
                </>
              )}

              {/* Legacy detail */}
              {detailType === "legacy" && (
                <>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={navigateToList}
                      className="text-muted-foreground hover:text-foreground gap-1.5 px-0"
                    >
                      <ArrowLeft className="h-4 w-4" /> Partners
                    </Button>
                  </div>
                  {isLegacyDetailLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-8 w-64" />
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ) : legacyCompany ? (
                    <ReadOnlyLegacyDetail
                      company={legacyCompany}
                      canUpload
                      onOpenMoa={setPdfSelection}
                      onPreviewDoc={(url, title) =>
                        openDocumentPreview(url, title)
                      }
                    />
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Legacy company not found.
                    </p>
                  )}
                </>
              )}
            </div>
            {pdfSelection && (
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
                    if (event.key === "ArrowLeft") {
                      updatePreviewWidth(previewWidth + 2);
                    }
                    if (event.key === "ArrowRight") {
                      updatePreviewWidth(previewWidth - 2);
                    }
                  }}
                >
                  <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-300 transition-colors group-hover:bg-primary group-focus:bg-primary" />
                  <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-full border border-gray-300 bg-white text-gray-500 shadow-sm transition-colors group-hover:border-primary group-focus:border-primary">
                    <button
                      type="button"
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={() => setPdfSelection(null)}
                      className="flex h-8 w-7 items-center justify-center border-b border-gray-200 hover:bg-gray-100 hover:text-gray-900"
                      aria-label="Close preview"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                    <span className="flex h-10 w-7 items-center justify-center group-hover:text-primary group-focus:text-primary">
                      <GripVertical className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </div>
                </div>
                <PartnerPdfPane selection={pdfSelection} />
              </>
            )}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

export default function PartnersPage() {
  const { companyId, legacyCompanyId } = useParams<{
    companyId?: string;
    legacyCompanyId?: string;
  }>();
  return (
    <PartnersContent
      initialDetailType={
        companyId ? "partner" : legacyCompanyId ? "legacy" : null
      }
      initialDetailId={companyId ?? legacyCompanyId ?? null}
    />
  );
}
