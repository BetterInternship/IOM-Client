"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import {
  getCompanyControllerListMoaRequestsQueryKey,
  useCompanyControllerCancelMoaRequest,
  useCompanyControllerListMoaRequests,
  type CompanyMoaRequestDto,
} from "@/app/api";
import {
  PageContainer,
  PageHeader,
  EmptyState,
} from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { useIomModalRegistry } from "@/components/modal-registry";
import { useModal } from "@/app/providers/modal-provider";
import { formatDateWithoutTime } from "@/lib/utils";
import { CheckCircle2, ChevronDown, Clock4, Mail, X } from "lucide-react";

const IN_FLIGHT_STATUSES = ["awaiting_signature", "awaiting_verification"];
// issued leaves the page for Partners → the university; a fire-time failure
// is silent by decision — the row simply never appears (flow spec §10).
const HISTORY_STATUSES = ["cancelled", "expired"];

const STATUS_BADGE: Partial<
  Record<CompanyMoaRequestDto["status"], { status: string; label: string }>
> = {
  awaiting_signature: { status: "pending", label: "Waiting for signature" },
  awaiting_verification: { status: "pending", label: "Pending verification" },
  cancelled: { status: "cancelled", label: "Cancelled" },
  expired: { status: "expired", label: "Expired" },
};

type InviteResult = "signed" | "submitted" | "signing-request";

function InviteResultContent({
  result,
  onClose,
}: {
  result: InviteResult;
  onClose: () => void;
}) {
  const details =
    result === "signed"
      ? {
          icon: CheckCircle2,
          title: "MOA signed",
          description:
            "The agreement is now active and available from Partners.",
        }
      : result === "signing-request"
        ? {
            icon: Mail,
            title: "Signing request sent",
            description:
              "We emailed the signatory. This request will remain here until it is signed.",
          }
        : {
            icon: Clock4,
            title: "Request submitted",
            description:
              "Your company verification is pending. The MOA will issue automatically once it is approved.",
          };
  const Icon = details.icon;

  return (
    <div className="text-center">
      <span className="bg-supportive/10 text-supportive mx-auto flex size-16 items-center justify-center rounded-full">
        <Icon className="size-8" aria-hidden="true" />
      </span>
      <h2 className="mt-5 text-xl font-semibold tracking-tight text-gray-950">
        {details.title}
      </h2>
      <p className="text-muted-foreground mx-auto mt-2 max-w-sm text-sm leading-6">
        {details.description}
      </p>
      <Button className="mt-6 w-full" onClick={onClose}>
        Continue
      </Button>
    </div>
  );
}

function universityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function requestSubtitle(request: CompanyMoaRequestDto): string {
  if (request.status === "expired") {
    return "This signing link expired — request again from the Partners page.";
  }
  if (request.signatory_email) {
    if (request.status === "awaiting_signature") {
      return `Sent to ${request.signatory_email} to sign`;
    }
    return request.auto_signed
      ? `Auto-signed by ${request.signatory_name ?? request.signatory_email}`
      : `Signed by ${request.signatory_name ?? request.signatory_email}`;
  }
  if (request.signatory_name) {
    return `Signed by ${request.signatory_name}${
      request.signatory_title ? `, ${request.signatory_title}` : ""
    }`;
  }
  return "";
}

function RequestRow({
  request,
  onCancel,
  isCancelling,
}: {
  request: CompanyMoaRequestDto;
  onCancel: () => void;
  isCancelling: boolean;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const badge = STATUS_BADGE[request.status];
  if (!badge) return null;
  const university = request.university;
  const inFlight = IN_FLIGHT_STATUSES.includes(request.status);
  const subtitle = requestSubtitle(request);
  const toggleDetails = () => setDetailsOpen((open) => !open);

  return (
    <Card className="gap-0 overflow-hidden border-gray-200 bg-white py-0 transition-colors hover:border-gray-300 hover:bg-gray-50/40">
      <button
        type="button"
        className="grid w-full cursor-pointer gap-4 p-5 text-left md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
        onClick={toggleDetails}
        aria-expanded={detailsOpen}
      >
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-lg font-semibold text-gray-600">
            {university?.logo_url ? (
              // University logos are user-uploaded external assets.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={university.logo_url}
                alt={`${university.registered_name} logo`}
                className="h-full w-full object-contain p-1.5"
              />
            ) : (
              <span aria-hidden="true">
                {universityInitials(university?.registered_name ?? "?")}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
              {university?.registered_name ?? "Unknown university"}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 md:justify-self-end">
          <PartnershipStatusBadge status={badge.status} label={badge.label} />
          <ChevronDown
            className={`text-muted-foreground size-5 transition-transform ${detailsOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </div>
      </button>

      {detailsOpen && (
        <div className="border-t border-gray-200 bg-gray-50/50 px-5 py-4">
          <div className="grid gap-4 text-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <dl className="contents">
              <div className="space-y-1">
                <dt className="text-muted-foreground text-xs">Template</dt>
                <dd className="font-medium text-gray-900">
                  {request.template?.name ?? "MOA"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-xs">
                  Signing status
                </dt>
                <dd className="text-gray-900">
                  {subtitle || "Not yet signed"}
                </dd>
              </div>
              <div className="space-y-1">
                <dt className="text-muted-foreground text-xs">Requested</dt>
                <dd className="text-gray-900">
                  {formatDateWithoutTime(request.created_at)}
                </dd>
              </div>
            </dl>
            {inFlight && (
              <div className="flex sm:justify-end">
                <Button
                  variant="outline"
                  scheme="destructive"
                  size="sm"
                  disabled={isCancelling}
                  onClick={(event) => {
                    event.stopPropagation();
                    onCancel();
                  }}
                >
                  <X /> Cancel request
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

export default function CompanyRequestsPage() {
  const router = useRouter();
  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();
  const { confirmAction } = useIomModalRegistry();
  const { openModal, closeModal } = useModal();
  const hasShownInviteResult = useRef(false);

  useEffect(() => {
    if (hasShownInviteResult.current) return;

    const result = new URLSearchParams(window.location.search).get(
      "invite_result",
    );
    if (
      result !== "signed" &&
      result !== "submitted" &&
      result !== "signing-request"
    ) {
      return;
    }

    hasShownInviteResult.current = true;
    openModal(
      "invite-request-result",
      <InviteResultContent
        result={result}
        onClose={() => closeModal("invite-request-result")}
      />,
      {
        hasClose: false,
        panelClassName: "!w-full sm:!max-w-md",
        contentClassName: "px-6 pb-6 pt-5 sm:px-8 sm:pb-7",
        showHeaderDivider: false,
      },
    );
    router.replace("/company/requests");
  }, [closeModal, openModal, router]);

  const { data, isLoading: requestsLoading } =
    useCompanyControllerListMoaRequests({
      query: { enabled: !!company },
    });

  const cancel = useCompanyControllerCancelMoaRequest({
    mutation: {
      onSuccess: () => {
        toast.success("Request cancelled");
        confirmAction.close();
        queryClient.invalidateQueries({
          queryKey: getCompanyControllerListMoaRequestsQueryKey(),
        });
      },
      onError: (e: Error) => toast.error(e.message),
    },
  });

  const requestCancel = (request: CompanyMoaRequestDto) => {
    confirmAction.open({
      title: `Cancel this request?`,
      description: `Your request to ${request.university?.registered_name ?? "this university"} will be withdrawn. You can request again later.`,
      confirmLabel: "Cancel request",
      onConfirm: async () => {
        await cancel.mutateAsync({ requestId: request.id });
      },
      isPending: cancel.isPending,
      tone: "warning",
    });
  };

  if (isLoading) {
    return (
      <PageContainer className="space-y-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-24 w-full" />
      </PageContainer>
    );
  }
  if (!company) return null;

  const allRequests = data?.requests ?? [];
  const inFlight = allRequests.filter((r) =>
    IN_FLIGHT_STATUSES.includes(r.status),
  );
  const history = allRequests.filter((r) =>
    HISTORY_STATUSES.includes(r.status),
  );
  const requests = [...inFlight, ...history];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Outgoing MOA Requests"
        description="Track the status of MOA requests sent to universities."
      />

      {requestsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No outgoing MOA requests yet"
          description="Requests you send from the Partners page will show up here."
        />
      ) : (
        <div className="space-y-8">
          {inFlight.length > 0 && (
            <div className="space-y-3">
              {inFlight.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  onCancel={() => requestCancel(request)}
                  isCancelling={cancel.isPending}
                />
              ))}
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">History</h2>
              <div className="space-y-3">
                {history.map((request) => (
                  <RequestRow
                    key={request.id}
                    request={request}
                    onCancel={() => requestCancel(request)}
                    isCancelling={cancel.isPending}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
