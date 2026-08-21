"use client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useCompanyProfile } from "@/app/providers/company-profile.provider";
import {
  getCompanyControllerListMoaRequestsQueryKey,
  useCompanyControllerCancelMoaRequest,
  useCompanyControllerListMoaRequests,
  type CompanyMoaRequestDto,
} from "@/app/api";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PartnershipStatusBadge } from "@/components/partnership-status-badge";
import { useIomModalRegistry } from "@/components/modal-registry";
import { formatDateWithoutTime } from "@/lib/utils";
import { X } from "lucide-react";

const IN_FLIGHT_STATUSES = ["awaiting_signature", "awaiting_verification"];
// issued leaves the page for Partners → the university; a fire-time failure
// is silent by decision — the row simply never appears (flow spec §10).
const HISTORY_STATUSES = ["cancelled", "expired"];

const STATUS_BADGE: Partial<Record<CompanyMoaRequestDto["status"], { status: string; label: string }>> = {
  awaiting_signature: { status: "pending", label: "Waiting for signature" },
  awaiting_verification: { status: "pending", label: "Pending verification" },
  cancelled: { status: "cancelled", label: "Cancelled" },
  expired: { status: "expired", label: "Expired" },
};

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
  const badge = STATUS_BADGE[request.status];
  if (!badge) return null;
  const university = request.university;
  const inFlight = IN_FLIGHT_STATUSES.includes(request.status);

  return (
    <Card className="grid gap-4 border-gray-200 bg-white p-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600">
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
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">
              {university?.registered_name ?? "Unknown university"}
            </h2>
            <PartnershipStatusBadge status={badge.status} label={badge.label} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm">
            {request.template?.name ?? "MOA"}
            {requestSubtitle(request) ? ` · ${requestSubtitle(request)}` : ""}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Requested {formatDateWithoutTime(request.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 md:justify-self-end">
        {inFlight && (
          <Button
            variant="outline"
            scheme="destructive"
            size="sm"
            disabled={isCancelling}
            onClick={onCancel}
          >
            <X /> Cancel
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function CompanyRequestsPage() {
  const { company, isLoading } = useCompanyProfile();
  const queryClient = useQueryClient();
  const { confirmAction } = useIomModalRegistry();

  const { data, isLoading: requestsLoading } = useCompanyControllerListMoaRequests({
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
  const inFlight = allRequests.filter((r) => IN_FLIGHT_STATUSES.includes(r.status));
  const history = allRequests.filter((r) => HISTORY_STATUSES.includes(r.status));
  const requests = [...inFlight, ...history];

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="MOA Requests"
        description="Requests you've sent to universities, in flight and past."
      />

      {requestsLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : requests.length === 0 ? (
        <EmptyState
          title="No MOA requests yet"
          description="Requests you send from the Partners page will show up here."
        />
      ) : (
        <div className="space-y-8">
          {inFlight.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-gray-900">In flight</h2>
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
