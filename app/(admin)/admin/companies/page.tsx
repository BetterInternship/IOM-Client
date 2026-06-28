"use client";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { formatDateWithoutTime } from "@/lib/utils";

interface Company {
  id: string;
  registered_name: string;
  email: string;
  email_verified: boolean | null;
  is_deactivated: boolean | null;
  has_pending_review: boolean;
  is_profile_incomplete: boolean;
  created_at: string;
}

const columns: ColumnDef<Company>[] = [
  {
    id: "name",
    header: "Company",
    accessorFn: (row) => row.registered_name,
    cell: ({ row }) => (
      <div className="flex items-center gap-2 min-w-0">
        <p className="font-medium text-gray-900">{row.original.registered_name}</p>
        {row.original.is_deactivated ? (
          <Badge type="destructive" strength="medium">Deactivated</Badge>
        ) : row.original.has_pending_review ? (
          <Badge type="warning" strength="medium">Pending</Badge>
        ) : row.original.is_profile_incomplete ? (
          <Badge type="default" strength="medium">Incomplete</Badge>
        ) : null}
      </div>
    ),
  },
  {
    id: "email",
    header: "Email",
    accessorFn: (row) => row.email,
    cell: ({ row }) => (
      <span className="text-muted-foreground">{row.original.email}</span>
    ),
  },
  {
    id: "joined",
    header: "Joined",
    accessorFn: (row) => row.created_at,
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {formatDateWithoutTime(row.original.created_at)}
      </span>
    ),
  },
];

export default function AdminCompaniesPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: async () => {
      const res = await preconfiguredAxios.get("/api/admin/companies");
      return res.data.companies as Company[];
    },
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Companies"
        description="All registered companies on the platform."
      />

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-10 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <DataTable
          id="admin-companies"
          columns={columns}
          data={data ?? []}
          searchPlaceholder="Search companies..."
          rowLabelSingular="company"
          rowLabelPlural="companies"
          pageSizes={[10, 25, 50]}
          onRowClick={(company) => router.push(`/admin/companies/${company.id}`)}
        />
      )}
    </PageContainer>
  );
}
