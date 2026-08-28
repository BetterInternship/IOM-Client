"use client";

import type { ReactNode } from "react";
import { ArrowRight, Clock3, MessageCircleQuestion } from "lucide-react";

import type { CompanyUniversityDirectoryItemDto } from "@/app/api";
import { cn } from "@/lib/utils";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function universityInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function UniversityLogo({
  university,
  compact = false,
}: {
  university: CompanyUniversityDirectoryItemDto;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-sm font-semibold text-gray-600"
          : "flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[0.33em] border border-gray-200 bg-gray-50 text-lg font-semibold text-gray-600 sm:h-20 sm:w-20"
      }
    >
      {university.logo_url ? (
        // University logos are user-uploaded and served from signed external URLs.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={university.logo_url}
          alt={`${university.registered_name} logo`}
          className={
            compact
              ? "h-full w-full object-contain p-1.5"
              : "h-full w-full object-contain p-2"
          }
        />
      ) : (
        <span aria-hidden="true">
          {universityInitials(university.registered_name)}
        </span>
      )}
    </div>
  );
}

function InstantApprovalBadge() {
  return (
    <div className="bg-supportive text-supportive-foreground inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold">
      <span>Instant Approval</span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Learn what instant approval means"
            className="cursor-help rounded-full text-white focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:outline-none"
            onClick={(event) => event.stopPropagation()}
          >
            <MessageCircleQuestion className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          sideOffset={8}
          className="max-w-64 bg-gray-900 px-3 py-2 leading-5 text-white shadow-sm"
          arrowClassName="fill-gray-900"
        >
          MOAs are approved instantly upon submission.
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

function UniversitiesTableSkeleton({
  toolbarStart,
}: {
  toolbarStart?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {toolbarStart}
        <Skeleton className="h-11 w-full max-w-xl" />
      </div>
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}

/** In-flight status text for a university that already has a request (flow spec §7). */
export type InFlightRequestStatus =
  | "awaiting_signature"
  | "awaiting_verification";

const IN_FLIGHT_LABELS: Record<InFlightRequestStatus, { description: string }> =
  {
    awaiting_signature: { description: "Awaiting signature" },
    awaiting_verification: { description: "Pending verification" },
  };

function InFlightBadge({ status }: { status: InFlightRequestStatus }) {
  const { description } = IN_FLIGHT_LABELS[status];

  return (
    <div className="inline-flex w-52 items-center gap-2 rounded-[0.33em] border border-gray-200 bg-gray-50 px-3 py-2 text-left">
      <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full">
        <Clock3 className="size-4" aria-hidden="true" />
      </span>
      <span>
        <span className="block text-sm font-medium text-gray-900">
          Request sent
        </span>
        <span className="text-muted-foreground block text-xs">
          {description}
        </span>
      </span>
    </div>
  );
}

/** Documents incomplete — buttons disabled with a tooltip (flow spec §7). */
function LockedRequestButton({ mobile = false }: { mobile?: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn("inline-flex cursor-not-allowed", mobile && "w-full")}
        >
          <Button
            size="md"
            disabled
            className={cn("justify-center", mobile ? "w-full" : "w-52")}
          >
            Request MOA
            <ArrowRight />
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        className="max-w-64 bg-gray-900 px-3 py-2 leading-5 text-white shadow-sm"
        arrowClassName="fill-gray-900"
      >
        Upload your documents to request MOAs.
      </TooltipContent>
    </Tooltip>
  );
}

export function RequestableUniversitiesTable({
  universities,
  isLoading,
  onRequest,
  inFlightByUniversityId,
  hasActiveMoaByUniversityId,
  locked = false,
  toolbarStart,
}: {
  universities: CompanyUniversityDirectoryItemDto[];
  isLoading: boolean;
  onRequest: (university: CompanyUniversityDirectoryItemDto) => void;
  /** University id -> in-flight request status, if any (flow spec §7). */
  inFlightByUniversityId?: Record<string, InFlightRequestStatus>;
  /** University id -> whether the company already has an active MOA. */
  hasActiveMoaByUniversityId?: Record<string, boolean>;
  /** Documents incomplete — every button disabled with a tooltip (flow spec §7). */
  locked?: boolean;
  toolbarStart?: ReactNode;
}) {
  const inFlightFor = (universityId: string) =>
    inFlightByUniversityId?.[universityId];
  const hasActiveMoaFor = (universityId: string) =>
    hasActiveMoaByUniversityId?.[universityId];
  const canRequestRow = (universityId: string) =>
    !locked && !inFlightFor(universityId) && !hasActiveMoaFor(universityId);

  const columns: Array<ResourceTableColumn<CompanyUniversityDirectoryItemDto>> =
    [
      {
        id: "university",
        header: "University",
        width: "w-[52%]",
        getSortValue: (university) =>
          `${hasActiveMoaFor(university.id) ? "2" : inFlightFor(university.id) ? "1" : "0"}-${university.registered_name}`,
        render: (university) => (
          <div className="flex min-w-0 items-center gap-4">
            <UniversityLogo university={university} compact />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">
                {university.registered_name}
              </p>
              <p className="text-muted-foreground mt-1 truncate text-sm leading-5">
                {university.address || "Address not provided"}
              </p>
            </div>
          </div>
        ),
      },
      {
        id: "approval",
        header: "Approval",
        width: "w-[25%]",
        align: "center",
        sortable: false,
        render: () => <InstantApprovalBadge />,
      },
      {
        id: "action",
        header: <span className="sr-only">Action</span>,
        width: "w-[23%]",
        align: "right",
        sortable: false,
        render: (university) => {
          const inFlight = inFlightFor(university.id);
          if (inFlight) return <InFlightBadge status={inFlight} />;
          if (hasActiveMoaFor(university.id)) return null;
          if (locked) return <LockedRequestButton />;
          return (
            <Button
              size="md"
              className="w-52 justify-center"
              onClick={(event) => {
                event.stopPropagation();
                onRequest(university);
              }}
            >
              Request MOA
              <ArrowRight />
            </Button>
          );
        },
      },
    ];

  const table = useResourceTable({
    data: universities,
    getRowId: (university) => university.id,
    columns,
    search: {
      placeholder: "Search universities...",
      ariaLabel: "Search universities",
      matches: (university, query) =>
        university.registered_name.toLowerCase().includes(query) ||
        !!university.address?.toLowerCase().includes(query),
    },
    sort: { initialColumn: "university" },
    pagination: { pageSize: 20 },
  });

  if (isLoading)
    return <UniversitiesTableSkeleton toolbarStart={toolbarStart} />;

  return (
    <ResourceTable
      table={table}
      toolbarStart={toolbarStart}
      onRowClick={(university) => {
        if (canRequestRow(university.id)) onRequest(university);
      }}
      renderMobileRow={(university) => {
        const inFlight = inFlightFor(university.id);
        const hasActiveMoa = hasActiveMoaFor(university.id);
        const clickable = canRequestRow(university.id);
        return (
          <article
            className={cn(
              "group flex flex-col items-start gap-4 rounded-[0.33em] border border-gray-200 bg-white p-5 text-left transition-colors lg:flex-row lg:items-center lg:gap-6 lg:p-6",
              clickable
                ? "cursor-pointer hover:border-gray-300 hover:bg-gray-50/40"
                : "cursor-default",
            )}
            onClick={() => clickable && onRequest(university)}
          >
            <div className="flex min-w-0 flex-col items-start gap-3 lg:flex-1 lg:flex-row lg:items-center lg:gap-5">
              <UniversityLogo university={university} />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-gray-900 sm:text-lg">
                  {university.registered_name}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  {university.address || "Address not provided"}
                </p>
              </div>
            </div>

            <div className="flex items-center lg:justify-center">
              <InstantApprovalBadge />
            </div>

            <div className="flex w-full items-center lg:w-auto lg:py-3 lg:pl-6">
              {inFlight ? (
                <InFlightBadge status={inFlight} />
              ) : hasActiveMoa ? null : locked ? (
                <LockedRequestButton mobile />
              ) : (
                <Button
                  size="md"
                  className="w-full lg:w-auto"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRequest(university);
                  }}
                >
                  Request MOA
                  <ArrowRight />
                </Button>
              )}
            </div>
          </article>
        );
      }}
      emptyState={{
        title: "No universities available",
        description:
          "There are no universities available for instant MOA requests right now.",
      }}
      noResultsState={{
        title: "No universities found",
        description: "Try searching by university name or address.",
      }}
      rowLabelSingular="university"
      rowLabelPlural="universities"
    />
  );
}
