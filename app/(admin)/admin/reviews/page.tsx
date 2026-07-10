"use client";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { useAdminControllerCompanyReviewQueue } from "@/app/api";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { formatDateWithoutTime } from "@/lib/utils";

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

const columns: ColumnDef<ReviewRow>[] = [
  {
    id: "company",
    header: "Company",
    accessorFn: (row) => row.company?.registered_name ?? "",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium text-gray-900">
          {row.original.company?.registered_name ?? "Unknown company"}
        </p>
        <p className="text-muted-foreground truncate text-xs">
          {row.original.company?.email}
        </p>
      </div>
    ),
  },
  {
    id: "submitted",
    header: "Submitted",
    accessorFn: (row) => row.created_at,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateWithoutTime(row.original.created_at)}
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
        <DataTable
          id="admin-reviews"
          columns={columns}
          data={reviews}
          searchPlaceholder="Search companies..."
          rowLabelSingular="review"
          rowLabelPlural="reviews"
          onRowClick={(r) => router.push(`/companies/${r.company_id}/review`)}
        />
      )}
    </PageContainer>
  );
}
