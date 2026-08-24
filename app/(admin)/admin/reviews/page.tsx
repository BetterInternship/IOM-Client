"use client";
import { useRouter } from "next/navigation";
import { useAdminControllerCompanyReviewQueue } from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import {
  ResourceTable,
  type ResourceTableColumn,
} from "@/components/ui/resource-table";
import { Skeleton } from "@/components/ui/skeleton";
import { useResourceTable } from "@/components/ui/use-resource-table";
import { formatTimeElapsed } from "@/lib/utils";

interface ReviewRow {
  id: string;
  company_id: string;
  created_at: string;
  company: {
    id: string;
    registered_name: string;
    email: string;
    company_type: string | null;
  } | null;
}

const columns: Array<ResourceTableColumn<ReviewRow>> = [
  {
    id: "company",
    header: "Company",
    width: "w-[70%]",
    getSortValue: (review) => review.company?.email ?? "",
    render: (review) => (
      <p className="truncate font-medium text-gray-900">
        {review.company?.email ?? "No account email"}
      </p>
    ),
  },
  {
    id: "submitted",
    header: "Submitted",
    width: "w-[30%]",
    getSortValue: (review) => review.created_at,
    render: (review) => (
      <span className="text-muted-foreground">
        {formatTimeElapsed(review.created_at)}
      </span>
    ),
  },
];

export default function AdminReviewsPage() {
  const router = useRouter();

  const { data, isLoading } = useAdminControllerCompanyReviewQueue({
    query: { refetchInterval: 30_000 },
  });

  const reviews = (data?.reviews ?? []) as unknown as ReviewRow[];
  const table = useResourceTable({
    data: reviews,
    getRowId: (review) => review.id,
    columns,
    search: {
      placeholder: "Search companies...",
      ariaLabel: "Search company reviews",
      matches: (review, query) =>
        (review.company?.email ?? "").toLowerCase().includes(query) ||
        (review.company?.registered_name ?? "").toLowerCase().includes(query) ||
        review.created_at.toLowerCase().includes(query),
    },
    sort: { initialColumn: "submitted", initialDirection: "desc" },
    pagination: { pageSize: 20, pageSizeOptions: [10, 20, 50] },
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Company Reviews"
        description="Verify companies before they can request MOAs from universities."
      />

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <ResourceTable
          table={table}
          renderMobileRow={(review) => (
            <article
              className="cursor-pointer px-4 py-4"
              onClick={() =>
                router.push(`/companies/${review.company_id}/review`)
              }
            >
              <p className="font-semibold text-gray-900">
                {review.company?.email ?? "No account email"}
              </p>
              <p className="text-muted-foreground mt-3 text-xs">
                Submitted {formatTimeElapsed(review.created_at)}
              </p>
            </article>
          )}
          emptyState={{ title: "No company reviews" }}
          noResultsState={{ title: "No reviews match your search" }}
          rowLabelSingular="review"
          rowLabelPlural="reviews"
          onRowClick={(r) => router.push(`/companies/${r.company_id}/review`)}
        />
      )}
    </PageContainer>
  );
}
