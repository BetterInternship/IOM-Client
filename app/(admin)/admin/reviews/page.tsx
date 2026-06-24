"use client";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { preconfiguredAxios } from "@/app/api/preconfig.axios";
import { PageContainer, PageHeader, EmptyState } from "@/components/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateWithoutTime } from "@/lib/utils";
import { Building2, ChevronRight } from "lucide-react";

interface ReviewRow {
  id: string;
  company_id: string;
  created_at: string;
  company: {
    id: string;
    display_name: string;
    registered_name: string | null;
    rep_email: string;
    company_type: string | null;
  } | null;
}

export default function AdminReviewsPage() {
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-company-reviews"],
    queryFn: () =>
      preconfiguredAxios
        .get("/api/admin/company-reviews")
        .then((r) => r.data.reviews as ReviewRow[]),
    refetchInterval: 30_000,
  });

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        title="Company Reviews"
        description="Verify companies before they can request MOAs from universities."
      />

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          title="No companies awaiting review"
          description="New verification requests will appear here when companies complete their material."
        />
      ) : (
        <div className="space-y-2.5">
          {data.map((r) => (
            <Card
              key={r.id}
              role="button"
              onClick={() => router.push(`/companies/${r.company_id}/review`)}
              className="flex-row items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-gray-50 cursor-pointer"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="bg-muted text-muted-foreground flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[0.33em]">
                  <Building2 className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {r.company?.display_name ?? "Unknown company"}
                    </p>
                    <Badge type="warning" strength="medium">
                      Pending
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {r.company?.rep_email}
                    {r.company?.company_type && ` · ${r.company.company_type.replace(/_/g, " ")}`}
                  </p>
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-3">
                <span className="text-muted-foreground text-xs">
                  {formatDateWithoutTime(r.created_at)}
                </span>
                <ChevronRight className="text-muted-foreground h-4 w-4" />
              </div>
            </Card>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
