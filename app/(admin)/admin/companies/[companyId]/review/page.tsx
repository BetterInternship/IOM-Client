"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useModal } from "@/app/providers/modal-provider";
import { REQUIRED_DOCUMENT_TYPES, documentLabel } from "@/lib/document-types";
import { cn, formatDateWithoutTime } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  CircleCheck,
  Eye,
  GripVertical,
  Loader2,
  X,
} from "lucide-react";

interface ReviewDoc {
  type: string;
  filename: string;
  url: string | null;
}

interface DocumentPreviewSelection {
  document: ReviewDoc;
  label: string;
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

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const yearsFromToday = (years: number) => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + years);
  return toDateInputValue(date);
};

// unknown-valued fields come back from generic Record<string, X> DTOs the
// OpenAPI codegen can't narrow further (see admin/companies/[companyId]
// /page.tsx for the same pattern) — render defensively.
const asDisplayString = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

function DocumentsReadOnly({
  entry,
  openPreview,
}: {
  entry: AdminReviewHistoryItemDto;
  openPreview: (url: string, title: string) => void;
}) {
  const documents = entry.documents ?? [];
  if (documents.length === 0) return null;
  return (
    <div className="divide-y divide-gray-100 overflow-hidden rounded-[0.33em] border border-gray-200 bg-white">
      {documents.map((doc) => {
        const label = documentLabel(doc.type);
        return (
          <button
            key={doc.type}
            type="button"
            className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 disabled:cursor-default disabled:opacity-50"
            onClick={() => doc.url && openPreview(doc.url, label)}
            disabled={!doc.url}
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
          </button>
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

// Documents — one card each: preview, an optional expiry date, and a reject
// flag with a per-document reason (flow spec §5).
function ReviewDocumentCard({
  type,
  document,
  onOpenDocument,
  expiryValue,
  onExpiryChange,
  onExpiryValidityChange,
  rejected,
  onRejectedChange,
  reason,
  onReasonChange,
}: {
  type: string;
  document: ReviewDoc | undefined;
  onOpenDocument: (document: ReviewDoc, label: string) => void;
  expiryValue: string;
  onExpiryChange: (value: string) => void;
  onExpiryValidityChange: (isValid: boolean) => void;
  rejected: boolean;
  onRejectedChange: (rejected: boolean) => void;
  reason: string;
  onReasonChange: (reason: string) => void;
}) {
  const label = documentLabel(type);

  return (
    <div className="space-y-3 border-b border-gray-100 px-4 py-4 last:border-b-0">
      <button
        type="button"
        disabled={!document?.url}
        onClick={() => document?.url && onOpenDocument(document, label)}
        className="flex w-full items-center gap-3 rounded-[0.16em] text-left enabled:cursor-pointer enabled:hover:bg-gray-50 disabled:cursor-default"
      >
        {document ? (
          <CircleCheck className="text-supportive shrink-0" />
        ) : (
          <CircleAlert className="text-warning shrink-0" />
        )}
        <div className="min-w-0 flex-1 p-1">
          <p className="text-sm font-medium text-gray-800">{label}</p>
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {document ? document.filename : "Not included with this request"}
          </p>
        </div>
        {document && (
          <span className="text-primary text-xs font-medium">
            {document.url ? "View" : "Unavailable"}
          </span>
        )}
      </button>

      {document && (
        <div className="space-y-3 pl-9">
          <div className="flex items-center justify-between gap-3">
            <Label
              htmlFor={`reject-${type}`}
              className="text-sm font-normal text-gray-700"
            >
              Reject this document
            </Label>
            <Switch
              id={`reject-${type}`}
              checked={rejected}
              onCheckedChange={onRejectedChange}
            />
          </div>

          {rejected ? (
            <Textarea
              rows={2}
              placeholder="Reason (required — emailed to the company)"
              value={reason}
              onChange={(event) => onReasonChange(event.target.value)}
            />
          ) : (
            <DetailField
              label={
                <Label htmlFor={`expiry-${type}`}>
                  Expires on (blank = perpetual)
                </Label>
              }
              labelClassName="sm:min-h-9"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <DatePicker
                  id={`expiry-${type}`}
                  className="h-9 text-sm"
                  value={expiryValue}
                  onChange={onExpiryChange}
                  onValidityChange={onExpiryValidityChange}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onExpiryChange(yearsFromToday(1));
                      onExpiryValidityChange(true);
                    }}
                  >
                    +1 year
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onExpiryChange(yearsFromToday(3));
                      onExpiryValidityChange(true);
                    }}
                  >
                    +3 years
                  </Button>
                </div>
              </div>
            </DetailField>
          )}
        </div>
      )}
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

function PastReviewContent({
  entry,
  openPreview,
}: {
  entry: AdminReviewHistoryItemDto;
  openPreview: (url: string, title: string) => void;
}) {
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
          <DocumentsReadOnly entry={entry} openPreview={openPreview} />
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
  documentRejections,
  onReject,
}: {
  companyName: string;
  documentRejections: Record<string, string>;
  onReject: (note: string) => Promise<unknown>;
}) {
  const { closeModal } = useModal();
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rejectCompany = async () => {
    setIsSubmitting(true);
    try {
      await onReject(note);
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
      <div className="overflow-hidden rounded-[0.33em] border border-gray-200">
        {Object.entries(documentRejections).map(([type, reason]) => (
          <div key={type} className="border-b border-gray-100 px-4 py-2.5 last:border-b-0">
            <p className="text-sm font-medium text-gray-900">{documentLabel(type)}</p>
            <p className="text-muted-foreground text-sm">{reason}</p>
          </div>
        ))}
      </div>
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
          disabled={isSubmitting}
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
  const [rejectedDocs, setRejectedDocs] = useState<Record<string, boolean>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [documentPreview, setDocumentPreview] =
    useState<DocumentPreviewSelection | null>(null);
  const [previewWidth, setPreviewWidth] = useState(50);
  const prefetchedReviewId = useRef<string | null>(null);

  useEffect(() => {
    const savedWidth = Number(
      window.localStorage.getItem("iom-admin-review-preview-width"),
    );
    if (savedWidth >= 30 && savedWidth <= 70) setPreviewWidth(savedWidth);
  }, []);

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
        setRejectedDocs({});
        setRejectReasons({});
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
    setRejectedDocs({});
    setRejectReasons({});
  }, [data, openEntry]);

  const documentByType = useMemo(() => {
    const map = new Map<string, ReviewDoc>();
    for (const doc of openEntry?.documents ?? []) map.set(doc.type, doc);
    return map;
  }, [openEntry]);

  const rejectedCount = Object.values(rejectedDocs).filter(Boolean).length;
  const canReject =
    rejectedCount > 0 &&
    Object.entries(rejectedDocs).every(
      ([type, isRejected]) => !isRejected || !!rejectReasons[type]?.trim(),
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
    rejectedCount === 0 &&
    REQUIRED_DOCUMENT_TYPES.every(expiryOk);

  const updatePreviewWidth = (nextWidth: number) => {
    const clampedWidth = Math.min(70, Math.max(30, nextWidth));
    setPreviewWidth(clampedWidth);
    window.localStorage.setItem(
      "iom-admin-review-preview-width",
      String(clampedWidth),
    );
  };

  const resizePreview = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const bounds = event.currentTarget.parentElement?.getBoundingClientRect();
    if (!bounds) return;
    updatePreviewWidth(((bounds.right - event.clientX) / bounds.width) * 100);
  };

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
    const documentRejections = Object.fromEntries(
      Object.entries(rejectedDocs)
        .filter(([, isRejected]) => isRejected)
        .map(([type]) => [type, rejectReasons[type]?.trim() ?? ""]),
    );
    openModal(
      "reject-company",
      <RejectCompanyForm
        companyName={identity.registered_name || data?.company.email || "This company"}
        documentRejections={documentRejections}
        onReject={(note) =>
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
    <PageContainer
      className={cn(
        documentPreview ? "max-w-none py-0 pr-0 sm:pr-0" : "max-w-3xl py-0",
      )}
    >
      <div
        className={cn(
          "relative min-h-[calc(100dvh-5rem-1px)] lg:h-[calc(100dvh-5rem-1px)] lg:min-h-0 lg:overflow-hidden",
          documentPreview && "lg:grid",
        )}
        style={
          documentPreview
            ? { gridTemplateColumns: `${100 - previewWidth}% ${previewWidth}%` }
            : undefined
        }
      >
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
                    document={documentByType.get(type)}
                    onOpenDocument={(document, label) =>
                      setDocumentPreview({ document, label })
                    }
                    expiryValue={expiryValues[type] ?? ""}
                    onExpiryChange={(value) =>
                      setExpiryValues((v) => ({ ...v, [type]: value }))
                    }
                    onExpiryValidityChange={(isValid) =>
                      setExpiryValidity((v) => ({ ...v, [type]: isValid }))
                    }
                    rejected={!!rejectedDocs[type]}
                    onRejectedChange={(rejected) =>
                      setRejectedDocs((v) => ({ ...v, [type]: rejected }))
                    }
                    reason={rejectReasons[type] ?? ""}
                    onReasonChange={(reason) =>
                      setRejectReasons((v) => ({ ...v, [type]: reason }))
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
                      <PastReviewContent
                        entry={entry}
                        openPreview={(url, title) => {
                          const document = (entry.documents ?? []).find(
                            (item) => item.url === url,
                          );
                          if (document) {
                            setDocumentPreview({ document, label: title });
                          }
                        }}
                      />
                    </CollapsibleCardSection>
                  ))}
                </CollapsibleCardGroup>
              </CollapsibleCardSection>
            )}
          </CollapsibleCardGroup>

          <div className="flex justify-end gap-3">
            <Button
              scheme="destructive"
              disabled={!canReject || reject.isPending}
              onClick={openRejectSummary}
            >
              <X /> Reject{rejectedCount > 0 ? ` (${rejectedCount})` : ""}
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

        {documentPreview && (
          <>
            <div
              role="separator"
              aria-label="Resize document preview pane"
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
                  onClick={() => setDocumentPreview(null)}
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
            <DocumentPreviewPane
              url={documentPreview.document.url!}
              filename={documentPreview.document.filename}
              label={documentPreview.label}
              zoomStorageKey="iom-admin-review-preview-zoom"
            />
          </>
        )}
      </div>
    </PageContainer>
  );
}
