"use client";

import { ArrowRight, MessageCircleQuestion } from "lucide-react";

import type { CompanyUniversityDirectoryItemDto } from "@/app/api";
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

function UniversitiesTableSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-11 w-full max-w-xl" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-36 w-full" />
    </div>
  );
}

export function RequestableUniversitiesTable({
  universities,
  isLoading,
  onRequest,
}: {
  universities: CompanyUniversityDirectoryItemDto[];
  isLoading: boolean;
  onRequest: (university: CompanyUniversityDirectoryItemDto) => void;
}) {
  const columns: Array<ResourceTableColumn<CompanyUniversityDirectoryItemDto>> =
    [
      {
        id: "university",
        header: "University",
        width: "w-[52%]",
        getSortValue: (university) => university.registered_name,
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
        render: (university) => (
          <Button
            size="md"
            onClick={(event) => {
              event.stopPropagation();
              onRequest(university);
            }}
          >
            Request MOA
            <ArrowRight />
          </Button>
        ),
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

  if (isLoading) return <UniversitiesTableSkeleton />;

  return (
    <ResourceTable
      table={table}
      onRowClick={onRequest}
      renderMobileRow={(university) => (
        <article
          className="group grid cursor-pointer gap-6 rounded-[0.33em] border border-gray-200 bg-white p-6 transition-colors hover:border-gray-300 hover:bg-gray-50/40 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,0.7fr)_auto] lg:items-center"
          onClick={() => onRequest(university)}
        >
          <div className="flex min-w-0 items-center gap-5">
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

          <div className="flex items-center lg:py-3 lg:pl-6">
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
          </div>
        </article>
      )}
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
