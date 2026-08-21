"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getAdminControllerCompanyReviewDetailQueryKey,
  getAdminControllerCompanyReviewQueueQueryKey,
  getAdminControllerCompanyReviewQueueQueryOptions,
  getAdminControllerGetCompanyQueryKey,
  getAdminControllerListCompaniesQueryKey,
  getAdminControllerOverviewQueryKey,
  useAdminControllerApproveCompany,
  useAdminControllerCompanyReviewDetail,
  useAdminControllerRejectCompany,
  useAdminControllerTinAvailable,
  type AdminReviewHistoryItemDto,
  type ApproveCompanyReviewDtoCompanyType,
} from "@/app/api";
import type { ApiError } from "@/app/api/preconfig.axios";
import { PageContainer } from "@/components/page-header";
import { CompanyLogo } from "@/components/company-logo";
import { DocumentPreviewPane } from "@/components/document-preview-pane";
import { toastPresets } from "@/components/sonner-toaster";
import { Card, CardContent } from "@/components/ui/card";
import {
  CollapsibleCardGroup,
  CollapsibleCardSection,
} from "@/components/ui/collapsible-card";
import { DetailField } from "@/components/ui/detail-field";
import { Button } from "@/components/ui/button";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { Input } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MorphHeight } from "@/components/ui/morph-height";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useModal } from "@/app/providers/modal-provider";
import { REQUIRED_DOCUMENT_TYPES, documentLabel } from "@/lib/document-types";
import { cn, formatDateWithoutTime } from "@/lib/utils";
import { ArrowLeft, Check, Eye, Loader2, X } from "lucide-react";

interface ReviewDoc {
  type: string;
  filename: string;
  url: string | null;
}

const COMPANY_TYPES: Array<{
  value: ApproveCompanyReviewDtoCompanyType;
  label: string;
}> = [
  { value: "corporation", label: "Corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "sole_proprietorship", label: "Sole Proprietorship" },
  { value: "government_agency", label: "Government Agency" },
];

const COMPANY_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  COMPANY_TYPES.map((t) => [t.value, t.label]),
);

// Short labels for the tabs and left-panel rows on this page only — admins
// are the only audience here, so the full legal document names (used
// everywhere a company sees its own docs) aren't needed.
const REVIEW_DOCUMENT_LABELS: Record<string, string> = {
  bir_2303: "BIR Form 2303",
  sec_dti_registration: "SEC/DTI Reg Form",
  mayor_permit: "Mayor's Permit",
};

const reviewDocumentLabel = (type: string) =>
  REVIEW_DOCUMENT_LABELS[type] ?? documentLabel(type);

function ReviewStatusBadge({
  status,
}: {
  status: AdminReviewHistoryItemDto["status"];
}) {
  if (status === null) {
    return <PartnershipStatusBadge status="pending" label="Pending" />;
  }
  if (status === "approved") {
    return <PartnershipStatusBadge status="active" label="Approved" />;
  }
  if (status === "rejected") {
    return <PartnershipStatusBadge status="rejected" label="Rejected" />;
  }
  return <PartnershipStatusBadge status="inactive" label="Superseded" />;
}

// unknown-valued fields come back from generic Record<string, X> DTOs the
// OpenAPI codegen can't narrow further (see admin/companies/[companyId]
// /page.tsx for the same pattern) — render defensively.
const asDisplayString = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

function DocumentsReadOnly({ entry }: { entry: AdminReviewHistoryItemDto }) {
  const documents = entry.documents ?? [];
  if (documents.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
      {documents.map((doc) => {
        const label = documentLabel(doc.type);
        return (
          <a
            key={doc.type}
            href={doc.url ?? undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
              doc.url
                ? "cursor-pointer hover:bg-gray-50"
                : "pointer-events-none cursor-default opacity-50",
            )}
          >
            <span className="bg-primary/5 text-primary flex size-8 shrink-0 items-center justify-center rounded-[0.2em]">
              <Eye className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-gray-900">
                {label}
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                {doc.filename}
              </span>
            </span>
            <span className="text-primary text-xs font-medium">
              {doc.url ? "View" : "Unavailable"}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function CompanyIdentity({
  name,
  email,
  logoUrl,
}: {
  name: string;
  email: string;
  logoUrl?: string | null;
}) {
  return (
    <div className="flex items-center gap-3">
      <CompanyLogo name={name} logoUrl={logoUrl} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h1 className="text-lg leading-tight font-semibold text-gray-900">
            {name}
          </h1>
        </div>
        <p className="text-muted-foreground mt-1.5 text-sm">{email}</p>
      </div>
    </div>
  );
}

// Documents — one row each: document name, an accept checkbox, and (once
// accepted) an animated-in expiry date. A document left unchecked is
// treated as rejected, and its reason gets collected in the reject
// confirmation modal instead of here — it might not even be uploaded yet.
function ReviewDocumentCard({
  type,
  label,
  document,
  accepted,
  onAcceptedChange,
  expiryValue,
  onExpiryChange,
  onExpiryValidityChange,
}: {
  type: string;
  label: string;
  document: ReviewDoc | undefined;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  expiryValue: string;
  onExpiryChange: (value: string) => void;
  onExpiryValidityChange: (isValid: boolean) => void;
}) {
  return (
    <div className="border-b border-gray-100 px-4 py-4 last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          {!document && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              Not included with this request
            </p>
          )}
        </div>
        <Checkbox
          checked={accepted && !!document}
          disabled={!document}
          onCheckedChange={(checked) => onAcceptedChange(checked === true)}
          aria-label={`Accept ${label}`}
        />
      </div>

      <MorphHeight>
        {accepted && document ? (
          <div className="pt-3">
            <DetailField
              label={
                <Label htmlFor={`expiry-${type}`}>
                  Expires on (blank = perpetual)
                </Label>
              }
              labelClassName="sm:min-h-9"
            >
              <DatePicker
                id={`expiry-${type}`}
                className="h-9 text-sm"
                value={expiryValue}
                onChange={onExpiryChange}
                onValidityChange={onExpiryValidityChange}
              />
            </DetailField>
          </div>
        ) : null}
      </MorphHeight>
    </div>
  );
}

function MaterialFields({ entry }: { entry: AdminReviewHistoryItemDto }) {
  if (!entry.material) return null;
  const fields = Object.entries(entry.material).filter(
    (field): field is [string, string] => typeof field[1] === "string" && field[1] !== "",
  );
  if (fields.length === 0) return null;
  return (
    <div className="space-y-4 px-5 pb-5">
      {fields.map(([key, value]) => (
        <DetailField
          key={key}
          label={key.replace(/_/g, " ")}
          labelClassName="capitalize"
        >
          <p className="flex min-h-8 min-w-0 items-center break-words text-sm font-medium text-gray-900">
            {key === "company_type" ? (COMPANY_TYPE_LABELS[value] ?? value) : value}
          </p>
        </DetailField>
      ))}
    </div>
  );
}

function CompactHistorySection({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string }>;
}) {
  if (!rows.length) return null;
  return (
    <section>
      <h3 className="border-y border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold tracking-wide text-gray-700 uppercase first:border-t-0">
        {title}
      </h3>
      <dl>
        {rows.map((row) => (
          <div
            key={row.label}
            className="grid gap-1 border-b border-gray-100 px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(9rem,35%)_1fr] sm:items-center sm:gap-4"
          >
            <dt className="text-muted-foreground text-xs">{row.label}</dt>
            <dd className="break-words text-sm font-medium text-gray-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function PastReviewContent({ entry }: { entry: AdminReviewHistoryItemDto }) {
  const companyRows = Object.entries(entry.material ?? {})
    .filter((field): field is [string, string] => typeof field[1] === "string" && !!field[1])
    .map(([key, value]) => ({
      label: key.replace(/_/g, " "),
      value: key === "company_type" ? (COMPANY_TYPE_LABELS[value] ?? value) : value,
    }));
  const reviewRows = Object.entries(entry.document_review_details ?? {})
    .map(([key, field]) => {
      const value =
        field && typeof field === "object" && "value" in field
          ? asDisplayString((field as { value: unknown }).value)
          : "";
      return { label: key, value };
    })
    .filter((row) => !!row.value);
  const decisionRows = [
    { label: "Reviewed by", value: entry.reviewer_email ?? "Not reviewed" },
    {
      label: "Decision date",
      value: entry.reviewed_at
        ? formatDateWithoutTime(entry.reviewed_at)
        : "Not reviewed",
    },
    ...(entry.approval_expires_at
      ? [
          {
            label: "Approval expiry",
            value: formatDateWithoutTime(entry.approval_expires_at),
          },
        ]
      : []),
    ...(entry.rejection_reason
      ? [{ label: "Rejection reason", value: entry.rejection_reason }]
      : []),
  ];

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
        <CompactHistorySection title="Decision" rows={decisionRows} />
        <CompactHistorySection title="Company details" rows={companyRows} />
        <CompactHistorySection title="Review details" rows={reviewRows} />
      </div>

      {(entry.documents ?? []).length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Documents</h3>
          <DocumentsReadOnly entry={entry} />
        </section>
      )}
    </div>
  );
}

interface IdentityForm {
  registered_name: string;
  tin: string;
  company_type: ApproveCompanyReviewDtoCompanyType | "";
  registered_address: string;
  date_of_incorporation: string;
  company_registry_number: string;
}

function ApproveSummaryModal({
  identity,
  expiries,
  isPending,
  onConfirm,
  onCancel,
}: {
  identity: IdentityForm;
  expiries: Record<string, string>;
  isPending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["Registered name", identity.registered_name],
    ["TIN", identity.tin],
    ["Company type", COMPANY_TYPE_LABELS[identity.company_type] ?? identity.company_type],
    ["Registered address", identity.registered_address],
    ["Date of incorporation", identity.date_of_incorporation],
    ["Company registry number", identity.company_registry_number],
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[0.33em] border border-gray-200">
        <dl>
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid gap-1 border-b border-gray-100 px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(9rem,40%)_1fr] sm:items-center sm:gap-4"
            >
              <dt className="text-muted-foreground text-xs">{label}</dt>
              <dd className="break-words text-sm font-medium text-gray-900">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="space-y-1.5">
        <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
          Document expiry
        </p>
        <div className="overflow-hidden rounded-[0.33em] border border-gray-200">
          {REQUIRED_DOCUMENT_TYPES.map((type) => (
            <div
              key={type}
              className="flex items-center justify-between gap-4 border-b border-gray-100 px-4 py-2.5 text-sm last:border-b-0"
            >
              <span className="text-gray-700">{documentLabel(type)}</span>
              <span
                className={cn(
                  "font-semibold",
                  expiries[type] ? "text-warning" : "text-muted-foreground",
                )}
              >
                {expiries[type]
                  ? formatDateWithoutTime(expiries[type])
                  : "Perpetual"}
              </span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        The company will be able to request MOAs from any university and is
        emailed a confirmation.
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" disabled={isPending} onClick={onCancel}>
          Cancel
        </Button>
        <Button scheme="supportive" disabled={isPending} onClick={onConfirm}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? "Approving…" : "Confirm approval"}
        </Button>
      </div>
    </div>
  );
}

function RejectCompanyForm({
  companyName,
  documentTypes,
  onReject,
}: {
  companyName: string;
  documentTypes: string[];
  onReject: (
    documentRejections: Record<string, string>,
    note: string,
  ) => Promise<unknown>;
}) {
  const { closeModal } = useModal();
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = documentTypes.every((type) => !!reasons[type]?.trim());

  const rejectCompany = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      const documentRejections = Object.fromEntries(
        documentTypes.map((type) => [type, reasons[type].trim()]),
      );
      await onReject(documentRejections, note);
    } catch {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        {companyName} will be asked to update the flagged documents below.
        Each reason is emailed to the company.
      </p>
      {documentTypes.length > 0 && (
        <div className="space-y-3">
          {documentTypes.map((type) => (
            <div key={type} className="space-y-1.5">
              <Label htmlFor={`reject-reason-${type}`}>
                {documentLabel(type)}
              </Label>
              <Textarea
                id={`reject-reason-${type}`}
                rows={2}
                placeholder="Reason (required — emailed to the company)"
                value={reasons[type] ?? ""}
                onChange={(event) =>
                  setReasons((v) => ({ ...v, [type]: event.target.value }))
                }
              />
            </div>
          ))}
        </div>
      )}
      <Textarea
        rows={2}
        placeholder="Additional note (optional — emailed to the company)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          disabled={isSubmitting}
          onClick={() => closeModal("reject-company")}
        >
          Cancel
        </Button>
        <Button
          scheme="destructive"
          disabled={isSubmitting || !canSubmit}
          onClick={rejectCompany}
        >
          {isSubmitting && <Loader2 className="animate-spin" />}
          {isSubmitting ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminCompanyReviewPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();
  const { openModal, closeModal } = useModal();

  const [identity, setIdentity] = useState<IdentityForm>({
    registered_name: "",
    tin: "",
    company_type: "",
    registered_address: "",
    date_of_incorporation: "",
    company_registry_number: "",
  });
  const [dateValid, setDateValid] = useState(false);
  const [debouncedTin, setDebouncedTin] = useState("");
  const [expiryValues, setExpiryValues] = useState<Record<string, string>>({});
  const [expiryValidity, setExpiryValidity] = useState<Record<string, boolean>>({});
  const [acceptedDocs, setAcceptedDocs] = useState<Record<string, boolean>>({});
  const prefetchedReviewId = useRef<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTin(identity.tin.trim()), 350);
    return () => clearTimeout(timer);
  }, [identity.tin]);

  const { data, isLoading, refetch } = useAdminControllerCompanyReviewDetail(
    companyId,
    {
      query: {
        queryKey: getAdminControllerCompanyReviewDetailQueryKey(companyId),
        enabled: !!companyId,
        refetchInterval: 25 * 60 * 1000,
      },
    },
  );

  const { data: tinCheck, isFetching: tinChecking } =
    useAdminControllerTinAvailable(
      { tin: debouncedTin, companyId },
      { query: { enabled: debouncedTin.length > 0 } },
    );
  const tinConflict =
    debouncedTin && tinCheck?.available === false ? tinCheck : null;

  const invalidate = () => {
    refetch();
    queryClient.invalidateQueries({
      queryKey: getAdminControllerCompanyReviewQueueQueryKey(),
    });
  };

  const onConflict = (e: Error) => {
    const status = (e as { response?: { status?: number } }).response?.status;
    if (status === 409) {
      const error = e as ApiError;
      if (error.code === "TIN_TAKEN") {
        toast.error(error.message || "This TIN is already registered.");
        return true;
      }
      toast.message("This review changed — reloading");
      invalidate();
      return true;
    }
    return false;
  };

  const approve = useAdminControllerApproveCompany({
    mutation: {
      onSuccess: async () => {
        toast("Company verified", toastPresets.success);
        closeModal("approve-company");
        setIdentity({
          registered_name: "",
          tin: "",
          company_type: "",
          registered_address: "",
          date_of_incorporation: "",
          company_registry_number: "",
        });
        setExpiryValues({});

        await queryClient.invalidateQueries({
          queryKey: getAdminControllerCompanyReviewQueueQueryKey(),
          exact: true,
          refetchType: "none",
        });

        const [queueResult] = await Promise.allSettled([
          queryClient.fetchQuery(
            getAdminControllerCompanyReviewQueueQueryOptions(),
          ),
          queryClient.refetchQueries({
            queryKey: getAdminControllerOverviewQueryKey(),
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: getAdminControllerListCompaniesQueryKey(),
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: getAdminControllerGetCompanyQueryKey(companyId),
            exact: true,
          }),
        ]);

        const hasNoPendingReviews =
          queueResult.status === "fulfilled" &&
          queueResult.value.reviews.length === 0;
        router.replace(hasNoPendingReviews ? "/companies" : "/reviews");
      },
      onError: (e: Error) => {
        closeModal("approve-company");
        if (!onConflict(e)) toast.error(e.message);
      },
    },
  });

  const reject = useAdminControllerRejectCompany({
    mutation: {
      onSuccess: () => {
        toast.success("Company review rejected");
        closeModal("reject-company");
        setAcceptedDocs({});
        invalidate();
      },
      onError: (e: Error) => {
        if (!onConflict(e)) toast.error(e.message);
      },
    },
  });

  const { openEntry, pastEntries } = useMemo(() => {
    const visible = (data?.history ?? []).filter(
      (h) => h.status !== "superseded",
    );
    const open = data?.openReviewId
      ? visible.find((h) => h.id === data.openReviewId)
      : undefined;
    const past = visible.filter((h) => h.id !== data?.openReviewId);
    return { openEntry: open ?? null, pastEntries: past };
  }, [data]);

  useEffect(() => {
    if (!openEntry || prefetchedReviewId.current === openEntry.id) return;
    prefetchedReviewId.current = openEntry.id;
    const priorApproval = data?.history.find((entry) => entry.status === "approved");
    const priorDetails = priorApproval?.document_review_details as
      | Record<string, { value?: unknown }>
      | null
      | undefined;
    const company = data?.company;
    setIdentity({
      registered_name: company?.registered_name ?? "",
      tin: company?.tin ?? "",
      company_type: (company?.company_type as ApproveCompanyReviewDtoCompanyType) ?? "",
      registered_address: company?.registered_address ?? "",
      date_of_incorporation: asDisplayString(
        priorDetails?.["Date of Incorporation"]?.value,
      ),
      company_registry_number: asDisplayString(
        priorDetails?.["Company Registry Number"]?.value,
      ),
    });
    setDateValid(!!priorDetails?.["Date of Incorporation"]?.value);
    setExpiryValues({});
    setExpiryValidity({});
    setAcceptedDocs({});
  }, [data, openEntry]);

  const documentByType = useMemo(() => {
    const map = new Map<string, ReviewDoc>();
    for (const doc of openEntry?.documents ?? []) map.set(doc.type, doc);
    return map;
  }, [openEntry]);

  const notAcceptedCount = REQUIRED_DOCUMENT_TYPES.filter(
    (type) => !acceptedDocs[type],
  ).length;
  const allDocsAccepted = REQUIRED_DOCUMENT_TYPES.every(
    (type) => acceptedDocs[type] && documentByType.has(type),
  );

  const expiryOk = (type: string) =>
    !expiryValues[type]?.trim() || expiryValidity[type] !== false;

  const identityComplete =
    !!identity.registered_name.trim() &&
    !!identity.tin.trim() &&
    !!identity.company_type &&
    !!identity.registered_address.trim() &&
    !!identity.date_of_incorporation.trim() &&
    dateValid &&
    !!identity.company_registry_number.trim();

  const canApprove =
    !!openEntry &&
    identityComplete &&
    !tinConflict &&
    !tinChecking &&
    allDocsAccepted &&
    REQUIRED_DOCUMENT_TYPES.every(expiryOk);

  const openApproveSummary = () => {
    openModal(
      "approve-company",
      <ApproveSummaryModal
        identity={identity}
        expiries={expiryValues}
        isPending={approve.isPending}
        onCancel={() => closeModal("approve-company")}
        onConfirm={() =>
          approve.mutate({
            companyId,
            data: {
              registered_name: identity.registered_name.trim(),
              tin: identity.tin.trim(),
              company_type: identity.company_type as ApproveCompanyReviewDtoCompanyType,
              registered_address: identity.registered_address.trim(),
              date_of_incorporation: identity.date_of_incorporation.trim(),
              company_registry_number: identity.company_registry_number.trim(),
              document_expiries: Object.fromEntries(
                REQUIRED_DOCUMENT_TYPES.map((type) => [
                  type,
                  expiryValues[type]?.trim() || null,
                ]),
              ),
            },
          })
        }
      />,
      {
        title: "Confirm approval",
        panelClassName: "!w-full sm:!max-w-lg",
      },
    );
  };

  const openRejectSummary = () => {
    const documentTypes = REQUIRED_DOCUMENT_TYPES.filter(
      (type) => !acceptedDocs[type],
    );
    openModal(
      "reject-company",
      <RejectCompanyForm
        companyName={identity.registered_name || data?.company.email || "This company"}
        documentTypes={documentTypes}
        onReject={(documentRejections, note) =>
          reject.mutateAsync({
            companyId,
            data: { document_rejections: documentRejections, reason: note || undefined },
          })
        }
      />,
      {
        title: "Reject verification",
        panelClassName: "!w-full sm:!max-w-md",
      },
    );
  };

  if (isLoading) {
    return (
      <PageContainer className="max-w-3xl space-y-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </PageContainer>
    );
  }
  if (!data?.company) {
    return (
      <PageContainer className="max-w-3xl">
        <Card>
          <CardContent className="text-destructive py-8 text-center text-sm">
            Company not found.
          </CardContent>
        </Card>
      </PageContainer>
    );
  }

  if (!openEntry) {
    return router.push("/reviews");
  }

  const { company } = data;
  const companyDisplayName =
    company.registered_name ?? company.email ?? "Unregistered company";
  // logo_url lives in the same cosmetic jsonb blob but isn't a declared
  // field on AdminCompanyCosmeticDto (matches the sibling detail page).
  const companyLogoUrl =
    typeof (company.cosmetic as Record<string, unknown> | null)?.logo_url ===
    "string"
      ? ((company.cosmetic as Record<string, unknown>).logo_url as string)
      : null;

  return (
    <PageContainer className="max-w-none py-0 pr-0 sm:pr-0">
      <div className="relative min-h-[calc(100dvh-5rem-1px)] lg:grid lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0 lg:grid-cols-2 lg:overflow-hidden">
        <div className="min-w-0 space-y-3 py-5 pr-4 lg:h-full lg:overflow-y-auto lg:px-6">
          <Link
            href="/reviews"
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="h-4 w-4" /> Company Reviews
          </Link>

          <CompanyIdentity
            name={companyDisplayName}
            email={company.email ?? "No account email"}
            logoUrl={companyLogoUrl}
          />
          <p className="text-muted-foreground text-sm">
            Submitted {formatDateWithoutTime(openEntry.created_at)}
          </p>

          <CollapsibleCardGroup
            type="multiple"
            defaultValue={["identity", "documents", "review-details"]}
            variant="grouped"
          >
            <CollapsibleCardSection
              value="identity"
              trigger="Company identity"
              triggerClassName="hover:bg-gray-50"
              contentClassName="space-y-4 px-5 pb-5"
            >
              <DetailField
                label={<Label htmlFor="identity-name">Registered name</Label>}
                labelClassName="sm:min-h-9"
              >
                <Input
                  id="identity-name"
                  className="h-9 text-sm"
                  value={identity.registered_name}
                  onChange={(e) =>
                    setIdentity((v) => ({
                      ...v,
                      registered_name: e.target.value.toUpperCase(),
                    }))
                  }
                />
              </DetailField>

              <DetailField
                label={<Label htmlFor="identity-tin">TIN</Label>}
                labelClassName="sm:min-h-9"
              >
                <div className="space-y-1">
                  <Input
                    id="identity-tin"
                    className="h-9 text-sm"
                    placeholder="000-000-000-000"
                    value={identity.tin}
                    onChange={(e) =>
                      setIdentity((v) => ({ ...v, tin: e.target.value }))
                    }
                  />
                  {tinConflict && (
                    <p className="text-destructive text-xs">
                      Already registered to{" "}
                      {tinConflict.censoredEmail ?? "another company"} — sign
                      in there instead.
                    </p>
                  )}
                </div>
              </DetailField>

              <DetailField
                label={<Label htmlFor="identity-type">Company type</Label>}
                labelClassName="sm:min-h-9"
              >
                <Select
                  value={identity.company_type}
                  onValueChange={(v) =>
                    setIdentity((state) => ({
                      ...state,
                      company_type: v as ApproveCompanyReviewDtoCompanyType,
                    }))
                  }
                >
                  <SelectTrigger id="identity-type" className="h-9 text-sm">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMPANY_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </DetailField>

              <DetailField
                label={<Label htmlFor="identity-address">Registered address</Label>}
                labelClassName="sm:min-h-9"
              >
                <Input
                  id="identity-address"
                  className="h-9 text-sm"
                  value={identity.registered_address}
                  onChange={(e) =>
                    setIdentity((v) => ({
                      ...v,
                      registered_address: e.target.value,
                    }))
                  }
                />
              </DetailField>

              <DetailField
                label={
                  <Label htmlFor="identity-incorporation">
                    Date of incorporation
                  </Label>
                }
                labelClassName="sm:min-h-9"
              >
                <DatePicker
                  id="identity-incorporation"
                  className="h-9 text-sm"
                  value={identity.date_of_incorporation}
                  onChange={(value) =>
                    setIdentity((v) => ({ ...v, date_of_incorporation: value }))
                  }
                  onValidityChange={setDateValid}
                />
              </DetailField>

              <DetailField
                label={
                  <Label htmlFor="identity-registry">
                    Company registry number
                  </Label>
                }
                labelClassName="sm:min-h-9"
              >
                <Input
                  id="identity-registry"
                  className="h-9 text-sm"
                  value={identity.company_registry_number}
                  onChange={(e) =>
                    setIdentity((v) => ({
                      ...v,
                      company_registry_number: e.target.value,
                    }))
                  }
                />
              </DetailField>
            </CollapsibleCardSection>

            <CollapsibleCardSection
              value="documents"
              trigger="Documents"
              triggerClassName="hover:bg-gray-50"
            >
              <div className="overflow-hidden rounded-[0.33em] border border-blue-100 bg-white">
                {REQUIRED_DOCUMENT_TYPES.map((type) => (
                  <ReviewDocumentCard
                    key={type}
                    type={type}
                    label={reviewDocumentLabel(type)}
                    document={documentByType.get(type)}
                    accepted={!!acceptedDocs[type]}
                    onAcceptedChange={(accepted) =>
                      setAcceptedDocs((v) => ({ ...v, [type]: accepted }))
                    }
                    expiryValue={expiryValues[type] ?? ""}
                    onExpiryChange={(value) =>
                      setExpiryValues((v) => ({ ...v, [type]: value }))
                    }
                    onExpiryValidityChange={(isValid) =>
                      setExpiryValidity((v) => ({ ...v, [type]: isValid }))
                    }
                  />
                ))}
              </div>
            </CollapsibleCardSection>

            {pastEntries.length > 0 && (
              <CollapsibleCardSection
                value="previous-requests"
                trigger={
                  <span className="flex w-full items-center justify-between gap-3 pr-2">
                    <span>Previous requests</span>
                    <span className="bg-gray-100 text-muted-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                      {pastEntries.length}
                    </span>
                  </span>
                }
                triggerClassName="items-center hover:bg-gray-50 [&>svg]:translate-y-0"
                contentClassName="px-5 pb-5"
              >
                <CollapsibleCardGroup
                  type="single"
                  collapsible
                  variant="separate"
                  className="space-y-3"
                >
                  {pastEntries.map((entry) => (
                    <CollapsibleCardSection
                      key={entry.id}
                      value={entry.id}
                      triggerClassName="items-center px-4 py-3.5 [&>svg]:translate-y-0"
                      contentClassName="border-t border-gray-200 px-4 pt-4 pb-4"
                      trigger={
                        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 pr-2 text-left">
                          <ReviewStatusBadge status={entry.status} />
                          <span className="text-sm font-semibold text-gray-900">
                            {formatDateWithoutTime(entry.created_at)}
                          </span>
                        </span>
                      }
                    >
                      <PastReviewContent entry={entry} />
                    </CollapsibleCardSection>
                  ))}
                </CollapsibleCardGroup>
              </CollapsibleCardSection>
            )}
          </CollapsibleCardGroup>

          <div className="flex justify-end gap-3">
            <Button
              scheme="destructive"
              disabled={reject.isPending}
              onClick={openRejectSummary}
            >
              <X /> Reject{notAcceptedCount > 0 ? ` (${notAcceptedCount})` : ""}
            </Button>
            <Button
              scheme="supportive"
              disabled={approve.isPending || !canApprove}
              onClick={openApproveSummary}
            >
              {approve.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check />
              )}
              Approve
            </Button>
          </div>
        </div>

        <Tabs
          defaultValue={REQUIRED_DOCUMENT_TYPES[0]}
          className="min-w-0 gap-0 border-t border-gray-200 lg:h-full lg:min-h-0 lg:overflow-hidden lg:border-t-0"
        >
          <TabsList className="h-auto max-w-full shrink-0 justify-start overflow-x-auto rounded-none border-0 border-b border-gray-200 bg-transparent">
            {REQUIRED_DOCUMENT_TYPES.map((type) => {
              const doc = documentByType.get(type);
              return (
                <TabsTrigger
                  key={type}
                  value={type}
                  className="group h-12 shrink-0 border-0 border-b-2 border-transparent bg-transparent! px-4 opacity-100 hover:bg-transparent! data-[state=active]:border-primary data-[state=active]:shadow-none [&>div]:bg-transparent! [&>div]:p-0"
                >
                  {reviewDocumentLabel(type)}
                  {!doc && (
                    <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
                      Missing
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          {REQUIRED_DOCUMENT_TYPES.map((type) => {
            const doc = documentByType.get(type);
            return (
              <TabsContent key={type} value={type} className="min-h-0">
                {doc?.url ? (
                  <DocumentPreviewPane
                    url={doc.url}
                    filename={doc.filename}
                    label={reviewDocumentLabel(type)}
                    zoomStorageKey="iom-admin-review-preview-zoom"
                  />
                ) : (
                  <div className="text-muted-foreground flex h-[70vh] min-h-[400px] items-center justify-center border-l border-gray-200 bg-slate-100 px-6 text-center text-sm lg:h-full">
                    {doc
                      ? "Preview unavailable for this file."
                      : "Not included with this request."}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>
    </PageContainer>
  );
}
