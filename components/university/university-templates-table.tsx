"use client";

import { Eye, EyeOff } from "lucide-react";

import { useIomModalRegistry } from "@/components/modal-registry";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export interface TemplateOffer {
  id: string;
  is_available: boolean;
  template: {
    id: string;
    name: string;
    description: string | null;
    term_months: number | null;
    is_deleted: boolean | null;
  };
}

function TemplateAvailability({
  offer,
  isPending,
  onToggle,
}: {
  offer: TemplateOffer;
  isPending: boolean;
  onToggle: (offer: TemplateOffer) => void;
}) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 min-w-24 cursor-pointer items-center justify-center gap-2 rounded-[0.33em] border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        offer.is_available
          ? "border-supportive bg-supportive text-supportive-foreground hover:bg-supportive/90"
          : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50 hover:text-gray-900"
      }`}
      onClick={() => onToggle(offer)}
      disabled={isPending}
    >
      {offer.is_available ? (
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {offer.is_available ? "Offered" : "Hidden"}
    </button>
  );
}

function TemplatesTableSkeleton() {
  return (
    <div className="space-y-1">
      {[0, 1, 2].map((index) => (
        <Skeleton key={index} className="h-12 w-full" />
      ))}
    </div>
  );
}

export function UniversityTemplatesTable({
  offers,
  isLoading,
  isPending,
  onToggle,
}: {
  offers: TemplateOffer[];
  isLoading: boolean;
  isPending: boolean;
  onToggle: (templateId: string, isAvailable: boolean) => Promise<unknown>;
}) {
  const { confirmAction, previewTemplate } = useIomModalRegistry();

  const handleToggle = (offer: TemplateOffer) => {
    const isHidingLastOfferedTemplate =
      offer.is_available &&
      offers.filter((currentOffer) => currentOffer.is_available).length === 1;

    confirmAction.open({
      title: isHidingLastOfferedTemplate
        ? "Hide your last offered template?"
        : `${offer.is_available ? "Hide" : "Offer"} this template?`,
      description: isHidingLastOfferedTemplate ? (
        <>
          <strong>This is your last available MOA template.</strong>
          <br />
          <br />
          If you hide it, companies will no longer be able to start new MOA
          requests with your university until you make another template
          available.
        </>
      ) : offer.is_available ? (
        `Companies will no longer be able to request new MOAs using "${offer.template.name}". Existing active MOAs are unaffected.`
      ) : (
        `Companies will be able to request MOAs using "${offer.template.name}".`
      ),
      confirmLabel: isHidingLastOfferedTemplate
        ? "Hide anyway"
        : offer.is_available
          ? "Hide"
          : "Offer",
      tone: isHidingLastOfferedTemplate ? "warning" : "default",
      onConfirm: async () => {
        await onToggle(offer.template.id, !offer.is_available);
      },
      isPending,
    });
  };

  const columns: Array<ResourceTableColumn<TemplateOffer>> = [
    {
      id: "template",
      header: "Template",
      width: "w-[48%]",
      getSortValue: (offer) => offer.template.name,
      render: (offer) => (
        <div>
          <p className="font-medium text-gray-900">{offer.template.name}</p>
          {offer.template.description && (
            <p className="text-muted-foreground mt-0.5 text-xs">
              {offer.template.description}
            </p>
          )}
        </div>
      ),
    },
    {
      id: "term",
      header: "Term",
      width: "w-[18%]",
      getSortValue: (offer) => offer.template.term_months ?? Infinity,
      render: (offer) => (
        <span className="text-muted-foreground">
          {offer.template.term_months == null
            ? "Perpetual"
            : `${offer.template.term_months} months`}
        </span>
      ),
    },
    {
      id: "available",
      header: "Availability",
      width: "w-[18%]",
      sortable: false,
      render: (offer) => (
        <TemplateAvailability
          offer={offer}
          isPending={isPending}
          onToggle={handleToggle}
        />
      ),
    },
    {
      id: "actions",
      header: "Actions",
      width: "w-[16%]",
      sortable: false,
      render: (offer) => (
        <Button
          variant="outline"
          onClick={() => previewTemplate.open(offer.template)}
        >
          <Eye className="mr-1 h-3.5 w-3.5" /> Preview
        </Button>
      ),
    },
  ];

  const table = useResourceTable({
    data: offers,
    getRowId: (offer) => offer.id,
    columns,
    search: {
      placeholder: "Search templates...",
      ariaLabel: "Search templates",
      matches: (offer, query) =>
        offer.template.name.toLowerCase().includes(query),
    },
    sort: { initialColumn: "template", initialDirection: "asc" },
    pagination: { pageSize: 20, pageSizeOptions: [5, 10, 20] },
  });

  if (isLoading) return <TemplatesTableSkeleton />;

  return (
    <ResourceTable
      table={table}
      renderMobileRow={(offer) => (
        <article className="px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-gray-900">
                {offer.template.name}
              </h2>
              {offer.template.description && (
                <p className="text-muted-foreground mt-1 text-sm leading-5">
                  {offer.template.description}
                </p>
              )}
            </div>
            <TemplateAvailability
              offer={offer}
              isPending={isPending}
              onToggle={handleToggle}
            />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
            <p className="text-muted-foreground text-sm">
              <span className="font-medium text-gray-700">Term: </span>
              {offer.template.term_months == null
                ? "Perpetual"
                : `${offer.template.term_months} months`}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => previewTemplate.open(offer.template)}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </Button>
          </div>
        </article>
      )}
      emptyState={{ title: "No results." }}
      noResultsState={{ title: "No results." }}
      rowLabelSingular="template"
      rowLabelPlural="templates"
    />
  );
}
