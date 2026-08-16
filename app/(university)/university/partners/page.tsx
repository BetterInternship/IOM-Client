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
import { useQueryClient } from "@tanstack/react-query";
import { useUniversityProfile } from "@/app/providers/university-profile.provider";
import {
  getUniversityControllerGetAuditLogQueryKey,
  getUniversityControllerGetBlacklistQueryKey,
  getUniversityControllerGetLegacyCompanyQueryKey,
  getUniversityControllerListInvitesQueryKey,
  getUniversityControllerListLegacyCompaniesQueryKey,
  getUniversityControllerListPartnersQueryKey,
  getUniversityControllerListRenewalsQueryKey,
  useUniversityControllerAppendLegacyCompanyMoas,
  useUniversityControllerDeleteLegacyCompanyMoa,
  useUniversityControllerBlacklistCompany,
  useUniversityControllerGetBlacklist,
  useUniversityControllerGetLegacyCompany,
  useUniversityControllerGetPartnerLegacyCompany,
  useUniversityControllerGetPartnerMoas,
  useUniversityControllerListLegacyCompanies,
  useUniversityControllerListPartners,
  useUniversityControllerUpdateLegacyCompanyMoa,
  useUniversityControllerUnblacklistCompany,
  type UniversityPartnerMoasDocumentDto,
} from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { CompanyLogo } from "@/components/company-logo";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusNotice } from "@/components/ui/status-notice";
import { useModal } from "@/app/providers/modal-provider";
import { useIomModalRegistry } from "@/components/modal-registry";
import { toast } from "sonner";
import { toastPresets } from "@/components/sonner-toaster";
import { Card } from "@/components/ui/card";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { isOutstandingMoa } from "@/lib/partner-predicates";
import {
  LegacyCompanyDetail,
  MoaUploadDialog,
  buildMoaRequest,
  isLegacyMoaExpired,
  normalizeBulkUploadResult,
  UploadDialog,
  CsvUploadDialog,
  ZipUploadDialog,
} from "@/components/legacy-companies/legacy-companies-panel";
import { formatDateWithoutTime, cn } from "@/lib/utils";
import {
  Archive,
  ArrowLeft,
  Ban,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Download,
  FileText,
  GripVertical,
  Plus,
  ShieldCheck,
  Upload,
  UserPlus,
  X,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  UniversityPartnersTable,
  NoAccountIndicator,
  type UniversityBlacklistEntry as BlacklistEntry,
  type UniversityLegacyCompanySummary as LegacyCompanySummary,
  type UniversityPartnerTableRow as PartnerTableRow,
  type BulkInviteAction,
} from "@/components/university/university-partners-table";
import {
  LegacyPartnerMoasTable,
  PartnerPdfPane,
  RegisteredPartnerMoasTable,
  type PartnerPdfSelection,
  type RegisteredPartnerMoa,
} from "@/components/university/partner-moa-history-tables";
import {
  universityControllerBulkCreateLegacyCompaniesFromCsv,
  universityControllerBulkCreateLegacyCompaniesFromZip,
  universityControllerCreateLegacyCompany,
} from "@/app/api/app/api/endpoints/university/university";

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
  lastRenewalRequestedAt: string | null;
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
const PREVIEW_WIDTH_STORAGE_KEY = "iom-partner-preview-width";

function mapLegacyCompanySummary(value: unknown): LegacyCompanySummary | null {
  if (typeof value !== "object" || value === null) return null;

  const field = (key: string): unknown =>
    key in value ? Reflect.get(value, key) : undefined;
  const stringField = (key: string): string | null => {
    const result = field(key);
    return typeof result === "string" ? result : null;
  };
  const numberField = (key: string): number => {
    const result = field(key);
    return typeof result === "number" ? result : 0;
  };
  const id = field("id");
  const companyName = field("company_name");
  const companyDetails = field("company_details");
  if (
    typeof id !== "string" ||
    typeof companyName !== "string" ||
    typeof companyDetails !== "object" ||
    companyDetails === null
  ) {
    return null;
  }

  return {
    id,
    company_name: companyName,
    company_details: Object.fromEntries(Object.entries(companyDetails)),
    moaCount: numberField("moaCount"),
    documentCount: numberField("documentCount"),
    valid_until: stringField("valid_until"),
    hasMoa: field("hasMoa") === true,
    hasPerpetualMoa: field("hasPerpetualMoa") === true,
    latestMoaEffectiveDate: stringField("latestMoaEffectiveDate"),
    latestMoaExpiryDate: stringField("latestMoaExpiryDate"),
    latestMoaIsPerpetual: field("latestMoaIsPerpetual") === true,
    registered_company_id: stringField("registered_company_id"),
  };
}

function PartnerTabs({
  outstandingCount,
  expiredCount,
  blacklistedCount,
}: {
  outstandingCount: number;
  expiredCount: number;
  blacklistedCount: number;
}) {
  return (
    <TabsList className="h-auto max-w-full justify-start overflow-x-auto rounded-none border-0 border-b border-gray-200 bg-transparent">
      <TabsTrigger
        value="outstanding"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        Active
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-supportive group-data-[state=active]:text-supportive-foreground">
          {outstandingCount}
        </span>
      </TabsTrigger>
      <TabsTrigger
        value="expired"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        Expired/No MOA
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-destructive group-data-[state=active]:text-destructive-foreground">
          {expiredCount}
        </span>
      </TabsTrigger>
      <TabsTrigger
        value="blacklisted"
        className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
      >
        Blacklisted
        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700 group-data-[state=active]:bg-gray-900 group-data-[state=active]:text-white">
          {blacklistedCount}
        </span>
      </TabsTrigger>
    </TabsList>
  );
}

function PartnerIdentity({
  name,
  logoUrl,
  status,
  badge,
  badgePlacement = "beside",
}: {
  name: string;
  logoUrl?: string | null;
  status: string;
  badge?: ReactNode;
  badgePlacement?: "beside" | "top-right";
}) {
  return (
    <div className="flex items-start gap-3">
      <CompanyLogo name={name} logoUrl={logoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-lg leading-tight font-semibold text-gray-900 uppercase">
            {name}
          </h2>
          {badge && badgePlacement === "beside" && badge}
        </div>
        <div className="mt-1.5">
          <PartnershipStatusBadge
            status={status}
            label={
              status === "active"
                ? "Active Partnership"
                : status === "inactive"
                  ? "No MOA"
                  : undefined
            }
          />
        </div>
      </div>
      {badge && badgePlacement === "top-right" && (
        <div className="ml-auto shrink-0">{badge}</div>
      )}
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
    <CollapsibleCard id="verified-details" title="Verified details">
      <div className="space-y-4 px-5 pb-5">
        {entries.map(([key, field]) => {
          const isDateOfIncorporation =
            key.toLowerCase().replace(/_/g, " ") === "date of incorporation";

          return (
            <DetailField key={key} label={key}>
              <p className="flex min-h-8 items-center break-words text-sm font-medium text-gray-900">
                {isDateOfIncorporation
                  ? formatDateWithoutTime(field.value)
                  : field.value}
              </p>
            </DetailField>
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
  documents: UniversityPartnerMoasDocumentDto[];
  onOpenDocument: (url: string, label: string) => void;
}) {
  return (
    <CollapsibleCard id="documents" title="Documents" defaultOpen={false}>
      <div>
        {DOC_TYPES_LIST.map(([type, label]) => {
          const doc = documents.find((d) => d.type === type);
          const proxiedUrl = doc?.url
            ? `/gcs-proxy?url=${encodeURIComponent(doc.url)}`
            : null;
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
              {doc?.url && (
                <a
                  href={proxiedUrl!}
                  download={doc.filename}
                  aria-label={`Download ${doc.filename}`}
                  title="Download"
                  onClick={(event) => event.stopPropagation()}
                  className="text-muted-foreground hover:text-primary inline-flex size-7 shrink-0 items-center justify-center rounded-md transition-colors"
                >
                  <Download className="size-4" aria-hidden="true" />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </CollapsibleCard>
  );
}

function ReadOnlyLegacyDetail({
  company,
  onOpenMoa,
  showHeader = true,
  canUpload = false,
}: {
  company: LegacyCompanyDetail;
  onOpenMoa: (selection: PartnerPdfSelection) => void;
  showHeader?: boolean;
  canUpload?: boolean;
}) {
  const queryClient = useQueryClient();
  const { openModal, closeModal } = useModal();
  const { confirmAction } = useIomModalRegistry();
  const details = company.company_details as Record<string, unknown>;
  const logoUrl =
    typeof details.logo_url === "string" ? details.logo_url : null;
  const hasActiveMoa = company.moas.some(
    (moa) => !isLegacyMoaExpired(moa.expiry_date, moa.is_perpetual),
  );

  const moaUploadMutation = useUniversityControllerAppendLegacyCompanyMoas({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerGetLegacyCompanyQueryKey(company.id),
        });
        queryClient.invalidateQueries({
          queryKey: getUniversityControllerListLegacyCompaniesQueryKey(),
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
    },
  });
  const refreshLegacyCompany = () => {
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerGetLegacyCompanyQueryKey(company.id),
    });
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerListLegacyCompaniesQueryKey(),
    });
  };
  const updateMoaMutation = useUniversityControllerUpdateLegacyCompanyMoa({
    mutation: {
      onSuccess: () => {
        refreshLegacyCompany();
        closeModal("legacy-edit-moa");
        toast("Legacy MOA updated", toastPresets.success);
      },
      onError: (err) =>
        toast(
          err instanceof Error ? err.message : "Failed to update legacy MOA",
          toastPresets.destructive,
        ),
    },
  });
  const deleteMoaMutation = useUniversityControllerDeleteLegacyCompanyMoa({
    mutation: {
      onSuccess: () => {
        refreshLegacyCompany();
        confirmAction.close();
        toast("Legacy MOA deleted", toastPresets.success);
      },
      onError: (err) =>
        toast(
          err instanceof Error ? err.message : "Failed to delete legacy MOA",
          toastPresets.destructive,
        ),
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
          badge={<NoAccountIndicator />}
        />
      )}

      <div className="flex flex-col">
        <div className="order-1">
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
                          onSubmit={(moas) =>
                            moaUploadMutation.mutate({
                              legacyCompanyId: company.id,
                              data: buildMoaRequest(moas),
                            })
                          }
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
            <LegacyPartnerMoasTable
              moas={company.moas}
              onOpenMoa={onOpenMoa}
              onEditMoa={
                canUpload
                  ? (moa) => {
                      openModal(
                        "legacy-edit-moa",
                        <LegacyMoaEditForm
                          moa={moa}
                          isPending={updateMoaMutation.isPending}
                          onClose={() => closeModal("legacy-edit-moa")}
                          onSubmit={(data) =>
                            updateMoaMutation.mutate({
                              legacyCompanyId: company.id,
                              moaId: moa.id,
                              data,
                            })
                          }
                        />,
                        {
                          title: "Edit Legacy MOA",
                          description: "Update this imported MOA record.",
                          panelClassName: "!w-full sm:!max-w-lg",
                        },
                      );
                    }
                  : undefined
              }
              onDeleteMoa={
                canUpload
                  ? (moa) => {
                      confirmAction.open({
                        title: "Delete this MOA?",
                        description:
                          "This removes the imported MOA record from the company history. This can't be undone.",
                        confirmLabel: "Delete MOA",
                        tone: "warning",
                        isPending: deleteMoaMutation.isPending,
                        onConfirm: () =>
                          deleteMoaMutation.mutate({
                            legacyCompanyId: company.id,
                            moaId: moa.id,
                          }),
                      });
                    }
                  : undefined
              }
            />
          </CollapsibleCard>
        </div>
      </div>
    </>
  );
}

type LegacyMoa = LegacyCompanyDetail["moas"][number];

function LegacyMoaEditForm({
  moa,
  isPending,
  onClose,
  onSubmit,
}: {
  moa: LegacyMoa;
  isPending: boolean;
  onClose: () => void;
  onSubmit: (data: {
    effective_date: string | null;
    expiry_date: string | null;
    is_perpetual: boolean;
    filename: string | null;
    notes: string | null;
  }) => void;
}) {
  const [effectiveDate, setEffectiveDate] = useState(moa.effective_date ?? "");
  const [expiryDate, setExpiryDate] = useState(moa.expiry_date ?? "");
  const [isPerpetual, setIsPerpetual] = useState(moa.is_perpetual);
  const [filename, setFilename] = useState(moa.filename ?? "");
  const [notes, setNotes] = useState(moa.notes ?? "");
  const invalidRange =
    !!effectiveDate && !!expiryDate && expiryDate < effectiveDate;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          id={`edit-perpetual-${moa.id}`}
          type="checkbox"
          className="size-4"
          checked={isPerpetual}
          onChange={(event) => {
            setIsPerpetual(event.target.checked);
            if (event.target.checked) setExpiryDate("");
          }}
        />
        <Label htmlFor={`edit-perpetual-${moa.id}`}>Perpetual MOA</Label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Effective date</Label>
          <DatePicker value={effectiveDate} onChange={setEffectiveDate} />
        </div>
        <div className="space-y-1.5">
          <Label>{isPerpetual ? "Expiry date (N/A)" : "Expiry date"}</Label>
          <DatePicker
            value={expiryDate}
            disabled={isPerpetual}
            onChange={setExpiryDate}
          />
        </div>
      </div>
      {invalidRange && (
        <p className="text-destructive text-sm">
          Expiry date must be on or after the effective date.
        </p>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={`edit-filename-${moa.id}`}>Document name</Label>
        <Input
          id={`edit-filename-${moa.id}`}
          value={filename}
          onChange={(event) => setFilename(event.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`edit-notes-${moa.id}`}>Notes</Label>
        <Textarea
          id={`edit-notes-${moa.id}`}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button
          disabled={invalidRange || isPending}
          onClick={() =>
            onSubmit({
              effective_date: effectiveDate || null,
              expiry_date: isPerpetual ? null : expiryDate || null,
              is_perpetual: isPerpetual,
              filename: filename.trim() || null,
              notes: notes.trim() || null,
            })
          }
        >
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}

function LegacyRecordsSection({
  currentCompanyId: companyId,
  onOpenMoa,
}: {
  currentCompanyId: string | null;
  onOpenMoa: (selection: PartnerPdfSelection) => void;
}) {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useUniversityControllerGetPartnerLegacyCompany(
    companyId,
    {
      query: { enabled: open && !!companyId },
    },
  );

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

  const { data: partnersData, isLoading: isPartnersLoading } =
    useUniversityControllerListPartners({
      query: { enabled: !!account },
    });

  const { data: blacklistData, isLoading: isBlacklistLoading } =
    useUniversityControllerGetBlacklist({
      query: { enabled: !!account },
    });

  const { data: legacyData, isLoading: isLegacyLoading } =
    useUniversityControllerListLegacyCompanies({
      query: { enabled: !!account },
    });

  const { data: partnerMoasData, isLoading: isMoasLoading } =
    useUniversityControllerGetPartnerMoas(detailId, {
      query: {
        enabled: detailType === "partner" && !!detailId,
        refetchInterval: 25 * 60 * 1000,
      },
    });

  const { data: legacyDetailData, isLoading: isLegacyDetailLoading } =
    useUniversityControllerGetLegacyCompany(detailId, {
      query: { enabled: detailType === "legacy" && !!detailId },
    });
  const { data: partnerLegacyData } =
    useUniversityControllerGetPartnerLegacyCompany(
      detailType === "partner" ? detailId : null,
      { query: { enabled: detailType === "partner" && !!detailId } },
    );
  const blacklist = (blacklistData?.blacklist ?? []) as BlacklistEntry[];
  const legacyCompanies = (legacyData?.legacyCompanies ?? [])
    .map(mapLegacyCompanySummary)
    .filter((company): company is LegacyCompanySummary => company !== null);

  const refresh = () => {
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerListPartnersQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerGetBlacklistQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerListLegacyCompaniesQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerGetAuditLogQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerListInvitesQueryKey(),
    });
    queryClient.invalidateQueries({
      queryKey: getUniversityControllerListRenewalsQueryKey(),
    });
  };

  const blacklistMutation = useUniversityControllerBlacklistCompany({
    mutation: {
      onSuccess: () => {
        refresh();
        modal.blacklistPartner.close();
      },
    },
  });

  const unblacklistMutation = useUniversityControllerUnblacklistCompany({
    mutation: {
      onSuccess: () => {
        refresh();
        modal.confirmAction.close();
      },
    },
  });

  const openInviteModal = useCallback(
    (row: PartnerTableRow, kind: "moa" | "listing") => {
      // D9: kind is no longer derived per-row — it's inherited from
      // whichever tab this row's Invite button was clicked from.
      const contactEmail = row.isImported ? (row.contactEmail ?? "") : "";
      const initialStep: 1 | 2 = row.isImported && !contactEmail ? 1 : 2;

      modal.inviteCompany.open({
        onSent: refresh,
        initialMode: row.isImported ? "new" : "registered",
        initialStep,
        initialCompanyId: row.partnerCompany?.id,
        initialCompanyName: row.displayName,
        initialEmail: contactEmail,
        initialKind: kind,
        initialLegacyCompanyId: row.isImported
          ? row.legacyEntry?.id
          : undefined,
        // The row already identifies a specific company — no reason to let
        // the university search for/switch to a different one.
        allowSearch: false,
      });
    },
    [modal.inviteCompany, refresh],
  );

  const openBulkInviteSheet = useCallback(
    (action: BulkInviteAction, selectedRows: PartnerTableRow[]) => {
      modal.bulkInviteCompanies.open({
        action,
        targets: selectedRows.map((row) =>
          row.isImported
            ? {
                type: "legacy" as const,
                legacyCompanyId: row.legacyEntry!.id,
                displayName: row.displayName,
              }
            : {
                type: "registered" as const,
                companyId: row.partnerCompany!.id,
                displayName: row.displayName,
              },
        ),
        onSent: refresh,
      });
    },
    [modal.bulkInviteCompanies, refresh],
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
        lastRenewalRequestedAt: p.lastRenewalRequestedAt,
      });
    }

    for (const b of blacklist) {
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
          lastRenewalRequestedAt: null,
        });
      }
    }

    for (const l of legacyCompanies) {
      if (l.registered_company_id) {
        const registered = map.get(`registered:${l.registered_company_id}`);
        if (registered) {
          registered.legacyEntry = l;
          continue;
        }
      }
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
        lastRenewalRequestedAt: null,
      });
    }

    return [...map.values()];
  }, [partnersData, blacklist, legacyCompanies]);

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
  // D1/D2/D3 — the tab boundary is the invite-kind boundary; blacklisted
  // rows get their own tab so select-all is safe by construction.
  const expiringSoonDays = partnersData?.expiringSoonDays ?? 30;
  const outstandingRows = rows.filter(
    (row) => !row.isBlacklisted && isOutstandingMoa(row, nowIso),
  );
  const expiredOrNoneRows = rows.filter(
    (row) => !row.isBlacklisted && !isOutstandingMoa(row, nowIso),
  );
  const blacklistedRows = rows.filter((row) => row.isBlacklisted);

  const partnerEntry =
    detailType === "partner" && detailId
      ? rows.find((r) => r.id === `registered:${detailId}`)
      : null;
  const company = partnerMoasData?.company ?? partnerEntry?.partnerCompany;
  const moas = partnerMoasData?.moas ?? [];
  const legacyCompany = legacyDetailData?.legacyCompany;
  const partnerLegacyCompany = partnerLegacyData?.legacyCompany;
  const combinedMoas = [
    ...moas,
    ...(partnerLegacyCompany?.moas ?? []).map((legacyMoa) => ({
      id: `legacy:${legacyMoa.id}`,
      status: isLegacyMoaExpired(legacyMoa.expiry_date, legacyMoa.is_perpetual)
        ? "Expired"
        : "Active",
      created_at: legacyMoa.created_at,
      effective_date: legacyMoa.effective_date,
      expiry_date: legacyMoa.expiry_date,
      is_expired: isLegacyMoaExpired(
        legacyMoa.expiry_date,
        legacyMoa.is_perpetual,
      ),
      template: { name: legacyMoa.filename ?? "Imported MOA" },
      imported: true,
      importedUrl: legacyMoa.document_url,
      importedLabel: legacyMoa.filename,
    })),
  ];
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
      <div className="relative">
        {/* ── List panel ───────────────────────────────────────────────────── */}
        {showList && (
          <div className="space-y-4">
            <PageHeader
              title="Partners"
              description="Manage your university's partner companies and their MOAs."
            >
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button>
                    <Plus /> Add Partner
                    <ChevronDown className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 p-1.5">
                  <DropdownMenuItem
                    className="cursor-pointer items-start gap-3 px-3 py-2"
                    onSelect={() =>
                      modal.inviteCompany.open({
                        onSent: refresh,
                        initialMode: "new",
                        initialKind: "moa",
                      })
                    }
                  >
                    <UserPlus className="mt-0.5 size-4 text-primary" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        Invite Partner
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Invite a company to sign a MOA
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer items-start gap-3 px-3 py-2"
                    onSelect={() =>
                      openModal(
                        "legacy-upload",
                        <UploadDialog
                          createRequest={
                            universityControllerCreateLegacyCompany
                          }
                          queryKey={getUniversityControllerListLegacyCompaniesQueryKey()}
                          onClose={() => {
                            closeModal("legacy-upload");
                            queryClient.invalidateQueries({
                              queryKey:
                                getUniversityControllerListPartnersQueryKey(),
                            });
                            queryClient.invalidateQueries({
                              queryKey:
                                getUniversityControllerListLegacyCompaniesQueryKey(),
                            });
                          }}
                        />,
                        {
                          title: "Add Partner",
                          description:
                            "Create a partner manually. You can add MOAs now or later from the company detail view.",
                          panelClassName: "!w-full sm:!max-w-2xl",
                        },
                      )
                    }
                  >
                    <Plus className="mt-0.5 size-4 text-primary" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        Add Partner
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Manually create a new partner
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer items-start gap-3 px-3 py-2"
                    onSelect={() =>
                      openModal(
                        "csv-upload",
                        <CsvUploadDialog
                          uploadRequest={async (file) =>
                            normalizeBulkUploadResult(
                              await universityControllerBulkCreateLegacyCompaniesFromCsv(
                                { file },
                              ),
                            )
                          }
                          queryKey={getUniversityControllerListLegacyCompaniesQueryKey()}
                          onClose={() => {
                            closeModal("csv-upload");
                            queryClient.invalidateQueries({
                              queryKey:
                                getUniversityControllerListPartnersQueryKey(),
                            });
                            queryClient.invalidateQueries({
                              queryKey:
                                getUniversityControllerListLegacyCompaniesQueryKey(),
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
                    <Upload className="mt-0.5 size-4 text-primary" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        Bulk Upload via CSV
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Import partner records from a spreadsheet
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer items-start gap-3 px-3 py-2"
                    onSelect={() =>
                      openModal(
                        "zip-upload",
                        <ZipUploadDialog
                          uploadRequest={async (file) =>
                            normalizeBulkUploadResult(
                              await universityControllerBulkCreateLegacyCompaniesFromZip(
                                { file },
                              ),
                            )
                          }
                          queryKey={getUniversityControllerListLegacyCompaniesQueryKey()}
                          onClose={() => {
                            closeModal("zip-upload");
                            queryClient.invalidateQueries({
                              queryKey:
                                getUniversityControllerListPartnersQueryKey(),
                            });
                            queryClient.invalidateQueries({
                              queryKey:
                                getUniversityControllerListLegacyCompaniesQueryKey(),
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
                    <Archive className="mt-0.5 size-4 text-primary" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        Bulk Upload via ZIP
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Import a ZIP file with MOA documents
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="cursor-pointer items-start gap-3 px-3 py-2"
                    onSelect={() =>
                      router.push("/university/partners/import-wizard")
                    }
                  >
                    <FileText className="mt-0.5 size-4 text-primary" />
                    <span>
                      <span className="block text-sm font-semibold text-gray-900">
                        Bulk Upload Wizard
                      </span>
                      <span className="text-muted-foreground block text-xs">
                        Upload PDFs and manually name them through the wizard
                      </span>
                    </span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </PageHeader>

            <Tabs defaultValue="outstanding">
              <TabsContent value="outstanding">
                <UniversityPartnersTable
                  rows={outstandingRows}
                  isLoading={isLoading}
                  tab="outstanding"
                  expiringSoonDays={expiringSoonDays}
                  onPartnerClick={navigateToDetail}
                  onInvite={(row) => openInviteModal(row, "listing")}
                  toolbarStart={
                    <PartnerTabs
                      outstandingCount={outstandingRows.length}
                      expiredCount={expiredOrNoneRows.length}
                      blacklistedCount={blacklistedRows.length}
                    />
                  }
                />
              </TabsContent>
              <TabsContent value="expired">
                <UniversityPartnersTable
                  rows={expiredOrNoneRows}
                  isLoading={isLoading}
                  tab="expired"
                  expiringSoonDays={expiringSoonDays}
                  onPartnerClick={navigateToDetail}
                  onInvite={(row) => openInviteModal(row, "moa")}
                  toolbarStart={
                    <PartnerTabs
                      outstandingCount={outstandingRows.length}
                      expiredCount={expiredOrNoneRows.length}
                      blacklistedCount={blacklistedRows.length}
                    />
                  }
                />
              </TabsContent>
              <TabsContent value="blacklisted">
                <UniversityPartnersTable
                  rows={blacklistedRows}
                  isLoading={isLoading}
                  tab="blacklisted"
                  expiringSoonDays={expiringSoonDays}
                  onPartnerClick={navigateToDetail}
                  toolbarStart={
                    <PartnerTabs
                      outstandingCount={outstandingRows.length}
                      expiredCount={expiredOrNoneRows.length}
                      blacklistedCount={blacklistedRows.length}
                    />
                  }
                />
              </TabsContent>
            </Tabs>
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
                    badgePlacement="top-right"
                    badge={
                      partnerEntry ? (
                        partnerEntry.isBlacklisted ? (
                          <Button
                            variant="outline"
                            size="sm"
                            aria-label="Un-blacklist company"
                            className="group/blacklist h-8 max-w-8 gap-0 overflow-hidden rounded-[0.33em] px-2 transition-[max-width,gap] duration-200 hover:max-w-32 hover:gap-1.5"
                            onClick={() =>
                              modal.confirmAction.open({
                                title: `Remove ${partnerEntry.displayName} from the blacklist?`,
                                description:
                                  "This re-enables future requests from this company. Previously revoked MOAs will not be restored.",
                                confirmLabel: "Remove",
                                onConfirm: () =>
                                  unblacklistMutation.mutate({
                                    companyId:
                                      getCompanyIdForBlacklist(partnerEntry),
                                  }),
                              })
                            }
                          >
                            <Ban className="size-3.5 shrink-0" />
                            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover/blacklist:max-w-24 group-hover/blacklist:opacity-100">
                              Un-blacklist
                            </span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            scheme="destructive"
                            size="sm"
                            aria-label="Blacklist company"
                            className="group/blacklist h-8 max-w-8 gap-0 overflow-hidden rounded-[0.33em] px-2 transition-[max-width,gap] duration-200 hover:max-w-32 hover:gap-1.5"
                            onClick={() =>
                              modal.blacklistPartner.open({
                                companyName: partnerEntry.displayName,
                                onBlacklist: (reason) =>
                                  blacklistMutation.mutate({
                                    data: {
                                      companyId:
                                        getCompanyIdForBlacklist(partnerEntry),
                                      reason: reason || undefined,
                                    },
                                  }),
                                isPending: blacklistMutation.isPending,
                              })
                            }
                          >
                            <Ban className="size-3.5 shrink-0" />
                            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-[max-width,opacity] duration-200 group-hover/blacklist:max-w-24 group-hover/blacklist:opacity-100">
                              Blacklist
                            </span>
                          </Button>
                        )
                      ) : null
                    }
                  />

                  {partnerEntry?.isBlacklisted &&
                    partnerEntry.blacklistEntry && (
                      <StatusNotice
                        icon={Ban}
                        variant="destructive"
                        title="This company is blacklisted — all active MOAs are revoked and new requests are blocked."
                        description={
                          <>
                            Blacklisted on{" "}
                            {formatDateWithoutTime(
                              partnerEntry.blacklistEntry.created_at,
                            )}
                            {partnerEntry.blacklistEntry.actor_email &&
                              ` by ${partnerEntry.blacklistEntry.actor_email}`}
                          </>
                        }
                      />
                    )}

                  <CollapsibleCard
                    id="registered-moa-history"
                    title="MOA history"
                    defaultOpen
                  >
                    <RegisteredPartnerMoasTable
                      moas={combinedMoas}
                      isLoading={isMoasLoading}
                      onOpenMoa={setPdfSelection}
                    />
                  </CollapsibleCard>

                  {(partnerMoasData?.company?.document_review_details ||
                    company?.company_type) && (
                    <VerifiedDocumentDetails
                      details={
                        (partnerMoasData?.company?.document_review_details ??
                          {}) as DocReviewDetails
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
